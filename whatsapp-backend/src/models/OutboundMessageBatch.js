import mongoose from "mongoose";

const outboundMessageBatchSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    apiKeyId: { type: mongoose.Schema.Types.ObjectId, ref: "ApiKey", index: true },
    channelId: { type: String, trim: true, index: true },
    // A hash is retained so a client can safely retry without storing its idempotency secret in plaintext.
    idempotencyScope: { type: String, trim: true },
    idempotencyKeyHash: { type: String, trim: true },
    requestHash: { type: String, trim: true },
    status: { type: String, enum: ["queued", "sending", "completed", "partial", "failed"], default: "queued", index: true },
    recipientCount: { type: Number, required: true, min: 0, default: 0 },
    duplicatesIgnored: { type: Number, min: 0, default: 0 },
    queued: { type: Number, min: 0, default: 0 },
    sent: { type: Number, min: 0, default: 0 },
    delivered: { type: Number, min: 0, default: 0 },
    read: { type: Number, min: 0, default: 0 },
    failed: { type: Number, min: 0, default: 0 },
    responsePayload: { type: mongoose.Schema.Types.Mixed },
    lastError: { type: String, trim: true },
    completedAt: { type: Date },
  },
  { timestamps: true },
);

outboundMessageBatchSchema.index({ userId: 1, createdAt: -1 });
outboundMessageBatchSchema.index(
  { userId: 1, idempotencyScope: 1, idempotencyKeyHash: 1 },
  {
    unique: true,
    partialFilterExpression: { idempotencyKeyHash: { $type: "string" } },
    name: "userId_1_idempotencyScope_1_idempotencyKeyHash_1",
  },
);

export const OutboundMessageBatchModel = mongoose.model("OutboundMessageBatch", outboundMessageBatchSchema);
