import { mongoose } from "../index.js";

const superHubSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    location: { type: String, default: "" },
    imageUrl: { type: String, default: "" },
    status: { type: String, default: "Active" },
  },
  { timestamps: { createdAt: "createdAt", updatedAt: "updatedAt" } }
);

export const SuperHub = mongoose.models.SuperHub || mongoose.model("SuperHub", superHubSchema, "super_hubs");
