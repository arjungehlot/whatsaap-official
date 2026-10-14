import mongoose from "mongoose";
import { generateChannelId } from "../modules/whatsapp/whatsapp.channel-id.js";

const deviceSchema = new mongoose.Schema(
  {
    platform: { type: String, default: "Awaiting link" },
    appVersion: { type: String, default: "-" },
    battery: { type: Number, default: 0 },
  },
  { _id: false },
);

const sendSettingsSchema = new mongoose.Schema(
  {
    hourlyCap: { type: Number, default: 120, min: 1 },
    dailyCap: { type: Number, default: 1000, min: 1 },
    warmupHourlyCap: { type: Number, default: 60, min: 1 },
    warmupDailyCap: { type: Number, default: 500, min: 1 },
    minDelayMs: { type: Number, default: 3000, min: 500 },
    maxDelayMs: { type: Number, default: 12000, min: 500 },
    warmupMinDelayMs: { type: Number, default: 8000, min: 500 },
    warmupMaxDelayMs: { type: Number, default: 25000, min: 500 },
  },
  { _id: false },
);

const whatsappAccountSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    // Public-facing opaque identifier. Internal relations continue to use Mongo _id.
    channelId: { type: String, required: true, immutable: true, default: generateChannelId },
    state: {
      type: String,
      enum: ["DISCONNECTED", "CONNECTING", "QR_REQUIRED", "CONNECTED", "DISCONNECTING", "SESSION_EXPIRED", "ERROR"],
      default: "DISCONNECTED",
    },
    phone: { type: String, required: true, trim: true },
    normalizedPhone: { type: String, trim: true },
    // Inbox data is only visible from the point this phone was linked to this slot.
    // It prevents a replacement number from inheriting the prior number's history.
    inboxPhone: { type: String, trim: true },
    inboxVisibleSince: { type: Date },
    connectionError: { type: String, trim: true },
    displayName: { type: String, required: true, trim: true },
    accountType: { type: String, enum: ["business", "personal"], default: "business" },
    lastConnectedAt: { type: Date, default: Date.now },
    lastSyncedAt: { type: Date, default: Date.now },
    uptime: { type: String, default: "0m" },
    messagesSentToday: { type: Number, default: 0 },
    device: { type: deviceSchema, default: () => ({}) },
    sessionStatus: { type: String, enum: ["active", "stale", "expired"], default: "stale" },
    sendSettings: { type: sendSettingsSchema, default: () => ({}) },
  },
  { timestamps: true },
);

export const WhatsAppAccountModel = mongoose.model("WhatsAppAccount", whatsappAccountSchema);
