import assert from "node:assert/strict";
import test from "node:test";
import { isInvoicePaid } from "../src/lib/invoice-payment-status.mjs";

test("treats completed FTW payments as paid on invoices", () => {
  assert.equal(isInvoicePaid({ orderId: "#FTW2026010063", paymentStatus: "completed" }), true);
  assert.equal(isInvoicePaid({ invoiceNo: "FTW2026010063", paymentStatus: " COMPLETED " }), true);
});

test("does not treat completed non-FTW orders as paid", () => {
  assert.equal(isInvoicePaid({ orderId: "#FTN2026010063", paymentStatus: "completed" }), false);
  assert.equal(isInvoicePaid({ orderId: "ORD-10063", paymentStatus: "completed" }), false);
});

test("keeps paid status and FTW pending or failed statuses distinct", () => {
  assert.equal(isInvoicePaid({ orderId: "FTN-10063", paymentStatus: "paid" }), true);
  assert.equal(isInvoicePaid({ orderId: "FTW2026010063", paymentStatus: "pending" }), false);
  assert.equal(isInvoicePaid({ orderId: "FTW2026010063", paymentStatus: "failed" }), false);
});
