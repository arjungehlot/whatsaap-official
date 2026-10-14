import { WhatsAppAccountModel } from "../../models/WhatsAppAccount.js";
import { OutboundMessageLogModel } from "../../models/OutboundMessageLog.js";
import { ApiError } from "../../utils/apiError.js";
import { normalizePhone } from "../contacts/contacts.service.js";
import { sameWhatsAppPhone } from "../whatsapp/whatsapp.phone.js";
import { uploadAttachmentToS3 } from "../templates/template-storage.service.js";
import { getPhoneJidForLid } from "../whatsapp/whatsapp.auth-store.js";
import {
  dispatchPendingOutboundMessages,
  getQueuedMessageResult,
  queueOutboundMessage,
} from "./message-dispatch.service.js";
import { isWhatsAppSocketOpen } from "../whatsapp/whatsapp.engine.js";
import { randomUUID } from "node:crypto";

function toRemoteJid(phone) {
  return `${normalizePhone(phone)}@s.whatsapp.net`;
}

async function resolveRecipient(accountId, to) {
  const raw = String(to || "").trim();
  if (raw.endsWith("@g.us")) {
    return { phone: raw.replace("@g.us", ""), remoteJid: raw, isGroup: true };
  }
  if (raw.endsWith("@lid")) {
    const phoneJid = await getPhoneJidForLid(accountId.toString(), raw);
    if (!phoneJid) {
      throw new ApiError(
        422,
        "This WhatsApp linked ID cannot be resolved for the selected account yet. Use the member's phone number or wait for WhatsApp contact identity sync before sending.",
      );
    }
    const phone = `+${normalizePhone(phoneJid.replace("@s.whatsapp.net", ""))}`;
    return { phone, remoteJid: phoneJid, isGroup: false, requestedJid: raw };
  }
  if (raw.endsWith("@c.us")) {
    const phone = `+${normalizePhone(raw.replace("@c.us", ""))}`;
    return { phone, remoteJid: `${normalizePhone(phone)}@s.whatsapp.net`, isGroup: false };
  }
  if (raw.endsWith("@s.whatsapp.net")) {
    const phone = `+${normalizePhone(raw.replace("@s.whatsapp.net", ""))}`;
    return { phone, remoteJid: raw, isGroup: false };
  }
  const phone = `+${normalizePhone(raw)}`;
  return { phone, remoteJid: toRemoteJid(phone), isGroup: false };
}

async function getAccount(userId, channelId, apiKey) {
  function assertBoundApiKeyPhone(account) {
    if (!apiKey?.defaultAccountId) return;
    if (!apiKey.defaultAccountPhone || !sameWhatsAppPhone(apiKey.defaultAccountPhone, account.normalizedPhone || account.phone)) {
      throw new ApiError(
        409,
        "This API key is bound to a WhatsApp number that has changed. Edit the API key and bind it to the replacement number before sending.",
      );
    }
  }

  if (!channelId) {
    if (apiKey?.defaultAccountId) {
      const account = await WhatsAppAccountModel.findOne({ _id: apiKey.defaultAccountId, userId });
      if (account) {
        assertBoundApiKeyPhone(account);
        return account;
      }
      throw new ApiError(409, "The WhatsApp number bound to this API key no longer exists");
    }
    const accounts = await WhatsAppAccountModel.find({ userId }).sort({ createdAt: 1 }).limit(2);
    if (accounts.length > 1) {
      throw new ApiError(400, "Multiple WhatsApp numbers are connected. Create a key bound to one number or pass channelId.");
    }
    const account = accounts[0];
    if (!account) throw new ApiError(409, "Connect a WhatsApp number before sending messages");
    return account;
  }

  const account = await WhatsAppAccountModel.findOne({ channelId, userId }).sort({ createdAt: 1 });
  if (!account) throw new ApiError(409, "Connect a WhatsApp number before sending messages");
  assertBoundApiKeyPhone(account);
  return account;
}

function channelIdForPayload(payload, apiKey) {
  const requested = payload.accountId || payload.channelId;
  const bound = apiKey?.defaultChannelId;

  if (bound && requested && requested !== bound) {
    throw new ApiError(403, "This API key is bound to a different WhatsApp number");
  }

  return requested || bound;
}

export async function resolveApiWhatsAppAccount(userId, payload = {}, options = {}) {
  return getAccount(userId, channelIdForPayload(payload, options.apiKey), options.apiKey);
}

function cleanButton(button) {
  if (!button) return null;
  const buttons = Array.isArray(button.buttons)
    ? button.buttons
        .map((item) => ({
          id: String(item.id || "").trim() || undefined,
          text: String(item.text || "").trim(),
        }))
        .filter((item) => item.text)
    : [];

  const body = String(button.body || "").trim();
  if (!body || buttons.length < 1 || buttons.length > 3) {
    throw new ApiError(400, "Button message requires body and 1 to 3 buttons");
  }

  return {
    title: String(button.title || "").trim(),
    body,
    footer: String(button.footer || "").trim(),
    buttons,
  };
}

async function persistInlineAttachment(userId, attachment) {
  if (!attachment?.buffer) return attachment;
  const stored = await uploadAttachmentToS3(userId, {
    buffer: attachment.buffer,
    originalname: attachment.fileName || attachment.name || "attachment",
    mimetype: attachment.mimeType || "application/octet-stream",
    size: attachment.size || attachment.buffer.length,
  });
  return { ...stored, body: attachment.body || "" };
}

/** Persist request attachments once so a bulk recipient batch can reuse the same immutable object. */
export async function persistInlineAttachments(userId, attachments = []) {
  return Promise.all(attachments.map((attachment) => persistInlineAttachment(userId, attachment)));
}

export async function sendApiMessage(userId, payload, options = {}) {
  const account = await resolveApiWhatsAppAccount(userId, payload, options);
  const { phone, remoteJid } = await resolveRecipient(account._id, payload.to);
  const button = cleanButton(payload.button);
  const rawAttachments = payload.inlineAttachments?.length
    ? payload.inlineAttachments
    : payload.attachments?.length
      ? payload.attachments
      : payload.attachment
        ? [payload.attachment]
        : [];
  const attachments = options.attachmentsAlreadyStored
    ? rawAttachments
    : await persistInlineAttachments(userId, rawAttachments);
  const bodyParts = Array.isArray(payload.bodyParts)
    ? payload.bodyParts.map((body) => String(body || "").trim()).filter(Boolean)
    : payload.body
      ? [String(payload.body).trim()]
      : [];
  const deliveryGroupId = options.deliveryGroupId || randomUUID();
  const deliveryParts = [];

  for (const body of bodyParts) deliveryParts.push({ body });
  if (button) deliveryParts.push({ body: button.body, button });
  for (const storedAttachment of attachments) {
    deliveryParts.push({ body: String(storedAttachment.body || ""), attachment: storedAttachment });
  }
  if (!deliveryParts.length) throw new ApiError(400, "A message, button or attachment is required");

  const deliveryBody = deliveryParts
    .map((part) => {
      if (part.button) return part.button.body;
      if (part.attachment) {
        const caption = String(part.body || "").trim();
        return caption ? `${caption}\n[Attachment: ${part.attachment.name}]` : `[Attachment: ${part.attachment.name}]`;
      }
      return part.body;
    })
    .filter(Boolean)
    .join("\n\n");
  const queued = [];
  for (const [index, part] of deliveryParts.entries()) {
    queued.push(await queueOutboundMessage({
      userId, account, phone, remoteJid, body: part.body, attachment: part.attachment, button: part.button, source: options.source || "api",
      // Exactly one successful part reserves the recipient's single credit. The first part is kept first in the durable queue.
      chargeCredits: options.chargeCredits !== false && index === 0, contactName: options.contactName, campaignId: options.campaignId,
      campaignRecipientId: options.campaignRecipientId, messageJobId: options.messageJobId,
      messageJobRecipientId: options.messageJobRecipientId, conversationId: options.conversationId, retryOf: options.retryOf,
      senderNormalizedPhone: options.senderNormalizedPhone,
      deliveryGroupId,
      batchId: options.batchId,
      isDeliverySummary: index === 0,
      deliveryBody,
    }));
  }

  const dispatch = dispatchPendingOutboundMessages(account._id, { limit: queued.length });
  if (options.awaitDispatch === false) {
    // Public API callers receive a durable queued response instead of waiting through each WhatsApp queue delay.
    void dispatch.catch((error) => console.error("Queued API message dispatch failed", error));
  } else {
    await dispatch;
  }
  const messages = await Promise.all(queued.map(async ({ log, message }) => (await getQueuedMessageResult(log._id)) || message));

  return {
    to: phone,
    channelId: account.channelId,
    channel: {
      id: account.channelId,
      name: account.displayName || account.phone || "WhatsApp",
      phone: account.phone,
      state: account.state,
      ready: account.state === "CONNECTED" && isWhatsAppSocketOpen(account._id),
    },
    messages,
    deliveryGroupId,
  };
}

/** Requeue only the failed physical parts of one recipient delivery. */
export async function retryOutboundDelivery(userId, summaryLog) {
  const previousParts = summaryLog.deliveryGroupId
    ? await OutboundMessageLogModel.find({
        userId,
        deliveryGroupId: summaryLog.deliveryGroupId,
        status: "failed",
      }).lean()
    : [summaryLog];
  if (!previousParts.length) throw new ApiError(409, "There are no failed message parts left to retry");

  const account = await WhatsAppAccountModel.findOne({ _id: summaryLog.accountId, userId });
  if (!account?.channelId) throw new ApiError(404, "The WhatsApp channel for this message no longer exists");

  const allPreviousParts = summaryLog.deliveryGroupId
    ? await OutboundMessageLogModel.find({ userId, deliveryGroupId: summaryLog.deliveryGroupId })
      .select("creditDown").lean()
    : [summaryLog];
  const needsCredit = allPreviousParts.every((part) => Number(part.creditDown) === 0);
  const deliveryGroupId = randomUUID();
  const deliveryBody = previousParts.map((part) => part.body).filter(Boolean).join("\n\n");
  const queued = [];

  for (const [index, part] of previousParts.entries()) {
    const payload = part.payload || {};
    queued.push(await queueOutboundMessage({
      userId,
      account,
      phone: part.phone,
      remoteJid: part.remoteJid,
      body: payload.body || part.body,
      attachment: payload.attachment,
      button: payload.button,
      source: part.source,
      chargeCredits: needsCredit && index === 0,
      contactName: part.contactName,
      campaignId: part.campaignId,
      campaignRecipientId: part.campaignRecipientId,
      messageJobId: part.messageJobId,
      messageJobRecipientId: part.messageJobRecipientId,
      conversationId: part.conversationId,
      retryOf: part._id,
      deliveryGroupId,
      isDeliverySummary: index === 0,
      deliveryBody,
    }));
  }

  await dispatchPendingOutboundMessages(account._id, { limit: queued.length });
  const messages = await Promise.all(queued.map(async ({ log, message }) => (await getQueuedMessageResult(log._id)) || message));
  return { to: summaryLog.phone, channelId: account.channelId, messages, deliveryGroupId };
}
