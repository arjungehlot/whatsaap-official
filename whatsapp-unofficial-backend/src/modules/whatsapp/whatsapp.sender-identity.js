import { normalizeWhatsAppPhone } from "./whatsapp.phone.js";

export const SENDER_IDENTITY_CHANGED_MESSAGE =
  "The WhatsApp number in this slot changed. Reconnect the original number or create a new send from the replacement number.";

export const LEGACY_SENDER_IDENTITY_MESSAGE =
  "This queued message was created before sender identity protection. It will not be sent automatically; submit it again after confirming the WhatsApp number.";

export function senderIdentityForAccount(account) {
  return normalizeWhatsAppPhone(account?.normalizedPhone || account?.phone);
}

export function senderIdentityMatches(account, expectedPhone) {
  return Boolean(expectedPhone && senderIdentityForAccount(account) === normalizeWhatsAppPhone(expectedPhone));
}
