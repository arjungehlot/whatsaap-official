import mongoose from "mongoose";

const webhookEndpointSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    url: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: "" },
    status: { type: String, enum: ["active", "paused"], default: "active", index: true },
    events: { type: [String], required: true, default: [] },
    version: { type: String, default: "2026-06-01" },
    retries: { type: Boolean, default: true },
  },
  { timestamps: true },
);

webhookEndpointSchema.index({ userId: 1, createdAt: -1 });
export const WebhookEndpointModel = mongoose.model("WebhookEndpoint", webhookEndpointSchema);
