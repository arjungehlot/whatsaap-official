import mongoose from "mongoose";

const messageJobRecipientSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    jobId: { type: mongoose.Schema.Types.ObjectId, ref: "MessageJob", required: true, index: true },
    contactId: { type: mongoose.Schema.Types.ObjectId, ref: "Contact", required: true, index: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    body: { type: String, trim: true, default: "" },
    status: {
      type: String,
      enum: ["pending", "under_processing", "sent", "delivered", "read", "failed", "skipped"],
      default: "pending",
      index: true,
    },
    messageIds: { type: [String], default: [] },
    sentAt: { type: Date },
    deliveredAt: { type: Date },
    readAt: { type: Date },
    error: { type: String, trim: true },
  },
  { timestamps: true },
);

messageJobRecipientSchema.index({ jobId: 1, contactId: 1 }, { unique: true });
messageJobRecipientSchema.index({ userId: 1, messageIds: 1 });

export const MessageJobRecipientModel = mongoose.model("MessageJobRecipient", messageJobRecipientSchema);
