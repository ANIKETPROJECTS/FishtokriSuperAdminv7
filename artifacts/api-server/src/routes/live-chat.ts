import { Router } from "express";
import multer from "multer";
import { requireAuth } from "../middlewares/auth.js";

const router = Router();
router.use(requireAuth as any);

const WABA_BASE = "https://verifiedwhatsapp.admarksolution.com";
const apiKey = () => process.env.WABA_API_KEY || "";
const phoneId = () => process.env.WABA_PHONE_ID || "";

// Multer: keep file in memory so we can re-upload to Admark
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

// ── GET /api/live-chat/contacts ───────────────────────────────────────────────
router.get("/contacts", async (req, res) => {
  try {
    const url = new URL(`${WABA_BASE}/get-contacts`);
    url.searchParams.set("api-key", apiKey());
    url.searchParams.set("phoneNumberId", phoneId());
    const resp = await fetch(url.toString());
    if (!resp.ok) { res.status(resp.status).json({ error: `Admark ${resp.status}` }); return; }
    res.json(await resp.json());
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/live-chat/messages/:number ──────────────────────────────────────
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
    if (!resp.ok) { res.status(resp.status).json({ error: `Admark ${resp.status}` }); return; }
    res.json(await resp.json());
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/live-chat/send ──────────────────────────────────────────────────
// Body: { number: string; message: string }
router.post("/send", async (req, res) => {
  try {
    const { number, message } = req.body ?? {};
    if (!number || !message) { res.status(400).json({ error: "number and message required" }); return; }
    const payload = {
      phoneNumberId: phoneId(),
      type: "text",
      number: String(number),
      tempId: `temp-${Date.now()}`,
      message: String(message),
    };
    const resp = await fetch(`${WABA_BASE}/send-chat-message`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "api-key": apiKey() },
      body: JSON.stringify(payload),
    });
    const data = await resp.json();
    res.status(resp.ok ? 200 : resp.status).json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/live-chat/upload-media ─────────────────────────────────────────
// multipart/form-data with field "file"
// Returns: { success, url, file: { url, filename, mimetype, size } }
router.post("/upload-media", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) { res.status(400).json({ error: "No file uploaded" }); return; }

    // Re-upload to Admark using FormData
    const fd = new FormData();
    fd.append(
      "file",
      new Blob([req.file.buffer], { type: req.file.mimetype }),
      req.file.originalname,
    );
    fd.append("folder", "chatbot");
    fd.append("phoneNumberId", phoneId());

    const resp = await fetch(`${WABA_BASE}/api/media/upload`, {
      method: "POST",
      headers: { "api-key": apiKey() },
      body: fd as any,
    });
    const data = await resp.json();
    res.status(resp.ok ? 200 : resp.status).json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/live-chat/templates ─────────────────────────────────────────────
// Returns all templates with body text fetched individually (cached 10 min).
// The /templates list endpoint returns empty components[], so we must call
// /template-byname for each template to get the actual body text.
let templatesCache: { data: any[]; at: number } | null = null;

async function fetchTemplateBody(name: string): Promise<{ name: string; body: string | null; footer: string | null }> {
  try {
    const url = new URL(`${WABA_BASE}/template-byname`);
    url.searchParams.set("name", name);
    url.searchParams.set("api-key", apiKey());
    const resp = await fetch(url.toString());
    if (!resp.ok) return { name, body: null, footer: null };
    const t = await resp.json();
    const comps: any[] = t.components ?? [];
    const body = comps.find((c: any) => c.type === "BODY");
    const footer = comps.find((c: any) => c.type === "FOOTER");
    return { name, body: body?.text ?? null, footer: footer?.text ?? null };
  } catch {
    return { name, body: null, footer: null };
  }
}

router.get("/templates", async (_req, res) => {
  try {
    const now = Date.now();
    if (templatesCache && now - templatesCache.at < 10 * 60 * 1000) {
      res.json(templatesCache.data); return;
    }
    // Step 1: get names list
    const listUrl = new URL(`${WABA_BASE}/templates`);
    listUrl.searchParams.set("api-key", apiKey());
    const listResp = await fetch(listUrl.toString());
    if (!listResp.ok) { res.status(listResp.status).json({ error: `Admark ${listResp.status}` }); return; }
    const listData = await listResp.json();
    const names: string[] = Array.isArray(listData) ? listData.map((t: any) => t.name).filter(Boolean) : [];

    // Step 2: fetch each template individually in parallel
    const enriched = await Promise.all(names.map(fetchTemplateBody));

    templatesCache = { data: enriched, at: now };
    res.json(enriched);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/live-chat/send-media ───────────────────────────────────────────
// Body: { number, media: { url, filename, mimetype, size }, caption? }
router.post("/send-media", async (req, res) => {
  try {
    const { number, media, caption = "" } = req.body ?? {};
    if (!number || !media?.url) { res.status(400).json({ error: "number and media.url required" }); return; }
    const payload = {
      phoneNumberId: phoneId(),
      type: "media",
      number: String(number),
      tempId: `temp-${Date.now()}`,
      message: caption,
      media,
    };
    const resp = await fetch(`${WABA_BASE}/send-chat-message`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "api-key": apiKey() },
      body: JSON.stringify(payload),
    });
    const data = await resp.json();
    res.status(resp.ok ? 200 : resp.status).json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/live-chat/wa-contacts ───────────────────────────────────────────
router.get("/wa-contacts", async (req, res) => {
  try {
    const url = new URL(`${WABA_BASE}/get-contacts`);
    url.searchParams.set("api-key", apiKey());
    url.searchParams.set("phoneNumberId", phoneId());
    const resp = await fetch(url.toString());
    if (!resp.ok) { res.status(resp.status).json({ error: `Admark ${resp.status}` }); return; }
    res.json(await resp.json());
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ── POST /api/live-chat/wa-contacts/edit ─────────────────────────────────────
router.post("/wa-contacts/edit", async (req, res) => {
  try {
    const { number, name } = req.body ?? {};
    if (!number) { res.status(400).json({ error: "number required" }); return; }
    const resp = await fetch(`${WABA_BASE}/edit-contact`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "api-key": apiKey() },
      body: JSON.stringify({ phoneNumberId: phoneId(), number, name }),
    });
    res.status(resp.ok ? 200 : resp.status).json(await resp.json().catch(() => ({ ok: resp.ok })));
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ── POST /api/live-chat/wa-contacts/delete ───────────────────────────────────
router.post("/wa-contacts/delete", async (req, res) => {
  try {
    const { number } = req.body ?? {};
    if (!number) { res.status(400).json({ error: "number required" }); return; }
    const resp = await fetch(`${WABA_BASE}/delete-contact`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "api-key": apiKey() },
      body: JSON.stringify({ phoneNumberId: phoneId(), number }),
    });
    res.status(resp.ok ? 200 : resp.status).json(await resp.json().catch(() => ({ ok: resp.ok })));
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/live-chat/wa-groups ─────────────────────────────────────────────
router.get("/wa-groups", async (_req, res) => {
  try {
    const url = new URL(`${WABA_BASE}/get-groups`);
    url.searchParams.set("api-key", apiKey());
    url.searchParams.set("phoneNumberId", phoneId());
    const resp = await fetch(url.toString());
    if (!resp.ok) { res.status(resp.status).json({ error: `Admark ${resp.status}` }); return; }
    res.json(await resp.json());
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ── POST /api/live-chat/wa-groups/create ─────────────────────────────────────
router.post("/wa-groups/create", async (req, res) => {
  try {
    const { name } = req.body ?? {};
    if (!name) { res.status(400).json({ error: "name required" }); return; }
    const resp = await fetch(`${WABA_BASE}/create-group`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "api-key": apiKey() },
      body: JSON.stringify({ phoneNumberId: phoneId(), name }),
    });
    res.status(resp.ok ? 200 : resp.status).json(await resp.json());
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ── POST /api/live-chat/wa-groups/delete ─────────────────────────────────────
router.post("/wa-groups/delete", async (req, res) => {
  try {
    const { name } = req.body ?? {};
    if (!name) { res.status(400).json({ error: "name required" }); return; }
    const resp = await fetch(`${WABA_BASE}/delete-group`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "api-key": apiKey() },
      body: JSON.stringify({ phoneNumberId: phoneId(), name }),
    });
    res.status(resp.ok ? 200 : resp.status).json(await resp.json());
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/live-chat/wa-tags ───────────────────────────────────────────────
router.get("/wa-tags", async (_req, res) => {
  try {
    const url = new URL(`${WABA_BASE}/get-tags`);
    url.searchParams.set("api-key", apiKey());
    url.searchParams.set("phoneNumberId", phoneId());
    const resp = await fetch(url.toString());
    if (!resp.ok) { res.status(resp.status).json({ error: `Admark ${resp.status}` }); return; }
    res.json(await resp.json());
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ── POST /api/live-chat/wa-tags/create ───────────────────────────────────────
router.post("/wa-tags/create", async (req, res) => {
  try {
    const { name, color } = req.body ?? {};
    if (!name) { res.status(400).json({ error: "name required" }); return; }
    const resp = await fetch(`${WABA_BASE}/create-tag`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "api-key": apiKey() },
      body: JSON.stringify({ phoneNumberId: phoneId(), name, color: color ?? "#4caf50" }),
    });
    res.status(resp.ok ? 200 : resp.status).json(await resp.json());
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ── POST /api/live-chat/wa-tags/delete ───────────────────────────────────────
router.post("/wa-tags/delete", async (req, res) => {
  try {
    const { name } = req.body ?? {};
    if (!name) { res.status(400).json({ error: "name required" }); return; }
    const resp = await fetch(`${WABA_BASE}/delete-tag`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "api-key": apiKey() },
      body: JSON.stringify({ phoneNumberId: phoneId(), name }),
    });
    res.status(resp.ok ? 200 : resp.status).json(await resp.json());
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

export default router;
