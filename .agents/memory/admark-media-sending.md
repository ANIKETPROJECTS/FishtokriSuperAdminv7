---
name: Admark media sending contract
description: Non-obvious upload and outbound media-message behavior for the Admark WhatsApp API.
---

Admark's media flow has separate send and receive contracts. For outbound media, upload the file through the media upload endpoint, then send it with `GET /api/send/bymedia` using `mediaUrl` and `mediaType` query parameters. The upload response places the public URL at the top level (`url` and/or `cloudUrl`), not necessarily inside a `file` object. For inbound media, `/get-messages` may contain only the type-specific media ID; fetch it through `GET /api/media-proxy/:id` with the Admark API key in the `api-key` header. This returns JSON containing `mime_type` and `base64Content`, which should be proxied server-side so the key never reaches the browser.

**Why:** The text chat endpoint accepts the normal JSON text payload but rejects the custom nested media payload, causing attachments to upload successfully and then fail during send. Message history also doesn't reliably include a renderable media URL, while Admark's media proxy can resolve the ID directly.

**How to apply:** For sending, preserve the uploaded public URL, map MIME types to `image`, `video`, or `document`, and pass `phoneNumber`, `phoneNumberId`, `mediaUrl`, `mediaType`, optional `documentName`, and optional `caption` to `/api/send/bymedia`. For displaying inbound media, call Admark's media proxy from the API server, decode its base64 response, and return the bytes without exposing the Admark API key to the frontend.