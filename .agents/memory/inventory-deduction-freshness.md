---
name: Inventory deduction freshness
description: Product policy for fallback inventory deductions on storefront and other active orders.
---

Automatic recovery must only deduct inventory for a newly created order within the short freshness window. Keep the normal order-creation path immediate, and do not let background scans, order-list reads, or first-time status transitions deduct a missed order after the window expires. Explicit order restoration and edits to an order already deducted remain separate intentional flows.

**Why:** A deduction recorded days after an order changes the wrong day's stock movement and corrupts historical daily calculations. The recovery scan must not turn a missed event into a retroactive inventory adjustment.

**How to apply:** Any new automatic deduction or retry path must check the order's creation time before changing stock. Do not run a historical backfill unless the user explicitly asks for one.