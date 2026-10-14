import mongoose from "mongoose";

const messageCreditUsageSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    subscriptionId: { type: mongoose.Schema.Types.ObjectId, ref: "Subscription", required: true, index: true },
    scope: { type: String, enum: ["daily", "monthly", "trial"], required: true },
    periodKey: { type: String, required: true },
    used: { type: Number, required: true, min: 0, default: 0 },
  },
  { timestamps: true },
);

messageCreditUsageSchema.index({ subscriptionId: 1, scope: 1, periodKey: 1 }, { unique: true });
messageCreditUsageSchema.index({ userId: 1, createdAt: -1 });

export const MessageCreditUsageModel = mongoose.model("MessageCreditUsage", messageCreditUsageSchema);
