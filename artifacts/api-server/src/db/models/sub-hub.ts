import { mongoose } from "../index.js";

const subHubSchema = new mongoose.Schema(
  {
    superHubId: { type: mongoose.Schema.Types.ObjectId, ref: "SuperHub", required: true },
    name: { type: String, required: true },
    location: { type: String, default: "" },
    imageUrl: { type: String, default: "" },
    pincodes: { type: [String], default: [] },
    status: { type: String, default: "Active" },
    dbName: { type: String, default: "" },
  },
  { timestamps: { createdAt: "createdAt", updatedAt: "updatedAt" } }
);

export const SubHub = mongoose.models.SubHub || mongoose.model("SubHub", subHubSchema, "sub_hubs");
