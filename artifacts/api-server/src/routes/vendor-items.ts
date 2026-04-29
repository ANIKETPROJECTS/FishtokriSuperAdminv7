import { Router, type IRouter } from "express";
import { mongoose } from "../db/index.js";
import { requireAuth } from "../middlewares/auth.js";
import { SuperHub } from "../db/models/super-hub.js";
import { SubHub } from "../db/models/sub-hub.js";
import { getSubHubDbConnection } from "../db/sub-hub-connections.js";
import { denyIfNotMaster, loadScope, type ScopedRequest } from "../middlewares/scope.js";

const router: IRouter = Router();
router.use(requireAuth as any);
router.use(loadScope as any);

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    linkedSubHubCategoryName: { type: String, default: "" },
    linkedSubHubCategoryNames: { type: [String], default: [] },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
  },
  { timestamps: true },
);

const itemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    itemCode: { type: String, default: "" },
    itemType: { type: String, default: "Raw Material" },
    categoryId: { type: mongoose.Schema.Types.ObjectId, required: true },
    categoryName: { type: String, default: "" },
    unit: { type: String, default: "kg" },
    purchasePrice: { type: Number, default: 0 },
    sellingPrice: { type: Number, default: 0 },
    openingStock: { type: Number, default: 0 },
    currentStock: { type: Number, default: 0 },
    description: { type: String, default: "" },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
    notes: { type: String, default: "" },
  },
  { timestamps: true },
);

function getCategoryModel() {
  if (mongoose.models["VendorItemCategory"]) return mongoose.models["VendorItemCategory"];
  return mongoose.model("VendorItemCategory", categorySchema, "vendor_item_categories");
}

function getItemModel() {
  if (mongoose.models["VendorItem"]) return mongoose.models["VendorItem"];
  return mongoose.model("VendorItem", itemSchema, "vendor_items");
}

function toId(id: string) {
  try {
    return new mongoose.Types.ObjectId(id);
  } catch {
    return null;
  }
}

function normalizeLinkedSubHubCategoryNames(source: any): string[] {
  const names = Array.isArray(source?.linkedSubHubCategoryNames)
    ? source.linkedSubHubCategoryNames
    : [];
  const legacyName = String(source?.linkedSubHubCategoryName ?? "").trim();
  return Array.from(
    new Set(
      [...names, legacyName]
        .map((name) => String(name ?? "").trim())
        .filter(Boolean)
    )
  );
}

function serializeCategory(doc: any) {
  const linkedSubHubCategoryNames = normalizeLinkedSubHubCategoryNames(doc);
  return {
    id: String(doc._id),
    name: doc.name ?? "",
    description: doc.description ?? "",
    linkedSubHubCategoryName: linkedSubHubCategoryNames[0] ?? "",
    linkedSubHubCategoryNames,
    status: doc.status ?? "active",
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

function serializeItem(doc: any) {
  return {
    id: String(doc._id),
    name: doc.name ?? "",
    itemCode: doc.itemCode ?? "",
    itemType: doc.itemType ?? "Raw Material",
    categoryId: String(doc.categoryId ?? ""),
    categoryName: doc.categoryName ?? "",
    unit: doc.unit ?? "kg",
    purchasePrice: doc.purchasePrice ?? 0,
    sellingPrice: doc.sellingPrice ?? 0,
    openingStock: doc.openingStock ?? 0,
    currentStock: doc.currentStock ?? 0,
    description: doc.description ?? "",
    status: doc.status ?? "active",
    notes: doc.notes ?? "",
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

async function getSubHubCategoryMap() {
  const subHubs = await SubHub.find({ dbName: { $ne: "" } }).lean();
  const subHubCategoryMap = new Map<string, { hubs: string[]; displayName: string; productCount: number }>();

  await Promise.allSettled(
    subHubs.map(async (hub: any) => {
      if (!hub.dbName) return;
      try {
        const conn = await getSubHubDbConnection(hub.dbName);
        const [cats, products] = await Promise.all([
          conn.db.collection("categories").find({}).toArray(),
          conn.db.collection("products").aggregate([
            { $group: { _id: "$category", count: { $sum: 1 } } },
          ]).toArray(),
        ]);
        const productCounts = new Map(products.map((p: any) => [String(p._id ?? "").trim().toLowerCase(), Number(p.count) || 0]));
        for (const cat of cats) {
          const rawName = String(cat.name ?? "").trim();
          if (!rawName) continue;
          const key = rawName.toLowerCase();
          if (!subHubCategoryMap.has(key)) {
            subHubCategoryMap.set(key, { hubs: [], displayName: rawName, productCount: 0 });
          }
          const entry = subHubCategoryMap.get(key)!;
          entry.hubs.push(hub.name);
          entry.productCount += productCounts.get(key) ?? 0;
        }
      } catch {
      }
    })
  );

  return subHubCategoryMap;
}

router.get("/sub-hub-categories", async (req, res) => {
  try {
    const subHubCategoryMap = await getSubHubCategoryMap();
    const categories = Array.from(subHubCategoryMap.values())
      .map((entry) => ({
        name: entry.displayName,
        subHubs: Array.from(new Set(entry.hubs)).sort((a, b) => a.localeCompare(b)),
        subHubCount: new Set(entry.hubs).size,
        productCount: entry.productCount,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
    res.json({ categories, total: categories.length });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch sub hub categories");
    res.status(500).json({ error: "InternalError", message: "Failed to fetch sub hub categories" });
  }
});

router.get("/categories", async (req, res) => {
  try {
    const Category = getCategoryModel();
    const masterCategories = await Category.find({}).sort({ name: 1 });
    const subHubCategoryMap = await getSubHubCategoryMap();
    const result = masterCategories.map((c: any) => {
      const linkedNames = normalizeLinkedSubHubCategoryNames(c);
      const entries = linkedNames
        .map((name) => subHubCategoryMap.get(name.toLowerCase()))
        .filter(Boolean) as { hubs: string[]; displayName: string; productCount: number }[];
      return {
        ...serializeCategory(c),
        source: "master" as const,
        subHubs: Array.from(new Set(entries.flatMap((entry) => entry.hubs))).sort((a, b) => a.localeCompare(b)),
        subHubCount: new Set(entries.flatMap((entry) => entry.hubs)).size,
        linkedProductCount: entries.reduce((sum, entry) => sum + entry.productCount, 0),
      };
    });
    res.json({ categories: result, total: result.length });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch vendor item categories");
    res.status(500).json({ error: "InternalError", message: "Failed to fetch categories" });
  }
});

router.post("/categories", denyIfNotMaster as any, async (req, res) => {
  try {
    const Category = getCategoryModel();
    const name = String(req.body.name ?? "").trim();
    if (!name) {
      res.status(400).json({ error: "ValidationError", message: "Category name is required" });
      return;
    }
    const linkedSubHubCategoryNames = normalizeLinkedSubHubCategoryNames(req.body);
    const category = await Category.create({
      name,
      description: String(req.body.description ?? "").trim(),
      linkedSubHubCategoryName: linkedSubHubCategoryNames[0] ?? "",
      linkedSubHubCategoryNames,
      status: req.body.status === "inactive" ? "inactive" : "active",
    });
    res.status(201).json({ category: serializeCategory(category) });
  } catch (err: any) {
    req.log.error({ err }, "Failed to create vendor item category");
    res.status(500).json({ error: "InternalError", message: err.message ?? "Failed to create category" });
  }
});

router.put("/categories/:id", denyIfNotMaster as any, async (req, res) => {
  try {
    const oid = toId(req.params.id);
    if (!oid) {
      res.status(400).json({ error: "InvalidId", message: "Invalid category ID" });
      return;
    }
    const Category = getCategoryModel();
    const Item = getItemModel();
    const update: any = {};
    if (req.body.name !== undefined) update.name = String(req.body.name).trim();
    if (req.body.description !== undefined) update.description = String(req.body.description).trim();
    if (req.body.linkedSubHubCategoryName !== undefined || req.body.linkedSubHubCategoryNames !== undefined) {
      const linkedSubHubCategoryNames = normalizeLinkedSubHubCategoryNames(req.body);
      update.linkedSubHubCategoryName = linkedSubHubCategoryNames[0] ?? "";
      update.linkedSubHubCategoryNames = linkedSubHubCategoryNames;
    }
    if (req.body.status !== undefined) update.status = req.body.status === "inactive" ? "inactive" : "active";
    if (!update.name && req.body.name !== undefined) {
      res.status(400).json({ error: "ValidationError", message: "Category name is required" });
      return;
    }
    const category = await Category.findByIdAndUpdate(oid, update, { returnDocument: "after" });
    if (!category) {
      res.status(404).json({ error: "NotFound", message: "Category not found" });
      return;
    }
    await Item.updateMany({ categoryId: oid }, { $set: { categoryName: category.name } });
    res.json({ category: serializeCategory(category) });
  } catch (err: any) {
    req.log.error({ err }, "Failed to update vendor item category");
    res.status(500).json({ error: "InternalError", message: err.message ?? "Failed to update category" });
  }
});

router.delete("/categories/:id", denyIfNotMaster as any, async (req, res) => {
  try {
    const oid = toId(req.params.id);
    if (!oid) {
      res.status(400).json({ error: "InvalidId", message: "Invalid category ID" });
      return;
    }
    const Category = getCategoryModel();
    const Item = getItemModel();
    const itemCount = await Item.countDocuments({ categoryId: oid });
    if (itemCount > 0) {
      res.status(400).json({ error: "CategoryInUse", message: "Move or delete items in this category first" });
      return;
    }
    await Category.findByIdAndDelete(oid);
    res.json({ message: "Category deleted" });
  } catch (err) {
    req.log.error({ err }, "Failed to delete vendor item category");
    res.status(500).json({ error: "InternalError", message: "Failed to delete category" });
  }
});

router.get("/items", async (req, res) => {
  try {
    const Item = getItemModel();
    const query: any = {};
    if (req.query.categoryId) {
      const oid = toId(String(req.query.categoryId));
      if (oid) query.categoryId = oid;
    }
    if (req.query.itemType && req.query.itemType !== "all") query.itemType = String(req.query.itemType);
    if (req.query.search) {
      const regex = { $regex: String(req.query.search), $options: "i" };
      query.$or = [{ name: regex }, { itemCode: regex }, { categoryName: regex }, { description: regex }];
    }
    const items = await Item.find(query).sort({ categoryName: 1, name: 1 });
    res.json({ items: items.map(serializeItem), total: items.length });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch vendor items");
    res.status(500).json({ error: "InternalError", message: "Failed to fetch items" });
  }
});

router.post("/items", denyIfNotMaster as any, async (req, res) => {
  try {
    const name = String(req.body.name ?? "").trim();
    const categoryId = toId(String(req.body.categoryId ?? ""));
    if (!name) {
      res.status(400).json({ error: "ValidationError", message: "Item name is required" });
      return;
    }
    if (!categoryId) {
      res.status(400).json({ error: "ValidationError", message: "Category is required" });
      return;
    }
    const Category = getCategoryModel();
    const Item = getItemModel();
    const category = await Category.findById(categoryId);
    if (!category) {
      res.status(404).json({ error: "NotFound", message: "Category not found" });
      return;
    }
    const item = await Item.create({
      name,
      itemCode: String(req.body.itemCode ?? "").trim(),
      itemType: String(req.body.itemType ?? "Raw Material").trim() || "Raw Material",
      categoryId,
      categoryName: category.name,
      unit: String(req.body.unit ?? "kg").trim() || "kg",
      purchasePrice: Number(req.body.purchasePrice) || 0,
      sellingPrice: Number(req.body.sellingPrice) || 0,
      openingStock: Number(req.body.openingStock) || 0,
      currentStock: req.body.currentStock !== undefined ? Number(req.body.currentStock) || 0 : Number(req.body.openingStock) || 0,
      description: String(req.body.description ?? "").trim(),
      status: req.body.status === "inactive" ? "inactive" : "active",
      notes: String(req.body.notes ?? "").trim(),
    });
    res.status(201).json({ item: serializeItem(item) });
  } catch (err: any) {
    req.log.error({ err }, "Failed to create vendor item");
    res.status(500).json({ error: "InternalError", message: err.message ?? "Failed to create item" });
  }
});

router.put("/items/:id", denyIfNotMaster as any, async (req, res) => {
  try {
    const oid = toId(req.params.id);
    if (!oid) {
      res.status(400).json({ error: "InvalidId", message: "Invalid item ID" });
      return;
    }
    const Category = getCategoryModel();
    const Item = getItemModel();
    const update: any = {};
    if (req.body.name !== undefined) update.name = String(req.body.name).trim();
    if (req.body.itemCode !== undefined) update.itemCode = String(req.body.itemCode).trim();
    if (req.body.itemType !== undefined) update.itemType = String(req.body.itemType).trim() || "Raw Material";
    if (req.body.unit !== undefined) update.unit = String(req.body.unit).trim() || "kg";
    if (req.body.purchasePrice !== undefined) update.purchasePrice = Number(req.body.purchasePrice) || 0;
    if (req.body.sellingPrice !== undefined) update.sellingPrice = Number(req.body.sellingPrice) || 0;
    if (req.body.openingStock !== undefined) update.openingStock = Number(req.body.openingStock) || 0;
    if (req.body.currentStock !== undefined) update.currentStock = Number(req.body.currentStock) || 0;
    if (req.body.description !== undefined) update.description = String(req.body.description).trim();
    if (req.body.notes !== undefined) update.notes = String(req.body.notes).trim();
    if (req.body.status !== undefined) update.status = req.body.status === "inactive" ? "inactive" : "active";
    if (req.body.categoryId !== undefined) {
      const categoryId = toId(String(req.body.categoryId));
      if (!categoryId) {
        res.status(400).json({ error: "ValidationError", message: "Category is required" });
        return;
      }
      const category = await Category.findById(categoryId);
      if (!category) {
        res.status(404).json({ error: "NotFound", message: "Category not found" });
        return;
      }
      update.categoryId = categoryId;
      update.categoryName = category.name;
    }
    if (!update.name && req.body.name !== undefined) {
      res.status(400).json({ error: "ValidationError", message: "Item name is required" });
      return;
    }
    const item = await Item.findByIdAndUpdate(oid, update, { returnDocument: "after" });
    if (!item) {
      res.status(404).json({ error: "NotFound", message: "Item not found" });
      return;
    }
    res.json({ item: serializeItem(item) });
  } catch (err: any) {
    req.log.error({ err }, "Failed to update vendor item");
    res.status(500).json({ error: "InternalError", message: err.message ?? "Failed to update item" });
  }
});

router.delete("/items/:id", denyIfNotMaster as any, async (req, res) => {
  try {
    const oid = toId(req.params.id);
    if (!oid) {
      res.status(400).json({ error: "InvalidId", message: "Invalid item ID" });
      return;
    }
    const Item = getItemModel();
    await Item.findByIdAndDelete(oid);
    res.json({ message: "Item deleted" });
  } catch (err) {
    req.log.error({ err }, "Failed to delete vendor item");
    res.status(500).json({ error: "InternalError", message: "Failed to delete item" });
  }
});

router.get("/hub-products", async (req: ScopedRequest, res) => {
  try {
    const subHubFilter: Record<string, any> = { dbName: { $ne: "" } };
    if (req.scope && !req.scope.isMaster) {
      const ids = new Set<string>();
      for (const id of req.scope.subHubIds) ids.add(id);
      if (req.scope.superHubIds.length > 0) {
        const subsUnderSuper = await SubHub.find({ superHubId: { $in: req.scope.superHubIds } }, { _id: 1 }).lean();
        for (const s of subsUnderSuper) ids.add(String(s._id));
      }
      if (ids.size === 0) {
        res.json({ products: [], total: 0 });
        return;
      }
      subHubFilter._id = { $in: [...ids] };
    }
    const subHubs = await SubHub.find(subHubFilter).lean();
    const productMap = new Map<string, {
      name: string;
      category: string;
      totalQuantity: number;
      hubs: { subHubId: string; subHubName: string; dbName: string; productId: string; quantity: number; price: number; unit: string; status: string }[];
    }>();

    await Promise.allSettled(
      subHubs.map(async (hub: any) => {
        if (!hub.dbName) return;
        try {
          const conn = await getSubHubDbConnection(hub.dbName);
          const products = await conn.db.collection("products").find({}).toArray();
          for (const p of products) {
            const rawName = String(p.name ?? "").trim();
            if (!rawName) continue;
            const key = rawName.toLowerCase();
            if (!productMap.has(key)) {
              productMap.set(key, { name: rawName, category: String(p.category ?? ""), totalQuantity: 0, hubs: [] });
            }
            const entry = productMap.get(key)!;
            const qty = Number(p.quantity) || 0;
            entry.totalQuantity += qty;
            entry.hubs.push({
              subHubId: String(hub._id),
              subHubName: hub.name,
              dbName: hub.dbName,
              productId: String(p._id),
              quantity: qty,
              price: Number(p.price) || 0,
              unit: String(p.unit ?? "kg"),
              status: p.isArchived ? "inactive" : "active",
            });
          }
        } catch {
        }
      })
    );

    const products = Array.from(productMap.values()).sort((a, b) => a.name.localeCompare(b.name));
    res.json({ products, total: products.length });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch hub products");
    res.status(500).json({ error: "InternalError", message: "Failed to fetch hub products" });
  }
});

router.put("/hub-products/:subHubId/:productId", async (req: ScopedRequest, res) => {
  try {
    const subHub = await SubHub.findById(req.params.subHubId).lean() as any;
    if (!subHub || !subHub.dbName) {
      res.status(404).json({ error: "NotFound", message: "Sub hub not found or has no database" });
      return;
    }
    if (req.scope && !req.scope.isMaster) {
      const subId = String(subHub._id);
      const supId = subHub.superHubId ? String(subHub.superHubId) : "";
      const inSubScope = req.scope.subHubIds.includes(subId);
      const inSuperScope = supId && req.scope.superHubIds.includes(supId);
      if (!inSubScope && !inSuperScope) {
        res.status(404).json({ error: "NotFound", message: "Sub hub not found or has no database" });
        return;
      }
    }
    const oid = toId(req.params.productId);
    if (!oid) {
      res.status(400).json({ error: "InvalidId", message: "Invalid product ID" });
      return;
    }
    const conn = await getSubHubDbConnection(subHub.dbName);
    const update: any = {};
    if (req.body.quantity !== undefined) update.quantity = Number(req.body.quantity) || 0;
    if (req.body.price !== undefined) update.price = Number(req.body.price) || 0;
    if (req.body.unit !== undefined) update.unit = String(req.body.unit).trim();
    if (req.body.status !== undefined) update.isArchived = req.body.status === "inactive";
    update.updatedAt = new Date();
    const result = await conn.db.collection("products").findOneAndUpdate(
      { _id: oid },
      { $set: update },
      { returnDocument: "after" }
    );
    if (!result) {
      res.status(404).json({ error: "NotFound", message: "Product not found" });
      return;
    }
    res.json({ product: result });
  } catch (err: any) {
    req.log.error({ err }, "Failed to update hub product");
    res.status(500).json({ error: "InternalError", message: err.message ?? "Failed to update hub product" });
  }
});

const stockAdjustmentSchema = new mongoose.Schema(
  {
    date: { type: Date, default: Date.now },
    superHubId: { type: mongoose.Schema.Types.ObjectId },
    superHubName: { type: String, default: "" },
    subHubId: { type: mongoose.Schema.Types.ObjectId },
    subHubName: { type: String, default: "" },
    voucherNumber: { type: Number },
    reason: { type: String, default: "" },
    notes: { type: String, default: "" },
    status: { type: String, enum: ["draft", "approved"], default: "approved" },
    createdBy: { type: String, default: "admin" },
    items: [
      {
        itemId: { type: mongoose.Schema.Types.ObjectId },
        source: { type: String, enum: ["master", "hub"], default: "master" },
        subHubId: { type: mongoose.Schema.Types.ObjectId },
        productId: { type: mongoose.Schema.Types.ObjectId },
        itemName: { type: String, default: "" },
        unit: { type: String, default: "" },
        quantityBefore: { type: Number, default: 0 },
        newQuantity: { type: Number, default: 0 },
        quantityAdjusted: { type: Number, default: 0 },
      },
    ],
  },
  { timestamps: true },
);

function getStockAdjustmentModel() {
  if (mongoose.models["StockAdjustment"]) return mongoose.models["StockAdjustment"];
  return mongoose.model("StockAdjustment", stockAdjustmentSchema, "stock_adjustments");
}

function serializeAdjustment(doc: any) {
  return {
    id: String(doc._id),
    date: doc.date,
    superHubId: doc.superHubId ? String(doc.superHubId) : "",
    superHubName: doc.superHubName ?? "",
    subHubId: doc.subHubId ? String(doc.subHubId) : "",
    subHubName: doc.subHubName ?? "",
    voucherNumber: doc.voucherNumber,
    reason: doc.reason ?? "",
    notes: doc.notes ?? "",
    status: doc.status ?? "approved",
    createdBy: doc.createdBy ?? "admin",
    items: (doc.items ?? []).map((it: any) => ({
      itemId: String(it.itemId ?? ""),
      source: it.source ?? "master",
      subHubId: it.subHubId ? String(it.subHubId) : "",
      productId: it.productId ? String(it.productId) : "",
      itemName: it.itemName ?? "",
      unit: it.unit ?? "",
      quantityBefore: it.quantityBefore ?? 0,
      newQuantity: it.newQuantity ?? 0,
      quantityAdjusted: it.quantityAdjusted ?? 0,
    })),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

async function resolveStockAdjustmentHubContext(superHubId: string, subHubId: string) {
  const superHubOid = toId(String(superHubId ?? ""));
  const subHubOid = toId(String(subHubId ?? ""));
  if (!superHubOid || !subHubOid) {
    return {
      superHubId: undefined as any,
      superHubName: "",
      subHubId: undefined as any,
      subHubName: "",
    };
  }
  const [superHub, subHub] = await Promise.all([
    SuperHub.findById(superHubOid).lean() as any,
    SubHub.findById(subHubOid).lean() as any,
  ]);
  return {
    superHubId: superHub?._id,
    superHubName: String(superHub?.name ?? ""),
    subHubId: subHub?._id,
    subHubName: String(subHub?.name ?? ""),
  };
}

async function getHubAdjustmentProduct(subHubId: string, productId: string) {
  const subHub = await SubHub.findById(subHubId).lean() as any;
  if (!subHub || !subHub.dbName) return null;
  const productOid = toId(productId);
  if (!productOid) return null;
  const conn = await getSubHubDbConnection(subHub.dbName);
  const product = await conn.db.collection("products").findOne({ _id: productOid });
  if (!product) return null;
  return { conn, productOid, product };
}

async function restoreAdjustmentItem(oldItem: any, Item: any) {
  if (oldItem.source === "hub") {
    const productRef = await getHubAdjustmentProduct(String(oldItem.subHubId ?? ""), String(oldItem.productId ?? oldItem.itemId ?? ""));
    if (!productRef) return;
    const restored = (Number(productRef.product.quantity) || 0) - (Number(oldItem.quantityAdjusted) || 0);
    await productRef.conn.db.collection("products").updateOne(
      { _id: productRef.productOid },
      { $set: { quantity: Math.max(0, restored), updatedAt: new Date() } }
    );
    return;
  }
  if (!oldItem.itemId) return;
  const item = await Item.findById(oldItem.itemId);
  if (!item) return;
  const restored = (item.currentStock ?? 0) - oldItem.quantityAdjusted;
  await Item.findByIdAndUpdate(oldItem.itemId, { $set: { currentStock: Math.max(0, restored) } });
}

async function applyAdjustmentInput(ri: any, Item: any, selectedSubHubId: string) {
  const source = ri.source === "hub" ? "hub" : "master";
  const newQuantity = Number(ri.newQuantity) || 0;
  if (source === "hub") {
    const productRef = await getHubAdjustmentProduct(selectedSubHubId, String(ri.productId ?? ri.itemId ?? ""));
    if (!productRef) return null;
    const quantityBefore = Number(productRef.product.quantity) || 0;
    const quantityAdjusted = newQuantity - quantityBefore;
    await productRef.conn.db.collection("products").updateOne(
      { _id: productRef.productOid },
      { $set: { quantity: newQuantity, updatedAt: new Date() } }
    );
    return {
      itemId: productRef.productOid,
      source,
      subHubId: toId(selectedSubHubId),
      productId: productRef.productOid,
      itemName: String(productRef.product.name ?? ""),
      unit: String(productRef.product.unit ?? ""),
      quantityBefore,
      newQuantity,
      quantityAdjusted,
    };
  }
  if (!ri.itemId) return null;
  const oid = toId(String(ri.itemId));
  if (!oid) return null;
  const item = await Item.findById(oid);
  if (!item) return null;
  const quantityBefore = item.currentStock ?? 0;
  const quantityAdjusted = newQuantity - quantityBefore;
  await Item.findByIdAndUpdate(oid, { $set: { currentStock: newQuantity } });
  return {
    itemId: oid,
    source,
    subHubId: toId(selectedSubHubId),
    itemName: item.name,
    unit: item.unit ?? "",
    quantityBefore,
    newQuantity,
    quantityAdjusted,
  };
}

function adjustmentScopeFilter(scope: ScopedRequest["scope"]): Record<string, any> | null {
  if (!scope || scope.isMaster) return null;
  const ors: Record<string, any>[] = [];
  if (scope.subHubIds.length > 0) ors.push({ subHubId: { $in: scope.subHubIds } });
  if (scope.superHubIds.length > 0) ors.push({ superHubId: { $in: scope.superHubIds } });
  if (ors.length === 0) return { _id: { $in: [] } };
  return { $or: ors };
}

function isAdjustmentInScope(scope: ScopedRequest["scope"], adj: any): boolean {
  if (!scope || scope.isMaster) return true;
  const sub = String(adj.subHubId || "");
  const sup = String(adj.superHubId || "");
  return (sub && scope.subHubIds.includes(sub)) || (sup && scope.superHubIds.includes(sup));
}

router.get("/stock-adjustments", async (req: ScopedRequest, res) => {
  try {
    const StockAdjustment = getStockAdjustmentModel();
    const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10));
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "10"), 10)));
    const skip = (page - 1) * limit;
    const query: any = {};
    if (req.query.search) {
      const regex = { $regex: String(req.query.search), $options: "i" };
      query.$or = [{ reason: regex }, { createdBy: regex }];
    }
    const scopeFilter = adjustmentScopeFilter(req.scope);
    if (scopeFilter) {
      // Combine with existing $or via $and so search and scope both apply.
      if (query.$or) {
        query.$and = [{ $or: query.$or }, scopeFilter];
        delete query.$or;
      } else {
        Object.assign(query, scopeFilter);
      }
    }
    const [docs, total] = await Promise.all([
      StockAdjustment.find(query).sort({ voucherNumber: -1 }).skip(skip).limit(limit),
      StockAdjustment.countDocuments(query),
    ]);
    res.json({ adjustments: docs.map(serializeAdjustment), total, page, limit });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch stock adjustments");
    res.status(500).json({ error: "InternalError", message: "Failed to fetch stock adjustments" });
  }
});

router.post("/stock-adjustments", async (req: ScopedRequest, res) => {
  try {
    const StockAdjustment = getStockAdjustmentModel();
    const Item = getItemModel();

    const last = await StockAdjustment.findOne({}).sort({ voucherNumber: -1 }).lean() as any;
    const nextVoucherNumber = last ? (last.voucherNumber ?? 0) + 1 : 1;

    const rawItems: any[] = Array.isArray(req.body.items) ? req.body.items : [];
    const adjustmentItems: any[] = [];
    const hubContext = await resolveStockAdjustmentHubContext(String(req.body.superHubId ?? ""), String(req.body.subHubId ?? ""));

    if (!isAdjustmentInScope(req.scope, hubContext)) {
      res.status(403).json({ error: "Forbidden", message: "You may only create stock adjustments for hubs in your scope" });
      return;
    }

    for (const ri of rawItems) {
      const adjustmentItem = await applyAdjustmentInput(ri, Item, String(hubContext.subHubId));
      if (adjustmentItem) adjustmentItems.push(adjustmentItem);
    }

    const doc = await StockAdjustment.create({
      date: req.body.date ? new Date(req.body.date) : new Date(),
      ...hubContext,
      voucherNumber: nextVoucherNumber,
      reason: String(req.body.reason ?? "").trim(),
      notes: String(req.body.notes ?? "").trim(),
      status: "approved",
      createdBy: (req as any).admin?.name ?? "admin",
      items: adjustmentItems,
    });

    res.status(201).json({ adjustment: serializeAdjustment(doc) });
  } catch (err: any) {
    req.log.error({ err }, "Failed to create stock adjustment");
    res.status(500).json({ error: "InternalError", message: err.message ?? "Failed to create stock adjustment" });
  }
});

router.put("/stock-adjustments/:id", async (req: ScopedRequest, res) => {
  try {
    const oid = toId(req.params.id);
    if (!oid) {
      res.status(400).json({ error: "InvalidId", message: "Invalid adjustment ID" });
      return;
    }
    const StockAdjustment = getStockAdjustmentModel();
    const Item = getItemModel();

    const existing = await StockAdjustment.findById(oid);
    if (!existing) {
      res.status(404).json({ error: "NotFound", message: "Stock adjustment not found" });
      return;
    }

    if (!isAdjustmentInScope(req.scope, existing)) {
      res.status(404).json({ error: "NotFound", message: "Stock adjustment not found" });
      return;
    }

    for (const oldItem of (existing.items ?? []) as any[]) {
      await restoreAdjustmentItem(oldItem, Item);
    }

    const rawItems: any[] = Array.isArray(req.body.items) ? req.body.items : [];
    const adjustmentItems: any[] = [];
    const hubContext = await resolveStockAdjustmentHubContext(String(req.body.superHubId ?? ""), String(req.body.subHubId ?? ""));

    if (!isAdjustmentInScope(req.scope, hubContext)) {
      res.status(403).json({ error: "Forbidden", message: "You may only assign stock adjustments to hubs in your scope" });
      return;
    }

    for (const ri of rawItems) {
      const adjustmentItem = await applyAdjustmentInput(ri, Item, String(hubContext.subHubId));
      if (adjustmentItem) adjustmentItems.push(adjustmentItem);
    }

    const update: any = {};
    if (req.body.date !== undefined) update.date = new Date(req.body.date);
    update.superHubId = hubContext.superHubId;
    update.superHubName = hubContext.superHubName;
    update.subHubId = hubContext.subHubId;
    update.subHubName = hubContext.subHubName;
    if (req.body.reason !== undefined) update.reason = String(req.body.reason).trim();
    if (req.body.notes !== undefined) update.notes = String(req.body.notes).trim();
    update.items = adjustmentItems;

    const doc = await StockAdjustment.findByIdAndUpdate(oid, update, { returnDocument: "after" });
    res.json({ adjustment: serializeAdjustment(doc) });
  } catch (err: any) {
    req.log.error({ err }, "Failed to update stock adjustment");
    res.status(500).json({ error: "InternalError", message: err.message ?? "Failed to update stock adjustment" });
  }
});

router.delete("/stock-adjustments/:id", async (req: ScopedRequest, res) => {
  try {
    const oid = toId(req.params.id);
    if (!oid) {
      res.status(400).json({ error: "InvalidId", message: "Invalid adjustment ID" });
      return;
    }
    const StockAdjustment = getStockAdjustmentModel();
    const Item = getItemModel();

    const existing = await StockAdjustment.findById(oid);
    if (!existing) {
      res.status(404).json({ error: "NotFound", message: "Stock adjustment not found" });
      return;
    }

    if (!isAdjustmentInScope(req.scope, existing)) {
      res.status(404).json({ error: "NotFound", message: "Stock adjustment not found" });
      return;
    }

    for (const oldItem of (existing.items ?? []) as any[]) {
      await restoreAdjustmentItem(oldItem, Item);
    }

    await StockAdjustment.findByIdAndDelete(oid);
    res.json({ message: "Stock adjustment deleted" });
  } catch (err: any) {
    req.log.error({ err }, "Failed to delete stock adjustment");
    res.status(500).json({ error: "InternalError", message: err.message ?? "Failed to delete stock adjustment" });
  }
});

export default router;