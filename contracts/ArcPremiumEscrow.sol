// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract ArcPremiumEscrow is Ownable, ReentrancyGuard {
    enum OrderStatus {
        Pending,
        Fulfilled,
        Refunded,
        Cancelled
    }

    struct Order {
        bytes32 orderId;
        address buyer;
        uint256 amount;
        uint256 createdAt;
        uint256 fulfilledAt;
        OrderStatus status;
        string deliveryData;
        string productId;
    }

    address public usdcToken;
    address public admin;
    uint256 public refundWindow = 24 hours;

    mapping(bytes32 => Order) public orders;
    mapping(address => bytes32[]) public userOrders;

    // Tracks escrowed USDC tied to pending orders.
    uint256 private _pendingEscrowed;

    event OrderCreated(bytes32 indexed orderId, address indexed buyer, uint256 amount, string productId);
    event OrderFulfilled(bytes32 indexed orderId, string deliveryData);
    event OrderRefunded(bytes32 indexed orderId, address indexed buyer, uint256 amount);
    event AdminChanged(address indexed newAdmin);

    modifier onlyAdmin() {
        require(msg.sender == admin, "ArcPremiumEscrow: caller is not admin");
        _;
    }

    constructor(address _usdcToken, address _admin, address initialOwner) Ownable(initialOwner) {
        require(_usdcToken != address(0), "ArcPremiumEscrow: zero USDC token");
        require(_admin != address(0), "ArcPremiumEscrow: zero admin");
        require(initialOwner != address(0), "ArcPremiumEscrow: zero owner");

        usdcToken = _usdcToken;
        admin = _admin;
    }

    function createOrder(bytes32 orderId, uint256 amount, string calldata productId) external nonReentrant {
        require(orderId != bytes32(0), "ArcPremiumEscrow: zero orderId");
        require(orders[orderId].buyer == address(0), "ArcPremiumEscrow: order exists");
        require(amount > 0, "ArcPremiumEscrow: amount is zero");

        bool transferred = IERC20(usdcToken).transferFrom(msg.sender, address(this), amount);
        require(transferred, "ArcPremiumEscrow: transferFrom failed");

        orders[orderId] = Order({
            orderId: orderId,
            buyer: msg.sender,
            amount: amount,
            createdAt: block.timestamp,
            fulfilledAt: 0,
            status: OrderStatus.Pending,
            deliveryData: "",
            productId: productId
        });

        userOrders[msg.sender].push(orderId);
        _pendingEscrowed += amount;

        emit OrderCreated(orderId, msg.sender, amount, productId);
    }

    function fulfillOrder(bytes32 orderId, string calldata deliveryData) external onlyAdmin {
        Order storage order = orders[orderId];
        require(order.buyer != address(0), "ArcPremiumEscrow: order not found");
        require(order.status == OrderStatus.Pending, "ArcPremiumEscrow: order not pending");

        order.status = OrderStatus.Fulfilled;
        order.deliveryData = deliveryData;
        order.fulfilledAt = block.timestamp;

        _pendingEscrowed -= order.amount;

        emit OrderFulfilled(orderId, deliveryData);
    }

    function requestRefund(bytes32 orderId) external nonReentrant {
        Order storage order = orders[orderId];
        require(order.buyer != address(0), "ArcPremiumEscrow: order not found");
        require(msg.sender == order.buyer, "ArcPremiumEscrow: caller is not buyer");
        require(order.status == OrderStatus.Pending, "ArcPremiumEscrow: order not pending");
        require(block.timestamp >= order.createdAt + refundWindow, "ArcPremiumEscrow: refund window not reached");

        order.status = OrderStatus.Refunded;
        _pendingEscrowed -= order.amount;

        bool transferred = IERC20(usdcToken).transfer(order.buyer, order.amount);
        require(transferred, "ArcPremiumEscrow: refund transfer failed");

        emit OrderRefunded(orderId, order.buyer, order.amount);
    }

    function claimRefundAdmin(bytes32 orderId) external onlyOwner nonReentrant {
        Order storage order = orders[orderId];
        require(order.buyer != address(0), "ArcPremiumEscrow: order not found");
        require(order.status == OrderStatus.Pending, "ArcPremiumEscrow: order not pending");

        order.status = OrderStatus.Refunded;
        _pendingEscrowed -= order.amount;

        bool transferred = IERC20(usdcToken).transfer(order.buyer, order.amount);
        require(transferred, "ArcPremiumEscrow: refund transfer failed");

        emit OrderRefunded(orderId, order.buyer, order.amount);
    }

    function setAdmin(address newAdmin) external onlyOwner {
        require(newAdmin != address(0), "ArcPremiumEscrow: zero admin");
        admin = newAdmin;
        emit AdminChanged(newAdmin);
    }

    function setRefundWindow(uint256 newWindow) external onlyOwner {
        refundWindow = newWindow;
    }

    function getOrder(bytes32 orderId) external view returns (Order memory) {
        return orders[orderId];
    }

    function getUserOrders(address user) external view returns (bytes32[] memory) {
        return userOrders[user];
    }

    function withdrawFunds(uint256 amount) external onlyOwner nonReentrant {
        uint256 available = IERC20(usdcToken).balanceOf(address(this)) - _pendingEscrowed;
        require(amount <= available, "ArcPremiumEscrow: insufficient withdrawable");

        bool transferred = IERC20(usdcToken).transfer(owner(), amount);
        require(transferred, "ArcPremiumEscrow: withdraw transfer failed");
    }
}
