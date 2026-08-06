---
name: Product sales modes
description: The supported product availability choices for normal and preorder ordering.
---

Products support only two sales modes: `normal` and `preorder_only`. The combined normal-and-preorder mode was intentionally retired.

**Why:** The product configuration should expose only the two business choices the digital menu and admin workflows currently support, avoiding ambiguous product eligibility.

**How to apply:** Keep new product forms, imports, API validation, menu filtering, and documentation aligned to these two values. Treat any legacy combined-mode record as normal rather than offering or creating it.