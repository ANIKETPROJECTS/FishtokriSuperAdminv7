---
name: Storefront order paymentStatus on arrival
description: FTN/FTW storefront orders arrive pre-paid (paymentStatus:"paid") even when status:"pending" — filtering by paymentStatus ne "paid" skips them.
---

## Rule
When scanning for storefront (FT*) orders that need auto-fix, do **not** filter by `paymentStatus: { $ne: "paid" }`.

**Why:** Storefront orders (FTN, FTW) are pre-paid via Razorpay at checkout. They arrive in the DB with `paymentStatus: "paid"` AND `status: "pending"` (waiting for admin confirmation). Filtering out paid orders silently excludes ALL real storefront orders.

**How to apply:** The `autoFixStorefrontPaymentMode` background job in `artifacts/api-server/src/index.ts` filters only by `status: { $nin: ["delivered", "cancelled", "rejected"] }` and `isDeleted: { $ne: true }` — never by paymentStatus.
