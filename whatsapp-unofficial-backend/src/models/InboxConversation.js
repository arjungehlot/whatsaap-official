import mongoose from "mongoose";

const inboxConversationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    accountId: { type: mongoose.Schema.Types.ObjectId, ref: "WhatsAppAccount", required: true, index: true },
    accountPhone: { type: String, required: true, trim: true, index: true },
    remoteJid: { type: String, required: true, trim: true },
    contactName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    lastMessage: { type: String, default: "", trim: true },
    lastMessageAt: { type: Date, default: Date.now, index: true },
    unreadCount: { type: Number, default: 0 },
    starred: { type: Boolean, default: false },
    assignedTo: { type: String, trim: true },
    isGroup: { type: Boolean, default: false },
    groupSubject: { type: String, trim: true, default: "" },
    groupDescription: { type: String, trim: true, default: "" },
    // Last successful WhatsApp group metadata refresh and a persisted retry cooldown.
    groupMetadataFetchedAt: { type: Date },
    groupMetadataRetryAfter: { type: Date },
    groupMembers: {
      type: [
        {
          _id: false,
          jid: { type: String, required: true, trim: true },
          phone: { type: String, default: "" },
          name: { type: String, default: "" },
          role: { type: String, default: "member" },
        },
      ],
      default: [],
    },
    labels: { type: [String], default: [] },
  },
  { timestamps: true },
);

inboxConversationSchema.index({ userId: 1, accountId: 1, accountPhone: 1, remoteJid: 1 }, { unique: true });
inboxConversationSchema.index({ userId: 1, lastMessageAt: -1 });
inboxConversationSchema.index({ userId: 1, accountPhone: 1, unreadCount: 1, lastMessageAt: -1 });

export const InboxConversationModel = mongoose.model("InboxConversation", inboxConversationSchema);
