import mongoose from "mongoose";

const campaignRecipientSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    campaignId: { type: mongoose.Schema.Types.ObjectId, ref: "Campaign", required: true, index: true },
    contactId: { type: mongoose.Schema.Types.ObjectId, ref: "Contact", required: true, index: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ["pending", "under_processing", "sent", "delivered", "read", "failed", "skipped"],
      default: "pending",
      index: true,
    },
    sentAt: { type: Date },
    deliveredAt: { type: Date },
    readAt: { type: Date },
    error: { type: String, trim: true },
    messageId: { type: String, trim: true },
    body: { type: String, trim: true, default: "" },
  },
  { timestamps: true },
);

campaignRecipientSchema.index({ campaignId: 1, contactId: 1 }, { unique: true });

export const CampaignRecipientModel = mongoose.model("CampaignRecipient", campaignRecipientSchema);
