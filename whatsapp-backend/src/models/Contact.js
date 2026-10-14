import mongoose from "mongoose";

const contactSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    normalizedPhone: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    dateOfBirth: { type: String, trim: true },
    avatarUrl: { type: String, trim: true },
    tags: [{ type: String, trim: true }],
    source: {
      type: String,
      enum: ["Manual", "CSV Import", "Website Form", "API", "WhatsApp"],
      default: "Manual",
    },
    status: { type: String, enum: ["active", "inactive", "blocked"], default: "active", index: true },
    lastContactedAt: { type: Date },
    notes: { type: String, trim: true },
    customFields: { type: Map, of: String, default: {} },
  },
  { timestamps: true },
);

contactSchema.index({ userId: 1, normalizedPhone: 1 }, { unique: true });
contactSchema.index({ userId: 1, tags: 1 });
contactSchema.index({ userId: 1, createdAt: -1 });

export const ContactModel = mongoose.model("Contact", contactSchema);
