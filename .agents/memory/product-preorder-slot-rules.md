---
name: Product preorder slot rules
description: Compatibility semantics for product-level recurring preorder timeslot restrictions
---

Product preorder availability may optionally include a timeslot allow-list keyed by weekday number. A missing weekday key is unrestricted; an explicit empty list disables every slot for that weekday.

**Why:** Existing products already use date and weekday availability without slot restrictions, so adding a default restriction would silently make legacy preorder products unavailable.

**How to apply:** Preserve omitted rules during API normalization and apply the rule only to preorder POS slot filtering. Intersect the allowed slots across every preorder product in the cart.