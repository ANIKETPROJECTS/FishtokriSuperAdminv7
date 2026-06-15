import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";
import { loadScope, type ScopedRequest } from "../middlewares/scope.js";
import { getSubHubDbConnection } from "../db/sub-hub-connections.js";

const router = Router();
router.use(requireAuth as any);
router.use(loadScope as any);

const ORDERS_DB = "orders";
const SETTINGS_COL = "settings";
const DOC_ID = "upi_variants";

async function getVariants(): Promise<string[]> {
  const conn = await getSubHubDbConnection(ORDERS_DB);
  const doc = await conn.db.collection(SETTINGS_COL).findOne({ _id: DOC_ID as any });
  return Array.isArray((doc as any)?.items) ? (doc as any).items : [];
}

async function saveVariants(items: string[]): Promise<void> {
  const conn = await getSubHubDbConnection(ORDERS_DB);
  await conn.db.collection(SETTINGS_COL).updateOne(
    { _id: DOC_ID as any },
    { $set: { items } },
    { upsert: true }
  );
}

router.get("/", async (req: ScopedRequest, res) => {
  try {
    res.json({ variants: await getVariants() });
  } catch (err) {
    req.log.error({ err }, "Failed to get UPI variants");
    res.status(500).json({ error: "InternalError", message: "Failed to get UPI variants" });
  }
});

router.post("/", async (req: ScopedRequest, res) => {
  try {
    const name = String(req.body?.name ?? "").trim();
    if (!name) { res.status(400).json({ error: "ValidationError", message: "name is required" }); return; }
    const variants = await getVariants();
    if (!variants.includes(name)) variants.push(name);
    await saveVariants(variants);
    res.json({ variants });
  } catch (err) {
    req.log.error({ err }, "Failed to add UPI variant");
    res.status(500).json({ error: "InternalError", message: "Failed to add UPI variant" });
  }
});

router.put("/:name", async (req: ScopedRequest, res) => {
  try {
    const oldName = decodeURIComponent(req.params.name);
    const newName = String(req.body?.newName ?? "").trim();
    if (!newName) { res.status(400).json({ error: "ValidationError", message: "newName is required" }); return; }
    const variants = (await getVariants()).map(v => v === oldName ? newName : v);
    await saveVariants(variants);
    res.json({ variants });
  } catch (err) {
    req.log.error({ err }, "Failed to rename UPI variant");
    res.status(500).json({ error: "InternalError", message: "Failed to rename UPI variant" });
  }
});

router.delete("/:name", async (req: ScopedRequest, res) => {
  try {
    const name = decodeURIComponent(req.params.name);
    const variants = (await getVariants()).filter(v => v !== name);
    await saveVariants(variants);
    res.json({ variants });
  } catch (err) {
    req.log.error({ err }, "Failed to delete UPI variant");
    res.status(500).json({ error: "InternalError", message: "Failed to delete UPI variant" });
  }
});

export default router;
