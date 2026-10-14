import mongoose from "mongoose";

const connectionEventSchema = new mongoose.Schema(
  {
    accountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "WhatsAppAccount",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["connected", "disconnected", "qr", "error", "sync"],
      required: true,
    },
    label: { type: String, required: true, trim: true },
    detail: { type: String, trim: true },
    at: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true },
);

connectionEventSchema.index({ accountId: 1, at: -1, _id: -1 });

export const ConnectionEventModel = mongoose.model("ConnectionEvent", connectionEventSchema);
