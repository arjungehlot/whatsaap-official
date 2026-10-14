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

const templateSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true, trim: true },
    category: {
      type: String,
      enum: ["Marketing", "Transactional", "Reminder", "Welcome", "Follow-up", "Other"],
      default: "Marketing",
    },
    language: { type: String, default: "English", trim: true },
    status: { type: String, enum: ["draft", "active", "inactive"], default: "draft", index: true },
    body: { type: String, required: true, trim: true },
    attachment: { type: attachmentSchema },
    attachments: { type: [attachmentSchema], default: [] },
    usageCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

templateSchema.index({ userId: 1, name: 1 }, { unique: true });
templateSchema.index({ userId: 1, updatedAt: -1 });

export const MessageTemplateModel = mongoose.model("MessageTemplate", templateSchema);
