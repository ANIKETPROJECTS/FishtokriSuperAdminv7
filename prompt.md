# FTW Frontend Inventory Ownership Prompt

## Objective

Implement inventory reservation, deduction, inventory-history logging, and restoration for **FTW orders only**.

An FTW order is an order whose public order ID starts with `FTW` or `#FTW`, for example:

```text
#FTW202609082
```

FTS orders are POS/admin orders and must not be handled by this flow.

## Ownership rules

1. The FTW checkout application owns inventory for FTW orders from the moment the customer clicks **Pay via UPI**.
2. The FishTokri Admin API must not automatically deduct undeducted FTW orders when:
   - the order is first inserted into MongoDB;
   - the admin orders page is opened;
   - the recurring inventory scan runs;
   - the FTW order is merely received from the storefront.
3. FishTokri Admin remains allowed to synchronize FTW inventory when an administrator edits the order:
   - an active FTW order with `inventoryDeducted !== true` can be deducted;
   - an active FTW order whose items change must restore the old item quantities and deduct the new item quantities;
   - cancelling, deleting, or otherwise moving a deducted FTW order out of an active status can restore its inventory.
4. FTS/POS orders keep their existing admin-side inventory behavior. Do not disable or change FTS deduction.

## Database locations

Use the existing shared MongoDB structure:

- Orders database: `orders`
- Orders collection: `orders`
- Each sub-hub product database: the sub-hub's `dbName`, such as `Thane`
- Product collection: `products`
- Inventory history collection: `inventory_movements`
- Master sub-hub metadata: database `fishtokri_admin`, collection `sub_hubs`

The order's `subHubId` or `subHubName` must be resolved before accessing products. Never deduct from a hard-coded sub-hub database.

## Required payment flow

### When Pay via UPI is clicked

The checkout backend, not only browser JavaScript, must start an idempotent FTW inventory reservation before redirecting to or opening the UPI payment flow.

The operation must:

1. Load the FTW order and verify its public `orderId` starts with `FTW`.
2. Load the order's product items and resolve the correct sub-hub.
3. Atomically claim the inventory operation for this order so two clicks, retries, webhook retries, or two browser tabs cannot deduct twice.
4. Check all requested products before changing any product. If any item is short, do not partially deduct the order.
5. Deduct inventory using the batch rules below.
6. Write an `order_deduct` movement for every deducted product.
7. Mark the order as inventory-reserved/deducted only after the product changes and movement records succeed.

The browser may call this operation, but the browser must not connect directly to MongoDB or be the only source of truth for inventory. Use a trusted frontend backend/API route.

## Product deduction rules

### Normal products with batches

Product inventory is stored in the product document:

```js
{
  _id: ObjectId("..."),
  quantity: Number,
  batches: [
    {
      _id: ObjectId("..."),
      batchNumber: String,
      quantity: Number,
      receivedDate: Date,
      expiryDate: Date | null,
      shelfLifeDays: Number | null,
      notes: String
    }
  ]
}
```

For each product:

1. Consider only batches whose `expiryDate` is missing or has not passed.
2. Sort eligible batches FIFO:
   - earliest expiry first;
   - then earliest `createdAt` for equal expiry dates.
3. Deduct from those batches in order.
4. Keep consumed and expired batches in the array with their resulting quantity. Do not delete them.
5. Recalculate top-level `quantity` as the sum of non-expired batch quantities.
6. Persist both `batches` and `quantity`.

Before any mutation, calculate the available quantity for every product. If any requested quantity is greater than available quantity, reject the complete operation with no product or movement changes.

### Legacy products without batches

If `batches` is absent or empty, decrement the top-level `quantity`. Never create a fake batch solely to record an order deduction unless the existing application explicitly requires it.

### Combos

If an order item is a combo, resolve it through the sub-hub's `combos` collection and expand its `includes` into constituent products before checking or changing stock. Aggregate repeated product IDs across all items and combos so a shared product is deducted once for the combined quantity.

## Inventory-history records

Insert one history document per product deduction. Use the existing shape so the Admin Inventory History screen can display it:

```js
{
  type: "order_deduct",
  productId: "<product ObjectId as string>",
  productName: "<product name>",
  unit: "<unit>",
  change: -quantityDeducted,
  balance: <product available quantity after deduction>,
  orderId: "<internal Mongo order _id as string>",
  orderRef: "#<last 6 characters of internal order _id in uppercase>",
  batchNumbers: "<comma-separated FIFO batch numbers>",
  subReason: "order_placed",
  expiryDate: <oldest consumed batch expiry or null>,
  createdAt: <server Date>
}
```

For reliable restoration, also persist an allocation ledger for the order or movement. It must record the exact amount taken from each batch:

```js
{
  batchId: "<embedded batch _id>",
  batchNumber: "<batch number>",
  quantity: <quantity taken from this batch>
}
```

The current Admin history shape records `batchNumbers`, but not enough per-batch quantity detail to reconstruct a historical deduction safely. Do not attempt restoration by guessing from the product's current batches.

## Payment failure, cancellation, or browser close

If payment fails, the user cancels payment, the payment session expires, or the order is cancelled, restore the exact quantities previously reserved for that order.

Restoration must be idempotent:

1. Atomically claim a single restore operation for the order/reservation.
2. If the reservation was never committed, do nothing.
3. If it was already restored, return success without changing stock again.
4. Use the saved batch allocation ledger to add quantities back to the original batches.
5. If an original batch still exists, restore to that batch even if it is no longer the newest batch.
6. If an original batch was removed, fail visibly and send the order to an inventory-reconciliation queue. Never silently add stock to an arbitrary batch.
7. Recalculate top-level `quantity` from non-expired batches.
8. Insert one restoration movement per product:

```js
{
  type: "order_restore",
  productId: "<product ObjectId as string>",
  productName: "<product name>",
  unit: "<unit>",
  change: quantityRestored,
  balance: <product available quantity after restoration>,
  orderId: "<internal Mongo order _id as string>",
  orderRef: "#<last 6 characters of internal order _id in uppercase>",
  batchNumbers: "<comma-separated restored batch numbers>",
  subReason: "payment_failed" // or payment_cancelled, payment_expired, browser_closed, order_cancelled
  createdAt: <server Date>
}
```

### Browser-close limitation

`beforeunload` and `sendBeacon` are best-effort only. They cannot guarantee restoration if the browser, device, or network disappears. Also implement a trusted server-side recovery path:

- use the payment provider's failure/cancel/expiry webhook when available;
- mark reservations with an expiration time;
- run a reconciliation job for expired, unpaid FTW reservations;
- restore only reservations that were actually committed and have not already been restored.

Do not restore only because a frontend timer fired, and do not restore a successful payment.

## Order flags and idempotency state

After a successful FTW reservation/deduction, update the order state so the Admin API will not deduct it again during a later edit:

```js
{
  inventoryDeducted: true,
  ftwInventoryManagedBy: "frontend",
  ftwInventoryState: "reserved",
  ftwInventoryOperationId: "<unique operation ID>"
}
```

After a successful restoration:

```js
{
  inventoryDeducted: false,
  ftwInventoryState: "restored",
  ftwInventoryRestoreOperationId: "<unique restore operation ID>"
}
```

Do not set `inventoryDeducted: true` before the product update and movement insert succeed. Do not set it back to `false` until restoration succeeds.

Use a durable unique operation key such as:

```text
ftw:<orderMongoId>:deduct
ftw:<orderMongoId>:restore:<reservationId>
```

The key must be enforced atomically by the backend/database, not just kept in frontend React state.

## Concurrency requirements

FTW and FTS may be placed at nearly the same time for the same product. The inventory mutation must serialize competing deductions against the shared product document or use a MongoDB transaction/conditional update. A frontend-only local lock is insufficient because the Admin API and frontend backend are separate processes.

The operation must never:

- deduct more than once for the same FTW reservation;
- restore more than once for the same failed payment;
- partially deduct a multi-item order after discovering a later item is out of stock;
- let the Admin background scan deduct an FTW order;
- let an admin edit double-deduct an FTW order already marked `inventoryDeducted: true`;
- restore an FTW order whose frontend reservation was never committed.

## Acceptance checklist

- FTW orders are not changed by the Admin orders-page scan or recurring inventory scan.
- FTS/POS automatic deduction is unchanged.
- Clicking Pay via UPI creates one FTW inventory reservation.
- A retry of the same click does not create another deduction or movement.
- The Admin Inventory History page shows `order_deduct` records for FTW reservations.
- Failed, cancelled, expired, or abandoned payments restore the exact batch quantities once.
- The Admin Inventory History page shows matching `order_restore` records.
- A later admin edit can intentionally deduct/restore an FTW order through the existing order-edit lifecycle.
- Payment success never triggers a restoration.
- All failures are logged with the FTW order ID, internal order `_id`, product ID, operation ID, and reason.