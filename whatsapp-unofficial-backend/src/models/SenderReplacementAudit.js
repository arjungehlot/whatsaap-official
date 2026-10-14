import mongoose from "mongoose";

const senderReplacementAuditSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    accountId: { type: mongoose.Schema.Types.ObjectId, ref: "WhatsAppAccount", required: true, index: true },
    channelId: { type: String, required: true, trim: true },
    action: { type: String, enum: ["api_key_rebound", "campaign_resumed"], required: true },
    previousPhone: { type: String, required: true, trim: true },
    replacementPhone: { type: String, required: true, trim: true },
    apiKeyId: { type: mongoose.Schema.Types.ObjectId, ref: "ApiKey", index: true },
    campaignId: { type: mongoose.Schema.Types.ObjectId, ref: "Campaign", index: true },
    resumedRecipients: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true },
);

senderReplacementAuditSchema.index({ userId: 1, accountId: 1, createdAt: -1 });

export const SenderReplacementAuditModel = mongoose.model("SenderReplacementAudit", senderReplacementAuditSchema);
