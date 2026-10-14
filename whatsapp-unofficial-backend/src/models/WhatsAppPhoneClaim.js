import mongoose from "mongoose";

const whatsappPhoneClaimSchema = new mongoose.Schema(
  {
    // The database migration owns the unique index so index creation is explicit and repeatable.
    normalizedPhone: { type: String, required: true, trim: true },
    accountId: { type: mongoose.Schema.Types.ObjectId, ref: "WhatsAppAccount", required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  },
  { timestamps: true },
);

export const WhatsAppPhoneClaimModel = mongoose.model("WhatsAppPhoneClaim", whatsappPhoneClaimSchema);
