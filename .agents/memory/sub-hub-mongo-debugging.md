---
name: Sub-hub Mongo debugging
description: A caution about inspecting FishTokri sub-hub product data outside the running API workflow.
---

Direct Mongo shell probes using the workspace URI can resolve to the default database and show no `sub_hubs`, even while the API workflow is serving valid scoped sub-hub data.

**Why:** The API selects a database per sub-hub and may use a workflow-specific runtime connection context; an apparently empty direct probe can be misleading.

**How to apply:** Prefer the API’s authenticated response and workflow logs when debugging sub-hub products. Do not mutate product data based only on an empty direct shell probe.