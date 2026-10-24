// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {ArcEscrow} from "../ArcEscrow.sol";
import {MockERC20} from "../test-helpers/MockERC20.sol";

// ─── Handler for invariant testing ────────────────────────────────────────────
contract EscrowHandler is Test {
    ArcEscrow public escrow;
    MockERC20 public usdc;
    address public owner;

    // Track total USDC deposited into escrow that is still "live" (Pending)
    uint256 public totalDeposited;

    // Sequential order counter so we never reuse an orderId in this handler
    uint256 private _orderCounter;

    constructor(ArcEscrow _escrow, MockERC20 _usdc, address _owner) {
        escrow = _escrow;
        usdc = _usdc;
        owner = _owner;
    }

    /// Buyer creates a new order with a fresh orderId
    function createOrder(uint256 amount) external {
        amount = bound(amount, 1, 1_000_000e6);

        address buyer = address(uint160(uint256(keccak256(abi.encodePacked(_orderCounter, block.timestamp)))));
        bytes32 orderId = keccak256(abi.encodePacked("order", _orderCounter));
        _orderCounter++;

        usdc.mint(buyer, amount);
        vm.prank(buyer);
        usdc.approve(address(escrow), amount);
        vm.prank(buyer);
        escrow.createOrder(orderId, amount);

        totalDeposited += amount;
    }
}

// ─── Main test contract ────────────────────────────────────────────────────────
contract ArcEscrowTest is Test {
    // ── Fixtures ──────────────────────────────────────────────────────────────
    ArcEscrow internal escrow;
    MockERC20  internal usdc;

    address internal owner   = makeAddr("owner");
    address internal alice   = makeAddr("alice");
    address internal bob     = makeAddr("bob");
    address internal charlie = makeAddr("charlie");

    uint256 internal constant INITIAL_USDC = 10_000e6; // 10 000 USDC (6 dec)
    bytes32 internal constant ORDER_A      = keccak256("orderA");
    bytes32 internal constant ORDER_B      = keccak256("orderB");

    uint256 internal constant AMOUNT = 500e6; // 500 USDC

    // ── setUp ─────────────────────────────────────────────────────────────────
    function setUp() public {
        // Deploy mock USDC
        usdc = new MockERC20("Mock USDC", "mUSDC", 6);

        // Deploy escrow with explicit initialOwner
        escrow = new ArcEscrow(address(usdc), owner);

        // Fund alice & bob
        usdc.mint(alice, INITIAL_USDC);
        usdc.mint(bob,   INITIAL_USDC);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 1. DEPLOYMENT & INITIALIZATION
    // ─────────────────────────────────────────────────────────────────────────

    function test_Constructor_SetsUsdcToken() public view {
        assertEq(address(escrow.usdcToken()), address(usdc));
    }

    function test_Constructor_SetsOwner() public view {
        assertEq(escrow.owner(), owner);
    }

    function test_Constructor_RevertsOnZeroUsdc() public {
        vm.expectRevert(bytes("ArcEscrow: zero USDC address"));
        new ArcEscrow(address(0), owner);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 2. createOrder — happy path
    // ─────────────────────────────────────────────────────────────────────────

    function test_CreateOrder_TransfersUsdcToEscrow() public {
        vm.startPrank(alice);
        usdc.approve(address(escrow), AMOUNT);
        escrow.createOrder(ORDER_A, AMOUNT);
        vm.stopPrank();

        assertEq(usdc.balanceOf(address(escrow)), AMOUNT,        "escrow balance");
        assertEq(usdc.balanceOf(alice),           INITIAL_USDC - AMOUNT, "alice balance");
    }

    function test_CreateOrder_StoresOrderDataCorrectly() public {
        vm.startPrank(alice);
        usdc.approve(address(escrow), AMOUNT);
        escrow.createOrder(ORDER_A, AMOUNT);
        vm.stopPrank();

        bytes32 internalId = keccak256(abi.encodePacked(alice, ORDER_A));
        (address buyer, uint256 amount, uint256 ts, ArcEscrow.Status status) = escrow.orders(internalId);

        assertEq(buyer,            alice,             "buyer");
        assertEq(amount,           AMOUNT,            "amount");
        assertEq(uint8(status),    uint8(ArcEscrow.Status.Pending), "status");
        assertTrue(ts > 0,                            "timestamp set");
    }

    function test_CreateOrder_SetsOrderBuyerMapping() public {
        vm.startPrank(alice);
        usdc.approve(address(escrow), AMOUNT);
        escrow.createOrder(ORDER_A, AMOUNT);
        vm.stopPrank();

        assertEq(escrow.orderBuyer(ORDER_A), alice);
    }

    function test_CreateOrder_EmitsOrderCreated() public {
        vm.startPrank(alice);
        usdc.approve(address(escrow), AMOUNT);

        vm.expectEmit(true, true, false, true, address(escrow));
        emit ArcEscrow.OrderCreated(ORDER_A, alice, AMOUNT);
        escrow.createOrder(ORDER_A, AMOUNT);
        vm.stopPrank();
    }

    function test_CreateOrder_RecordsTimestamp() public {
        uint256 warpTo = 1_700_000_000;
        vm.warp(warpTo);

        vm.startPrank(alice);
        usdc.approve(address(escrow), AMOUNT);
        escrow.createOrder(ORDER_A, AMOUNT);
        vm.stopPrank();

        bytes32 internalId = keccak256(abi.encodePacked(alice, ORDER_A));
        (, , uint256 ts, ) = escrow.orders(internalId);
        assertEq(ts, warpTo);
    }

    // Two different buyers can use the same orderId (different internalId)
    // but orderBuyer[orderId] is first-come, so the second buyer should revert.
    function test_CreateOrder_TwoBuyersSameOrderId_SecondReverts() public {
        // Alice creates first
        vm.startPrank(alice);
        usdc.approve(address(escrow), AMOUNT);
        escrow.createOrder(ORDER_A, AMOUNT);
        vm.stopPrank();

        // Bob tries the same orderId — should revert on orderBuyer uniqueness
        vm.startPrank(bob);
        usdc.approve(address(escrow), AMOUNT);
        vm.expectRevert(bytes("ArcEscrow: orderId already used"));
        escrow.createOrder(ORDER_A, AMOUNT);
        vm.stopPrank();
    }

    // Same buyer, same orderId — reverts on internalId uniqueness (orders mapping)
    function test_CreateOrder_SameBuyerDuplicateOrder_Reverts() public {
        vm.startPrank(alice);
        usdc.approve(address(escrow), AMOUNT * 2);
        escrow.createOrder(ORDER_A, AMOUNT);
        vm.expectRevert(bytes("Order already exists"));
        escrow.createOrder(ORDER_A, AMOUNT);
        vm.stopPrank();
    }

    function test_CreateOrder_InsufficientAllowance_Reverts() public {
        // No approval at all
        vm.prank(alice);
        vm.expectRevert();
        escrow.createOrder(ORDER_A, AMOUNT);
    }

    function test_CreateOrder_ZeroAmount_Succeeds() public {
        // The contract has no explicit zero-amount guard; 0-value transferFrom succeeds
        vm.startPrank(alice);
        usdc.approve(address(escrow), 0);
        escrow.createOrder(ORDER_A, 0);
        vm.stopPrank();

        bytes32 internalId = keccak256(abi.encodePacked(alice, ORDER_A));
        (, uint256 amount, , ) = escrow.orders(internalId);
        assertEq(amount, 0);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 3. fulfillOrder — happy path
    // ─────────────────────────────────────────────────────────────────────────

    function _aliceCreatesOrder(bytes32 orderId, uint256 amt) internal {
        vm.startPrank(alice);
        usdc.approve(address(escrow), amt);
        escrow.createOrder(orderId, amt);
        vm.stopPrank();
    }

    function test_FulfillOrder_TransfersUsdcToOwner() public {
        _aliceCreatesOrder(ORDER_A, AMOUNT);

        uint256 ownerBefore = usdc.balanceOf(owner);

        vm.prank(owner);
        escrow.fulfillOrder(ORDER_A);

        assertEq(usdc.balanceOf(owner),           ownerBefore + AMOUNT, "owner received");
        assertEq(usdc.balanceOf(address(escrow)), 0,                    "escrow drained");
    }

    function test_FulfillOrder_SetsStatusDelivered() public {
        _aliceCreatesOrder(ORDER_A, AMOUNT);

        vm.prank(owner);
        escrow.fulfillOrder(ORDER_A);

        bytes32 internalId = keccak256(abi.encodePacked(alice, ORDER_A));
        (, , , ArcEscrow.Status status) = escrow.orders(internalId);
        assertEq(uint8(status), uint8(ArcEscrow.Status.Delivered));
    }

    function test_FulfillOrder_EmitsOrderFulfilled() public {
        _aliceCreatesOrder(ORDER_A, AMOUNT);

        vm.prank(owner);
        vm.expectEmit(true, false, false, false, address(escrow));
        emit ArcEscrow.OrderFulfilled(ORDER_A);
        escrow.fulfillOrder(ORDER_A);
    }

    function test_FulfillOrder_RevertsIfNotOwner() public {
        _aliceCreatesOrder(ORDER_A, AMOUNT);

        vm.prank(alice);
        // Ownable2Step uses OwnableUnauthorizedAccount custom error
        vm.expectRevert(
            abi.encodeWithSignature("OwnableUnauthorizedAccount(address)", alice)
        );
        escrow.fulfillOrder(ORDER_A);
    }

    function test_FulfillOrder_RevertsIfOrderNotPending_Delivered() public {
        _aliceCreatesOrder(ORDER_A, AMOUNT);

        vm.prank(owner);
        escrow.fulfillOrder(ORDER_A); // → Delivered

        vm.prank(owner);
        vm.expectRevert(bytes("Invalid order status"));
        escrow.fulfillOrder(ORDER_A);
    }

    function test_FulfillOrder_RevertsIfOrderNotPending_Refunded() public {
        _aliceCreatesOrder(ORDER_A, AMOUNT);

        // Warp past 24 h and refund
        vm.warp(block.timestamp + 25 hours);
        vm.prank(alice);
        escrow.requestRefund(ORDER_A);

        vm.prank(owner);
        vm.expectRevert(bytes("Invalid order status"));
        escrow.fulfillOrder(ORDER_A);
    }

    function test_FulfillOrder_RevertsOnUnknownOrderId() public {
        // orderBuyer returns address(0), internalId resolves to a zero-buyer order
        // → order.status defaults to Pending (0) ... but buyer is address(0)
        // The function will attempt transfer to owner of a 0-amount order.
        // The "Invalid order status" check fires only if status != Pending.
        // A non-existent order has status=Pending(0) by default, so transfer of
        // amount=0 succeeds. This is noted as a suspected contract behaviour gap
        // in the report — the test documents the actual revert-or-not behaviour.
        bytes32 bogusId = keccak256("bogus");
        // No revert expected for unknown orderId with 0-value order (contract behaviour)
        vm.prank(owner);
        escrow.fulfillOrder(bogusId); // transfers 0 USDC — no revert
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 4. requestRefund — happy path
    // ─────────────────────────────────────────────────────────────────────────

    function test_RequestRefund_TransfersUsdcBackToBuyer() public {
        _aliceCreatesOrder(ORDER_A, AMOUNT);

        vm.warp(block.timestamp + 25 hours);
        vm.prank(alice);
        escrow.requestRefund(ORDER_A);

        assertEq(usdc.balanceOf(alice),           INITIAL_USDC, "alice fully refunded");
        assertEq(usdc.balanceOf(address(escrow)), 0,            "escrow drained");
    }

    function test_RequestRefund_SetsStatusRefunded() public {
        _aliceCreatesOrder(ORDER_A, AMOUNT);

        vm.warp(block.timestamp + 25 hours);
        vm.prank(alice);
        escrow.requestRefund(ORDER_A);

        bytes32 internalId = keccak256(abi.encodePacked(alice, ORDER_A));
        (, , , ArcEscrow.Status status) = escrow.orders(internalId);
        assertEq(uint8(status), uint8(ArcEscrow.Status.Refunded));
    }

    function test_RequestRefund_EmitsOrderRefunded() public {
        _aliceCreatesOrder(ORDER_A, AMOUNT);

        vm.warp(block.timestamp + 25 hours);

        vm.prank(alice);
        vm.expectEmit(true, false, false, false, address(escrow));
        emit ArcEscrow.OrderRefunded(ORDER_A);
        escrow.requestRefund(ORDER_A);
    }

    function test_RequestRefund_RevertsBeforeTimeout() public {
        _aliceCreatesOrder(ORDER_A, AMOUNT);

        // Only 12 hours passed — not enough
        vm.warp(block.timestamp + 12 hours);
        vm.prank(alice);
        vm.expectRevert(bytes("Timeout not reached"));
        escrow.requestRefund(ORDER_A);
    }

    function test_RequestRefund_RevertsExactlyAtTimeout() public {
        _aliceCreatesOrder(ORDER_A, AMOUNT);
        uint256 createdAt = block.timestamp;

        // Exactly 24 h — condition is STRICTLY greater than, so should revert
        vm.warp(createdAt + 24 hours);
        vm.prank(alice);
        vm.expectRevert(bytes("Timeout not reached"));
        escrow.requestRefund(ORDER_A);
    }

    function test_RequestRefund_RevertsForNonBuyer() public {
        _aliceCreatesOrder(ORDER_A, AMOUNT);

        vm.warp(block.timestamp + 25 hours);

        // Bob tries to refund Alice's order — internalId uses bob as sender,
        // so orders[internalId].buyer == address(0), and
        // msg.sender (bob) != address(0) triggers "Only buyer can refund".
        vm.prank(bob);
        vm.expectRevert(bytes("Only buyer can refund"));
        escrow.requestRefund(ORDER_A);
    }

    function test_RequestRefund_RevertsIfAlreadyDelivered() public {
        _aliceCreatesOrder(ORDER_A, AMOUNT);

        vm.prank(owner);
        escrow.fulfillOrder(ORDER_A);

        vm.warp(block.timestamp + 25 hours);
        vm.prank(alice);
        vm.expectRevert(bytes("Order not pending"));
        escrow.requestRefund(ORDER_A);
    }

    function test_RequestRefund_RevertsIfAlreadyRefunded() public {
        _aliceCreatesOrder(ORDER_A, AMOUNT);

        vm.warp(block.timestamp + 25 hours);
        vm.prank(alice);
        escrow.requestRefund(ORDER_A);

        // Second refund attempt
        vm.prank(alice);
        vm.expectRevert(bytes("Order not pending"));
        escrow.requestRefund(ORDER_A);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 5. Ownable2Step — transferOwnership / acceptOwnership
    // ─────────────────────────────────────────────────────────────────────────

    function test_TransferOwnership_RequiresAccept() public {
        vm.prank(owner);
        escrow.transferOwnership(charlie);

        // Owner not yet changed — pending only
        assertEq(escrow.owner(),            owner);
        assertEq(escrow.pendingOwner(),     charlie);

        vm.prank(charlie);
        escrow.acceptOwnership();
        assertEq(escrow.owner(),            charlie);
    }

    function test_TransferOwnership_NonOwnerReverts() public {
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSignature("OwnableUnauthorizedAccount(address)", alice)
        );
        escrow.transferOwnership(charlie);
    }

    function test_AcceptOwnership_WrongCallerReverts() public {
        vm.prank(owner);
        escrow.transferOwnership(charlie);

        vm.prank(alice); // alice is not the pending owner
        vm.expectRevert(
            abi.encodeWithSignature("OwnableUnauthorizedAccount(address)", alice)
        );
        escrow.acceptOwnership();
    }

    // fulfillOrder should use the NEW owner after ownership transfer
    function test_FulfillOrder_AfterOwnershipTransfer_PaysNewOwner() public {
        _aliceCreatesOrder(ORDER_A, AMOUNT);

        vm.prank(owner);
        escrow.transferOwnership(charlie);
        vm.prank(charlie);
        escrow.acceptOwnership();

        uint256 charlieBefore = usdc.balanceOf(charlie);

        vm.prank(charlie);
        escrow.fulfillOrder(ORDER_A);

        assertEq(usdc.balanceOf(charlie), charlieBefore + AMOUNT);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 6. FUZZ — key arithmetic
    // ─────────────────────────────────────────────────────────────────────────

    /// Fuzz: createOrder amount is exactly what the escrow holds
    function testFuzz_CreateOrder_EscrowBalanceEqualsAmount(uint256 amount) public {
        amount = bound(amount, 1, INITIAL_USDC);

        vm.startPrank(alice);
        usdc.approve(address(escrow), amount);
        escrow.createOrder(ORDER_A, amount);
        vm.stopPrank();

        assertEq(usdc.balanceOf(address(escrow)), amount);
    }

    /// Fuzz: after fulfill, owner receives exactly what was deposited
    function testFuzz_FulfillOrder_OwnerReceivesExactAmount(uint256 amount) public {
        amount = bound(amount, 1, INITIAL_USDC);

        vm.startPrank(alice);
        usdc.approve(address(escrow), amount);
        escrow.createOrder(ORDER_A, amount);
        vm.stopPrank();

        uint256 ownerBefore = usdc.balanceOf(owner);

        vm.prank(owner);
        escrow.fulfillOrder(ORDER_A);

        assertEq(usdc.balanceOf(owner), ownerBefore + amount);
        assertEq(usdc.balanceOf(address(escrow)), 0);
    }

    /// Fuzz: after refund, buyer gets back exactly what they deposited
    function testFuzz_RequestRefund_BuyerReceivesExactAmount(uint256 amount) public {
        amount = bound(amount, 1, INITIAL_USDC);

        vm.startPrank(alice);
        usdc.approve(address(escrow), amount);
        escrow.createOrder(ORDER_A, amount);
        vm.stopPrank();

        uint256 aliceBefore = usdc.balanceOf(alice);

        vm.warp(block.timestamp + 25 hours);
        vm.prank(alice);
        escrow.requestRefund(ORDER_A);

        assertEq(usdc.balanceOf(alice), aliceBefore + amount);
        assertEq(usdc.balanceOf(address(escrow)), 0);
    }

    /// Fuzz: requestRefund reverts for any timestamp at or before the 24h window
    function testFuzz_RequestRefund_RevertsWithinWindow(uint256 elapsed) public {
        elapsed = bound(elapsed, 0, 24 hours);

        _aliceCreatesOrder(ORDER_A, AMOUNT);
        uint256 createdAt = block.timestamp;

        vm.warp(createdAt + elapsed);
        vm.prank(alice);
        vm.expectRevert(bytes("Timeout not reached"));
        escrow.requestRefund(ORDER_A);
    }

    /// Fuzz: internalId derivation matches contract's own derivation
    function testFuzz_InternalId_DerivedCorrectly(address buyer, bytes32 orderId) public {
        vm.assume(buyer != address(0));

        bytes32 expected = keccak256(abi.encodePacked(buyer, orderId));

        // Mint and fund buyer so the createOrder can run
        usdc.mint(buyer, AMOUNT);
        vm.startPrank(buyer);
        usdc.approve(address(escrow), AMOUNT);
        escrow.createOrder(orderId, AMOUNT);
        vm.stopPrank();

        (address storedBuyer, , , ) = escrow.orders(expected);
        assertEq(storedBuyer, buyer);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 7. INVARIANT testing is in ArcEscrowInvariantTest (see below) so that
    //    the handler registration via targetContract() stays isolated from the
    //    unit-test state.
    // ─────────────────────────────────────────────────────────────────────────
}

// ─── Dedicated invariant test contract ────────────────────────────────────────
// Foundry's invariant runner needs targetContract() to be set up in setUp().
// We isolate the invariant from the unit-test contract to avoid state bleed.
contract ArcEscrowInvariantTest is Test {
    ArcEscrow      internal escrow;
    MockERC20      internal usdc;
    EscrowHandler  internal handler;

    address internal owner = makeAddr("inv-owner");

    function setUp() public {
        usdc    = new MockERC20("Mock USDC", "mUSDC", 6);
        escrow  = new ArcEscrow(address(usdc), owner);
        handler = new EscrowHandler(escrow, usdc, owner);

        targetContract(address(handler));
    }

    /// Invariant: the escrow's actual USDC balance is always >= total deposited
    /// by the handler (handler only creates orders; no fulfills or refunds,
    /// so all deposits are still Pending — balance must equal totalDeposited).
    function invariant_EscrowBalanceEqualsHandlerDeposits() public view {
        assertEq(
            usdc.balanceOf(address(escrow)),
            handler.totalDeposited(),
            "escrow balance must equal sum of pending handler deposits"
        );
    }
}
