import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";
import { loadScope, type ScopedRequest } from "../middlewares/scope.js";
import { getSubHubDbConnection } from "../db/sub-hub-connections.js";

const router = Router();
router.use(requireAuth as any);
router.use(loadScope as any);

const ORDERS_DB = "orders";
const SETTINGS_COL = "settings";
const DOC_ID = "payment_types";

async function getTypes(): Promise<string[]> {
  const conn = await getSubHubDbConnection(ORDERS_DB);
  const doc = await conn.db.collection(SETTINGS_COL).findOne({ _id: DOC_ID as any });
  return Array.isArray((doc as any)?.items) ? (doc as any).items : [];
}

async function saveTypes(items: string[]): Promise<void> {
  const conn = await getSubHubDbConnection(ORDERS_DB);
  await conn.db.collection(SETTINGS_COL).updateOne(
    { _id: DOC_ID as any },
    { $set: { items } },
    { upsert: true }
  );
}

router.get("/", async (req: ScopedRequest, res) => {
  try {
    res.json({ types: await getTypes() });
  } catch (err) {
    req.log.error({ err }, "Failed to get payment types");
    res.status(500).json({ error: "InternalError", message: "Failed to get payment types" });
  }
});

router.post("/", async (req: ScopedRequest, res) => {
  try {
    const name = String(req.body?.name ?? "").trim();
    if (!name) { res.status(400).json({ error: "ValidationError", message: "name is required" }); return; }
    const types = await getTypes();
    if (!types.includes(name)) types.push(name);
    await saveTypes(types);
    res.json({ types });
  } catch (err) {
    req.log.error({ err }, "Failed to add payment type");
    res.status(500).json({ error: "InternalError", message: "Failed to add payment type" });
  }
});

router.put("/:name", async (req: ScopedRequest, res) => {
  try {
    const oldName = decodeURIComponent(req.params.name);
    const newName = String(req.body?.newName ?? "").trim();
    if (!newName) { res.status(400).json({ error: "ValidationError", message: "newName is required" }); return; }
    const types = (await getTypes()).map(t => t === oldName ? newName : t);
    await saveTypes(types);
    res.json({ types });
  } catch (err) {
    req.log.error({ err }, "Failed to rename payment type");
    res.status(500).json({ error: "InternalError", message: "Failed to rename payment type" });
  }
});

router.delete("/:name", async (req: ScopedRequest, res) => {
  try {
    const name = decodeURIComponent(req.params.name);
    const types = (await getTypes()).filter(t => t !== name);
    await saveTypes(types);
    res.json({ types });
  } catch (err) {
    req.log.error({ err }, "Failed to delete payment type");
    res.status(500).json({ error: "InternalError", message: "Failed to delete payment type" });
  }
});

export default router;
