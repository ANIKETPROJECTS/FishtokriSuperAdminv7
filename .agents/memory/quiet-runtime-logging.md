---
name: Quiet runtime logging
description: Runtime logging defaults to failures only, with request access logs disabled and PM2 stdout discarded.
---

The API should default to error-only runtime logging. Request/access logging is disabled, while explicit error logs remain available for diagnosis. PM2 should discard child stdout but retain stderr/error output.

**Why:** Routine startup, polling, request, and successful-operation output was accumulating continuously in production logs and obscuring actual failures.

**How to apply:** Set `LOG_LEVEL=info` only for deliberate local diagnostics; do not re-enable automatic request logging or route-level success logging as part of normal feature work.