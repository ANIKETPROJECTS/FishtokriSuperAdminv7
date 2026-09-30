import { mongoose } from "../index.js";

const razorpayAlertSuppressionSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    suppressedAt: { type: Date, required: true, default: Date.now },
    suppressedBy: { type: String, default: "" },
  },
  {
    collection: "razorpay_payment_alert_suppressions",
    versionKey: false,
  },
);

export const RazorpayAlertSuppression =
  mongoose.models.RazorpayAlertSuppression ||
  mongoose.model("RazorpayAlertSuppression", razorpayAlertSuppressionSchema);