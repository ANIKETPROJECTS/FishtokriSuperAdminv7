import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";

const router = Router();
router.use(requireAuth as any);

const WABA_BASE = "https://verifiedwhatsapp.admarksolution.com";
const apiKey = () => process.env.WABA_API_KEY || "";
const phoneId = () => process.env.WABA_PHONE_ID || "";

// ── GET /api/live-chat/contacts ───────────────────────────────────────────────
// Returns all contacts sorted by last-message time.
router.get("/contacts", async (req, res) => {
  try {
    const url = new URL(`${WABA_BASE}/get-contacts`);
    url.searchParams.set("api-key", apiKey());
    url.searchParams.set("phoneNumberId", phoneId());
    const resp = await fetch(url.toString());
    if (!resp.ok) {
      res.status(resp.status).json({ error: `Admark error ${resp.status}` });
      return;
    }
    const data = await resp.json();
    res.json(data);
  } catch (err: any) {
    req.log?.error({ err }, "live-chat/contacts failed");
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/live-chat/messages/:number ───────────────────────────────────────
// Returns paginated message history for a contact.
router.get("/messages/:number", async (req, res) => {
  try {
    const { number } = req.params;
    const { page = "1", limit = "50" } = req.query as Record<string, string>;
    const url = new URL(`${WABA_BASE}/get-messages`);
    url.searchParams.set("api-key", apiKey());
    url.searchParams.set("phoneNumberId", phoneId());
    url.searchParams.set("number", number);
    url.searchParams.set("page", page);
    url.searchParams.set("limit", limit);
    const resp = await fetch(url.toString());
    if (!resp.ok) {
      res.status(resp.status).json({ error: `Admark error ${resp.status}` });
      return;
    }
    const data = await resp.json();
    res.json(data);
  } catch (err: any) {
    req.log?.error({ err }, "live-chat/messages failed");
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/live-chat/send ──────────────────────────────────────────────────
// Body: { number: string; message: string }
router.post("/send", async (req, res) => {
  try {
    const { number, message } = req.body ?? {};
    if (!number || !message) {
      res.status(400).json({ error: "number and message are required" });
      return;
    }
    const url = new URL(`${WABA_BASE}/api/send/bytextreply`);
    url.searchParams.set("api-key", apiKey());
    url.searchParams.set("phoneNumber", String(number));
    url.searchParams.set("phoneNumberId", phoneId());
    url.searchParams.set("message", String(message));
    const resp = await fetch(url.toString());
    const data = await resp.json();
    res.status(resp.ok ? 200 : resp.status).json(data);
  } catch (err: any) {
    req.log?.error({ err }, "live-chat/send failed");
    res.status(500).json({ error: err.message });
  }
});

export default router;
