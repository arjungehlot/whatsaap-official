import mongoose from "mongoose";

const attachmentSchema = new mongoose.Schema(
  {
    kind: { type: String, enum: ["image", "video", "document"], required: true },
    bucket: { type: String, trim: true },
    key: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    mimeType: { type: String, required: true, trim: true },
    size: { type: Number },
  },
  { _id: false },
);

const messageJobSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    accountId: { type: mongoose.Schema.Types.ObjectId, ref: "WhatsAppAccount", required: true },
    channelId: { type: String, trim: true },
    senderNormalizedPhone: { type: String, trim: true },
    name: { type: String, required: true, trim: true, maxlength: 140 },
    mode: { type: String, enum: ["direct", "template"], required: true },
    templateId: { type: mongoose.Schema.Types.ObjectId, ref: "MessageTemplate" },
    templateName: { type: String, trim: true },
    body: { type: String, trim: true, default: "" },
    attachments: { type: [attachmentSchema], default: [] },
    contactIds: { type: [mongoose.Schema.Types.ObjectId], default: [] },
    recipients: { type: Number, default: 0 },
    sent: { type: Number, default: 0 },
    delivered: { type: Number, default: 0 },
    read: { type: Number, default: 0 },
    failed: { type: Number, default: 0 },
    status: { type: String, enum: ["scheduled", "running", "completed", "paused", "cancelled", "failed"], default: "scheduled", index: true },
    scheduledAt: { type: Date },
    timezone: { type: String, default: "Asia/Kolkata" },
    startedAt: { type: Date },
    completedAt: { type: Date },
    lastError: { type: String, trim: true },
  },
  { timestamps: true },
);

messageJobSchema.index({ userId: 1, createdAt: -1 });
messageJobSchema.index({ status: 1, scheduledAt: 1 });

export const MessageJobModel = mongoose.model("MessageJob", messageJobSchema);
