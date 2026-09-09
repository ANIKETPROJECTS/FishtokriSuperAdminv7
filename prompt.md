# FTW Frontend Inventory Deduction Implementation Prompt

## Objective

Implement inventory handling for **FTW storefront orders only** in the FTW application.

The FTW application must deduct stock only after the payment has been confirmed by a trusted payment result, and it must restore stock when the payment fails, is cancelled, or is refunded after a deduction.

Do not change inventory behavior for:

- FTS/POS orders
- FTN orders
- Manual admin orders
- Any order that is not clearly an FTW order

The existing admin API currently tries to auto-deduct orders that arrive with `inventoryDeducted: false`. The FTW flow must be coordinated with that behavior: the server-side background job must skip FTW orders, or the FTW inventory operation will race with the background job. Do **not** set `inventoryDeducted: true` as a fake claim without actually deducting stock.

## Important security requirement

If this is a browser frontend, do not connect directly to MongoDB and do not expose `MONGODB_URI` to the browser.

The actual inventory mutation must run in a trusted server-side route or server action owned by the FTW application. The browser should call that route after the payment provider result has been verified.

Use a MongoDB transaction if the deployment supports transactions. Otherwise use an atomic compare-and-set update, a distributed lock, or another server-side concurrency mechanism. A process-local JavaScript mutex is not sufficient when multiple app instances can run.

## Existing data layout

### Orders

- Database: `orders`
- Collection: `orders`
- Order Mongo `_id`: the internal order identifier
- Public order number: `orderId`, for example `#FTW202609082`
- FTW detection: use the public order number prefix `FTW` case-insensitively, allowing an optional leading `#`
- FTW orders commonly have `source: "online"`

Do not identify FTW orders by `paymentStatus` alone. FTW orders can arrive with inconsistent payment fields while a Razorpay payment is being reconciled. Use the order-number prefix and then use a trusted payment-verification result to decide whether to deduct or restore.

Relevant order fields:

```js
{
  _id: ObjectId("..."),
  orderId: "#FTW202609082",
  subHubId: "...",
  subHubName: "Thane",
  status: "pending" | "confirmed" | "out_for_delivery" | "delivered" | "cancelled" | "rejected",
  paymentStatus: "paid" | "partial" | "unpaid",
  inventoryDeducted: Boolean,
  items: [
    {
      productId: "...",
      name: "Baby Surmai Slices",
      quantity: 2,
      unit: "pack"
    }
  ]
}
```

### Sub-hub product inventory

Products are stored in the database belonging to the order's sub-hub.

For Thane, the current database is `Thane`.

- Collection: `products`
- Product ID: `products._id`
- Product name: `products.name`
- Top-level available quantity: `products.quantity`
- Batch inventory: `products.batches`

The product's top-level `quantity` must remain synchronized with the quantity of active, non-expired batches. Keep depleted batches with `quantity: 0`; do not delete them during a deduction.

Example batch shape:

```js
{
  _id: ObjectId("..."),
  batchNumber: "20260906BSS27",
  quantity: 4,
  receivedDate: ISODate("2026-09-06T03:40:02.176Z"),
  expiryDate: ISODate("2026-09-08T12:30:00.000Z"),
  createdAt: ISODate("2026-09-06T03:40:02.176Z")
}
```

`inventoryBatches` is not the inventory source used by the admin panel. Use `batches` and `quantity`.

### Inventory history

Inventory history is stored beside the product inventory:

- Database: the same sub-hub database, such as `Thane`
- Collection: `inventory_movements`

The admin Inventory Management history reads these movement documents. Use these exact movement types:

- `order_deduct` for a successful order deduction
- `order_restore` for a stock restoration

## FTW deduction flow

Create one idempotent server-side inventory operation for FTW payment confirmation.

### 1. Validate the order

Before mutating anything:

1. Load the order from `orders.orders`.
2. Confirm that `orderId` matches `/^#?FTW/i`.
3. Confirm that the payment provider has verified the payment as successful.
4. Resolve the order's `subHubId` or `subHubName` to the correct sub-hub database.
5. Resolve all order items to products.
6. Ignore zero or negative quantities.
7. Aggregate duplicate product IDs before checking or deducting stock.

Do not run this flow for FTS, FTN, POS, admin-manual, or unknown order types.

### 2. Make the operation idempotent

Retries are expected because payment webhooks and frontend requests can be delivered more than once.

Before deducting a product, check for an existing movement with:

```js
{
  type: "order_deduct",
  orderId: String(order._id),
  productId: String(product._id)
}
```

If the required deduction already exists, do not deduct again.

Also persist an FTW-specific processing state on the order, for example:

```js
{
  ftwInventoryStatus: "pending" | "deducted" | "restored" | "failed",
  ftwInventoryProcessedAt: Date,
  ftwInventoryOperationId: String
}
```

The movement record is the inventory source of truth. The order flag is useful for status and retry coordination, but it must not be trusted by itself to prove that stock was changed.

### 3. Pre-flight all products

Check every product before changing any product. If any product has insufficient stock, do not partially deduct the order.

For a product with a non-empty `batches` array:

- Exclude batches whose `expiryDate` is earlier than the current time.
- Available stock is the sum of the non-expired batch quantities.
- A batch without an expiry date is active.
- Reject the entire FTW deduction if available stock is lower than the requested quantity.

For a legacy product with no batches:

- Use the non-negative top-level `quantity`.
- Reject if it is lower than the requested quantity.

Return a clear out-of-stock result containing the product name, requested quantity, and available quantity. Do not create an `order_deduct` movement when the pre-flight check fails.

### 4. Deduct batches FIFO

For products with batches, consume stock in this order:

1. Earliest `expiryDate` first.
2. If expiry dates are equal, earliest `createdAt` first.
3. Batches without an expiry date sort after batches with an expiry date.

Skip expired batches. Reduce each consumed batch's `quantity` by the amount taken. Keep every batch in the array, including depleted batches with quantity `0`.

Persist the product by updating both:

```js
{
  batches: updatedBatches,
  quantity: sumOfNonExpiredBatchQuantities,
  updatedAt: new Date()
}
```

For a legacy product without batches, decrement the top-level quantity and update `updatedAt`.

If the product reaches zero, preserve the admin panel's existing combo behavior: combos containing that product may need to become inactive. If stock is later restored above zero, combos may become active again only when their other products also have stock.

## Deduction history document

After the product update succeeds, insert one movement document per deducted product:

```js
{
  type: "order_deduct",
  productId: String(product._id),
  productName: product.name || item.name || "",
  unit: product.unit || item.unit || "",
  change: -deductedQuantity,
  balance: newProductQuantity,
  orderId: String(order._id),
  orderRef: `#${String(order._id).slice(-6).toUpperCase()}`,
  batchNumbers: "BATCH_NUMBER_1, BATCH_NUMBER_2",
  subReason: "payment_confirmed",
  expiryDate: expiryDateOfTheOldestConsumedBatch || undefined,
  createdAt: new Date()
}
```

For a legacy product without batches, omit `batchNumbers` and `expiryDate`.

The current admin implementation stores consumed batch identifiers in the comma-separated `batchNumbers` field. It does not currently store the exact quantity taken from each batch in the movement document. For a more reliable FTW implementation, also store an optional allocation field without removing the existing fields:

```js
batchAllocations: [
  {
    batchId: String(batch._id),
    batchNumber: batch.batchNumber || "",
    quantity: quantityTaken
  }
]
```

This allocation is important if stock must later be restored to the exact original batches.

## Payment failure and restoration flow

Restoration must also be idempotent and FTW-only.

Trigger restoration when a trusted payment result says that an already-deducted FTW order was not successfully paid, was cancelled, was refunded, or otherwise must not remain reserved.

### Restoration rules

1. Load the order.
2. Confirm that it is an FTW order.
3. Find the order's successful `order_deduct` movements.
4. For each deducted product, check whether a matching `order_restore` already exists for the same order and product.
5. If a restore already exists, skip it.
6. Restore only the quantity that was actually deducted.
7. Never restore an order that has no successful deduction movement.

### Where to restore quantity

Preferred behavior: use `batchAllocations` from the deduction movement and add each quantity back to the same batch ID. This preserves batch accounting exactly.

If legacy movement data has no allocation information, use the existing compatibility behavior:

- Restore to the most recently received active batch.
- If no active batch exists, create a new batch with the restored quantity and the current timestamp.
- Do not add restored quantity to an expired batch.

After restoration, persist both the updated `batches` array and the recalculated non-expired top-level `quantity`.

### Restoration history document

Insert one document per restored product:

```js
{
  type: "order_restore",
  productId: String(product._id),
  productName: product.name || "",
  unit: product.unit || "",
  change: restoredQuantity,
  balance: newProductQuantity,
  orderId: String(order._id),
  orderRef: `#${String(order._id).slice(-6).toUpperCase()}`,
  batchNumbers: "RESTORED_BATCH_NUMBER",
  subReason: "payment_failed",
  createdAt: new Date()
}
```

Use a different `subReason` such as `order_cancelled` or `payment_refunded` when that is the actual cause.

Update the FTW order state only after the inventory operation has completed:

```js
{
  ftwInventoryStatus: "restored",
  ftwInventoryProcessedAt: new Date()
}
```

## Combos

If an FTW item references a combo rather than a direct product:

1. Resolve the combo from the sub-hub `combos` collection.
2. Expand its `includes` list.
3. For each included product, deduct:

```text
orderedComboQuantity × includedProductQuantity
```

4. Aggregate shared products across multiple combos before the pre-flight check.
5. Write movement history for the actual constituent products, not only for the combo.

If an item contains a direct product ID, use that product before attempting name-based lookup. Name lookup is only a fallback and must be exact, case-insensitive, and trimmed.

## Do not use these shortcuts

Do not:

- Deduct based only on a client-side “payment successful” screen.
- Connect MongoDB from browser code.
- Use `inventoryBatches`.
- Update only `products.quantity` while leaving `batches` unchanged.
- Replace the entire batch list from a stale frontend copy.
- Deduct FTW inventory through the existing generic order-create/order-update path.
- Call `PUT /api/inventory/products/:productId/batches` for an order deduction; it replaces batches but does not create the required order movement history.
- Use a generic `adjustment` movement when the event is an order deduction or restoration.
- Treat `inventoryDeducted: true` as proof that a product movement exists.
- Restore stock when no matching deduction happened.
- Restore the same order more than once.
- Filter FTW orders only by `paymentStatus`; storefront payment fields can be temporarily inconsistent.

The existing admin inventory API requires authentication. If the FTW application calls an API instead of using its own server-side database service, use a dedicated authenticated inventory operation endpoint that performs the whole idempotent operation server-side. Do not split “read stock” in the browser and “write stock” later.

## Required coordination with the admin API

The admin API currently has a background scan for active orders with `inventoryDeducted: false`. That scan must exclude FTW orders if the FTW application becomes the owner of FTW inventory deduction.

The exclusion should be based on the order number:

```js
{ orderId: { $not: /^#?FTW/i } }
```

Keep the existing automatic inventory behavior for FTS, FTN, POS, and other supported order types.

Do not work around the background scan by marking an FTW order as deducted before changing inventory. That would hide a real failed deduction.

## Acceptance tests

The implementation is complete only when all of these cases pass:

1. One paid FTW order deducts the requested quantity once.
2. Retrying the same payment webhook does not deduct again.
3. Two simultaneous FTW orders cannot oversell the same stock.
4. A payment failure before deduction creates no deduction movement.
5. A payment failure after deduction restores exactly once.
6. A repeated failure/refund event does not restore twice.
7. A cancelled FTW order with no deduction does not increase stock.
8. FIFO uses active batches and skips expired batches.
9. The product's `batches` and top-level `quantity` remain synchronized.
10. `inventory_movements` contains `order_deduct` and `order_restore` records visible in Inventory Management history.
11. Combo items deduct their constituent products correctly.
12. FTS, FTN, POS, and admin-manual orders are unaffected.
13. The existing admin background job cannot deduct the same FTW order.
14. A partial failure cannot leave a product changed without a corresponding movement record.
