import test from "node:test";
import assert from "node:assert/strict";
import {
  getWalletPaymentAmount,
  hasNonWalletPayment,
} from "../src/lib/wallet-payment-amount.mjs";

test("sums the wallet part of a mixed Wallet and UPI payment", () => {
  assert.equal(
    getWalletPaymentAmount([
      { mode: "wallet", amount: 22 },
      { mode: "upi", amount: 1 },
    ]),
    22,
  );
});

test("normalizes wallet payment mode casing and whitespace", () => {
  assert.equal(
    getWalletPaymentAmount([
      { mode: " Wallet ", amount: "22" },
      { mode: "UPI", amount: 1 },
    ]),
    22,
  );
});

test("uses the legacy walletUsed field when no wallet payment entry exists", () => {
  assert.equal(getWalletPaymentAmount([{ mode: "upi", amount: 1 }], 22), 22);
});

test("can treat an explicit walletUsed update as authoritative", () => {
  assert.equal(
    getWalletPaymentAmount([{ mode: "wallet", amount: 50 }], 22, true),
    22,
  );
});

test("recognizes the UPI leg of a mixed payment", () => {
  assert.equal(
    hasNonWalletPayment([
      { mode: "wallet", amount: 22 },
      { mode: "upi", amount: 1 },
    ]),
    true,
  );
  assert.equal(hasNonWalletPayment([{ mode: "wallet", amount: 22 }]), false);
});
