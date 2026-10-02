import assert from "node:assert/strict";
import test from "node:test";
import { getInventoryUpdateAction } from "../src/routes/inventory-update-policy.mjs";

test("restores a deducted baseline order when it transitions from active to cancelled", () => {
  assert.equal(
    getInventoryUpdateAction({
      baselineProtected: true,
      wasDeducted: true,
      wasActive: true,
      wantsDeducted: false,
    }),
    "restore",
  );
});

test("does not restore an order that was already cancelled at startup when it is edited", () => {
  assert.equal(
    getInventoryUpdateAction({
      baselineProtected: true,
      wasDeducted: true,
      wasActive: false,
      wantsDeducted: false,
    }),
    "skip",
  );
});

test("does not backfill an undeducted baseline order when it is active", () => {
  assert.equal(
    getInventoryUpdateAction({
      baselineProtected: true,
      wasDeducted: false,
      wasActive: true,
      wantsDeducted: true,
    }),
    "skip",
  );
});

test("does not reconcile an already-deducted baseline order on an active edit", () => {
  assert.equal(
    getInventoryUpdateAction({
      baselineProtected: true,
      wasDeducted: true,
      wasActive: true,
      wantsDeducted: true,
    }),
    "skip",
  );
});

test("allows a post-baseline active order to receive its first deduction", () => {
  assert.equal(
    getInventoryUpdateAction({
      baselineProtected: false,
      wasDeducted: false,
      wasActive: false,
      wantsDeducted: true,
    }),
    "deduct",
  );
});

test("restores a post-baseline order when its status leaves the active set", () => {
  assert.equal(
    getInventoryUpdateAction({
      baselineProtected: false,
      wasDeducted: true,
      wasActive: true,
      wantsDeducted: false,
    }),
    "restore",
  );
});

test("does not restore an active-to-cancelled order that never had a deduction", () => {
  assert.equal(
    getInventoryUpdateAction({
      baselineProtected: true,
      wasDeducted: false,
      wasActive: true,
      wantsDeducted: false,
    }),
    "skip",
  );
});