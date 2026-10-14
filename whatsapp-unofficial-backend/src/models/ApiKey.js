import mongoose from "mongoose";

const apiKeySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    label: { type: String, required: true, trim: true },
    prefix: { type: String, required: true, trim: true, index: true },
    keyHash: { type: String, required: true, unique: true },
    defaultAccountId: { type: mongoose.Schema.Types.ObjectId, ref: "WhatsAppAccount", index: true },
    defaultChannelId: { type: String, trim: true },
    defaultAccountName: { type: String, trim: true },
    defaultAccountPhone: { type: String, trim: true },
    scopes: { type: [String], default: ["messages:write", "contacts:read"] },
    environment: { type: String, enum: ["test", "live"], default: "live" },
    lastUsedAt: { type: Date },
    revokedAt: { type: Date },
    requests30d: { type: Number, default: 0 },
  },
  { timestamps: true },
);

apiKeySchema.index({ userId: 1, createdAt: -1 });

export const ApiKeyModel = mongoose.model("ApiKey", apiKeySchema);
