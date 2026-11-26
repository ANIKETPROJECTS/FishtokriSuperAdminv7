import test from "node:test";
import assert from "node:assert/strict";
import { getUnrefundedFtwWalletAmount } from "../src/lib/ftw-wallet-refund.mjs";

test("refund amount is only the wallet leg of a mixed FTW payment", () => {
  assert.equal(
    getUnrefundedFtwWalletAmount(
      {
        _id: "order-1",
        payments: [
          { mode: "wallet", amount: 3 },
          { mode: "upi", amount: 1 },
        ],
      },
      [],
    ),
    3,
  );
});

test("does not refund wallet usage twice for the same order", () => {
  assert.equal(
    getUnrefundedFtwWalletAmount(
      {
        _id: "order-1",
        payments: [{ mode: "wallet", amount: 3 }],
      },
      [{
        orderRef: "order-1",
        amount: 3,
        type: "credit",
        reason: "FTW payment failed — wallet refunded",
      }],
    ),
    0,
  );
});

test("does not treat another order's refund or this order's debit as a refund", () => {
  assert.equal(
    getUnrefundedFtwWalletAmount(
      {
        _id: "order-1",
        payments: [{ mode: "wallet", amount: 3 }],
      },
      [
        { orderRef: "order-2", amount: 3, type: "credit", reason: "wallet refunded" },
        { orderRef: "order-1", amount: -3, type: "debit", reason: "wallet deducted" },
      ],
    ),
    3,
  );
});

test("credits only the unreimbursed remainder after a partial refund", () => {
  assert.equal(
    getUnrefundedFtwWalletAmount(
      {
        _id: "order-1",
        walletUsed: 5,
      },
      [{ orderRef: "order-1", amount: 2, type: "credit", reason: "Order deleted — wallet refunded" }],
    ),
    3,
  );
});
