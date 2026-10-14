import { randomBytes } from "node:crypto";

export const CHANNEL_ID_PATTERN = /^ch_[A-Za-z0-9_-]{24}$/;

export function generateChannelId() {
  return `ch_${randomBytes(18).toString("base64url")}`;
}

export function isChannelId(value) {
  return CHANNEL_ID_PATTERN.test(String(value || ""));
}
