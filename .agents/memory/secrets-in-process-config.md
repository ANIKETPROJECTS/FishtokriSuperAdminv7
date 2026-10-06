---
name: Secrets in process configuration
description: Avoid plaintext secret copies in tracked process configuration.
---

After adding or updating a Replit secret, check tracked process configuration for plaintext copies. Keep application and process configuration wired to the environment variable rather than embedding the secret.

**Why:** a secure secret update was reflected as a literal in the tracked process configuration during this work, despite application code using the environment variable.

**How to apply:** inspect the changed configuration without printing secret values, replace literal assignments with `process.env` references, and confirm the runtime receives the Replit-managed value.
