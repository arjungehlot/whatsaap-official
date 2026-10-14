import mongoose from "mongoose";

const sendEventSchema = new mongoose.Schema(
  {
    reservationId: { type: String, required: true },
    at: { type: Date, required: true },
  },
  { _id: false },
);

const whatsAppSendWindowSchema = new mongoose.Schema(
  {
    // The database migration owns the unique index so it is guaranteed in every environment.
    accountId: { type: mongoose.Schema.Types.ObjectId, ref: "WhatsAppAccount", required: true },
    events: { type: [sendEventSchema], default: [] },
  },
  { timestamps: true },
);

export const WhatsAppSendWindowModel = mongoose.model("WhatsAppSendWindow", whatsAppSendWindowSchema);
