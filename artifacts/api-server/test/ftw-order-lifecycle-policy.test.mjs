import assert from "node:assert/strict";
import test from "node:test";
import {
  buildFailedFtwPaymentFilter,
  buildExpiredFtwPaymentFilter,
  buildFtwPaymentExpiryBackfillFilter,
  buildFtwPaymentExpiryExtensionFilter,
  buildFtwPaymentExpiryPipeline,
  canAcceptFtwSettlement,
  FTW_FAILED_FILTER,
  FTW_PAYMENT_TIMEOUT_MINUTES,
  FTW_PENDING_FILTER,
} from "../src/services/ftw-order-lifecycle-policy.mjs";

const createdAt = new Date("2026-10-28T09:02:24.490Z");
const expiresAt = new Date(createdAt.getTime() + 7 * 60 * 1000);

test("FTW payment window is seven minutes from order creation", () => {
  assert.equal(FTW_PAYMENT_TIMEOUT_MINUTES, 7);
  assert.equal(expiresAt.toISOString(), "2026-10-28T09:09:24.490Z");
});

test("pending FTW payment accepts settlement only within the payment window", () => {
  const order = {
    orderId: "#FTW2026102837",
    paymentStatus: "pending",
    paymentExpiresAt: expiresAt,
  };

  assert.equal(
    canAcceptFtwSettlement(order, "completed", new Date("2026-10-28T09:04:42.343Z").getTime()),
    true,
  );
  assert.equal(
    canAcceptFtwSettlement(order, "completed", expiresAt.getTime()),
    false,
  );
});

test("failed FTW payment cannot be revived by a later successful settlement", () => {
  const failedOrder = {
    orderId: "#FTW2026102837",
    paymentStatus: "failed",
    paymentExpiresAt: expiresAt,
  };

  assert.equal(
    canAcceptFtwSettlement(failedOrder, "completed", new Date("2026-10-28T09:04:42.343Z").getTime()),
    false,
  );
});

test("failed FTW payments are immediately eligible for cleanup without an expiry", () => {
  const filter = buildFailedFtwPaymentFilter();
  assert.deepEqual(filter.paymentStatus, FTW_FAILED_FILTER);
  assert.deepEqual(filter.isDeleted, { $ne: true });
  assert.equal(filter.paymentExpiresAt, undefined);
});

test("pending-payment cleanup remains gated by the seven-minute expiry", () => {
  const pendingFilter = buildExpiredFtwPaymentFilter(FTW_PENDING_FILTER);

  assert.deepEqual(pendingFilter.paymentExpiresAt, { $type: "date" });
  assert.deepEqual(pendingFilter.$expr, { $lte: ["$paymentExpiresAt", "$$NOW"] });
  assert.deepEqual(pendingFilter.isDeleted, { $ne: true });
  assert.deepEqual(pendingFilter.paymentStatus, FTW_PENDING_FILTER);
});

test("expiry is backfilled only for pending FTW orders", () => {
  const filter = buildFtwPaymentExpiryBackfillFilter();
  assert.deepEqual(filter.paymentStatus, FTW_PENDING_FILTER);
});

test("pending orders with the former five-minute expiry are extended to seven minutes", () => {
  const filter = buildFtwPaymentExpiryExtensionFilter();
  assert.deepEqual(filter.paymentStatus, FTW_PENDING_FILTER);
  assert.deepEqual(filter.createdAt, { $type: "date" });
  assert.equal(
    buildFtwPaymentExpiryPipeline()[0].$set.paymentExpiresAt.$dateAdd.amount,
    7,
  );
});
