---
name: WhatsApp template parameter newlines are unreliable
description: Newlines sent inside a WhatsApp Business API template variable (e.g. via Admark relay) are not guaranteed to render as line breaks — the relay/Meta layer may collapse them (observed as " | " joins) instead of rejecting the message.
---

Sending `\n` inside a template parameter value (e.g. a multi-line items list) can silently get collapsed into a single line by the WhatsApp Business API relay, even though the request succeeds and the docs/sample values show `\n` as valid.

**Why:** Confirmed via a real delivered `fishtokri_order_confirmed` message where the items list arrived pipe-separated (" | ") instead of one-per-line, despite the code correctly joining with `"\n"` and the relay (Admark) accepting the request without error.

**How to apply:** For any list-like data embedded in a single WhatsApp template variable, don't rely on `\n` alone for readability — prefix each entry with a sequence number (`1. `, `2. `, …) so the list still reads as ordered/sequential even if line breaks get stripped or replaced by the relay.
