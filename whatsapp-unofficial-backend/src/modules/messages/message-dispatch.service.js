import { ContactModel } from "../../models/Contact.js";
import { InboxConversationModel } from "../../models/InboxConversation.js";
import { InboxMessageModel } from "../../models/InboxMessage.js";
import { MessageJobRecipientModel } from "../../models/MessageJobRecipient.js";
import { OutboundMessageLogModel } from "../../models/OutboundMessageLog.js";
import { WhatsAppAccountModel } from "../../models/WhatsAppAccount.js";
import { normalizePhone } from "../contacts/contacts.service.js";
import { createOutboundMessageLog, outboundLogFailure, refreshOutboundDeliverySummary } from "../message-logs/message-logs.service.js";
import { sendWithMessageCredit } from "../billing/message-credits.service.js";
import { downloadAttachmentBuffer } from "../templates/template-storage.service.js";
import {
  isWhatsAppSocketOpen,
  sendWhatsAppButtonMessage,
  sendWhatsAppMediaMessage,
  sendWhatsAppTextMessage,
} from "../whatsapp/whatsapp.engine.js";
import { dispatchWebhookEvent } from "../webhooks/webhooks.service.js";
import {
  LEGACY_SENDER_IDENTITY_MESSAGE,
  SENDER_IDENTITY_CHANGED_MESSAGE,
  senderIdentityForAccount,
  senderIdentityMatches,
} from "../whatsapp/whatsapp.sender-identity.js";
import { getNextSendAvailability } from "../whatsapp/whatsapp.send-queue.js";
import { refreshOutboundBatch } from "./outbound-batches.service.js";

const PROCESSING_LEASE_MS = 2 * 60 * 1000;
const CAPACITY_RETRY_MS = 5 * 60 * 1000;
const DISCONNECTED_RETRY_MS = 15 * 1000;
const activeDispatchers = new Map();

function visibleMessage(message) {
  return {
    id: message._id.toString(),
    conversationId: message.conversationId.toString(),
    body: message.body,
    direction: message.direction,
    status: message.status,
    waMessageId: message.waMessageId,
    at: message.at.toISOString(),
    attachment: message.attachment,
  };
}

function isGroup(remoteJid) {
  return String(remoteJid || "").endsWith("@g.us");
}

function isDisconnectedError(error) {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  return error?.statusCode === 409 && (message.includes("not connected") || message.includes("reconnect"));
}

async function resolveContactName(userId, phone, remoteJid, preferredName) {
  if (preferredName) return preferredName;
  if (isGroup(remoteJid)) return phone;
  const contact = await ContactModel.findOne({ userId, normalizedPhone: normalizePhone(phone) }).select("name").lean();
  return contact?.name || phone;
}

async function createPendingInboxMessage({ userId, account, remoteJid, phone, body, attachment, source, logId, contactName }) {
  const now = new Date();
  const conversation = await InboxConversationModel.findOneAndUpdate(
    { userId, accountId: account._id, accountPhone: account.phone, remoteJid },
    {
      $set: {
        accountPhone: account.phone,
        contactName,
        phone,
        lastMessage: body || attachment?.name || "Attachment",
        lastMessageAt: now,
        isGroup: isGroup(remoteJid),
      },
      $setOnInsert: { unreadCount: 0, starred: false, labels: [source === "api" ? "API" : "WhatsApp"] },
    },
    { upsert: true, returnDocument: "after" },
  );

  return InboxMessageModel.create({
    userId,
    accountId: account._id,
    accountPhone: account.phone,
    conversationId: conversation._id,
    outboundLogId: logId,
    remoteJid,
    body: body || attachment?.name || "Attachment",
    direction: "outbound",
    source,
    status: "pending",
    at: now,
    attachment: attachment
      ? {
          kind: attachment.kind,
          name: attachment.name,
          mimeType: attachment.mimeType,
          size: attachment.size,
        }
      : undefined,
  });
}

export async function queueOutboundMessage({
  userId,
  account,
  phone,
  remoteJid,
  body,
  attachment,
  button,
  source = "api",
  chargeCredits = true,
  contactName,
  campaignId,
  campaignRecipientId,
  messageJobId,
  messageJobRecipientId,
  conversationId,
  retryOf,
  senderNormalizedPhone,
  deliveryGroupId,
  batchId,
  isDeliverySummary = false,
  deliveryBody,
}) {
  const finalBody = String(body || attachment?.name || "Attachment").trim() || "Attachment";
  const finalContactName = await resolveContactName(userId, phone, remoteJid, contactName);
  const payload = button
    ? { type: "button", button }
    : attachment
      ? { type: "media", attachment, body: String(body || "") }
      : { type: "text", body: finalBody };

  const log = await createOutboundMessageLog({
    userId,
    accountId: account._id,
    senderNormalizedPhone: senderNormalizedPhone || senderIdentityForAccount(account),
    phone,
    body: finalBody,
    source,
    status: "pending",
    creditDown: 0,
    remoteJid,
    payload,
    chargeCredits,
    contactName: finalContactName,
    campaignId,
    campaignRecipientId,
    messageJobId,
    messageJobRecipientId,
    conversationId,
    retryOf,
    deliveryGroupId,
    batchId,
    isDeliverySummary,
    deliveryBody,
    deliveryStatus: deliveryGroupId ? "pending" : undefined,
    deliveryCreditDown: 0,
    error: "Waiting for the WhatsApp number to be available",
  });

  const inboxMessage = await createPendingInboxMessage({
    userId,
    account,
    remoteJid,
    phone,
    body,
    attachment,
    source,
    logId: log._id,
    contactName: finalContactName,
  });
  await OutboundMessageLogModel.updateOne({ _id: log._id }, { $set: { inboxMessageId: inboxMessage._id } });
  log.inboxMessageId = inboxMessage._id;

  return { log, message: visibleMessage(inboxMessage) };
}

async function failRemainingDeliveryParts(log) {
  if (!log.deliveryGroupId) return;
  const message = "A part of this delivery failed, so the remaining parts were not sent.";
  const siblings = await OutboundMessageLogModel.find(
    { deliveryGroupId: log.deliveryGroupId, _id: { $ne: log._id }, status: { $in: ["pending", "processing"] } },
  ).select("_id inboxMessageId").lean();
  if (!siblings.length) return;
  const ids = siblings.map((sibling) => sibling._id);
  const inboxIds = siblings.map((sibling) => sibling.inboxMessageId).filter(Boolean);
  await OutboundMessageLogModel.updateMany({ _id: { $in: ids } }, { $set: { status: "failed", creditDown: 0, error: message }, $unset: { leaseExpiresAt: 1 } });
  if (inboxIds.length) await InboxMessageModel.updateMany({ _id: { $in: inboxIds } }, { $set: { status: "failed", error: message } });
}

async function blockDispatchForSenderIdentity(log, message) {
  await OutboundMessageLogModel.updateOne(
    { _id: log._id, status: "processing" },
    {
      $set: {
        status: "pending",
        blockedBySenderChange: true,
        error: message,
      },
      $unset: { leaseExpiresAt: 1 },
    },
  );
  await refreshOutboundDeliverySummary(log.deliveryGroupId);
  await refreshOutboundBatch(log.batchId);
}

async function reconcileSenderIdentityBlocks(account) {
  const accountId = account._id;
  const senderNormalizedPhone = senderIdentityForAccount(account);
  const pending = { accountId, status: "pending" };

  // We cannot safely infer the original sender for work queued before this protection existed.
  await OutboundMessageLogModel.updateMany(
    { ...pending, $or: [{ senderNormalizedPhone: { $exists: false } }, { senderNormalizedPhone: null }, { senderNormalizedPhone: "" }] },
    { $set: { blockedBySenderChange: true, error: LEGACY_SENDER_IDENTITY_MESSAGE } },
  );
  await OutboundMessageLogModel.updateMany(
    { ...pending, senderNormalizedPhone: { $exists: true, $ne: senderNormalizedPhone } },
    { $set: { blockedBySenderChange: true, error: SENDER_IDENTITY_CHANGED_MESSAGE } },
  );
  await OutboundMessageLogModel.updateMany(
    { ...pending, senderNormalizedPhone, blockedBySenderChange: true },
    {
      $set: {
        blockedBySenderChange: false,
        nextAttemptAt: new Date(),
        error: "Waiting for the WhatsApp number to be available",
      },
    },
  );
}

async function markSourceDelivered(log, waMessageId, sentAt) {
  if (log.campaignRecipientId) {
    const { CampaignRecipientModel } = await import("../../models/CampaignRecipient.js");
    const { refreshCampaignCounts, notifyCampaignDeliveryUpdate, resumeCampaignDelivery } = await import("../campaigns/campaigns.service.js");
    const pending = await OutboundMessageLogModel.countDocuments({
      campaignRecipientId: log.campaignRecipientId,
      status: { $in: ["pending", "processing"] },
    });
    if (pending === 0) {
      const recipient = await CampaignRecipientModel.findByIdAndUpdate(
        log.campaignRecipientId,
        { $set: { status: "sent", sentAt, messageId: waMessageId, error: undefined } },
        { returnDocument: "after" },
      );
      if (recipient) {
        await ContactModel.updateOne({ _id: recipient.contactId }, { $set: { lastContactedAt: sentAt } });
        await refreshCampaignCounts(recipient.campaignId);
        notifyCampaignDeliveryUpdate(log.userId, recipient.campaignId);
        resumeCampaignDelivery(recipient.campaignId);
      }
    }
  }

  if (log.messageJobRecipientId) {
    const { MessageJobRecipientModel } = await import("../../models/MessageJobRecipient.js");
    const { refreshMessageJobCounts } = await import("./message-status.service.js");
    const { resumeMessageJobDelivery } = await import("../message-jobs/message-jobs.service.js");
    if (waMessageId) {
      await MessageJobRecipientModel.updateOne({ _id: log.messageJobRecipientId }, { $addToSet: { messageIds: waMessageId } });
    }
    const pending = await OutboundMessageLogModel.countDocuments({
      messageJobRecipientId: log.messageJobRecipientId,
      status: { $in: ["pending", "processing"] },
    });
    if (pending === 0) {
      const recipient = await MessageJobRecipientModel.findByIdAndUpdate(
        log.messageJobRecipientId,
        { $set: { status: "sent", sentAt, error: undefined } },
        { returnDocument: "after" },
      );
      if (recipient) {
        await refreshMessageJobCounts(recipient.jobId);
        resumeMessageJobDelivery(recipient.jobId);
      }
    }
  }
}

async function markSourceFailed(log, reason) {
  if (log.campaignRecipientId) {
    const { CampaignRecipientModel } = await import("../../models/CampaignRecipient.js");
    const { refreshCampaignCounts, notifyCampaignDeliveryUpdate, resumeCampaignDelivery } = await import("../campaigns/campaigns.service.js");
    const recipient = await CampaignRecipientModel.findByIdAndUpdate(
      log.campaignRecipientId,
      { $set: { status: "failed", error: reason } },
      { returnDocument: "after" },
    );
    if (recipient) {
      await refreshCampaignCounts(recipient.campaignId);
      notifyCampaignDeliveryUpdate(log.userId, recipient.campaignId);
      resumeCampaignDelivery(recipient.campaignId);
    }
  }

  if (log.messageJobRecipientId) {
    const { MessageJobRecipientModel } = await import("../../models/MessageJobRecipient.js");
    const { refreshMessageJobCounts } = await import("./message-status.service.js");
    const { resumeMessageJobDelivery } = await import("../message-jobs/message-jobs.service.js");
    const recipient = await MessageJobRecipientModel.findByIdAndUpdate(
      log.messageJobRecipientId,
      { $set: { status: "failed", error: reason } },
      { returnDocument: "after" },
    );
    if (recipient) {
      await refreshMessageJobCounts(recipient.jobId);
      resumeMessageJobDelivery(recipient.jobId);
    }
  }
}

async function sendDispatch(log) {
  const payload = log.payload || {};
  if (payload.type === "button") {
    return sendWhatsAppButtonMessage(log.accountId, log.remoteJid, payload.button);
  }
  if (payload.type === "media") {
    const attachment = await downloadAttachmentBuffer(payload.attachment);
    return sendWhatsAppMediaMessage(log.accountId, log.remoteJid, { ...attachment, body: payload.body || "" });
  }
  return sendWhatsAppTextMessage(log.accountId, log.remoteJid, payload.body || log.body);
}

async function deferDispatch(log, error, delayMs) {
  await OutboundMessageLogModel.updateOne(
    { _id: log._id, status: "processing" },
    {
      $set: {
        status: "pending",
        nextAttemptAt: new Date(Date.now() + delayMs),
        error: error instanceof Error ? error.message : "Waiting for the WhatsApp number to reconnect",
      },
      $unset: { leaseExpiresAt: 1 },
    },
  );
}

async function pauseSourceForRateLimit(log, error) {
  const reason = error instanceof Error ? error.message : "WhatsApp send limit reached";
  if (log.campaignId) {
    const { CampaignModel } = await import("../../models/Campaign.js");
    const { notifyCampaignDeliveryUpdate } = await import("../campaigns/campaigns.service.js");
    await CampaignModel.updateOne({ _id: log.campaignId, status: "running" }, { $set: { status: "paused", lastError: reason } });
    notifyCampaignDeliveryUpdate(log.userId, log.campaignId);
  }
  if (log.messageJobId) {
    const { MessageJobModel } = await import("../../models/MessageJob.js");
    await MessageJobModel.updateOne({ _id: log.messageJobId, status: "running" }, { $set: { status: "paused", lastError: reason } });
  }
  // Direct API batches do not have a parent controller to unpause them. They stay pending
  // with nextAttemptAt set to the next rolling-window opening and resume automatically.
  if (log.source === "api") return;
  await OutboundMessageLogModel.updateOne({ _id: log._id, status: "pending" }, { $set: { blockedByRateLimit: true } });
}

async function deliverDispatch(log) {
  if (log.messageJobRecipientId) {
    const recipient = await MessageJobRecipientModel.findById(log.messageJobRecipientId).select("status").lean();
    if (!recipient || recipient.status === "skipped") {
      await OutboundMessageLogModel.updateOne(
        { _id: log._id, status: "processing" },
        { $set: { status: "failed", creditDown: 0, error: "Removed from this scheduled send before delivery" }, $unset: { leaseExpiresAt: 1 } },
      );
      if (log.inboxMessageId) {
        await InboxMessageModel.updateOne(
          { _id: log.inboxMessageId, status: { $in: ["pending", "processing"] } },
          { $set: { status: "failed", error: "Removed from this scheduled send before delivery" } },
        );
      }
      await refreshOutboundDeliverySummary(log.deliveryGroupId);
      await refreshOutboundBatch(log.batchId);
      return;
    }
  }
  const account = await WhatsAppAccountModel.findById(log.accountId).select("phone normalizedPhone").lean();
  if (!log.senderNormalizedPhone) {
    await blockDispatchForSenderIdentity(log, LEGACY_SENDER_IDENTITY_MESSAGE);
    return;
  }
  if (!senderIdentityMatches(account, log.senderNormalizedPhone)) {
    await blockDispatchForSenderIdentity(log, SENDER_IDENTITY_CHANGED_MESSAGE);
    return;
  }
  if (!isWhatsAppSocketOpen(log.accountId)) {
    await deferDispatch(log, new Error("Waiting for the WhatsApp number to reconnect"), DISCONNECTED_RETRY_MS);
    return;
  }

  try {
    const sent = log.chargeCredits === false
      ? await sendDispatch(log)
      : await sendWithMessageCredit(log.userId, () => sendDispatch(log));
    const sentAt = new Date();
    const waMessageId = sent?.key?.id;
    await OutboundMessageLogModel.updateOne(
      { _id: log._id, status: "processing" },
      {
        $set: { status: "sent", creditDown: log.chargeCredits === false ? 0 : 1, waMessageId, sentAt },
        $unset: { leaseExpiresAt: 1, nextAttemptAt: 1, error: 1 },
      },
    );
    if (log.inboxMessageId) {
      await InboxMessageModel.updateOne(
        { _id: log.inboxMessageId, status: "pending" },
        { $set: { status: "sent", waMessageId, at: sentAt } },
      );
    }
    await refreshOutboundDeliverySummary(log.deliveryGroupId);
    await refreshOutboundBatch(log.batchId);
    await markSourceDelivered(log, waMessageId, sentAt);
    const account = await WhatsAppAccountModel.findById(log.accountId).select("channelId").lean();
    void dispatchWebhookEvent(log.userId, "message.sent", {
      message_id: waMessageId,
      account_id: account?.channelId,
      channel_id: account?.channelId,
      to: log.phone,
      body: log.body,
      sent_at: sentAt.toISOString(),
    }).catch(() => {});
  } catch (error) {
    if (isDisconnectedError(error)) {
      await deferDispatch(log, error, DISCONNECTED_RETRY_MS);
      return;
    }
    if (error?.statusCode === 429) {
      const nextAvailableAt = await getNextSendAvailability(log.accountId).catch(() => new Date(Date.now() + CAPACITY_RETRY_MS));
      await deferDispatch(log, error, Math.max(nextAvailableAt.getTime() - Date.now(), CAPACITY_RETRY_MS));
      await pauseSourceForRateLimit(log, error);
      return;
    }

    const reason = outboundLogFailure(error);
    await OutboundMessageLogModel.updateOne(
      { _id: log._id, status: "processing" },
      { $set: { status: "failed", creditDown: 0, error: reason }, $unset: { leaseExpiresAt: 1 } },
    );
    if (log.inboxMessageId) {
      await InboxMessageModel.updateOne({ _id: log.inboxMessageId }, { $set: { status: "failed", error: reason } });
    }
    await failRemainingDeliveryParts(log);
    await refreshOutboundDeliverySummary(log.deliveryGroupId);
    await refreshOutboundBatch(log.batchId);
    await markSourceFailed(log, reason);
  }
}

async function processAccountDispatches(accountId, limit) {
  const account = await WhatsAppAccountModel.findById(accountId).select("state phone normalizedPhone").lean();
  if (!account || account.state !== "CONNECTED" || !isWhatsAppSocketOpen(accountId)) return 0;
  await reconcileSenderIdentityBlocks(account);

  let processed = 0;
  while (processed < limit && isWhatsAppSocketOpen(accountId)) {
    const now = new Date();
    const log = await OutboundMessageLogModel.findOneAndUpdate(
      {
        accountId,
        status: "pending",
        blockedByRateLimit: { $ne: true },
        blockedBySenderChange: { $ne: true },
        $or: [{ nextAttemptAt: { $exists: false } }, { nextAttemptAt: { $lte: now } }],
      },
      {
        $set: { status: "processing", leaseExpiresAt: new Date(Date.now() + PROCESSING_LEASE_MS), error: undefined },
        $inc: { attemptCount: 1 },
      },
      { sort: { createdAt: 1, _id: 1 }, returnDocument: "after" },
    );
    if (!log) break;
    processed += 1;
    await deliverDispatch(log);
  }
  return processed;
}

export async function dispatchPendingOutboundMessages(accountId, options = {}) {
  const key = accountId.toString();
  const running = activeDispatchers.get(key);
  if (running) return running;

  const task = processAccountDispatches(accountId, Math.max(1, Number(options.limit) || 100))
    .finally(() => activeDispatchers.delete(key));
  activeDispatchers.set(key, task);
  return task;
}

export async function dispatchPendingMessagesForConnectedAccounts() {
  const now = new Date();
  await OutboundMessageLogModel.updateMany(
    { status: "processing", leaseExpiresAt: { $lte: now } },
    { $set: { status: "pending", nextAttemptAt: now, error: "Recovered after an interrupted delivery attempt" }, $unset: { leaseExpiresAt: 1 } },
  );
  const accounts = await WhatsAppAccountModel.find({ state: "CONNECTED" }).select("_id").lean();
  const results = await Promise.all(accounts.map((account) => dispatchPendingOutboundMessages(account._id).catch(() => 0)));
  return results.reduce((total, value) => total + value, 0);
}

export async function getQueuedMessageResult(logId) {
  const log = await OutboundMessageLogModel.findById(logId).select("inboxMessageId status").lean();
  if (!log?.inboxMessageId) return null;
  const message = await InboxMessageModel.findById(log.inboxMessageId).lean();
  return message ? visibleMessage(message) : null;
}
