---
name: Delivery zone overlap rule
description: The confirmed precedence rule for overlapping delivery-zone pincode memberships.
---

When an order pincode belongs to multiple zones, use the farthest matching assignment: highest zone rank first, then highest pincode rank.

**Why:** Dispatch sorting is intended to surface relatively farther delivery areas first, and choosing the farthest match avoids hiding the more distant assignment.

**How to apply:** Keep the rule consistent in order enrichment, the displayed Zone column, and zone sorting.