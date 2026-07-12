---
name: Two separate delivery-charge fields on FishTokri orders
description: Orders have both `slotCharge` and `deliveryCharge` fields that both render as "Delivery charge" in some views; a display spot that only reads one of them will silently miss orders from the other source.
---

FishTokri admin order documents can carry the "delivery fee" amount in **either** of two different fields depending on
where the order was created:

- `deliveryCharge` — set by the admin's own order-creation form (source `admin_manual`, order IDs prefixed `#FTS`).
- `slotCharge` — set by the customer-facing storefront/online orders (source `online`, order IDs prefixed `#FTW`).
  These orders never populate `deliveryCharge` at all.

Both fields are already summed into the order total (`subtotal - discount + slotCharge + deliveryCharge + instantDeliveryCharge`)
and the order-detail sheet / printed invoice already label `slotCharge > 0` as "Delivery charge" — but the "All Orders"
list's compact total sub-line only checked `deliveryCharge`, so FTW/storefront orders showed no delivery-charge breakdown
even when they had one.

**Why:** the two order-creation paths (admin manual vs. customer storefront) never got fully reconciled onto a single field name.

**How to apply:** any new UI that shows an order's "delivery charge" must check **both** `slotCharge` and `deliveryCharge`
(show them as separate lines, as the detail view does) rather than assuming one field covers all order sources. Don't
merge them into one number without checking whether both can be non-zero on the same order.
