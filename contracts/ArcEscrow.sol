// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract ArcEscrow is Ownable2Step, ReentrancyGuard {
    IERC20 public immutable usdcToken;

    enum Status { Pending, Delivered, Refunded }

    struct Order {
        address buyer;
        uint256 amount;
        uint256 timestamp;
        Status status;
    }

    mapping(bytes32 => Order) public orders;
    mapping(bytes32 => address) public orderBuyer;

    event OrderCreated(bytes32 indexed orderId, address indexed buyer, uint256 amount);
    event OrderFulfilled(bytes32 indexed orderId);
    event OrderRefunded(bytes32 indexed orderId);

    constructor(address _usdcToken, address _initialOwner) Ownable(_initialOwner) {
        require(_usdcToken != address(0), "ArcEscrow: zero USDC address");
        require(_initialOwner != address(0), "ArcEscrow: zero owner address");
        usdcToken = IERC20(_usdcToken);
    }

    function createOrder(bytes32 orderId, uint256 amount) external nonReentrant {
        bytes32 internalId = keccak256(abi.encodePacked(msg.sender, orderId));
        require(orders[internalId].buyer == address(0), "Order already exists");
        require(orderBuyer[orderId] == address(0), "ArcEscrow: orderId already used");
        require(usdcToken.transferFrom(msg.sender, address(this), amount), "USDC transfer failed");

        orders[internalId] = Order({
            buyer: msg.sender,
            amount: amount,
            timestamp: block.timestamp,
            status: Status.Pending
        });
        orderBuyer[orderId] = msg.sender;

        emit OrderCreated(orderId, msg.sender, amount);
    }

    function fulfillOrder(bytes32 orderId) external onlyOwner nonReentrant {
        address buyer = orderBuyer[orderId];
        require(buyer != address(0), "ArcEscrow: unknown orderId");
        bytes32 internalId = keccak256(abi.encodePacked(buyer, orderId));
        Order storage order = orders[internalId];
        require(order.status == Status.Pending, "Invalid order status");

        order.status = Status.Delivered;
        require(usdcToken.transfer(owner(), order.amount), "Transfer to owner failed");

        emit OrderFulfilled(orderId);
    }

    function requestRefund(bytes32 orderId) external nonReentrant {
        bytes32 internalId = keccak256(abi.encodePacked(msg.sender, orderId));
        Order storage order = orders[internalId];
        require(msg.sender == order.buyer, "Only buyer can refund");
        require(order.status == Status.Pending, "Order not pending");
        require(block.timestamp > order.timestamp + 24 hours, "Timeout not reached");

        order.status = Status.Refunded;
        require(usdcToken.transfer(order.buyer, order.amount), "Refund transfer failed");

        emit OrderRefunded(orderId);
    }
}
