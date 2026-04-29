import { Router, type IRouter } from "express";
import { SuperHub } from "../db/models/super-hub.js";
import { SubHub } from "../db/models/sub-hub.js";
import { requireAuth } from "../middlewares/auth.js";
import {
  loadScope,
  toObjectIds,
  canAccessSuperHub,
  rejectIfNotMaster,
  type ScopedRequest,
} from "../middlewares/scope.js";
import { generateDbName, getSubHubDbConnection } from "../db/sub-hub-connections.js";

const router: IRouter = Router();
router.use(requireAuth as any);
router.use(loadScope as any);

function subHubToJson(s: any, superHubName: string) {
  return {
    id: String(s._id),
    superHubId: String(s.superHubId),
    superHubName,
    name: s.name,
    location: s.location,
    imageUrl: s.imageUrl ?? "",
    pincodes: s.pincodes,
    status: s.status,
    dbName: s.dbName ?? "",
    createdAt: s.createdAt,
  };
}

router.get("/", async (req: ScopedRequest, res) => {
  try {
    const scope = req.scope!;
    const filter = scope.isMaster
      ? {}
      : { _id: { $in: toObjectIds(scope.superHubIds) } };

    const superHubs = await SuperHub.find(filter).sort({ createdAt: 1 });
    const result = await Promise.all(
      superHubs.map(async (h) => {
        const subFilter: any = { superHubId: h._id };
        if (!scope.isMaster) {
          subFilter._id = { $in: toObjectIds(scope.subHubIds) };
        }
        const subHubCount = await SubHub.countDocuments(subFilter);
        return {
          id: String(h._id),
          name: h.name,
          location: h.location,
          imageUrl: h.imageUrl,
          status: h.status,
          subHubCount,
          createdAt: h.createdAt,
        };
      })
    );
    res.json({ superHubs: result, total: result.length });
  } catch (err) {
    req.log.error({ err }, "Failed to get super hubs");
    res.status(500).json({ error: "InternalError", message: "Failed to fetch super hubs" });
  }
});

router.get("/:id/sub-hubs", async (req: ScopedRequest, res) => {
  try {
    const scope = req.scope!;
    if (!canAccessSuperHub(scope, req.params.id)) {
      res.status(404).json({ error: "NotFound", message: "Super hub not found" });
      return;
    }

    const superHub = await SuperHub.findById(req.params.id);
    if (!superHub) { res.status(404).json({ error: "NotFound", message: "Super hub not found" }); return; }

    const subFilter: any = { superHubId: superHub._id };
    if (!scope.isMaster) subFilter._id = { $in: toObjectIds(scope.subHubIds) };
    const subHubs = await SubHub.find(subFilter).sort({ createdAt: 1 });
    res.json({ subHubs: subHubs.map((s) => subHubToJson(s, superHub.name)), total: subHubs.length });
  } catch (err) {
    req.log.error({ err }, "Failed to get sub hubs");
    res.status(500).json({ error: "InternalError", message: "Failed to fetch sub hubs" });
  }
});

router.get("/:id", async (req: ScopedRequest, res) => {
  try {
    const scope = req.scope!;
    if (!canAccessSuperHub(scope, req.params.id)) {
      res.status(404).json({ error: "NotFound", message: "Super hub not found" });
      return;
    }

    const superHub = await SuperHub.findById(req.params.id);
    if (!superHub) { res.status(404).json({ error: "NotFound", message: "Super hub not found" }); return; }

    const subFilter: any = { superHubId: superHub._id };
    if (!scope.isMaster) subFilter._id = { $in: toObjectIds(scope.subHubIds) };
    const subHubs = await SubHub.find(subFilter).sort({ createdAt: 1 });
    const sh = {
      id: String(superHub._id),
      name: superHub.name,
      location: superHub.location,
      imageUrl: superHub.imageUrl,
      status: superHub.status,
      subHubCount: subHubs.length,
      createdAt: superHub.createdAt,
    };
    res.json({ superHub: sh, subHubs: subHubs.map((s) => subHubToJson(s, superHub.name)) });
  } catch (err) {
    req.log.error({ err }, "Failed to get super hub");
    res.status(500).json({ error: "InternalError", message: "Failed to fetch super hub" });
  }
});

router.post("/", async (req: ScopedRequest, res) => {
  if (rejectIfNotMaster(req.scope, res)) return;
  try {
    const { name, location, imageUrl, status } = req.body;
    if (!name) { res.status(400).json({ error: "ValidationError", message: "Name is required" }); return; }
    const hub = await SuperHub.create({
      name,
      location: location ?? "",
      imageUrl: imageUrl ?? "",
      status: status ?? "Active",
    });
    res.status(201).json({
      superHub: { id: String(hub._id), name: hub.name, location: hub.location, imageUrl: hub.imageUrl, status: hub.status, subHubCount: 0, createdAt: hub.createdAt },
    });
  } catch (err) {
    req.log.error({ err }, "Failed to create super hub");
    res.status(500).json({ error: "InternalError", message: "Failed to create super hub" });
  }
});

router.post("/:id/sub-hubs", async (req: ScopedRequest, res) => {
  if (rejectIfNotMaster(req.scope, res)) return;
  try {
    const superHub = await SuperHub.findById(req.params.id);
    if (!superHub) { res.status(404).json({ error: "NotFound", message: "Super hub not found" }); return; }
    const { name, location, imageUrl, pincodes, status } = req.body;
    if (!name) { res.status(400).json({ error: "ValidationError", message: "Name is required" }); return; }

    const dbName = generateDbName(name);
    if (!dbName) { res.status(400).json({ error: "ValidationError", message: "Sub hub name must contain alphanumeric characters" }); return; }

    const duplicate = await SubHub.findOne({ dbName });
    if (duplicate) {
      res.status(400).json({ error: "DuplicateDb", message: `A sub hub with database name "${dbName}" already exists. Please use a different name.` });
      return;
    }

    const sub = await SubHub.create({
      superHubId: superHub._id,
      name,
      location: location ?? "",
      imageUrl: imageUrl ?? "",
      pincodes: pincodes ?? [],
      status: status ?? "Active",
      dbName,
    });

    try {
      const conn = await getSubHubDbConnection(dbName);
      await Promise.all([
        conn.db.createCollection("products").catch(() => {}),
        conn.db.createCollection("categories").catch(() => {}),
        conn.db.createCollection("coupons").catch(() => {}),
        conn.db.createCollection("orders").catch(() => {}),
      ]);
    } catch (initErr) {
      req.log.warn({ initErr, dbName }, "Could not initialize sub hub database collections");
    }

    res.status(201).json({ subHub: subHubToJson(sub, superHub.name) });
  } catch (err) {
    req.log.error({ err }, "Failed to create sub hub");
    res.status(500).json({ error: "InternalError", message: "Failed to create sub hub" });
  }
});

router.put("/:id", async (req: ScopedRequest, res) => {
  if (rejectIfNotMaster(req.scope, res)) return;
  try {
    const superHub = await SuperHub.findById(req.params.id);
    if (!superHub) { res.status(404).json({ error: "NotFound", message: "Super hub not found" }); return; }
    const { name, location, imageUrl, status } = req.body;
    if (name !== undefined) superHub.name = name;
    if (location !== undefined) superHub.location = location;
    if (imageUrl !== undefined) superHub.imageUrl = imageUrl;
    if (status !== undefined) superHub.status = status;
    await superHub.save();
    const subHubCount = await SubHub.countDocuments({ superHubId: superHub._id });
    const sh = { id: String(superHub._id), name: superHub.name, location: superHub.location, imageUrl: superHub.imageUrl, status: superHub.status, subHubCount, createdAt: superHub.createdAt };
    res.json({ superHub: sh });
  } catch (err) {
    req.log.error({ err }, "Failed to update super hub");
    res.status(500).json({ error: "InternalError", message: "Failed to update super hub" });
  }
});

router.delete("/:id", async (req: ScopedRequest, res) => {
  if (rejectIfNotMaster(req.scope, res)) return;
  try {
    const superHub = await SuperHub.findById(req.params.id);
    if (!superHub) { res.status(404).json({ error: "NotFound", message: "Super hub not found" }); return; }
    await SubHub.deleteMany({ superHubId: superHub._id });
    await SuperHub.findByIdAndDelete(req.params.id);
    res.json({ message: "Super hub deleted successfully" });
  } catch (err) {
    req.log.error({ err }, "Failed to delete super hub");
    res.status(500).json({ error: "InternalError", message: "Failed to delete super hub" });
  }
});

router.patch("/:id/toggle-status", async (req: ScopedRequest, res) => {
  if (rejectIfNotMaster(req.scope, res)) return;
  try {
    const superHub = await SuperHub.findById(req.params.id);
    if (!superHub) { res.status(404).json({ error: "NotFound", message: "Super hub not found" }); return; }
    superHub.status = superHub.status === "Active" ? "Inactive" : "Active";
    await superHub.save();
    const subHubCount = await SubHub.countDocuments({ superHubId: superHub._id });
    const sh = { id: String(superHub._id), name: superHub.name, location: superHub.location, imageUrl: superHub.imageUrl, status: superHub.status, subHubCount, createdAt: superHub.createdAt };
    res.json({ superHub: sh });
  } catch (err) {
    req.log.error({ err }, "Failed to toggle super hub status");
    res.status(500).json({ error: "InternalError", message: "Failed to toggle status" });
  }
});

export default router;
