---
name: Inventory deduction freshness
description: Product policy for fallback inventory deductions on storefront and other active orders.
---

The background and order-list fallback paths may recover active, non-deleted orders regardless of `createdAt` age, but only when their IDs were not present in the read-only baseline captured before the API accepts traffic. Status-update inventory sync must also skip every baseline ID and preserve its current deduction flag. Keep normal order-creation deduction immediate; post-baseline first-time status transitions retain the separate short freshness guard. Explicit order restoration and deletion remain separate intentional flows.

**Why:** Removing the age cutoff naively would replay existing undeducted orders and alter historical stock. A startup ID baseline allows future missed orders to be recovered regardless of their stored `createdAt` while protecting every record that already existed.

**How to apply:** Initialize the baseline before starting the server or fallback timers; filter active statuses in MongoDB before selecting the 200-order batch, then exclude baseline IDs before filling that batch. The baseline is read-only and must never update orders, inventory, or movement records.