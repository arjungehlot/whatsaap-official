import mongoose from "mongoose";

const planSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true, match: /^[a-z0-9-]+$/ },
    description: { type: String, trim: true, maxlength: 500 },
    monthlyPrice: { type: Number, required: true, min: 0 },
    yearlyPrice: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "INR", uppercase: true, trim: true, maxlength: 3 },
    status: { type: String, enum: ["active", "inactive"], default: "active", index: true },
    visibility: { type: String, enum: ["public", "private"], default: "public" },
    popular: { type: Boolean, default: false },
    isTrial: { type: Boolean, default: false, index: true },
    trialDays: { type: Number, min: 1, max: 365 },
    messageCreditsUnlimited: { type: Boolean, default: true },
    monthlyMessageCredits: { type: Number, min: 0, default: 0 },
    dailyMessageCredits: { type: Number, min: 0, default: 0 },
    displayOrder: { type: Number, default: 0 },
  },
  { timestamps: true },
);

planSchema.index({ status: 1, visibility: 1, displayOrder: 1 });
export const PlanModel = mongoose.model("Plan", planSchema);
