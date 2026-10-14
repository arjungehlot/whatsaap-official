import mongoose from "mongoose";

const outboundMessageLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    accountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "WhatsAppAccount",
      required: true,
      index: true,
    },
    // The real WhatsApp phone at queue time. A slot may later be paired with another phone.
    senderNormalizedPhone: { type: String, trim: true, index: true },
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "InboxConversation",
    },
    campaignId: { type: mongoose.Schema.Types.ObjectId, ref: "Campaign" },
    messageJobId: { type: mongoose.Schema.Types.ObjectId, ref: "MessageJob" },
    retryOf: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "OutboundMessageLog",
    },
    // One customer request can contain text plus several WhatsApp media sends.
    // The queue retains every physical send, while this id ties them to one billable recipient delivery.
    deliveryGroupId: { type: String, trim: true, index: true },
    // A public API batch groups many recipient-level delivery groups.
    batchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "OutboundMessageBatch",
      index: true,
    },
    isDeliverySummary: { type: Boolean, default: false, index: true },
    deliveryBody: { type: String, trim: true },
    deliveryStatus: {
      type: String,
      enum: ["pending", "sent", "delivered", "read", "failed", "cancelled"],
    },
    deliveryCreditDown: { type: Number, min: 0, default: 0 },
    deliveryError: { type: String, trim: true },
    deliverySentAt: { type: Date },
    inboxMessageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "InboxMessage",
      index: true,
    },
    campaignRecipientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CampaignRecipient",
      index: true,
    },
    messageJobRecipientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MessageJobRecipient",
      index: true,
    },
    contactName: { type: String, trim: true },
    phone: { type: String, required: true, trim: true, index: true },
    body: { type: String, required: true, trim: true },
    source: {
      type: String,
      enum: ["campaign", "send-message", "api", "inbox"],
      required: true,
      index: true,
    },
    // Pending rows are durable outbound work. They are retained until the linked WhatsApp channel can send them.
    status: {
      type: String,
      enum: [
        "pending",
        "processing",
        "sent",
        "delivered",
        "read",
        "failed",
        "cancelled",
      ],
      required: true,
      index: true,
    },
    creditDown: { type: Number, required: true, min: 0, default: 0 },
    waMessageId: { type: String, trim: true, index: true },
    error: { type: String, trim: true },
    remoteJid: { type: String, trim: true },
    payload: { type: mongoose.Schema.Types.Mixed },
    chargeCredits: { type: Boolean, default: true },
    attemptCount: { type: Number, required: true, min: 0, default: 0 },
    nextAttemptAt: { type: Date, default: Date.now, index: true },
    leaseExpiresAt: { type: Date, index: true },
    blockedByRateLimit: { type: Boolean, default: false, index: true },
    blockedBySenderChange: { type: Boolean, default: false, index: true },
    sentAt: { type: Date, default: Date.now, index: true },
    deliveredAt: { type: Date },
    readAt: { type: Date },
    retryCount: { type: Number, required: true, min: 0, default: 0 },
    lastRetriedAt: { type: Date },
  },
  { timestamps: true },
);

outboundMessageLogSchema.index({ userId: 1, sentAt: -1, _id: -1 });
outboundMessageLogSchema.index({ userId: 1, accountId: 1, waMessageId: 1 });
outboundMessageLogSchema.index({
  accountId: 1,
  status: 1,
  nextAttemptAt: 1,
  createdAt: 1,
});
outboundMessageLogSchema.index({
  accountId: 1,
  status: 1,
  blockedBySenderChange: 1,
  nextAttemptAt: 1,
});
outboundMessageLogSchema.index({
  userId: 1,
  deliveryGroupId: 1,
  isDeliverySummary: 1,
  createdAt: -1,
});
outboundMessageLogSchema.index({
  batchId: 1,
  isDeliverySummary: 1,
  createdAt: 1,
});

export const OutboundMessageLogModel = mongoose.model(
  "OutboundMessageLog",
  outboundMessageLogSchema,
);
