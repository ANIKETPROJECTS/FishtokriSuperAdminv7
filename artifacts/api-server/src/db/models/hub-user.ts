import { mongoose } from "../index.js";

const hubUserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phone: { type: String, default: "" },
    profileImageUrl: { type: String, default: "" },
    role: { type: String, default: "sub_hub" },
    password: { type: String, required: true },
    superHubId: { type: mongoose.Schema.Types.ObjectId, ref: "SuperHub", default: null },
    superHubIds: { type: [mongoose.Schema.Types.ObjectId], ref: "SuperHub", default: [] },
    subHubId: { type: mongoose.Schema.Types.ObjectId, ref: "SubHub", default: null },
    subHubIds: { type: [mongoose.Schema.Types.ObjectId], ref: "SubHub", default: [] },
    status: { type: String, default: "Active" },
  },
  { timestamps: { createdAt: "createdAt", updatedAt: "updatedAt" } }
);

export const HubUser = mongoose.models.HubUser || mongoose.model("HubUser", hubUserSchema, "hub_users");
