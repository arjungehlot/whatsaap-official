import mongoose from "mongoose";

const attachmentSchema = new mongoose.Schema(
  {
    kind: { type: String, enum: ["image", "video", "document"], required: true },
    bucket: { type: String, required: true, trim: true },
    key: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    mimeType: { type: String, required: true, trim: true },
    size: { type: Number, required: true },
  },
  { _id: false },
);

const campaignSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    accountId: { type: mongoose.Schema.Types.ObjectId, ref: "WhatsAppAccount", required: true, index: true },
    channelId: { type: String, trim: true },
    senderNormalizedPhone: { type: String, trim: true },
    templateId: { type: mongoose.Schema.Types.ObjectId, ref: "MessageTemplate", required: true, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    status: {
      type: String,
      enum: ["draft", "scheduled", "running", "paused", "completed", "failed"],
      default: "draft",
      index: true,
    },
    audience: { type: String, required: true, trim: true },
    audienceType: { type: String, enum: ["all", "tag", "contacts"], default: "all" },
    audienceTag: { type: String, trim: true },
    templateName: { type: String, required: true, trim: true },
    templateBody: { type: String, required: true, trim: true },
    templateAttachment: { type: attachmentSchema },
    templateAttachments: { type: [attachmentSchema], default: [] },
    recipients: { type: Number, default: 0 },
    sent: { type: Number, default: 0 },
    delivered: { type: Number, default: 0 },
    read: { type: Number, default: 0 },
    failed: { type: Number, default: 0 },
    scheduledAt: { type: Date },
    timezone: { type: String, default: "Asia/Kolkata" },
    startedAt: { type: Date },
    completedAt: { type: Date },
    lastError: { type: String, trim: true },
    ratePerMinute: { type: Number, default: 120 },
  },
  { timestamps: true },
);

campaignSchema.index({ userId: 1, createdAt: -1 });

export const CampaignModel = mongoose.model("Campaign", campaignSchema);
