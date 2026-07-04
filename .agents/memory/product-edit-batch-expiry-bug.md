---
name: Product edit forms must not round-trip read-only sub-resources
description: Why the Edit Product form was silently corrupting inventory batch expiry times, and the pattern to avoid.
---

Forms that display a nested/related resource (e.g. inventory batches) as read-only inside an "Edit Parent" modal must NOT reload that resource with a lossy format (date-only, no time-of-day) and then unconditionally re-PUT it back to its own endpoint on every parent save.

**Why:** The Edit Product modal loaded batch `expiryDate`/`receivedDate` via `.toISOString().slice(0, 10)` (date-only) purely for display, but then re-submitted that same truncated value back to the batches API on every product save — even though the batch fields were rendered `readOnly`. A date-only string like `"2026-07-06"` parses as UTC midnight, which displays as 05:30 AM in IST, so every product edit silently reset batch expiry times to 5:30 AM.

**How to apply:** If a sub-resource is read-only in a given form/modal, don't send it back to its own update endpoint from that form at all — let the dedicated page/flow (e.g. Inventory Management) own writes to it. If you must reload a date for display truncation, keep the full ISO value in state separately from the display value, and never feed the truncated display value back into a save payload.
