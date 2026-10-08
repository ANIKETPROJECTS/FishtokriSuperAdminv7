---
name: Admark template rendering in Live Chat
description: How Admark exposes sent WhatsApp template values in its messages feed.
---

Admark's messages feed can return a template name and a separate `variables` object with keys such as `body1`, while the template body still contains numbered placeholders like `{{1}}`. The feed may omit variables on older or other message records.

**Why:** The delivered message was rendered correctly by Admark, but the admin Live Chat showed the unresolved template body because it did not apply the returned variable values.

**How to apply:** When displaying template messages, substitute numbered placeholders with the matching `bodyN` value in both chat bubbles and contact previews. If values are absent and placeholders remain, show the template name instead of exposing raw placeholder syntax. Keep the outbound send request unchanged.
