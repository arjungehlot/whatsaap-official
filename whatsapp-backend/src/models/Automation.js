import mongoose from "mongoose";

const automationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 140 },
    triggerType: { type: String, enum: ["birthday", "event"], required: true },
    dateField: { type: String, trim: true, default: "birthday" },
    eventDate: { type: Date },
    time: { type: String, trim: true, default: "09:00" },
    timezone: { type: String, default: "Asia/Kolkata" },
    accountId: { type: mongoose.Schema.Types.ObjectId, ref: "WhatsAppAccount", required: true },
    channelId: { type: String, trim: true },
    senderNormalizedPhone: { type: String, trim: true },
    mode: { type: String, enum: ["direct", "template"], required: true },
    message: { type: String, trim: true },
    templateId: { type: mongoose.Schema.Types.ObjectId, ref: "MessageTemplate" },
    audienceType: { type: String, enum: ["all", "tag", "contacts"], default: "all" },
    audienceTag: { type: String, trim: true },
    contactIds: { type: [mongoose.Schema.Types.ObjectId], default: [] },
    status: { type: String, enum: ["active", "paused", "completed", "failed"], default: "active", index: true },
    lastRunAt: { type: Date },
    lastError: { type: String, trim: true },
  },
  { timestamps: true },
);

automationSchema.index({ userId: 1, createdAt: -1 });
export const AutomationModel = mongoose.model("Automation", automationSchema);
