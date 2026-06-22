import { mongoose } from "../index.js";

const fishCalculatorConfigSchema = new mongoose.Schema(
  {
    market_handling_cost: { type: Number, default: 0 },
    fixed_cost: { type: Number, default: 0 },
    packaging_cost: { type: Number, default: 0 },
    delivery_cost: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const FishCalculatorConfig =
  mongoose.models.FishCalculatorConfig ||
  mongoose.model("FishCalculatorConfig", fishCalculatorConfigSchema, "fish_calculator_config");

const fishRawProductSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
  },
  { timestamps: { createdAt: "created_at", updatedAt: false } }
);

export const FishRawProduct =
  mongoose.models.FishRawProduct ||
  mongoose.model("FishRawProduct", fishRawProductSchema, "fish_calculator_products");

const fishCalculatorRecordSchema = new mongoose.Schema(
  {
    record_date: { type: String, required: true },
    inputs: { type: mongoose.Schema.Types.Mixed, required: true },
    config: { type: mongoose.Schema.Types.Mixed, required: true },
    outputs: { type: mongoose.Schema.Types.Mixed, required: true },
  },
  { timestamps: { createdAt: "created_at", updatedAt: false } }
);

export const FishCalculatorRecord =
  mongoose.models.FishCalculatorRecord ||
  mongoose.model("FishCalculatorRecord", fishCalculatorRecordSchema, "fish_calculator_records");
