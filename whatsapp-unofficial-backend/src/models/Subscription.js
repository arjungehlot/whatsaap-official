import mongoose from "mongoose";

const subscriptionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    planId: { type: mongoose.Schema.Types.ObjectId, ref: "Plan", required: true, index: true },
    billingCycle: { type: String, enum: ["monthly", "yearly"], required: true },
    status: { type: String, enum: ["pending", "active", "expired", "cancelled", "failed"], default: "pending", index: true },
    startDate: { type: Date },
    expiryDate: { type: Date },
    autoRenew: { type: Boolean, default: false },
    isTrial: { type: Boolean, default: false },
    paymentId: { type: mongoose.Schema.Types.ObjectId, ref: "Payment" },
    planNameSnapshot: { type: String, required: true },
    amountSnapshot: { type: Number, required: true, min: 0 },
    taxableAmountSnapshot: { type: Number, min: 0 },
    gstAmountSnapshot: { type: Number, min: 0, default: 0 },
    currencySnapshot: { type: String, required: true, trim: true },
  },
  { timestamps: true },
);

subscriptionSchema.index({ userId: 1, status: 1, expiryDate: -1 });
export const SubscriptionModel = mongoose.model("Subscription", subscriptionSchema);
