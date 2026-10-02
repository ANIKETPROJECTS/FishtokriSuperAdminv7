---
name: Inventory deduction freshness
description: Product policy for fallback inventory deductions on storefront and other active orders.
---

The background and order-list fallback paths may recover active, non-deleted orders regardless of `createdAt` age, but only when their IDs were not present in the read-only baseline captured before the API accepts traffic. Status updates must skip baseline IDs for deductions and item reconciliation, but must restore stock when an already-deducted active order transitions to an inactive status. Keep normal order-creation deduction immediate; post-baseline first-time status transitions retain the separate short freshness guard.

**Why:** Removing the age cutoff naively would replay existing undeducted orders and alter historical stock. A startup ID baseline allows future missed orders to be recovered regardless of their stored `createdAt` while protecting every record that already existed. A blanket status-update skip also blocks the legitimate inverse of a prior deduction on cancellation.

**How to apply:** Initialize the baseline before starting the server or fallback timers; filter active statuses in MongoDB before selecting the 200-order batch, then exclude baseline IDs before filling that batch. On status updates, allow only the active-to-inactive restoration when the order was already deducted; do not restore a baseline order merely because it is opened or edited while already inactive. The baseline itself is read-only.