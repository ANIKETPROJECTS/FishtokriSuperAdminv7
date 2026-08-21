---
name: Order timeslot display source
description: Canonical source for delivery slot display after pincode-based time adjustments
---

All order-facing delivery slot displays should prefer the persisted `timeslotStart` and `timeslotEnd` fields over `timeslotLabel`. The label may retain a legacy or unadjusted range when an order has a pincode time delay.

**Why:** The table and invoice already used the persisted range, while the order detail panel rendered the label directly, allowing one order to show different delivery times in different views.

**How to apply:** When adding any new order timeslot display, use the shared start/end formatter first. When saving a new slot with a pincode delay, adjust both the persisted end time and any label fallback.