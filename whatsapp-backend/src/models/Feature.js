import mongoose from "mongoose";

const featureSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, trim: true, lowercase: true, match: /^[a-z0-9_-]+$/ },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, trim: true, maxlength: 500 },
    valueType: { type: String, enum: ["boolean", "number", "unlimited", "text"], required: true },
    active: { type: Boolean, default: true, index: true },
    displayOrder: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export const FeatureModel = mongoose.model("Feature", featureSchema);
