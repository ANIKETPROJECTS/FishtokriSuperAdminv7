---
name: FTW inventory ownership
description: Durable ownership split for storefront FTW inventory reservation and FishTokri Admin edits.
---

The FTW storefront checkout owns inventory reservation, deduction, inventory-history logging, and payment-failure restoration. FishTokri Admin must not auto-deduct FTW orders from order-list loads or recurring background scans; admin order edits remain allowed to synchronize FTW inventory.

**Why:** A simultaneous FTS/POS and FTW checkout can be processed in an order that leaves the FTW order with no stock when the admin background scan handles it late. Moving the FTW reservation to the checkout flow lets it reserve at the payment attempt and restore failed reservations idempotently.

**How to apply:** Identify FTW by public order ID prefix `FTW`/`#FTW`, keep FTS/POS behavior unchanged, and coordinate via the order's `inventoryDeducted` state plus durable operation/allocation records so frontend retries and admin edits cannot double-deduct or double-restore.