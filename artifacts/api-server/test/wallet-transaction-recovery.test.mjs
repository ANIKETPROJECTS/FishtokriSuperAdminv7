import test from "node:test";
import assert from "node:assert/strict";
import { addMissingWalletOrderDeductions } from "../src/lib/wallet-transaction-recovery.mjs";

test("recovers a missing wallet debit despite an earlier refund for a reused order number", () => {
  const order = {
    _id: "mongo-order-id",
    orderId: "#FTW202611261",
    createdAt: "2026-11-26T13:25:08.554Z",
    payments: [{ mode: "wallet", amount: 40 }],
  };
  const transactions = [{
    amount: 40,
    type: "credit",
    reason: "Order cancelled — wallet refunded",
    orderId: "#FTW202611261",
    createdAt: "2026-11-26T13:17:00.121Z",
  }];

  const recovered = addMissingWalletOrderDeductions(transactions, [order]);

  assert.equal(recovered.length, 2);
  assert.deepEqual(
    recovered[1],
    {
      amount: -40,
      type: "debit",
      reason: "Order placed — wallet deducted",
      createdAt: order.createdAt,
      orderId: order.orderId,
      orderRef: order._id,
      recoveredFromOrder: true,
    },
  );
});

test("does not duplicate an already logged debit for the same Mongo order", () => {
  const order = {
    _id: "mongo-order-id",
    orderId: "#FTW202611261",
    createdAt: "2026-11-26T13:25:08.554Z",
    payments: [{ mode: "wallet", amount: 40 }],
  };
  const transactions = [{
    amount: -40,
    type: "debit",
    orderId: order.orderId,
    orderRef: order._id,
    createdAt: "2026-11-26T13:25:09.000Z",
  }];

  assert.equal(addMissingWalletOrderDeductions(transactions, [order]).length, 1);
});

test("supports the legacy walletUsed field and ignores orders without wallet usage", () => {
  const recovered = addMissingWalletOrderDeductions([], [
    { _id: "wallet-order", orderId: "FTS202611261", walletUsed: 12, createdAt: "2026-11-26T10:00:00Z" },
    { _id: "cash-order", orderId: "FTS202611262", payments: [{ mode: "cash", amount: 20 }] },
  ]);

  assert.equal(recovered.length, 1);
  assert.equal(recovered[0].amount, -12);
  assert.equal(recovered[0].orderRef, "wallet-order");
});
