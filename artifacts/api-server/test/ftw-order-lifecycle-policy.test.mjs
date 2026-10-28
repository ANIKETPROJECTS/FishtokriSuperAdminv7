import assert from "node:assert/strict";
import test from "node:test";
import {
  buildExpiredFtwPaymentFilter,
  buildFtwPaymentExpiryBackfillFilter,
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

test("failed FTW payment remains eligible for a successful settlement during the window", () => {
  const order = {
    orderId: "#FTW2026102837",
    paymentStatus: "failed",
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

test("failed-payment cleanup is gated by the same expiry as pending-payment cleanup", () => {
  const pendingFilter = buildExpiredFtwPaymentFilter(FTW_PENDING_FILTER);
  const failedFilter = buildExpiredFtwPaymentFilter(FTW_FAILED_FILTER);

  for (const filter of [pendingFilter, failedFilter]) {
    assert.deepEqual(filter.paymentExpiresAt, { $type: "date" });
    assert.deepEqual(filter.$expr, { $lte: ["$paymentExpiresAt", "$$NOW"] });
    assert.deepEqual(filter.isDeleted, { $ne: true });
  }
  assert.deepEqual(pendingFilter.paymentStatus, FTW_PENDING_FILTER);
  assert.deepEqual(failedFilter.paymentStatus, FTW_FAILED_FILTER);
});

test("expiry is backfilled for both pending and failed FTW orders", () => {
  const filter = buildFtwPaymentExpiryBackfillFilter();
  assert.equal(filter.paymentStatus.$in.length, 2);
  assert.deepEqual(filter.paymentStatus.$in, [FTW_PENDING_FILTER, FTW_FAILED_FILTER]);
});
