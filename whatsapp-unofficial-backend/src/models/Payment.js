import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    planId: { type: mongoose.Schema.Types.ObjectId, ref: "Plan", required: true },
    subscriptionId: { type: mongoose.Schema.Types.ObjectId, ref: "Subscription" },
    billingCycle: { type: String, enum: ["monthly", "yearly"], required: true },
    amount: { type: Number, required: true, min: 0 },
    baseAmount: { type: Number, min: 0 },
    prorationCredit: { type: Number, min: 0, default: 0 },
    taxableAmount: { type: Number, min: 0 },
    gstRate: { type: Number, min: 0, default: 18 },
    gstAmount: { type: Number, min: 0, default: 0 },
    upgradeFromSubscriptionId: { type: mongoose.Schema.Types.ObjectId, ref: "Subscription" },
    currency: { type: String, required: true, trim: true },
    status: { type: String, enum: ["pending", "successful", "failed", "cancelled"], default: "pending", index: true },
    gateway: { type: String, enum: ["razorpay", "payu", "manual"], default: "razorpay" },
    gatewayTransactionId: { type: String, trim: true, index: true },
    razorpayOrderId: { type: String, trim: true, index: true },
    razorpayPaymentId: { type: String, trim: true, index: true },
    razorpaySignature: { type: String, trim: true },
    paymentMethod: { type: String, trim: true },
    failureReason: { type: String, trim: true },
    completedAt: { type: Date },
  },
  { timestamps: true },
);

paymentSchema.index({ userId: 1, createdAt: -1 });
export const PaymentModel = mongoose.model("Payment", paymentSchema);
