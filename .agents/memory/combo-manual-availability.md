---
name: Combo manual availability
description: How manual combo activation interacts with inventory availability.
---

Keep manual combo enablement separate from whether its products are currently in stock. A combo is sellable only when the admin has enabled it and all included products have stock. Inventory updates may change the effective availability, but must never override a deliberate manual disable.

**Why:** Inventory-based reactivation previously treated every inactive combo as stock-disabled, so a later restock could undo an admin's manual disable.

**How to apply:** Store the manual choice independently from effective `isActive`. When reading combos for storefront/order consumers, derive effective availability from the manual choice and current stock. For legacy records without the manual field, preserve an existing inactive value as manually disabled; require an explicit admin re-enable rather than risking an unintended activation.
