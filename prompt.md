# Coupon Usage Tracking — Implementation Prompt

This document explains exactly how the coupon system works in FishTokri and how to replicate the same logic in the customer-facing frontend app. Both apps share the same MongoDB Atlas cluster, so the data is already there.

---

## MongoDB — Where the Data Lives

### 1. Coupon definitions
**Database:** `<subHubName>` (each sub-hub has its own database, e.g. `Thane`)
**Collection:** `coupons`

Each document looks like:
```json
{
  "_id": "ObjectId(...)",
  "code": "ONETIME",
  "title": "Test",
  "description": "Test",
  "type": "flat",
  "discountValue": 50,
  "minOrderAmount": 100,
  "maxUsage": 1,
  "isFirstTimeOnly": true,
  "isActive": true,
  "applicableCategories": [],
  "applicableProducts": [],
  "expiresAt": null,
  "color": ""
}
```

`maxUsage` is the maximum number of times **a single customer** can use this coupon. `null` or missing means unlimited.

---

### 2. Customer coupon usage
**Database:** `customers`
**Collection:** `customers`

Each customer document has two coupon arrays:

#### `activeCoupons` — coupons locked in currently active (non-delivered) orders
```json
"activeCoupons": [
  {
    "couponId": "ObjectId as string",
    "couponCode": "ONETIME",
    "couponTitle": "Test",
    "subHubId": "ObjectId as string",
    "usedCount": 1,
    "orderIds": ["orderId1", "orderId2"],
    "appliedAt": "ISODate"
  }
]
```

- One entry per unique coupon (keyed by `couponId`).
- `usedCount` = how many currently active orders have this coupon applied.
- `orderIds` = the list of those active order IDs.
- Entry is removed automatically when `usedCount` drops to 0.

#### `usedCoupons` — coupons from orders that were delivered (permanent history)
```json
"usedCoupons": [
  {
    "couponId": "ObjectId as string",
    "couponCode": "ONETIME",
    "couponTitle": "Test",
    "orderId": "ObjectId as string",
    "subHubId": "ObjectId as string",
    "usedAt": "ISODate"
  }
]
```

- One entry **per delivered order** (not aggregated like activeCoupons).
- Never removed once written — it is permanent history.

---

### 3. Orders
**Database:** `orders`
**Collection:** `orders`

Each order stores the coupon(s) applied:
```json
{
  "couponId": "ObjectId as string",
  "couponCode": "ONETIME",
  "couponTitle": "Test",
  "status": "pending"
}
```

Active statuses (order is live): `pending`, `confirmed`, `out_for_delivery`, `takeaway`
Terminal statuses: `delivered`, `cancelled`

---

## How to Calculate Total Coupon Usage for a Customer

```
totalUsage = activeCoupons[couponId].usedCount + count(usedCoupons where couponId matches)
```

If `totalUsage >= coupon.maxUsage` → the customer has exhausted this coupon.

---

## Logic to Implement

### When displaying available coupons (before order is placed)

Before showing a coupon to the customer in the UI, check if they have reached the limit:

```js
function isCouponExhausted(coupon, customer) {
  if (!coupon.maxUsage || coupon.maxUsage <= 0) return false; // unlimited

  const couponId = String(coupon._id);

  // Count active usage
  const activeEntry = (customer.activeCoupons ?? []).find(
    (ac) => String(ac.couponId) === couponId
  );
  const activeCount = activeEntry
    ? (activeEntry.usedCount != null ? Number(activeEntry.usedCount) : 1)
    : 0;

  // Count historical usage (delivered orders)
  const historicalCount = (customer.usedCoupons ?? []).filter(
    (uc) => String(uc.couponId) === couponId
  ).length;

  return activeCount + historicalCount >= Number(coupon.maxUsage);
}
```

Hide (do not show) any coupon where `isCouponExhausted` returns `true`.

---

### When an order is created (POST /orders or equivalent)

**Before inserting the order**, check usage limit server-side:

```
1. Extract couponId from the order payload
2. Fetch the coupon document from <subHubName>.coupons by _id
3. Fetch the customer document from customers.customers by _id
4. Compute totalUsage = activeCoupons[couponId].usedCount + usedCoupons[couponId].count
5. If coupon.maxUsage > 0 AND totalUsage >= coupon.maxUsage → reject with 400 error
```

**After inserting the order successfully**, update the customer's `activeCoupons`:

```
// Try to increment an existing entry for this couponId
result = db.customers.updateOne(
  { _id: customerId, "activeCoupons.couponId": couponId },
  {
    $inc: { "activeCoupons.$.usedCount": 1 },
    $addToSet: { "activeCoupons.$.orderIds": orderId }
  }
)

// If no existing entry was found, create a new one
if (result.matchedCount === 0) {
  db.customers.updateOne(
    { _id: customerId },
    {
      $push: {
        activeCoupons: {
          couponId: couponId,
          couponCode: couponCode,
          couponTitle: couponTitle,
          subHubId: subHubId,
          usedCount: 1,
          orderIds: [orderId],
          appliedAt: new Date()
        }
      }
    }
  )
}
```

---

### When an order is cancelled or rejected

Decrement the `usedCount` and remove the orderId. If `usedCount` reaches 0, remove the entire entry so the coupon becomes available again:

```
// Step 1 — decrement usedCount
db.customers.updateOne(
  { _id: customerId, "activeCoupons.couponId": couponId },
  { $inc: { "activeCoupons.$.usedCount": -1 } }
)

// Step 2 — remove orderId from orderIds array
db.customers.updateOne(
  { _id: customerId },
  { $pull: { "activeCoupons.$[elem].orderIds": orderId } },
  { arrayFilters: [{ "elem.couponId": couponId }] }
)

// Step 3 — remove entries where usedCount has dropped to 0 or below
db.customers.updateOne(
  { _id: customerId },
  { $pull: { activeCoupons: { couponId: couponId, usedCount: { $lte: 0 } } } }
)
```

---

### When an order is delivered

Move the coupon from `activeCoupons` to `usedCoupons` permanently:

```
// Step 1 — decrement activeCoupons (same 3-step process as cancel above)
// ... (run the same 3 steps from the cancel section)

// Step 2 — push to usedCoupons as permanent history
db.customers.updateOne(
  { _id: customerId },
  {
    $push: {
      usedCoupons: {
        couponId: couponId,
        couponCode: couponCode,
        couponTitle: couponTitle,
        orderId: orderId,
        subHubId: subHubId,
        usedAt: new Date()
      }
    }
  }
)
```

---

## Summary of All State Transitions

| Order event | activeCoupons | usedCoupons |
|---|---|---|
| Order created | upsert entry, `usedCount++`, push `orderId` | no change |
| Order cancelled / rejected / deleted | decrement `usedCount`, remove `orderId`; delete entry if count = 0 | no change |
| Order delivered | decrement `usedCount`, remove `orderId`; delete entry if count = 0 | push permanent entry |
| Order un-delivered (back to active) | upsert entry, `usedCount++`, push `orderId` | remove entry for this orderId |
| Order un-cancelled (back to active) | upsert entry, `usedCount++`, push `orderId` | no change |

---

## Key Rules

1. **One `activeCoupons` entry per coupon** — never push duplicate entries. Always upsert using the `couponId` as the key.
2. **`usedCoupons` is permanent** — never delete from it unless un-delivering an order.
3. **`maxUsage` is per-customer** — the limit is how many times that one customer can use the coupon total (active + historical), not a global count.
4. **Always enforce server-side** — do the `maxUsage` check in the API before inserting the order, regardless of what the frontend shows.
5. **Hide exhausted coupons on the frontend** — do not show coupons where `activeCount + historicalCount >= maxUsage` to the logged-in customer.
