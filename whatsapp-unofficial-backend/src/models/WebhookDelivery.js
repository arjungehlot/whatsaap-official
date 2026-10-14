import mongoose from "mongoose";

const webhookDeliverySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    endpointId: { type: mongoose.Schema.Types.ObjectId, ref: "WebhookEndpoint", required: true, index: true },
    event: { type: String, required: true, index: true },
    status: { type: String, enum: ["pending", "succeeded", "failed"], required: true, default: "pending" },
    responseCode: { type: Number, default: null },
    durationMs: { type: Number, default: 0 },
    attempt: { type: Number, default: 1 },
    at: { type: Date, default: Date.now, index: true },
    requestBody: { type: mongoose.Schema.Types.Mixed, required: true },
    responseBody: { type: String, default: "" },
    error: { type: String, default: "" },
  },
  { timestamps: true },
);

webhookDeliverySchema.index({ endpointId: 1, at: -1 });
export const WebhookDeliveryModel = mongoose.model("WebhookDelivery", webhookDeliverySchema);
