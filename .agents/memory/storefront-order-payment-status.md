---
name: Storefront order paymentStatus on arrival
description: FTN/FTW storefront orders arrive pre-paid (paymentStatus:"paid") even when status:"pending" — filtering by paymentStatus ne "paid" skips them.
---

## Rule
When scanning for storefront (FT*) orders that need auto-fix, do **not** filter by `paymentStatus: { $ne: "paid" }`. Some FTW records can have a Razorpay transaction ID while still carrying `paymentStatus: "unpaid"`, empty `payments`, and a full `dueAmount`.

**Why:** Storefront orders (FTN, FTW) are intended to be pre-paid via Razorpay at checkout. Most arrive in the DB with `paymentStatus: "paid"` and `status: "pending"`, but some FTW records have a Razorpay transaction ID without the corresponding paid fields.

**How to apply:** The `autoFixStorefrontPaymentMode` background job in `artifacts/api-server/src/index.ts` filters only by `status: { $nin: ["delivered", "cancelled", "rejected"] }` and `isDeleted: { $ne: true }` — never by paymentStatus. A future server-side safeguard should reconcile FTW/Razorpay records rather than relying only on the storefront callback.
