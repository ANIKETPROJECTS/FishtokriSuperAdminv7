import { Router, type IRouter } from "express";
import { mongoose } from "../db/index.js";
import { requireAuth } from "../middlewares/auth.js";
import { denyIfNotMaster, loadScope, type ScopedRequest } from "../middlewares/scope.js";

const router: IRouter = Router();
router.use(requireAuth as any);
router.use(loadScope as any);

/**
 * Returns a Mongo filter that restricts vendor purchase queries to the
 * request user's hub scope. Returns null for master users (no scoping
 * needed). Returns a filter that matches nothing when the user has no hubs.
 */
function purchaseScopeFilter(scope: ScopedRequest["scope"]): Record<string, any> | null {
  if (!scope || scope.isMaster) return null;
  if (scope.subHubIds.length === 0 && scope.superHubIds.length === 0) {
    // No hubs — match nothing.
    return { _id: { $in: [] } };
  }
  const or: any[] = [];
  if (scope.subHubIds.length) or.push({ subHubId: { $in: scope.subHubIds } });
  if (scope.superHubIds.length) or.push({ superHubId: { $in: scope.superHubIds } });
  return { $or: or };
}

/**
 * Returns the set of vendorIds (as strings) referenced by purchases inside
 * the request user's scope. Returns null when the caller is master.
 */
async function loadScopedVendorIds(scope: ScopedRequest["scope"]): Promise<Set<string> | null> {
  if (!scope || scope.isMaster) return null;
  const filter = purchaseScopeFilter(scope);
  if (!filter) return null;
  const Purchase = getPurchaseModel() as any;
  const ids = await Purchase.distinct("vendorId", filter);
  const set = new Set<string>();
  for (const id of ids) set.add(String(id));
  return set;
}

/**
 * Returns the set of purchase _ids (as strings) inside the user's scope, or
 * null for master callers.
 */
async function loadScopedPurchaseIds(scope: ScopedRequest["scope"]): Promise<Set<string> | null> {
  if (!scope || scope.isMaster) return null;
  const filter = purchaseScopeFilter(scope);
  if (!filter) return null;
  const Purchase = getPurchaseModel() as any;
  const docs = await Purchase.find(filter).select({ _id: 1 }).lean();
  const set = new Set<string>();
  for (const d of docs) set.add(String(d._id));
  return set;
}

// ─── SCHEMAS ──────────────────────────────────────────────────────────────────

const vendorSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, default: "" },
    email: { type: String, default: "" },
    address: { type: String, default: "" },
    category: { type: String, default: "General" },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
    notes: { type: String, default: "" },
    totalPurchases: { type: Number, default: 0 },
    totalSpent: { type: Number, default: 0 },
  },
  { timestamps: true }
);

const purchaseItemBatchSchema = new mongoose.Schema({
  quantity: { type: Number, default: 0 },
  shelfLifeDays: { type: Number, default: 0 },
}, { _id: false });

const purchaseItemSchema = new mongoose.Schema({
  vendorItemId: { type: String, default: "" },
  vendorItemCategoryId: { type: String, default: "" },
  productName: { type: String, required: true },
  categoryName: { type: String, default: "" },
  quantity: { type: Number, required: true },
  unit: { type: String, default: "kg" },
  pricePerUnit: { type: Number, default: 0 },
  totalPrice: { type: Number, default: 0 },
  expiryDate: { type: String, default: "" },
  batches: { type: [purchaseItemBatchSchema], default: [] },
}, { _id: true });

const purchaseSchema = new mongoose.Schema(
  {
    vendorId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: "Vendor" },
    vendorName: { type: String, default: "" },
    invoiceNumber: { type: String, default: "" },
    purchaseDate: { type: Date, default: Date.now },
    items: [purchaseItemSchema],
    totalAmount: { type: Number, default: 0 },
    status: { type: String, enum: ["saved", "draft"], default: "saved" },
    notes: { type: String, default: "" },
    subHubId: { type: String, default: "" },
    subHubName: { type: String, default: "" },
    superHubId: { type: String, default: "" },
    superHubName: { type: String, default: "" },
    createdByName: { type: String, default: "" },
    createdByEmail: { type: String, default: "" },
  },
  { timestamps: true }
);

const receiptAllocationSchema = new mongoose.Schema({
  invoiceId: { type: String, default: "" },
  invoiceNumber: { type: String, default: "" },
  amount: { type: Number, default: 0 },
}, { _id: false });

const receiptSchema = new mongoose.Schema(
  {
    vendorId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: "Vendor" },
    vendorName: { type: String, default: "" },
    invoiceId: { type: String, default: "" },
    invoiceNumber: { type: String, default: "" },
    date: { type: Date, default: Date.now },
    depositTo: { type: String, default: "" },
    receivedFrom: { type: String, default: "" },
    paymentMode: { type: String, default: "" },
    amount: { type: Number, default: 0 },
    reference: { type: String, default: "" },
    remarks: { type: String, default: "" },
    lumpSum: { type: Boolean, default: false },
    markAllPaid: { type: Boolean, default: false },
    allocations: { type: [receiptAllocationSchema], default: [] },
    createdByName: { type: String, default: "" },
    bankReceiptId: { type: String, default: "" }, // legacy field retained for backward compat
    bankPaymentId: { type: String, default: "" },
  },
  { timestamps: true }
);

const batchSchema = new mongoose.Schema({
  batchRef: { type: String, default: "" },
  vendorId: { type: String, default: "" },
  vendorName: { type: String, default: "" },
  quantity: { type: Number, default: 0 },
  remaining: { type: Number, default: 0 },
  unit: { type: String, default: "kg" },
  pricePerUnit: { type: Number, default: 0 },
  purchaseDate: { type: Date, default: Date.now },
  expiryDate: { type: String, default: "" },
  purchaseId: { type: String, default: "" },
}, { _id: true });

const inventorySchema = new mongoose.Schema(
  {
    productName: { type: String, required: true, trim: true },
    category: { type: String, default: "General" },
    unit: { type: String, default: "kg" },
    totalQuantity: { type: Number, default: 0 },
    batches: [batchSchema],
  },
  { timestamps: true }
);

// ─── MODELS ───────────────────────────────────────────────────────────────────

function getVendorModel() {
  if (mongoose.models["Vendor"]) return mongoose.models["Vendor"];
  return mongoose.model("Vendor", vendorSchema, "vendors");
}

function getPurchaseModel() {
  if (mongoose.models["VendorPurchase"]) return mongoose.models["VendorPurchase"];
  return mongoose.model("VendorPurchase", purchaseSchema, "vendor_purchases");
}

function getInventoryModel() {
  if (mongoose.models["Inventory"]) return mongoose.models["Inventory"];
  return mongoose.model("Inventory", inventorySchema, "inventory");
}

function getReceiptModel() {
  if (mongoose.models["VendorReceipt"]) return mongoose.models["VendorReceipt"];
  return mongoose.model("VendorReceipt", receiptSchema, "vendor_receipts");
}

function getBankPaymentModel() {
  if (mongoose.models["BankPayment"]) return mongoose.models["BankPayment"];
  // Define a minimal compatible schema in case banking routes haven't loaded first.
  const s = new mongoose.Schema(
    {
      date: { type: Date, required: true },
      paymentMode: { type: String, required: true, trim: true },
      depositAccountName: { type: String, required: true, trim: true },
      oppositeAccountName: { type: String, required: true, trim: true },
      amount: { type: Number, required: true },
      notes: { type: String, default: "" },
    },
    { timestamps: true }
  );
  return mongoose.model("BankPayment", s, "bank_payments");
}

function serializeReceipt(doc: any) {
  return {
    id: String(doc._id),
    vendorId: String(doc.vendorId || ""),
    vendorName: doc.vendorName ?? "",
    invoiceId: doc.invoiceId ?? "",
    invoiceNumber: doc.invoiceNumber ?? "",
    date: doc.date,
    depositTo: doc.depositTo ?? "",
    receivedFrom: doc.receivedFrom ?? "",
    paymentMode: doc.paymentMode ?? "",
    amount: doc.amount ?? 0,
    reference: doc.reference ?? "",
    remarks: doc.remarks ?? "",
    lumpSum: !!doc.lumpSum,
    markAllPaid: !!doc.markAllPaid,
    allocations: (doc.allocations ?? []).map((a: any) => ({
      invoiceId: a.invoiceId ?? "",
      invoiceNumber: a.invoiceNumber ?? "",
      amount: a.amount ?? 0,
    })),
    createdByName: doc.createdByName ?? "",
    createdAt: doc.createdAt,
  };
}

// ─── SERIALIZERS ──────────────────────────────────────────────────────────────

function serializeVendor(doc: any) {
  return {
    id: String(doc._id),
    name: doc.name ?? "",
    phone: doc.phone ?? "",
    email: doc.email ?? "",
    address: doc.address ?? "",
    category: doc.category ?? "General",
    status: doc.status ?? "active",
    notes: doc.notes ?? "",
    totalPurchases: doc.totalPurchases ?? 0,
    totalSpent: doc.totalSpent ?? 0,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

function serializePurchase(doc: any) {
  return {
    id: String(doc._id),
    vendorId: String(doc.vendorId),
    vendorName: doc.vendorName ?? "",
    vendorPhone: doc.vendorPhone ?? "",
    invoiceNumber: doc.invoiceNumber ?? "",
    status: doc.status ?? "saved",
    purchaseDate: doc.purchaseDate,
    items: (doc.items ?? []).map((item: any) => ({
      id: String(item._id),
      vendorItemId: item.vendorItemId ?? "",
      vendorItemCategoryId: item.vendorItemCategoryId ?? "",
      productName: item.productName ?? "",
      categoryName: item.categoryName ?? "",
      quantity: item.quantity ?? 0,
      unit: item.unit ?? "kg",
      pricePerUnit: item.pricePerUnit ?? 0,
      totalPrice: item.totalPrice ?? 0,
      expiryDate: item.expiryDate ?? "",
      batches: (item.batches ?? []).map((b: any) => ({
        quantity: b.quantity ?? 0,
        shelfLifeDays: b.shelfLifeDays ?? 0,
      })),
    })),
    totalAmount: doc.totalAmount ?? 0,
    notes: doc.notes ?? "",
    subHubId: doc.subHubId ?? "",
    subHubName: doc.subHubName ?? "",
    superHubId: doc.superHubId ?? "",
    superHubName: doc.superHubName ?? "",
    createdByName: doc.createdByName ?? "",
    createdByEmail: doc.createdByEmail ?? "",
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

function serializeInventory(doc: any) {
  return {
    id: String(doc._id),
    productName: doc.productName ?? "",
    category: doc.category ?? "General",
    unit: doc.unit ?? "kg",
    totalQuantity: doc.totalQuantity ?? 0,
    batches: (doc.batches ?? []).map((b: any) => ({
      id: String(b._id),
      batchRef: b.batchRef ?? "",
      vendorId: b.vendorId ?? "",
      vendorName: b.vendorName ?? "",
      quantity: b.quantity ?? 0,
      remaining: b.remaining ?? 0,
      unit: b.unit ?? "kg",
      pricePerUnit: b.pricePerUnit ?? 0,
      purchaseDate: b.purchaseDate,
      expiryDate: b.expiryDate ?? "",
      purchaseId: b.purchaseId ?? "",
    })),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

// ─── VENDOR ROUTES ────────────────────────────────────────────────────────────

router.get("/", async (req: ScopedRequest, res) => {
  try {
    const Vendor = getVendorModel();
    const { search, category, status, sort = "createdAt_desc", page = "1", limit = "20" } = req.query as Record<string, string>;

    const filter: Record<string, any> = {};
    if (search) {
      const regex = new RegExp(search, "i");
      filter.$or = [{ name: regex }, { phone: regex }, { email: regex }, { address: regex }];
    }
    if (category && category !== "all") filter.category = new RegExp(`^${category}$`, "i");
    if (status && status !== "all") filter.status = status;

    // Non-master users only see vendors who have at least one purchase tied
    // to a hub in their scope.
    const scopedVendorIds = await loadScopedVendorIds(req.scope);
    if (scopedVendorIds !== null) {
      if (scopedVendorIds.size === 0) {
        const pageNumEmpty = Math.max(1, parseInt(page, 10));
        const limitNumEmpty = Math.min(100, Math.max(1, parseInt(limit, 10)));
        res.json({ vendors: [], total: 0, page: pageNumEmpty, limit: limitNumEmpty });
        return;
      }
      const vendorObjectIds = [...scopedVendorIds]
        .map((id) => { try { return new mongoose.Types.ObjectId(id); } catch { return null; } })
        .filter(Boolean);
      filter._id = { $in: vendorObjectIds };
    }

    let sortObj: Record<string, 1 | -1> = { createdAt: -1 };
    if (sort === "name_asc") sortObj = { name: 1 };
    else if (sort === "name_desc") sortObj = { name: -1 };
    else if (sort === "totalSpent_desc") sortObj = { totalSpent: -1 };
    else if (sort === "totalSpent_asc") sortObj = { totalSpent: 1 };
    else if (sort === "totalPurchases_desc") sortObj = { totalPurchases: -1 };
    else if (sort === "createdAt_asc") sortObj = { createdAt: 1 };

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const [vendors, total] = await Promise.all([
      Vendor.find(filter).sort(sortObj).skip(skip).limit(limitNum),
      Vendor.countDocuments(filter),
    ]);

    res.json({ vendors: vendors.map(serializeVendor), total, page: pageNum, limit: limitNum });
  } catch (err) {
    req.log.error({ err }, "Failed to get vendors");
    res.status(500).json({ error: "InternalError", message: "Failed to fetch vendors" });
  }
});

router.post("/", denyIfNotMaster as any, async (req, res) => {
  try {
    const Vendor = getVendorModel();
    const { name, phone, email, address, category, status, notes } = req.body;

    if (!name?.trim()) {
      res.status(400).json({ error: "ValidationError", message: "Vendor name is required" });
      return;
    }

    const vendor = await Vendor.create({
      name: name.trim(),
      phone: phone?.trim() ?? "",
      email: email?.toLowerCase().trim() ?? "",
      address: address?.trim() ?? "",
      category: category?.trim() || "General",
      status: status || "active",
      notes: notes?.trim() ?? "",
    });

    res.status(201).json({ vendor: serializeVendor(vendor) });
  } catch (err) {
    req.log.error({ err }, "Failed to create vendor");
    res.status(500).json({ error: "InternalError", message: "Failed to create vendor" });
  }
});

router.put("/:id", denyIfNotMaster as any, async (req, res) => {
  try {
    const Vendor = getVendorModel();
    const vendor = await Vendor.findById(req.params.id);
    if (!vendor) { res.status(404).json({ error: "NotFound", message: "Vendor not found" }); return; }

    const { name, phone, email, address, category, status, notes } = req.body;
    if (name !== undefined) vendor.name = name.trim();
    if (phone !== undefined) (vendor as any).phone = phone.trim();
    if (email !== undefined) (vendor as any).email = email.toLowerCase().trim();
    if (address !== undefined) (vendor as any).address = address.trim();
    if (category !== undefined) (vendor as any).category = category.trim();
    if (status !== undefined) (vendor as any).status = status;
    if (notes !== undefined) (vendor as any).notes = notes.trim();

    await vendor.save();
    res.json({ vendor: serializeVendor(vendor) });
  } catch (err) {
    req.log.error({ err }, "Failed to update vendor");
    res.status(500).json({ error: "InternalError", message: "Failed to update vendor" });
  }
});

router.delete("/:id", denyIfNotMaster as any, async (req, res) => {
  try {
    const Vendor = getVendorModel();
    const vendor = await Vendor.findById(req.params.id);
    if (!vendor) { res.status(404).json({ error: "NotFound", message: "Vendor not found" }); return; }
    await Vendor.findByIdAndDelete(req.params.id);
    res.json({ message: "Vendor deleted" });
  } catch (err) {
    req.log.error({ err }, "Failed to delete vendor");
    res.status(500).json({ error: "InternalError", message: "Failed to delete vendor" });
  }
});

// ─── PURCHASE ROUTES ──────────────────────────────────────────────────────────

router.get("/next-invoice-number", async (req, res) => {
  try {
    const Purchase = getPurchaseModel();
    const last = await Purchase.findOne({ invoiceNumber: /^INV-\d+$/ })
      .sort({ createdAt: -1 })
      .select({ invoiceNumber: 1 })
      .lean();
    let nextNum = 1;
    if (last && (last as any).invoiceNumber) {
      const m = String((last as any).invoiceNumber).match(/^INV-(\d+)$/);
      if (m) nextNum = parseInt(m[1], 10) + 1;
    }
    // Ensure uniqueness in case of gaps / parallel inserts
    let candidate = `INV-${String(nextNum).padStart(3, "0")}`;
    while (await Purchase.exists({ invoiceNumber: candidate })) {
      nextNum += 1;
      candidate = `INV-${String(nextNum).padStart(3, "0")}`;
    }
    res.json({ invoiceNumber: candidate });
  } catch (err) {
    (req as any)?.log?.error?.({ err }, "Failed to compute next invoice number");
    res.status(500).json({ error: "InternalError", message: "Failed to compute next invoice number" });
  }
});

router.get("/all-purchases", async (req: ScopedRequest, res) => {
  try {
    const Purchase = getPurchaseModel();
    const { page = "1", limit = "30", search, vendorId, sort = "date_desc", dateFrom, dateTo } = req.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const filter: Record<string, any> = {};
    if (vendorId) filter.vendorId = vendorId;
    if (search) {
      const regex = new RegExp(search, "i");
      filter.$or = [{ vendorName: regex }, { invoiceNumber: regex }];
    }
    if (dateFrom || dateTo) {
      filter.purchaseDate = {};
      if (dateFrom) filter.purchaseDate.$gte = new Date(dateFrom);
      if (dateTo) { const d = new Date(dateTo); d.setHours(23, 59, 59, 999); filter.purchaseDate.$lte = d; }
    }

    const scopeFilter = purchaseScopeFilter(req.scope);
    if (scopeFilter) {
      const ands: any[] = [scopeFilter];
      if (filter.$or) { ands.push({ $or: filter.$or }); delete filter.$or; }
      filter.$and = ands;
    }

    const sortMap: Record<string, Record<string, 1 | -1>> = {
      date_desc: { purchaseDate: -1 },
      date_asc: { purchaseDate: 1 },
      amount_desc: { totalAmount: -1 },
      amount_asc: { totalAmount: 1 },
      vendor_asc: { vendorName: 1 },
      vendor_desc: { vendorName: -1 },
    };
    const sortObj = sortMap[sort] ?? { purchaseDate: -1 };

    const [purchases, total] = await Promise.all([
      Purchase.find(filter).sort(sortObj).skip(skip).limit(limitNum),
      Purchase.countDocuments(filter),
    ]);

    const Vendor = getVendorModel();
    const vendorIds = [...new Set(purchases.map((p: any) => String(p.vendorId)).filter(Boolean))];
    const vendors = vendorIds.length
      ? await Vendor.find({ _id: { $in: vendorIds } }).select("_id phone")
      : [];
    const phoneMap = new Map(vendors.map((v: any) => [String(v._id), v.phone || ""]));

    const enriched = purchases.map((p) => {
      const s = serializePurchase(p);
      return { ...s, vendorPhone: s.vendorPhone || phoneMap.get(s.vendorId) || "" };
    });

    res.json({ purchases: enriched, total, page: pageNum, limit: limitNum });
  } catch (err) {
    req.log.error({ err }, "Failed to get all purchases");
    res.status(500).json({ error: "InternalError", message: "Failed to fetch all purchases" });
  }
});

router.get("/analytics/summary", async (req: ScopedRequest, res) => {
  try {
    const Vendor = getVendorModel();
    const Purchase = getPurchaseModel();
    const vendorItemCategories = mongoose.connection.collection("vendor_item_categories");
    const vendorItems = mongoose.connection.collection("vendor_items");
    const Inventory = getInventoryModel();

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Build scoped filters once.
    const purchaseScope = purchaseScopeFilter(req.scope);
    const scopedVendorIds = await loadScopedVendorIds(req.scope);
    const vendorScope: Record<string, any> = {};
    if (scopedVendorIds !== null) {
      const ids = [...scopedVendorIds]
        .map((id) => { try { return new mongoose.Types.ObjectId(id); } catch { return null; } })
        .filter(Boolean);
      vendorScope._id = { $in: ids };
    }
    // Vendor item catalogue is global → only show counts to master.
    const showCatalogue = !req.scope || req.scope.isMaster;

    const purchaseMatch = purchaseScope ?? {};
    const purchaseRecentMatch = purchaseScope
      ? { $and: [purchaseScope, { purchaseDate: { $gte: thirtyDaysAgo } }] }
      : { purchaseDate: { $gte: thirtyDaysAgo } };

    const [
      totalVendors,
      activeVendors,
      inactiveVendors,
      purchaseSummary,
      last30DaysSummary,
      categoryCount,
      activeCategoryCount,
      itemCount,
      activeItemCount,
      inventoryCount,
      topVendors,
      recentPurchases,
      spendByCategory,
    ] = await Promise.all([
      Vendor.countDocuments(vendorScope),
      Vendor.countDocuments({ ...vendorScope, status: "active" }),
      Vendor.countDocuments({ ...vendorScope, status: "inactive" }),
      Purchase.aggregate([
        ...(purchaseScope ? [{ $match: purchaseScope }] : []),
        { $group: { _id: null, totalTransactions: { $sum: 1 }, totalSpent: { $sum: "$totalAmount" }, averagePurchase: { $avg: "$totalAmount" } } },
      ]),
      Purchase.aggregate([
        { $match: purchaseRecentMatch },
        { $group: { _id: null, transactions: { $sum: 1 }, spent: { $sum: "$totalAmount" } } },
      ]),
      showCatalogue ? vendorItemCategories.countDocuments({}) : Promise.resolve(0),
      showCatalogue ? vendorItemCategories.countDocuments({ status: "active" }) : Promise.resolve(0),
      showCatalogue ? vendorItems.countDocuments({}) : Promise.resolve(0),
      showCatalogue ? vendorItems.countDocuments({ status: "active" }) : Promise.resolve(0),
      showCatalogue ? Inventory.countDocuments({}) : Promise.resolve(0),
      Vendor.find(vendorScope).sort({ totalSpent: -1 }).limit(5),
      Purchase.find(purchaseMatch).sort({ purchaseDate: -1 }).limit(5),
      Purchase.aggregate([
        ...(purchaseScope ? [{ $match: purchaseScope }] : []),
        { $unwind: "$items" },
        {
          $group: {
            _id: { $ifNull: ["$items.categoryName", "Uncategorised"] },
            totalSpent: { $sum: "$items.totalPrice" },
            purchases: { $sum: 1 },
          },
        },
        { $sort: { totalSpent: -1 } },
        { $limit: 6 },
      ]),
    ]);

    const summary = purchaseSummary[0] ?? { totalTransactions: 0, totalSpent: 0, averagePurchase: 0 };
    const last30 = last30DaysSummary[0] ?? { transactions: 0, spent: 0 };

    res.json({
      overview: {
        totalVendors,
        activeVendors,
        inactiveVendors,
        totalTransactions: summary.totalTransactions ?? 0,
        totalSpent: summary.totalSpent ?? 0,
        averagePurchase: summary.averagePurchase ?? 0,
        last30DaysTransactions: last30.transactions ?? 0,
        last30DaysSpent: last30.spent ?? 0,
        categoryCount,
        activeCategoryCount,
        itemCount,
        activeItemCount,
        inventoryCount,
      },
      topVendors: topVendors.map(serializeVendor),
      recentPurchases: recentPurchases.map(serializePurchase),
      spendByCategory: spendByCategory.map((row: any) => ({
        categoryName: row._id || "Uncategorised",
        totalSpent: row.totalSpent ?? 0,
        purchases: row.purchases ?? 0,
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get vendor analytics");
    res.status(500).json({ error: "InternalError", message: "Failed to fetch vendor analytics" });
  }
});

router.put("/purchases/:purchaseId", async (req: ScopedRequest, res) => {
  try {
    const Purchase = getPurchaseModel();
    const purchase = await Purchase.findById(req.params.purchaseId);
    if (!purchase) { res.status(404).json({ error: "NotFound", message: "Purchase not found" }); return; }
    if (req.scope && !req.scope.isMaster) {
      const inSubScope = req.scope.subHubIds.includes(String((purchase as any).subHubId || ""));
      const inSuperScope = req.scope.superHubIds.includes(String((purchase as any).superHubId || ""));
      if (!inSubScope && !inSuperScope) {
        res.status(404).json({ error: "NotFound", message: "Purchase not found" }); return;
      }
    }

    const { invoiceNumber, purchaseDate, notes } = req.body;
    if (invoiceNumber !== undefined) (purchase as any).invoiceNumber = invoiceNumber.trim();
    if (purchaseDate) (purchase as any).purchaseDate = new Date(purchaseDate);
    if (notes !== undefined) (purchase as any).notes = notes.trim();

    await purchase.save();
    res.json({ purchase: serializePurchase(purchase) });
  } catch (err) {
    req.log.error({ err }, "Failed to update purchase");
    res.status(500).json({ error: "InternalError", message: "Failed to update purchase" });
  }
});

router.delete("/purchases/:purchaseId", async (req: ScopedRequest, res) => {
  try {
    const Purchase = getPurchaseModel();
    const Vendor = getVendorModel();
    const purchase = await Purchase.findById(req.params.purchaseId);
    if (!purchase) { res.status(404).json({ error: "NotFound", message: "Purchase not found" }); return; }
    if (req.scope && !req.scope.isMaster) {
      const inSubScope = req.scope.subHubIds.includes(String((purchase as any).subHubId || ""));
      const inSuperScope = req.scope.superHubIds.includes(String((purchase as any).superHubId || ""));
      if (!inSubScope && !inSuperScope) {
        res.status(404).json({ error: "NotFound", message: "Purchase not found" }); return;
      }
    }

    const vendor = await Vendor.findById((purchase as any).vendorId);
    if (vendor) {
      (vendor as any).totalPurchases = Math.max(0, ((vendor as any).totalPurchases || 1) - 1);
      (vendor as any).totalSpent = Math.max(0, ((vendor as any).totalSpent || 0) - ((purchase as any).totalAmount || 0));
      await vendor.save();
    }

    await Purchase.findByIdAndDelete(req.params.purchaseId);
    res.json({ message: "Purchase deleted" });
  } catch (err) {
    req.log.error({ err }, "Failed to delete purchase");
    res.status(500).json({ error: "InternalError", message: "Failed to delete purchase" });
  }
});

router.get("/:vendorId/purchases", async (req: ScopedRequest, res) => {
  try {
    const Purchase = getPurchaseModel();
    const { page = "1", limit = "20" } = req.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const filter: Record<string, any> = { vendorId: req.params.vendorId };
    const scopeFilter = purchaseScopeFilter(req.scope);
    if (scopeFilter) Object.assign(filter, scopeFilter);

    const [purchases, total] = await Promise.all([
      Purchase.find(filter).sort({ purchaseDate: -1 }).skip(skip).limit(limitNum),
      Purchase.countDocuments(filter),
    ]);

    res.json({ purchases: purchases.map(serializePurchase), total, page: pageNum, limit: limitNum });
  } catch (err) {
    req.log.error({ err }, "Failed to get purchases");
    res.status(500).json({ error: "InternalError", message: "Failed to fetch purchases" });
  }
});

router.post("/:vendorId/purchases", async (req: ScopedRequest, res) => {
  try {
    const Vendor = getVendorModel();
    const Purchase = getPurchaseModel();
    const Inventory = getInventoryModel();

    const vendor = await Vendor.findById(req.params.vendorId);
    if (!vendor) { res.status(404).json({ error: "NotFound", message: "Vendor not found" }); return; }

    const { invoiceNumber, purchaseDate, items, notes, subHubId, subHubName, superHubId, superHubName, createdByName, createdByEmail, status } = req.body;
    const purchaseStatus: "saved" | "draft" = status === "draft" ? "draft" : "saved";

    // Non-master users may only create purchases for hubs in their scope.
    if (req.scope && !req.scope.isMaster) {
      const sub = String(subHubId || "");
      const sup = String(superHubId || "");
      const subOk = sub && req.scope.subHubIds.includes(sub);
      const supOk = sup && req.scope.superHubIds.includes(sup);
      if (!subOk && !supOk) {
        res.status(403).json({ error: "Forbidden", message: "You may only create purchases for hubs in your scope" });
        return;
      }
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: "ValidationError", message: "At least one item is required" });
      return;
    }

    const processedItems = items.map((item: any) => {
      const itemBatches = Array.isArray(item.batches)
        ? item.batches.filter((b: any) => Number(b.quantity) > 0).map((b: any) => ({
            quantity: Number(b.quantity) || 0,
            shelfLifeDays: Number(b.shelfLifeDays) || 0,
          }))
        : [];
      const totalQty = itemBatches.length > 0
        ? itemBatches.reduce((s: number, b: any) => s + b.quantity, 0)
        : (Number(item.quantity) || 0);
      return {
        vendorItemId: item.vendorItemId || item.existingProductId || "",
        vendorItemCategoryId: item.vendorItemCategoryId || item.existingCategory || "",
        productName: item.productName?.trim(),
        categoryName: item.categoryName?.trim() || item.existingCategory?.trim() || "",
        quantity: totalQty,
        unit: item.unit || "kg",
        pricePerUnit: Number(item.pricePerUnit) || 0,
        totalPrice: totalQty * (Number(item.pricePerUnit) || 0),
        expiryDate: item.expiryDate || "",
        batches: itemBatches,
      };
    });

    const totalAmount = processedItems.reduce((sum: number, i: any) => sum + i.totalPrice, 0);

    const adminEmail = (req as any).admin?.email || createdByEmail || "";
    const adminName = createdByName || adminEmail;

    const purchase = await Purchase.create({
      vendorId: vendor._id,
      vendorName: vendor.name,
      invoiceNumber: invoiceNumber?.trim() || "",
      purchaseDate: purchaseDate ? new Date(purchaseDate) : new Date(),
      items: processedItems,
      totalAmount,
      status: purchaseStatus,
      notes: notes?.trim() || "",
      subHubId: subHubId || "",
      subHubName: subHubName?.trim() || "",
      superHubId: superHubId || "",
      superHubName: superHubName?.trim() || "",
      createdByName: adminName,
      createdByEmail: adminEmail,
    });

    // Drafts don't affect vendor stats or inventory
    if (purchaseStatus === "draft") {
      res.status(201).json({ purchase: serializePurchase(purchase) });
      return;
    }

    // Update vendor stats
    (vendor as any).totalPurchases = ((vendor as any).totalPurchases || 0) + 1;
    (vendor as any).totalSpent = ((vendor as any).totalSpent || 0) + totalAmount;
    await vendor.save();

    // Auto-manage inventory: add/update products and batches
    for (const item of processedItems) {
      if (!item.productName) continue;

      const nameRegex = new RegExp(`^${item.productName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i");
      let invItem = await Inventory.findOne({ productName: nameRegex });

      const batchRef = `B-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;

      if (!invItem) {
        invItem = await Inventory.create({
          productName: item.productName,
          category: item.categoryName || (vendor as any).category || "General",
          unit: item.unit,
          totalQuantity: item.quantity,
          batches: [{
            batchRef,
            vendorId: String(vendor._id),
            vendorName: vendor.name,
            quantity: item.quantity,
            remaining: item.quantity,
            unit: item.unit,
            pricePerUnit: item.pricePerUnit,
            purchaseDate: purchaseDate ? new Date(purchaseDate) : new Date(),
            expiryDate: item.expiryDate || "",
            purchaseId: String(purchase._id),
          }],
        });
      } else {
        (invItem as any).totalQuantity = ((invItem as any).totalQuantity || 0) + item.quantity;
        (invItem as any).batches.push({
          batchRef,
          vendorId: String(vendor._id),
          vendorName: vendor.name,
          quantity: item.quantity,
          remaining: item.quantity,
          unit: item.unit,
          pricePerUnit: item.pricePerUnit,
          purchaseDate: purchaseDate ? new Date(purchaseDate) : new Date(),
          expiryDate: item.expiryDate || "",
          purchaseId: String(purchase._id),
        });
        await invItem.save();
      }
    }

    res.status(201).json({ purchase: serializePurchase(purchase) });
  } catch (err) {
    req.log.error({ err }, "Failed to create purchase");
    res.status(500).json({ error: "InternalError", message: "Failed to create purchase" });
  }
});

// ─── INVENTORY ROUTES ─────────────────────────────────────────────────────────

// The aggregated vendor inventory has no hub field, so it would leak
// cross-hub stock totals to non-master users. Lock it to Master Admins.
router.get("/inventory/all", denyIfNotMaster as any, async (req, res) => {
  try {
    const Inventory = getInventoryModel();
    const { search, sort = "productName_asc" } = req.query as Record<string, string>;

    const filter: Record<string, any> = {};
    if (search) filter.productName = new RegExp(search, "i");

    let sortObj: Record<string, 1 | -1> = { productName: 1 };
    if (sort === "quantity_desc") sortObj = { totalQuantity: -1 };
    else if (sort === "quantity_asc") sortObj = { totalQuantity: 1 };
    else if (sort === "updatedAt_desc") sortObj = { updatedAt: -1 };

    const items = await Inventory.find(filter).sort(sortObj);
    res.json({ inventory: items.map(serializeInventory), total: items.length });
  } catch (err) {
    req.log.error({ err }, "Failed to get inventory");
    res.status(500).json({ error: "InternalError", message: "Failed to fetch inventory" });
  }
});

// ─── RECEIPTS ─────────────────────────────────────────────────────────────────

router.post("/purchases/:id/receipts", async (req: ScopedRequest, res) => {
  try {
    const Purchase = getPurchaseModel();
    const Receipt = getReceiptModel();
    const purchase = await Purchase.findById(req.params.id);
    if (!purchase) return res.status(404).json({ error: "NotFound", message: "Invoice not found" });
    if (req.scope && !req.scope.isMaster) {
      const inSubScope = req.scope.subHubIds.includes(String((purchase as any).subHubId || ""));
      const inSuperScope = req.scope.superHubIds.includes(String((purchase as any).superHubId || ""));
      if (!inSubScope && !inSuperScope) {
        return res.status(404).json({ error: "NotFound", message: "Invoice not found" });
      }
    }

    const body = req.body || {};
    const allocations = Array.isArray(body.allocations) ? body.allocations : [];
    const allocInvoiceIds = allocations.map((a: any) => String(a.invoiceId)).filter(Boolean);
    const allocPurchases = allocInvoiceIds.length
      ? await Purchase.find({ _id: { $in: allocInvoiceIds } }).select("_id invoiceNumber")
      : [];
    const numberMap = new Map(allocPurchases.map((p: any) => [String(p._id), p.invoiceNumber || ""]));

    const receiptDate = body.date ? new Date(body.date) : new Date();
    const amount = Number(body.amount) || 0;
    const depositTo = body.depositTo ?? "";
    const receivedFrom = body.receivedFrom ?? purchase.vendorName;
    const paymentMode = body.paymentMode ?? "";
    const reference = body.reference ?? "";
    const remarks = body.remarks ?? "";

    // Mirror this vendor payment into the Banking → Payments ledger (money
    // going OUT to the vendor) so it appears alongside other outgoing
    // payments. Vendor "receipts" represent receipts of payment WE made TO
    // the vendor — i.e., outflows, not income.
    let bankPaymentId = "";
    if (depositTo && paymentMode && receivedFrom && amount > 0) {
      try {
        const BankPayment = getBankPaymentModel();
        const noteParts = [
          purchase.invoiceNumber ? `Invoice ${purchase.invoiceNumber}` : "",
          reference ? `Ref ${reference}` : "",
          remarks,
        ].filter(Boolean);
        const bankDoc = await BankPayment.create({
          date: receiptDate,
          paymentMode,
          depositAccountName: depositTo,
          oppositeAccountName: receivedFrom,
          amount,
          notes: noteParts.join(" • "),
        });
        bankPaymentId = String(bankDoc._id);
      } catch (e) {
        req.log.warn({ err: e }, "Failed to mirror vendor payment into banking payments");
      }
    }

    const receipt = await Receipt.create({
      vendorId: purchase.vendorId,
      vendorName: purchase.vendorName,
      invoiceId: String(purchase._id),
      invoiceNumber: purchase.invoiceNumber,
      date: receiptDate,
      depositTo,
      receivedFrom,
      paymentMode,
      amount,
      reference,
      remarks,
      lumpSum: !!body.lumpSum,
      markAllPaid: !!body.markAllPaid,
      allocations: allocations.map((a: any) => ({
        invoiceId: String(a.invoiceId || ""),
        invoiceNumber: numberMap.get(String(a.invoiceId)) || "",
        amount: Number(a.amount) || 0,
      })),
      createdByName: (req as any).user?.name ?? "",
      bankPaymentId,
    });

    res.json({ receipt: serializeReceipt(receipt) });
  } catch (err) {
    req.log.error({ err }, "Failed to create receipt");
    res.status(500).json({ error: "InternalError", message: "Failed to create receipt" });
  }
});

router.get("/receipts", async (req: ScopedRequest, res) => {
  try {
    const Receipt = getReceiptModel();
    const { vendorId, page = "1", limit = "30", search, dateFrom, dateTo } = req.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;
    const filter: Record<string, any> = {};
    if (vendorId) filter.vendorId = vendorId;
    if (search) {
      const re = new RegExp(search, "i");
      filter.$or = [{ vendorName: re }, { invoiceNumber: re }, { reference: re }];
    }
    if (dateFrom || dateTo) {
      filter.date = {};
      if (dateFrom) filter.date.$gte = new Date(dateFrom);
      if (dateTo) { const d = new Date(dateTo); d.setHours(23, 59, 59, 999); filter.date.$lte = d; }
    }

    // Non-master users only see receipts for invoices in their hub scope.
    const scopedPurchaseIds = await loadScopedPurchaseIds(req.scope);
    if (scopedPurchaseIds !== null) {
      if (scopedPurchaseIds.size === 0) {
        res.json({ receipts: [], total: 0, page: pageNum, limit: limitNum });
        return;
      }
      filter.invoiceId = { $in: [...scopedPurchaseIds] };
    }

    const [receipts, total] = await Promise.all([
      Receipt.find(filter).sort({ date: -1, createdAt: -1 }).skip(skip).limit(limitNum),
      Receipt.countDocuments(filter),
    ]);
    res.json({ receipts: receipts.map(serializeReceipt), total, page: pageNum, limit: limitNum });
  } catch (err) {
    req.log.error({ err }, "Failed to list receipts");
    res.status(500).json({ error: "InternalError", message: "Failed to list receipts" });
  }
});

router.delete("/receipts/:id", async (req: ScopedRequest, res) => {
  try {
    const Receipt = getReceiptModel();
    if (req.scope && !req.scope.isMaster) {
      const existing = await Receipt.findById(req.params.id);
      if (!existing) return res.status(404).json({ error: "NotFound", message: "Receipt not found" });
      const scopedPurchaseIds = await loadScopedPurchaseIds(req.scope);
      if (!scopedPurchaseIds || !scopedPurchaseIds.has(String((existing as any).invoiceId || ""))) {
        return res.status(404).json({ error: "NotFound", message: "Receipt not found" });
      }
    }
    const r = await Receipt.findByIdAndDelete(req.params.id);
    if (!r) return res.status(404).json({ error: "NotFound", message: "Receipt not found" });
    if ((r as any).bankPaymentId) {
      try {
        const BankPayment = getBankPaymentModel();
        await BankPayment.findByIdAndDelete((r as any).bankPaymentId);
      } catch (e) {
        req.log.warn({ err: e }, "Failed to delete linked bank payment");
      }
    }
    // Clean up legacy mirror entry if it exists.
    if ((r as any).bankReceiptId) {
      try {
        const BankReceipt = mongoose.models["BankReceipt"];
        if (BankReceipt) await BankReceipt.findByIdAndDelete((r as any).bankReceiptId);
      } catch (e) {
        req.log.warn({ err: e }, "Failed to delete legacy bank receipt mirror");
      }
    }
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to delete receipt");
    res.status(500).json({ error: "InternalError", message: "Failed to delete receipt" });
  }
});

// ─── VENDOR STATEMENT ─────────────────────────────────────────────────────────

router.get("/:vendorId/statement", async (req: ScopedRequest, res) => {
  try {
    const Vendor = getVendorModel();
    const Purchase = getPurchaseModel();
    const Receipt = getReceiptModel();
    const { dateFrom, dateTo } = req.query as Record<string, string>;

    const vendor = await Vendor.findById(req.params.vendorId);
    if (!vendor) return res.status(404).json({ error: "NotFound", message: "Vendor not found" });

    const dateFilter: Record<string, any> = {};
    if (dateFrom) dateFilter.$gte = new Date(dateFrom);
    if (dateTo) { const d = new Date(dateTo); d.setHours(23, 59, 59, 999); dateFilter.$lte = d; }

    const purchaseFilter: Record<string, any> = { vendorId: req.params.vendorId };
    if (Object.keys(dateFilter).length) purchaseFilter.purchaseDate = dateFilter;
    const receiptFilter: Record<string, any> = { vendorId: req.params.vendorId };
    if (Object.keys(dateFilter).length) receiptFilter.date = dateFilter;

    // Apply hub scope to both purchases and receipts.
    const scopeFilter = purchaseScopeFilter(req.scope);
    if (scopeFilter) Object.assign(purchaseFilter, scopeFilter);
    const scopedPurchaseIds = await loadScopedPurchaseIds(req.scope);
    if (scopedPurchaseIds !== null) {
      if (scopedPurchaseIds.size === 0) {
        res.json({
          vendor: serializeVendor(vendor),
          invoices: [],
          receipts: [],
          totals: { invoiced: 0, received: 0, outstanding: 0 },
        });
        return;
      }
      receiptFilter.invoiceId = { $in: [...scopedPurchaseIds] };
    }

    const [purchases, receipts] = await Promise.all([
      Purchase.find(purchaseFilter).sort({ purchaseDate: 1, createdAt: 1 }),
      Receipt.find(receiptFilter).sort({ date: 1, createdAt: 1 }),
    ]);

    const totalInvoiced = purchases.reduce((s: number, p: any) => s + Number(p.totalAmount || 0), 0);
    const totalReceived = receipts.reduce((s: number, r: any) => s + Number(r.amount || 0), 0);

    res.json({
      vendor: serializeVendor(vendor),
      invoices: purchases.map(serializePurchase),
      receipts: receipts.map(serializeReceipt),
      totals: {
        invoiced: totalInvoiced,
        received: totalReceived,
        outstanding: totalInvoiced - totalReceived,
      },
    });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch vendor statement");
    res.status(500).json({ error: "InternalError", message: "Failed to fetch vendor statement" });
  }
});

export default router;
