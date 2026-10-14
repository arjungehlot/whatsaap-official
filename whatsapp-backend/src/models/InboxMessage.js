import mongoose from "mongoose";

const attachmentSchema = new mongoose.Schema(
  {
    kind: { type: String, enum: ["image", "video", "document"], required: true },
    name: { type: String, required: true, trim: true },
    mimeType: { type: String, trim: true },
    size: { type: Number },
  },
  { _id: false },
);

const inboxMessageSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    accountId: { type: mongoose.Schema.Types.ObjectId, ref: "WhatsAppAccount", required: true, index: true },
    accountPhone: { type: String, required: true, trim: true, index: true },
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "InboxConversation",
      required: true,
      index: true,
    },
    waMessageId: { type: String, trim: true },
    outboundLogId: { type: mongoose.Schema.Types.ObjectId, ref: "OutboundMessageLog", index: true },
    remoteJid: { type: String, required: true, trim: true },
    senderJid: { type: String, trim: true },
    senderName: { type: String, trim: true },
    senderPhone: { type: String, trim: true },
    body: { type: String, required: true, trim: true },
    direction: { type: String, enum: ["inbound", "outbound"], required: true },
    source: { type: String, enum: ["campaign", "send-message", "api", "inbox"] },
    status: { type: String, enum: ["pending", "sent", "delivered", "read", "failed"], default: "sent" },
    deliveredAt: { type: Date },
    readAt: { type: Date },
    error: { type: String, trim: true },
    at: { type: Date, default: Date.now, index: true },
    attachment: { type: attachmentSchema },
  },
  { timestamps: true },
);

inboxMessageSchema.index({ conversationId: 1, at: 1 });
inboxMessageSchema.index(
  { accountId: 1, accountPhone: 1, waMessageId: 1 },
  { unique: true, partialFilterExpression: { waMessageId: { $type: "string" } } },
);

export const InboxMessageModel = mongoose.model("InboxMessage", inboxMessageSchema);
