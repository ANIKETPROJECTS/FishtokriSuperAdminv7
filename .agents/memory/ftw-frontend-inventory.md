---
name: FTW frontend-owned inventory
description: FTW payment inventory ownership and the coordination required with the admin API.
---

FTW inventory is intended to be deducted and restored by a trusted server-side service in the FTW application, while FTS, FTN, POS, and manual orders retain the admin API's existing inventory flow.

**Why:** The admin background scanner can see an undeducted FTW order after it is inserted, causing a race with frontend-owned processing and leaving paid/delivered orders without reliable inventory state.

**How to apply:** FTW processing must be idempotent, batch-aware, and history-aware; the admin background scanner must explicitly exclude FTW orders rather than treating `inventoryDeducted: true` as a fake claim. See the root `prompt.md` for the full contract.