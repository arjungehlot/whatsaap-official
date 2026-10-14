import mongoose from "mongoose";

const whatsappAuthStateSchema = new mongoose.Schema(
  {
    accountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "WhatsAppAccount",
      required: true,
      index: true,
    },
    type: { type: String, required: true, trim: true },
    key: { type: String, required: true, trim: true },
    value: { type: String, required: true },
  },
  { timestamps: true },
);

whatsappAuthStateSchema.index({ accountId: 1, type: 1, key: 1 }, { unique: true });
whatsappAuthStateSchema.index({ updatedAt: 1 });

export const WhatsAppAuthStateModel = mongoose.model("WhatsAppAuthState", whatsappAuthStateSchema);
