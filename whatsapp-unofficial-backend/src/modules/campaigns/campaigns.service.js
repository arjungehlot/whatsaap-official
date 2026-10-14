import { EventEmitter } from "node:events";
import { CampaignModel } from "../../models/Campaign.js";
import { CampaignRecipientModel } from "../../models/CampaignRecipient.js";
import { ContactModel } from "../../models/Contact.js";
import { InboxConversationModel } from "../../models/InboxConversation.js";
import { InboxMessageModel } from "../../models/InboxMessage.js";
import { MessageTemplateModel } from "../../models/MessageTemplate.js";
import { OutboundMessageLogModel } from "../../models/OutboundMessageLog.js";
import { WhatsAppAccountModel } from "../../models/WhatsAppAccount.js";
import { ApiError } from "../../utils/apiError.js";
import { normalizePhone } from "../contacts/contacts.service.js";
import { sendApiMessage } from "../messages/messages.service.js";
import {
  SENDER_IDENTITY_CHANGED_MESSAGE,
  senderIdentityForAccount,
  senderIdentityMatches,
} from "../whatsapp/whatsapp.sender-identity.js";
import { dispatchWebhookEvent } from "../webhooks/webhooks.service.js";
import { createSenderReplacementAudit, resumeBlockedCampaignMessages } from "../whatsapp/sender-replacement.service.js";
import { DEFAULT_TIMEZONE, localDateTimeToUtc, requireTimezone } from "../../utils/timezone.js";

const scheduledTimers = new Map();
const runningCampaigns = new Set();
const runningCampaignByUser = new Map();
const campaignEvents = new EventEmitter();

campaignEvents.setMaxListeners(500);

function emitCampaignEvent(userId, campaignId, type = "changed") {
  if (!userId) return;
  campaignEvents.emit(userId.toString(), {
    type,
    campaignId: campaignId?.toString(),
    at: new Date().toISOString(),
  });
}

export function notifyCampaignDeliveryUpdate(userId, campaignId) {
  emitCampaignEvent(userId, campaignId);
}

export function subscribeCampaignEvents(userId, listener) {
  const key = userId.toString();
  campaignEvents.on(key, listener);
  return () => campaignEvents.off(key, listener);
}

function visibleCampaign(campaign, deliveryCounts) {
  const templateAttachments = campaign.templateAttachments?.length
    ? campaign.templateAttachments
    : campaign.templateAttachment
      ? [campaign.templateAttachment]
      : [];

  return {
    id: campaign._id.toString(),
    name: campaign.name,
    description: campaign.description || undefined,
    status: campaign.status,
    accountId: campaign.channelId,
    channelId: campaign.channelId,
    templateId: campaign.templateId?.toString(),
    audience: campaign.audience,
    audienceType: campaign.audienceType,
    audienceTag: campaign.audienceTag || undefined,
    templateName: campaign.templateName,
    templateBody: campaign.templateBody,
    templateAttachment: campaign.templateAttachment
      ? {
          kind: campaign.templateAttachment.kind,
          name: campaign.templateAttachment.name,
          mimeType: campaign.templateAttachment.mimeType,
          size: campaign.templateAttachment.size,
        }
      : undefined,
    templateAttachments: templateAttachments.map((attachment) => ({
      kind: attachment.kind,
      name: attachment.name,
      mimeType: attachment.mimeType,
      size: attachment.size,
    })),
    recipients: campaign.recipients,
    sent: deliveryCounts?.sent ?? campaign.sent,
    delivered: deliveryCounts?.delivered ?? campaign.delivered,
    read: deliveryCounts?.read ?? campaign.read,
    failed: deliveryCounts?.failed ?? campaign.failed,
    scheduledAt: campaign.scheduledAt?.toISOString(),
    timezone: campaign.timezone || DEFAULT_TIMEZONE,
    ratePerMinute: Math.min(Math.max(Number(campaign.ratePerMinute) || 1, 1), 250),
    lastError: campaign.lastError || undefined,
    createdAt: campaign.createdAt.toISOString(),
  };
}

function deliveryCountsFromRows(rows) {
  const counts = { sent: 0, delivered: 0, read: 0, failed: 0 };
  for (const row of rows) {
    const value = Number(row.count || 0);
    if (row._id.status === "sent") counts.sent += value;
    if (row._id.status === "delivered") {
      counts.sent += value;
      counts.delivered += value;
    }
    if (row._id.status === "read") {
      counts.sent += value;
      counts.delivered += value;
      counts.read += value;
    }
    if (row._id.status === "failed") counts.failed += value;
  }
  return counts;
}

async function campaignDeliveryCounts(campaignIds) {
  if (!campaignIds.length) return new Map();
  const rows = await CampaignRecipientModel.aggregate([
    { $match: { campaignId: { $in: campaignIds } } },
    { $group: { _id: { campaignId: "$campaignId", status: "$status" }, count: { $sum: 1 } } },
  ]);
  const grouped = new Map();
  for (const row of rows) {
    const key = row._id.campaignId.toString();
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(row);
  }
  return new Map([...grouped.entries()].map(([id, counts]) => [id, deliveryCountsFromRows(counts)]));
}

function visibleRecipient(recipient) {
  return {
    contactId: recipient.contactId.toString(),
    name: recipient.name,
    phone: recipient.phone,
    status: recipient.status,
    body: recipient.body || undefined,
    sentAt: recipient.sentAt?.toISOString(),
    deliveredAt: recipient.deliveredAt?.toISOString(),
    readAt: recipient.readAt?.toISOString(),
    error: recipient.error || undefined,
  };
}

function toRemoteJid(phone) {
  return `${normalizePhone(phone)}@s.whatsapp.net`;
}

function renderTemplate(body, contact) {
  const fields =
    contact.customFields instanceof Map
      ? Object.fromEntries(contact.customFields)
      : contact.customFields && typeof contact.customFields === "object"
        ? contact.customFields
        : {};

  return body.replace(/\{\{(\w+)\}\}/g, (_match, key) => {
    if (key === "name") return contact.name;
    if (key === "phone") return contact.phone;
    if (key === "email") return contact.email || "";
    return fields[key] || "";
  });
}

function campaignIntervalMs(ratePerMinute) {
  const normalizedRate = Math.min(Math.max(Number(ratePerMinute) || 1, 1), 250);
  return Math.ceil((60 * 1000) / normalizedRate);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForCampaignSlot(campaignId, nextSendAt) {
  while (Date.now() < nextSendAt) {
    await sleep(Math.min(nextSendAt - Date.now(), 5000));
    const current = await CampaignModel.findById(campaignId).select("status").lean();
    if (!current || current.status !== "running") return false;
  }
  return true;
}

function templateAttachmentsFrom(template) {
  return template.attachments?.length ? template.attachments : template.attachment ? [template.attachment] : [];
}

async function getAccountForCampaign(userId, channelId, options = {}) {
  const query = channelId
    ? { ...(options.internal ? { _id: channelId } : { channelId }), userId }
    : { userId };
  const account = await WhatsAppAccountModel.findOne(query).sort({ createdAt: 1 });

  if (!account) throw new ApiError(409, "Connect a WhatsApp number before launching a campaign");
  return account;
}

function audienceLabel(payload, count) {
  if (payload.audienceType === "tag") return `Tag: ${payload.audienceTag}`;
  if (payload.audienceType === "contacts") return `${count} selected contacts`;
  return "All active contacts";
}

async function resolveRecipients(userId, payload) {
  const query = { userId, status: "active" };
  if (payload.audienceType === "tag") {
    if (!payload.audienceTag) throw new ApiError(400, "Choose a tag for this audience");
    query.tags = payload.audienceTag;
  }
  if (payload.audienceType === "contacts") {
    if (!payload.contactIds?.length) throw new ApiError(400, "Choose at least one contact");
    query._id = { $in: payload.contactIds };
  }

  const contacts = await ContactModel.find(query).sort({ createdAt: -1 });
  if (contacts.length === 0) throw new ApiError(400, "No active contacts found for this audience");
  return contacts;
}

export async function refreshCampaignCounts(campaignId) {
  const rows = await CampaignRecipientModel.aggregate([
    { $match: { campaignId } },
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);
  const counts = Object.fromEntries(rows.map((row) => [row._id, row.count]));

  await CampaignModel.findByIdAndUpdate(campaignId, {
    sent: (counts.sent || 0) + (counts.delivered || 0) + (counts.read || 0),
    delivered: (counts.delivered || 0) + (counts.read || 0),
    read: counts.read || 0,
    failed: counts.failed || 0,
  });
}

async function upsertCampaignConversation({ userId, accountId, contact, body, attachment, waMessageId }) {
  const remoteJid = toRemoteJid(contact.phone);
  const now = new Date();
  const account = await WhatsAppAccountModel.findById(accountId).select("phone").lean();
  const accountPhone = account?.phone || "Unknown WhatsApp number";
  const conversation = await InboxConversationModel.findOneAndUpdate(
    { userId, accountId, accountPhone, remoteJid },
    {
      $set: {
        accountPhone,
        contactName: contact.name,
        phone: contact.phone,
        lastMessage: body || attachment?.name || "Attachment",
        lastMessageAt: now,
        isGroup: false,
      },
      $setOnInsert: { unreadCount: 0, starred: false, labels: [] },
    },
    { returnDocument: "after", upsert: true },
  );

  await InboxMessageModel.create({
    userId,
    accountId,
    accountPhone,
    conversationId: conversation._id,
    waMessageId,
    remoteJid,
    body: body || attachment?.name || "Attachment",
    direction: "outbound",
    source: "campaign",
    status: "sent",
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

async function processCampaign(campaignId) {
  const key = campaignId.toString();
  if (runningCampaigns.has(key)) return;
  let userKey;

  try {
    let campaign = await CampaignModel.findById(campaignId);
    if (!campaign || !["running", "scheduled"].includes(campaign.status)) return;
    if (campaign.status === "scheduled" && campaign.scheduledAt && new Date(campaign.scheduledAt).getTime() > Date.now()) return;

    const account = await getAccountForCampaign(campaign.userId, campaign.accountId, { internal: true });
    if (!campaign.senderNormalizedPhone || !senderIdentityMatches(account, campaign.senderNormalizedPhone)) {
      campaign.status = "paused";
      campaign.lastError = SENDER_IDENTITY_CHANGED_MESSAGE;
      await campaign.save();
      emitCampaignEvent(campaign.userId, campaign._id);
      return;
    }

    userKey = campaign.userId.toString();
    const activeCampaignId = runningCampaignByUser.get(userKey);
    if (activeCampaignId && activeCampaignId !== key) return;

    runningCampaigns.add(key);
    runningCampaignByUser.set(userKey, key);

    campaign.status = "running";
    campaign.startedAt ||= new Date();
    campaign.lastError = undefined;
    await campaign.save();
    void dispatchWebhookEvent(campaign.userId, "campaign.started", visibleCampaign(campaign)).catch(() => {});

    const recipients = await CampaignRecipientModel.find({ campaignId, status: "pending" }).sort({ createdAt: 1 });
    let nextSendAt = Date.now();

    for (const recipient of recipients) {
      campaign = await CampaignModel.findById(campaignId);
      if (!campaign || campaign.status !== "running") break;
      if (!(await waitForCampaignSlot(campaign._id, nextSendAt))) break;

      campaign = await CampaignModel.findById(campaignId);
      if (!campaign || campaign.status !== "running") break;

      const contact = await ContactModel.findOne({ _id: recipient.contactId, userId: campaign.userId });
      if (!contact || contact.status !== "active") {
        recipient.status = "skipped";
        recipient.error = "Contact is no longer active";
        await recipient.save();
        continue;
      }

      try {
        const body = renderTemplate(campaign.templateBody, contact);
        const attachments = campaign.templateAttachments?.length
          ? campaign.templateAttachments
          : campaign.templateAttachment
            ? [campaign.templateAttachment]
            : [];
        recipient.status = "under_processing";
        recipient.body = body;
        recipient.error = undefined;
        await recipient.save();
        const result = await sendApiMessage(
          campaign.userId,
          {
            to: toRemoteJid(contact.phone),
            accountId: campaign.channelId,
            body,
            attachments,
          },
          {
            source: "campaign",
            contactName: contact.name,
            campaignId: campaign._id,
            campaignRecipientId: recipient._id,
            senderNormalizedPhone: campaign.senderNormalizedPhone,
          },
        );

        // When the channel is offline, leave this recipient visibly under processing and resume the campaign after delivery.
        if (result.messages.some((message) => message.status === "pending")) {
          await refreshCampaignCounts(campaign._id);
          emitCampaignEvent(campaign.userId, campaign._id);
          break;
        }
      } catch (error) {
        if (error?.statusCode === 429) {
          campaign.status = "paused";
          campaign.lastError = error.message;
          await campaign.save();
          emitCampaignEvent(campaign.userId, campaign._id);
          break;
        }
        recipient.status = "failed";
        recipient.error = error instanceof Error ? error.message : "Message failed";
        await recipient.save();
      }

      await refreshCampaignCounts(campaign._id);
      emitCampaignEvent(campaign.userId, campaign._id);

      const attachments = campaign.templateAttachments?.length
        ? campaign.templateAttachments
        : campaign.templateAttachment
          ? [campaign.templateAttachment]
          : [];
      nextSendAt = Math.max(nextSendAt, Date.now()) + campaignIntervalMs(campaign.ratePerMinute) * Math.max(attachments.length, 1);
    }

    campaign = await CampaignModel.findById(campaignId);
    if (!campaign || campaign.status !== "running") return;

    const [remaining, underProcessing] = await Promise.all([
      CampaignRecipientModel.countDocuments({ campaignId, status: "pending" }),
      CampaignRecipientModel.countDocuments({ campaignId, status: "under_processing" }),
    ]);
    campaign.status = underProcessing > 0 ? "running" : remaining === 0 ? "completed" : "paused";
    campaign.completedAt = campaign.status === "completed" ? new Date() : undefined;
    await campaign.save();
    if (campaign.status === "completed") {
      void dispatchWebhookEvent(campaign.userId, "campaign.completed", visibleCampaign(campaign)).catch(() => {});
    }
    emitCampaignEvent(campaign.userId, campaign._id);
  } catch (error) {
    const campaign = await CampaignModel.findByIdAndUpdate(
      campaignId,
      {
        status: "failed",
        lastError: error instanceof Error ? error.message : "Campaign failed",
      },
      { returnDocument: "after" },
    );
    if (campaign) emitCampaignEvent(campaign.userId, campaign._id);
  } finally {
    runningCampaigns.delete(key);
    if (userKey && runningCampaignByUser.get(userKey) === key) runningCampaignByUser.delete(userKey);
    if (userKey) drainCampaignQueue(userKey);
  }
}

// Called by the durable outbound dispatcher after a held recipient settles.
export function resumeCampaignDelivery(campaignId) {
  void (async () => {
    const now = new Date();
    await OutboundMessageLogModel.updateMany(
      { campaignId, status: "pending", blockedByRateLimit: true },
      { $set: { blockedByRateLimit: false, nextAttemptAt: now } },
    );
    const log = await OutboundMessageLogModel.findOne({ campaignId, status: "pending", blockedByRateLimit: { $ne: true } }).select("accountId").lean();
    if (log) {
      const { dispatchPendingOutboundMessages } = await import("../messages/message-dispatch.service.js");
      void dispatchPendingOutboundMessages(log.accountId);
    }
    await processCampaign(campaignId);
  })();
}

function drainCampaignQueue(userId) {
  setTimeout(async () => {
    try {
      const userKey = userId.toString();
      if (runningCampaignByUser.has(userKey)) return;

      const now = new Date();
      const campaign = await CampaignModel.findOne({
        userId,
        $or: [{ status: "running" }, { status: "scheduled", scheduledAt: { $lte: now } }],
      }).sort({ scheduledAt: 1, createdAt: 1 });

      if (campaign) processCampaign(campaign._id);
    } catch (_error) {
      // The next list/detail/status action or server restart will retry queue recovery.
    }
  }, 0);
}

function recoverUserCampaignQueue(userId) {
  const userKey = userId.toString();
  if (runningCampaignByUser.has(userKey)) return;
  drainCampaignQueue(userId);
}

function scheduleCampaign(campaign) {
  const key = campaign._id.toString();
  clearTimeout(scheduledTimers.get(key));

  if (campaign.status !== "scheduled" || !campaign.scheduledAt) return;

  const delayMs = Math.max(new Date(campaign.scheduledAt).getTime() - Date.now(), 0);
  const timer = setTimeout(() => {
    scheduledTimers.delete(key);
    processCampaign(campaign._id);
  }, delayMs);
  scheduledTimers.set(key, timer);
}

export async function restoreScheduledCampaigns() {
  const campaigns = await CampaignModel.find({ status: "scheduled", scheduledAt: { $gte: new Date() } });
  campaigns.forEach(scheduleCampaign);
  const overdue = await CampaignModel.find({ status: "scheduled", scheduledAt: { $lt: new Date() } });
  const running = await CampaignModel.find({ status: "running" }).sort({ createdAt: 1 });

  overdue.forEach((campaign) => recoverUserCampaignQueue(campaign.userId));
  running.forEach((campaign) => recoverUserCampaignQueue(campaign.userId));
  return campaigns.length + overdue.length + running.length;
}

export async function listCampaigns(userId, filters = {}) {
  recoverUserCampaignQueue(userId);

  const query = { userId };
  const search = filters.search?.trim();
  if (filters.status && filters.status !== "all") query.status = filters.status;
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: "i" } },
      { audience: { $regex: search, $options: "i" } },
      { templateName: { $regex: search, $options: "i" } },
    ];
  }

  const campaigns = await CampaignModel.find(query).sort({ createdAt: -1 }).lean();
  const counts = await campaignDeliveryCounts(campaigns.map((campaign) => campaign._id));
  return campaigns.map((campaign) => visibleCampaign(campaign, counts.get(campaign._id.toString())));
}

export async function getCampaign(userId, campaignId) {
  recoverUserCampaignQueue(userId);

  const campaign = await CampaignModel.findOne({ _id: campaignId, userId }).lean();
  if (!campaign) throw new ApiError(404, "Campaign not found");
  const counts = await campaignDeliveryCounts([campaign._id]);
  return visibleCampaign(campaign, counts.get(campaign._id.toString()));
}

export async function listCampaignRecipients(userId, campaignId) {
  const campaign = await CampaignModel.findOne({ _id: campaignId, userId }).select("_id").lean();
  if (!campaign) throw new ApiError(404, "Campaign not found");

  const recipients = await CampaignRecipientModel.find({ campaignId }).sort({ createdAt: 1 }).lean();
  return recipients.map(visibleRecipient);
}

export async function createCampaign(userId, payload) {
  const [template, contacts, account] = await Promise.all([
    MessageTemplateModel.findOne({ _id: payload.templateId, userId }),
    resolveRecipients(userId, payload),
    getAccountForCampaign(userId, payload.accountId),
  ]);

  if (!template) throw new ApiError(404, "Template not found");

  let timezone;
  let scheduledAt;
  try {
    timezone = requireTimezone(payload.timezone || DEFAULT_TIMEZONE);
    scheduledAt = payload.sendNow ? undefined : payload.scheduledAt ? localDateTimeToUtc(payload.scheduledAt, timezone) : undefined;
  } catch (error) {
    throw new ApiError(400, error instanceof Error ? error.message : "Invalid timezone or scheduled date");
  }
  const status = payload.sendNow ? "running" : scheduledAt ? "scheduled" : "draft";
  const campaign = await CampaignModel.create({
    userId,
    accountId: account._id,
    channelId: account.channelId,
    senderNormalizedPhone: senderIdentityForAccount(account),
    templateId: template._id,
    name: payload.name,
    description: payload.description,
    status,
    audience: audienceLabel(payload, contacts.length),
    audienceType: payload.audienceType,
    audienceTag: payload.audienceTag,
    templateName: template.name,
    templateBody: template.body,
    templateAttachment: templateAttachmentsFrom(template)[0],
    templateAttachments: templateAttachmentsFrom(template),
    recipients: contacts.length,
    scheduledAt,
    timezone,
    ratePerMinute: payload.ratePerMinute,
  });

  await CampaignRecipientModel.insertMany(
    contacts.map((contact) => ({
      userId,
      campaignId: campaign._id,
      contactId: contact._id,
      name: contact.name,
      phone: contact.phone,
    })),
  );

  template.usageCount += 1;
  await template.save();

  if (status === "running") resumeCampaignDelivery(campaign._id);
  if (status === "scheduled") scheduleCampaign(campaign);
  emitCampaignEvent(userId, campaign._id);

  return visibleCampaign(campaign);
}

async function applyCampaignTemplate(campaign, userId, templateId) {
  if (!templateId) return;
  const template = await MessageTemplateModel.findOne({ _id: templateId, userId });
  if (!template) throw new ApiError(404, "Template not found");

  campaign.templateId = template._id;
  campaign.templateName = template.name;
  campaign.templateBody = template.body;
  campaign.templateAttachment = templateAttachmentsFrom(template)[0];
  campaign.templateAttachments = templateAttachmentsFrom(template);
}

async function refreshCampaignTemplateSnapshot(campaign, userId) {
  if (!campaign.templateId) return;
  await applyCampaignTemplate(campaign, userId, campaign.templateId);
}

export async function updateCampaign(userId, campaignId, payload) {
  const campaign = await CampaignModel.findOne({ _id: campaignId, userId });
  if (!campaign) throw new ApiError(404, "Campaign not found");
  if (runningCampaignByUser.get(campaign.userId.toString()) === campaign._id.toString()) {
    throw new ApiError(409, "Pause the campaign before editing it");
  }

  if (payload.name !== undefined) campaign.name = payload.name;
  if (payload.description !== undefined) campaign.description = payload.description;
  if (payload.ratePerMinute !== undefined) campaign.ratePerMinute = payload.ratePerMinute;
  if (payload.audienceType !== undefined) {
    campaign.audienceType = payload.audienceType;
    if (payload.audienceType !== "tag") campaign.audienceTag = undefined;
  }
  if (payload.audienceTag !== undefined) campaign.audienceTag = payload.audienceTag;
  if (payload.accountId !== undefined) {
    const account = await getAccountForCampaign(userId, payload.accountId);
    campaign.accountId = account._id;
    campaign.channelId = account.channelId;
    campaign.senderNormalizedPhone = senderIdentityForAccount(account);
  }
  await applyCampaignTemplate(campaign, userId, payload.templateId);

  if (payload.audienceType || payload.audienceTag) {
    const contacts = await resolveRecipients(userId, {
      audienceType: campaign.audienceType,
      audienceTag: campaign.audienceTag,
      contactIds: payload.contactIds,
    });
    campaign.audience = audienceLabel(campaign, contacts.length);
    if (["draft", "scheduled"].includes(campaign.status)) {
      await CampaignRecipientModel.deleteMany({ campaignId: campaign._id });
      await CampaignRecipientModel.insertMany(
        contacts.map((contact) => ({
          userId,
          campaignId: campaign._id,
          contactId: contact._id,
          name: contact.name,
          phone: contact.phone,
        })),
      );
      campaign.recipients = contacts.length;
      campaign.sent = 0;
      campaign.delivered = 0;
      campaign.read = 0;
      campaign.failed = 0;
    }
  }

  if (payload.timezone !== undefined) {
    try { campaign.timezone = requireTimezone(payload.timezone); } catch (error) { throw new ApiError(400, error instanceof Error ? error.message : "Invalid timezone"); }
  }
  if (payload.scheduledAt !== undefined) {
    try { campaign.scheduledAt = payload.scheduledAt ? localDateTimeToUtc(payload.scheduledAt, campaign.timezone || DEFAULT_TIMEZONE) : undefined; } catch (error) { throw new ApiError(400, error instanceof Error ? error.message : "Invalid scheduled date"); }
    if (campaign.status === "scheduled" && !campaign.scheduledAt) throw new ApiError(400, "Schedule time is required");
  }

  await campaign.save();
  if (campaign.status === "scheduled") scheduleCampaign(campaign);
  emitCampaignEvent(userId, campaign._id);
  return visibleCampaign(campaign);
}

/** Continue a paused campaign only after a user confirms the replacement sender. */
export async function continueCampaignWithReplacement(userId, campaignId) {
  const campaign = await CampaignModel.findOne({ _id: campaignId, userId });
  if (!campaign) throw new ApiError(404, "Campaign not found");
  if (!["running", "scheduled", "paused"].includes(campaign.status)) {
    throw new ApiError(409, "Only an active, scheduled, or paused campaign can continue with a replacement number");
  }

  const account = await WhatsAppAccountModel.findOne({ _id: campaign.accountId, userId });
  if (!account || account.state !== "CONNECTED") {
    throw new ApiError(409, "Connect the replacement WhatsApp number before continuing this campaign");
  }
  if (senderIdentityMatches(account, campaign.senderNormalizedPhone)) {
    throw new ApiError(409, "This campaign already matches the currently connected WhatsApp number");
  }

  const previousPhone = campaign.senderNormalizedPhone || "Unknown number";
  const { resumedRecipients } = await resumeBlockedCampaignMessages(userId, account, campaign._id);
  campaign.senderNormalizedPhone = senderIdentityForAccount(account);
  campaign.status = "running";
  campaign.lastError = undefined;
  campaign.completedAt = undefined;
  await campaign.save();

  await createSenderReplacementAudit({
    userId,
    accountId: account._id,
    channelId: account.channelId,
    action: "campaign_resumed",
    previousPhone,
    replacementPhone: account.phone,
    campaignId: campaign._id,
    resumedRecipients,
  });

  void import("../messages/message-dispatch.service.js")
    .then(({ dispatchPendingOutboundMessages }) => dispatchPendingOutboundMessages(account._id))
    .catch(() => {});
  resumeCampaignDelivery(campaign._id);
  emitCampaignEvent(userId, campaign._id);
  return visibleCampaign(campaign);
}

export async function rerunCampaign(userId, campaignId) {
  const campaign = await CampaignModel.findOne({ _id: campaignId, userId });
  if (!campaign) throw new ApiError(404, "Campaign not found");
  if (runningCampaignByUser.get(campaign.userId.toString()) === campaign._id.toString()) {
    throw new ApiError(409, "Campaign is already running");
  }

  await getAccountForCampaign(userId, campaign.accountId, { internal: true });
  await refreshCampaignTemplateSnapshot(campaign, userId);
  const contacts = await resolveRecipients(userId, {
    audienceType: campaign.audienceType,
    audienceTag: campaign.audienceTag,
  });

  await CampaignRecipientModel.deleteMany({ campaignId: campaign._id });
  await CampaignRecipientModel.insertMany(
    contacts.map((contact) => ({
      userId,
      campaignId: campaign._id,
      contactId: contact._id,
      name: contact.name,
      phone: contact.phone,
    })),
  );

  campaign.status = "running";
  campaign.audience = audienceLabel(campaign, contacts.length);
  campaign.recipients = contacts.length;
  campaign.sent = 0;
  campaign.delivered = 0;
  campaign.read = 0;
  campaign.failed = 0;
  campaign.startedAt = undefined;
  campaign.completedAt = undefined;
  campaign.lastError = undefined;
  await campaign.save();
  emitCampaignEvent(userId, campaign._id);
  recoverUserCampaignQueue(userId);
  return visibleCampaign(campaign);
}

export async function updateCampaignStatus(userId, campaignId, payload) {
  const campaign = await CampaignModel.findOne({ _id: campaignId, userId });
  if (!campaign) throw new ApiError(404, "Campaign not found");

  if (payload.status === "running") {
    await getAccountForCampaign(userId, campaign.accountId, { internal: true });
    campaign.status = "running";
    await campaign.save();
    emitCampaignEvent(userId, campaign._id);
    recoverUserCampaignQueue(userId);
  } else if (payload.status === "scheduled") {
    campaign.status = "scheduled";
    if (payload.timezone) {
      try { campaign.timezone = requireTimezone(payload.timezone); } catch (error) { throw new ApiError(400, error instanceof Error ? error.message : "Invalid timezone"); }
    }
    if (payload.scheduledAt) {
      try { campaign.scheduledAt = localDateTimeToUtc(payload.scheduledAt, campaign.timezone || DEFAULT_TIMEZONE); } catch (error) { throw new ApiError(400, error instanceof Error ? error.message : "Invalid scheduled date"); }
    }
    if (!campaign.scheduledAt) throw new ApiError(400, "Schedule time is required");
    await campaign.save();
    scheduleCampaign(campaign);
    emitCampaignEvent(userId, campaign._id);
  } else {
    campaign.status = payload.status;
    await campaign.save();
    if (payload.status === "paused" || payload.status === "draft") clearTimeout(scheduledTimers.get(campaign._id.toString()));
    emitCampaignEvent(userId, campaign._id);
  }

  return visibleCampaign(campaign);
}

export async function deleteCampaign(userId, campaignId) {
  const campaign = await CampaignModel.findOne({ _id: campaignId, userId }).select("_id");
  if (!campaign) throw new ApiError(404, "Campaign not found");
  clearTimeout(scheduledTimers.get(campaign._id.toString()));
  await CampaignRecipientModel.deleteMany({ campaignId: campaign._id });
  await CampaignModel.deleteOne({ _id: campaign._id });
  emitCampaignEvent(userId, campaign._id, "deleted");
}
