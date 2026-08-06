---
name: Product sales modes
description: The supported product availability choices for normal and preorder ordering.
---

Products support only two sales modes: `normal` and `preorder_only`. The combined normal-and-preorder mode was intentionally retired. Preorder-only products may additionally use `preorderAvailability` with `type: "all"`, `type: "weekdays"` plus weekday numbers (`0` Sunday through `6` Saturday), `type: "date_range"` with inclusive `startDate` and `endDate` values, or `type: "date_range_and_weekdays"` where both conditions must pass.

**Why:** The product configuration should expose only the two business choices the digital menu and admin workflows currently support, avoiding ambiguous product eligibility.

**How to apply:** Keep new product forms, imports, API validation, menu filtering, and documentation aligned to these two values. Treat any legacy combined-mode record as normal rather than offering or creating it. When a preorder delivery date changes, filter preorder products using the saved availability schedule and remove cart items that are no longer eligible. For combined availability, require both the date range and selected weekday to match.