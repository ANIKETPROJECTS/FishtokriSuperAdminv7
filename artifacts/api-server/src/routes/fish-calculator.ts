import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";
import {
  FishCalculatorConfig,
  FishRawProduct,
  FishCalculatorRecord,
} from "../db/models/fish-calculator.js";

const router = Router();

function r2(x: number): number {
  return Math.round(x * 100) / 100;
}

function generateBatchNumber(recordDate: string): string {
  if (recordDate.length !== 10) return "";
  const year = recordDate.slice(0, 4);
  const month = recordDate.slice(5, 7);
  const day = recordDate.slice(8, 10);
  return `${day}${month}${year}`;
}

function computeSalePrice(
  buyPricePerKg: number,
  wastagePercent: number,
  marginPercent: number,
  cfg: { market_handling_cost: number; fixed_cost: number; packaging_cost: number; delivery_cost: number }
) {
  const buyPerG = buyPricePerKg / 1000;
  let effectivePerG: number;
  if (wastagePercent === 0) {
    effectivePerG = buyPerG;
  } else {
    const denom = 1 - wastagePercent / 100;
    effectivePerG = buyPerG / denom;
  }

  const baseCostPerG =
    effectivePerG +
    cfg.market_handling_cost +
    cfg.fixed_cost +
    cfg.packaging_cost +
    cfg.delivery_cost;

  const marginPerG = baseCostPerG * (marginPercent / 100);
  const finalPerG = baseCostPerG + marginPerG;

  const packetWeights = [100, 250, 500, 750, 1000];
  const packetPrices: Record<string, number> = {};
  for (const w of packetWeights) {
    packetPrices[`${w}g`] = r2(finalPerG * w);
  }

  return {
    buy_price_per_gram: r2(buyPerG),
    effective_price_per_gram: r2(effectivePerG),
    margin_price_per_gram: r2(marginPerG),
    final_sale_price_per_gram: r2(finalPerG),
    packet_prices: packetPrices,
  };
}

async function getOrCreateConfig() {
  let cfg = await FishCalculatorConfig.findOne();
  if (!cfg) {
    cfg = await FishCalculatorConfig.create({
      market_handling_cost: 0,
      fixed_cost: 0,
      packaging_cost: 0,
      delivery_cost: 0,
    });
  }
  return cfg;
}

router.get("/config", requireAuth, async (req, res) => {
  try {
    const cfg = await getOrCreateConfig();
    res.json({
      market_handling_cost: cfg.market_handling_cost,
      fixed_cost: cfg.fixed_cost,
      packaging_cost: cfg.packaging_cost,
      delivery_cost: cfg.delivery_cost,
    });
  } catch (e: any) {
    res.status(500).json({ message: e.message || "Failed to get config" });
  }
});

router.post("/config", requireAuth, async (req, res) => {
  try {
    const { market_handling_cost, fixed_cost, packaging_cost, delivery_cost } = req.body;
    let cfg = await FishCalculatorConfig.findOne();
    if (!cfg) {
      cfg = await FishCalculatorConfig.create({ market_handling_cost, fixed_cost, packaging_cost, delivery_cost });
    } else {
      cfg.market_handling_cost = market_handling_cost ?? cfg.market_handling_cost;
      cfg.fixed_cost = fixed_cost ?? cfg.fixed_cost;
      cfg.packaging_cost = packaging_cost ?? cfg.packaging_cost;
      cfg.delivery_cost = delivery_cost ?? cfg.delivery_cost;
      await cfg.save();
    }
    res.json({
      market_handling_cost: cfg.market_handling_cost,
      fixed_cost: cfg.fixed_cost,
      packaging_cost: cfg.packaging_cost,
      delivery_cost: cfg.delivery_cost,
    });
  } catch (e: any) {
    res.status(500).json({ message: e.message || "Failed to save config" });
  }
});

router.post("/calculate", requireAuth, async (req, res) => {
  try {
    const { buy_price_per_kg, wastage_percent, margin_percent } = req.body;
    if (!buy_price_per_kg || buy_price_per_kg <= 0) {
      return res.status(422).json({ message: "buy_price_per_kg must be > 0" });
    }
    if (wastage_percent === undefined || wastage_percent < 0 || wastage_percent >= 100) {
      return res.status(422).json({ message: "wastage_percent must be >= 0 and < 100" });
    }
    if (margin_percent === undefined || margin_percent < 0) {
      return res.status(422).json({ message: "margin_percent must be >= 0" });
    }
    const cfg = await getOrCreateConfig();
    const result = computeSalePrice(buy_price_per_kg, wastage_percent, margin_percent, cfg.toObject());
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ message: e.message || "Calculation failed" });
  }
});

router.get("/products", requireAuth, async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 500, 1000);
    const products = await FishRawProduct.find().sort({ name: 1 }).limit(limit);
    res.json(
      products.map((p: any) => ({
        id: p._id.toString(),
        name: p.name,
        created_at: p.created_at,
      }))
    );
  } catch (e: any) {
    res.status(500).json({ message: e.message || "Failed to list products" });
  }
});

router.post("/products", requireAuth, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(422).json({ message: "name is required" });
    }
    const existing = await FishRawProduct.findOne({ name: name.trim() });
    if (existing) {
      return res.status(422).json({ message: "Product with this name already exists" });
    }
    const product = await FishRawProduct.create({ name: name.trim() });
    res.status(201).json({ id: product._id.toString(), name: product.name, created_at: product.created_at });
  } catch (e: any) {
    res.status(500).json({ message: e.message || "Failed to create product" });
  }
});

router.post("/records", requireAuth, async (req, res) => {
  try {
    const {
      record_date,
      buy_price_per_kg,
      wastage_percent,
      margin_percent,
      raw_fish_product_id,
      raw_fish_product_name,
      total_kg,
      total_purchase_kg,
      expiry_date,
    } = req.body;

    if (!record_date || record_date.length !== 10) {
      return res.status(422).json({ message: "record_date must be YYYY-MM-DD" });
    }

    const cfg = await getOrCreateConfig();
    const outputs = computeSalePrice(buy_price_per_kg, wastage_percent, margin_percent, cfg.toObject());
    const batchNumber = generateBatchNumber(record_date);

    const inputs: Record<string, any> = {
      buy_price_per_kg,
      wastage_percent,
      margin_percent,
      raw_fish_product_id: raw_fish_product_id ?? null,
      raw_fish_product_name: raw_fish_product_name ?? null,
      batch_number: batchNumber,
    };
    if (total_kg != null) inputs.total_kg = total_kg;
    if (total_purchase_kg != null) inputs.total_purchase_kg = total_purchase_kg;
    if (expiry_date) inputs.expiry_date = expiry_date;

    const record = await FishCalculatorRecord.create({
      record_date,
      inputs,
      config: cfg.toObject(),
      outputs,
    });

    res.status(201).json({
      id: record._id.toString(),
      record_date: record.record_date,
      created_at: record.created_at,
      inputs: record.inputs,
      config: record.config,
      outputs: record.outputs,
    });
  } catch (e: any) {
    res.status(500).json({ message: e.message || "Failed to create record" });
  }
});

router.get("/records", requireAuth, async (req, res) => {
  try {
    const { from_date, to_date, limit } = req.query;
    const filter: Record<string, any> = {};
    if (from_date) filter.record_date = { ...(filter.record_date || {}), $gte: from_date };
    if (to_date) filter.record_date = { ...(filter.record_date || {}), $lte: to_date };

    const records = await FishCalculatorRecord.find(filter)
      .sort({ record_date: -1, created_at: -1 })
      .limit(Math.min(Number(limit) || 200, 500));

    res.json(
      records.map((r: any) => ({
        id: r._id.toString(),
        record_date: r.record_date,
        created_at: r.created_at,
        inputs: r.inputs,
        config: r.config,
        outputs: r.outputs,
      }))
    );
  } catch (e: any) {
    res.status(500).json({ message: e.message || "Failed to list records" });
  }
});

router.patch("/records/:id", requireAuth, async (req, res) => {
  try {
    const record = await FishCalculatorRecord.findById(req.params.id);
    if (!record) return res.status(404).json({ message: "Record not found" });

    const {
      buy_price_per_kg,
      wastage_percent,
      margin_percent,
      total_kg,
      total_purchase_kg,
      expiry_date,
    } = req.body;

    const cfg = await getOrCreateConfig();
    const outputs = computeSalePrice(buy_price_per_kg, wastage_percent, margin_percent, cfg.toObject());

    const newInputs = { ...(record.inputs as any) };
    newInputs.buy_price_per_kg = buy_price_per_kg;
    newInputs.wastage_percent = wastage_percent;
    newInputs.margin_percent = margin_percent;
    if (total_kg != null) newInputs.total_kg = total_kg;
    if (total_purchase_kg != null) newInputs.total_purchase_kg = total_purchase_kg;
    if (expiry_date != null) newInputs.expiry_date = expiry_date;

    record.inputs = newInputs;
    record.config = cfg.toObject();
    record.outputs = outputs;
    await record.save();

    res.json({
      id: record._id.toString(),
      record_date: record.record_date,
      created_at: record.created_at,
      inputs: record.inputs,
      config: record.config,
      outputs: record.outputs,
    });
  } catch (e: any) {
    res.status(500).json({ message: e.message || "Failed to update record" });
  }
});

router.delete("/records/:id", requireAuth, async (req, res) => {
  try {
    const record = await FishCalculatorRecord.findByIdAndDelete(req.params.id);
    if (!record) return res.status(404).json({ message: "Record not found" });
    res.json({ status: "deleted", id: req.params.id });
  } catch (e: any) {
    res.status(500).json({ message: e.message || "Failed to delete record" });
  }
});

export default router;
