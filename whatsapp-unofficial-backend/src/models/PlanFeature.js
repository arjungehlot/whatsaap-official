import mongoose from "mongoose";

const planFeatureSchema = new mongoose.Schema(
  {
    planId: { type: mongoose.Schema.Types.ObjectId, ref: "Plan", required: true, index: true },
    featureId: { type: mongoose.Schema.Types.ObjectId, ref: "Feature", required: true, index: true },
    valueType: { type: String, enum: ["boolean", "number", "unlimited", "text"], required: true },
    booleanValue: { type: Boolean },
    numberValue: { type: Number, min: 0 },
    textValue: { type: String, trim: true, maxlength: 200 },
  },
  { timestamps: true },
);

planFeatureSchema.index({ planId: 1, featureId: 1 }, { unique: true });
export const PlanFeatureModel = mongoose.model("PlanFeature", planFeatureSchema);
