import assert from "node:assert/strict";
import test from "node:test";
import { sortBatchesByExpiry } from "../src/routes/inventory-batch-order.mjs";

test("sorts by expiry even when a later-expiring batch was created or received earlier", () => {
  const batches = [
    {
      batchNumber: "later-expiry",
      expiryDate: new Date("2026-11-30T12:00:00.000Z"),
      receivedDate: new Date("2026-01-01T00:00:00.000Z"),
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    },
    {
      batchNumber: "earlier-expiry",
      expiryDate: new Date("2026-10-31T12:00:00.000Z"),
      receivedDate: new Date("2026-09-01T00:00:00.000Z"),
      createdAt: new Date("2026-09-01T00:00:00.000Z"),
    },
    { batchNumber: "no-expiry", expiryDate: null },
  ];

  assert.deepEqual(
    sortBatchesByExpiry(batches).map((batch) => batch.batchNumber),
    ["earlier-expiry", "later-expiry", "no-expiry"],
  );
});

test("does not use createdAt to order batches with the same expiry", () => {
  const batches = [
    {
      batchNumber: "first-in-list",
      expiryDate: new Date("2026-10-31T12:00:00.000Z"),
      createdAt: new Date("2026-09-15T00:00:00.000Z"),
    },
    {
      batchNumber: "older-created-at",
      expiryDate: new Date("2026-10-31T12:00:00.000Z"),
      createdAt: new Date("2026-08-15T00:00:00.000Z"),
    },
  ];

  assert.deepEqual(
    sortBatchesByExpiry(batches).map((batch) => batch.batchNumber),
    ["first-in-list", "older-created-at"],
  );
});
