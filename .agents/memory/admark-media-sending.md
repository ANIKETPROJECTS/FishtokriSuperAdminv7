---
name: Admark media sending contract
description: Non-obvious upload and outbound media-message behavior for the Admark WhatsApp API.
---

Admark's media flow has two separate contracts: upload the file through the media upload endpoint, then send it with `GET /api/send/bymedia` using `mediaUrl` and `mediaType` query parameters. The upload response places the public URL at the top level (`url` and/or `cloudUrl`), not necessarily inside a `file` object.

**Why:** The text chat endpoint accepts the normal JSON text payload but rejects the custom nested media payload, causing attachments to upload successfully and then fail during send.

**How to apply:** Preserve the uploaded public URL, map MIME types to `image`, `video`, or `document`, and pass `phoneNumber`, `phoneNumberId`, `mediaUrl`, `mediaType`, optional `documentName`, and optional `caption` to `/api/send/bymedia`.