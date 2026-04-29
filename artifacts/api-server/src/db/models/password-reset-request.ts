import { mongoose } from "../index.js";

const passwordResetRequestSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, lowercase: true, trim: true },
    hubUserId: { type: mongoose.Schema.Types.ObjectId, ref: "HubUser", default: null },
    name: { type: String, default: "" },
    role: { type: String, default: "" },
    status: { type: String, enum: ["pending", "resolved", "rejected"], default: "pending" },
    note: { type: String, default: "" },
    resolvedAt: { type: Date, default: null },
    resolvedByEmail: { type: String, default: "" },
  },
  { timestamps: { createdAt: "createdAt", updatedAt: "updatedAt" } }
);

export const PasswordResetRequest =
  mongoose.models.PasswordResetRequest ||
  mongoose.model("PasswordResetRequest", passwordResetRequestSchema, "password_reset_requests");
