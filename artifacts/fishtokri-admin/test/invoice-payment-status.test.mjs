import assert from "node:assert/strict";
import test from "node:test";
import {
  isInvoicePaid,
  isPaymentStatusPaid,
  normalizePaymentStatus,
  paymentStatusDisplayLabel,
} from "../src/lib/invoice-payment-status.mjs";

test("normalizes completed payment status to Paid for every order", () => {
  assert.equal(isPaymentStatusPaid("completed"), true);
  assert.equal(normalizePaymentStatus(" COMPLETED "), "paid");
  assert.equal(paymentStatusDisplayLabel("completed"), "Paid");
  assert.equal(isInvoicePaid({ orderId: "#FTW2026010063", paymentStatus: "completed" }), true);
  assert.equal(isInvoicePaid({ orderId: "#FTN2026010063", paymentStatus: "completed" }), true);
});

test("preserves unpaid, partial, pending, and failed statuses", () => {
  assert.equal(isPaymentStatusPaid("paid"), true);
  assert.equal(isPaymentStatusPaid("partial"), false);
  assert.equal(isPaymentStatusPaid("pending"), false);
  assert.equal(isPaymentStatusPaid("failed"), false);
  assert.equal(paymentStatusDisplayLabel("partial"), "partial");
  assert.equal(isInvoicePaid({ orderId: "ORD-10063", paymentStatus: "unpaid" }), false);
});

test("displays paid status for existing paid orders and keeps FTW pending or failed distinct", () => {
  assert.equal(isInvoicePaid({ orderId: "FTN-10063", paymentStatus: "paid" }), true);
  assert.equal(isInvoicePaid({ orderId: "FTW2026010063", paymentStatus: "pending" }), false);
  assert.equal(isInvoicePaid({ orderId: "FTW2026010063", paymentStatus: "failed" }), false);
});
