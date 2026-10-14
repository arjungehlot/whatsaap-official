import { ContactModel } from "../../models/Contact.js";
import { InboxConversationModel } from "../../models/InboxConversation.js";
import { InboxMessageModel } from "../../models/InboxMessage.js";
import { OutboundMessageLogModel } from "../../models/OutboundMessageLog.js";
import { ApiError } from "../../utils/apiError.js";
import { normalizePhone } from "../contacts/contacts.service.js";
import { refreshOutboundBatch } from "../messages/outbound-batches.service.js";

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;
const CANCELLED_MESSAGE = "Cancelled before delivery by the workspace user";

function limitFor(value) {
  return Math.min(Math.max(Number(value) || DEFAULT_LIMIT, 1), MAX_LIMIT);
}

function errorMessage(error) {
  return error instanceof Error ? error.message : "Message failed";
}

function escapedRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function visibleLog(log, canCancel = false) {
  const grouped = Boolean(log.deliveryGroupId);
  return {
    id: log._id.toString(),
    phone: log.phone,
    contactName: log.contactName || undefined,
    body: grouped ? log.deliveryBody || log.body : log.body,
    source: log.source,
    status: grouped
      ? log.deliveryStatus || "pending"
      : log.status === "processing"
        ? "pending"
        : log.status,
    creditDown: grouped ? log.deliveryCreditDown || 0 : log.creditDown,
    error: grouped ? log.deliveryError || undefined : log.error || undefined,
    sentAt:
      (grouped ? log.deliverySentAt : log.sentAt)?.toISOString() ||
      log.createdAt.toISOString(),
    deliveredAt: log.deliveredAt?.toISOString(),
    readAt: log.readAt?.toISOString(),
    retryCount: log.retryCount || 0,
    canCancel,
  };
}

function deliveryStatusFor(parts) {
  const statuses = parts.map((part) => part.status);
  if (statuses.length && statuses.every((status) => status === "cancelled"))
    return "cancelled";
  if (
    statuses.some((status) => status === "pending" || status === "processing")
  )
    return "pending";
  if (statuses.some((status) => status === "failed")) return "failed";
  if (statuses.length && statuses.every((status) => status === "read"))
    return "read";
  if (
    statuses.length &&
    statuses.every((status) => ["delivered", "read"].includes(status))
  )
    return "delivered";
  return "sent";
}

async function cancellableLogIds(userId, logs) {
  const cancellable = new Set(
    logs
      .filter((log) => !log.deliveryGroupId && log.status === "pending")
      .map((log) => log._id.toString()),
  );
  const groupIds = [
    ...new Set(logs.map((log) => log.deliveryGroupId).filter(Boolean)),
  ];
  if (!groupIds.length) return cancellable;

  const parts = await OutboundMessageLogModel.find({
    userId,
    deliveryGroupId: { $in: groupIds },
  })
    .select("deliveryGroupId status")
    .lean();
  const byGroup = new Map();
  for (const part of parts) {
    const key = part.deliveryGroupId;
    byGroup.set(key, [...(byGroup.get(key) || []), part]);
  }
  for (const log of logs) {
    if (!log.deliveryGroupId || log.deliveryStatus !== "pending") continue;
    const deliveryParts = byGroup.get(log.deliveryGroupId) || [];
    if (
      deliveryParts.length &&
      deliveryParts.every((part) => part.status === "pending")
    ) {
      cancellable.add(log._id.toString());
    }
  }
  return cancellable;
}

async function skipCancelledSourceRecipients(
  userId,
  campaignRecipientIds,
  messageJobRecipientIds,
) {
  if (campaignRecipientIds.size) {
    const { CampaignRecipientModel } =
      await import("../../models/CampaignRecipient.js");
    const {
      notifyCampaignDeliveryUpdate,
      refreshCampaignCounts,
      resumeCampaignDelivery,
    } = await import("../campaigns/campaigns.service.js");
    const recipients = await CampaignRecipientModel.find({
      _id: { $in: [...campaignRecipientIds] },
      userId,
      status: { $in: ["pending", "under_processing"] },
    })
      .select("_id campaignId")
      .lean();
    if (recipients.length) {
      await CampaignRecipientModel.updateMany(
        { _id: { $in: recipients.map((recipient) => recipient._id) } },
        { $set: { status: "skipped", error: CANCELLED_MESSAGE } },
      );
      const campaignIds = [
        ...new Set(
          recipients.map((recipient) => recipient.campaignId.toString()),
        ),
      ];
      await Promise.all(campaignIds.map(refreshCampaignCounts));
      campaignIds.forEach((campaignId) => {
        notifyCampaignDeliveryUpdate(userId, campaignId);
        resumeCampaignDelivery(campaignId);
      });
    }
  }

  if (messageJobRecipientIds.size) {
    const { MessageJobRecipientModel } =
      await import("../../models/MessageJobRecipient.js");
    const { refreshMessageJobCounts } =
      await import("../messages/message-status.service.js");
    const { resumeMessageJobDelivery } =
      await import("../message-jobs/message-jobs.service.js");
    const recipients = await MessageJobRecipientModel.find({
      _id: { $in: [...messageJobRecipientIds] },
      userId,
      status: { $in: ["pending", "under_processing"] },
    })
      .select("_id jobId")
      .lean();
    if (recipients.length) {
      await MessageJobRecipientModel.updateMany(
        { _id: { $in: recipients.map((recipient) => recipient._id) } },
        { $set: { status: "skipped", error: CANCELLED_MESSAGE } },
      );
      const jobIds = [
        ...new Set(recipients.map((recipient) => recipient.jobId.toString())),
      ];
      await Promise.all(jobIds.map(refreshMessageJobCounts));
      jobIds.forEach(resumeMessageJobDelivery);
    }
  }
}

async function removePendingInboxPlaceholders(inboxMessageIds) {
  if (!inboxMessageIds.length) return;
  const messages = await InboxMessageModel.find({
    _id: { $in: inboxMessageIds },
    status: "pending",
  })
    .select("_id conversationId")
    .lean();
  if (!messages.length) return;

  await InboxMessageModel.deleteMany({
    _id: { $in: messages.map((message) => message._id) },
  });
  const conversationIds = [
    ...new Set(messages.map((message) => message.conversationId.toString())),
  ];
  await Promise.all(
    conversationIds.map(async (conversationId) => {
      const latest = await InboxMessageModel.findOne({ conversationId })
        .sort({ at: -1, _id: -1 })
        .select("body attachment at")
        .lean();
      if (!latest) {
        await InboxConversationModel.deleteOne({ _id: conversationId });
        return;
      }
      await InboxConversationModel.updateOne(
        { _id: conversationId },
        {
          $set: {
            lastMessage: latest.body || latest.attachment?.name || "Attachment",
            lastMessageAt: latest.at,
          },
        },
      );
    }),
  );
}

/** Keep a single recipient-level log row in sync with its physical WhatsApp sends. */
export async function refreshOutboundDeliverySummary(deliveryGroupId) {
  if (!deliveryGroupId) return;
  const parts = await OutboundMessageLogModel.find({ deliveryGroupId })
    .select("_id isDeliverySummary status creditDown error sentAt createdAt")
    .lean();
  const summary = parts.find((part) => part.isDeliverySummary);
  if (!summary) return;

  const failed = parts
    .filter((part) => part.status === "failed" && part.error)
    .map((part) => part.error);
  const sentAt = parts
    .map((part) => part.sentAt || part.createdAt)
    .filter(Boolean)
    .sort((a, b) => b - a)[0];
  await OutboundMessageLogModel.updateOne(
    { _id: summary._id },
    {
      $set: {
        deliveryStatus: deliveryStatusFor(parts),
        deliveryCreditDown: Math.max(
          0,
          ...parts.map((part) => Number(part.creditDown) || 0),
        ),
        deliverySentAt: sentAt,
        deliveryError: failed.length
          ? [...new Set(failed)].join(" ")
          : undefined,
      },
    },
  );
}

export async function createOutboundMessageLog(payload) {
  let contactName = payload.contactName;
  if (
    !contactName &&
    payload.phone &&
    !String(payload.phone).startsWith("Unknown")
  ) {
    const contact = await ContactModel.findOne({
      userId: payload.userId,
      normalizedPhone: normalizePhone(payload.phone),
    })
      .select("name")
      .lean();
    contactName = contact?.name;
  }

  return OutboundMessageLogModel.create({
    ...payload,
    contactName,
    body: String(payload.body || "Attachment").trim() || "Attachment",
    sentAt: payload.sentAt || new Date(),
  });
}

export async function markOutboundMessageLogStatus(
  userId,
  accountId,
  waMessageId,
  status,
  now = new Date(),
) {
  if (!waMessageId) return;
  const set = { status };
  if (status === "delivered") set.deliveredAt = now;
  if (status === "read") set.readAt = now;
  if (status === "failed")
    set.error = "WhatsApp could not deliver this message";
  const updated = await OutboundMessageLogModel.find({
    userId,
    accountId,
    waMessageId,
    status: { $in: ["sent", "delivered"] },
  })
    .select("deliveryGroupId batchId")
    .lean();
  await OutboundMessageLogModel.updateMany(
    { userId, accountId, waMessageId, status: { $in: ["sent", "delivered"] } },
    { $set: set },
  );
  await Promise.all(
    [...new Set(updated.map((log) => log.deliveryGroupId).filter(Boolean))].map(
      refreshOutboundDeliverySummary,
    ),
  );
  await Promise.all(
    [
      ...new Set(updated.map((log) => log.batchId?.toString()).filter(Boolean)),
    ].map(refreshOutboundBatch),
  );
}

export async function listOutboundMessageLogs(userId, filters = {}) {
  const page = Math.max(Number(filters.page) || 1, 1);
  const limit = limitFor(filters.limit);
  const conditions = [
    { userId },
    { status: { $ne: "cancelled" } },
    {
      $or: [
        { deliveryGroupId: { $exists: false } },
        { deliveryGroupId: null },
        { isDeliverySummary: true },
      ],
    },
  ];
  if (filters.source && filters.source !== "all")
    conditions.push({ source: filters.source });
  if (filters.status && filters.status !== "all") {
    const status =
      filters.status === "pending"
        ? { $in: ["pending", "processing"] }
        : filters.status;
    conditions.push({
      $or: [
        {
          deliveryGroupId: { $exists: true, $ne: null },
          deliveryStatus: status,
        },
        { deliveryGroupId: null, status },
      ],
    });
  }
  if (filters.search?.trim()) {
    const search = filters.search.trim();
    const groupIdWithoutSuffix = search.replace(/@g\.us$/i, "");
    const searchPattern = escapedRegex(search);
    const groupIdPattern = escapedRegex(groupIdWithoutSuffix);
    conditions.push({
      $or: [
        { phone: { $regex: searchPattern, $options: "i" } },
        { remoteJid: { $regex: searchPattern, $options: "i" } },
        { contactName: { $regex: searchPattern, $options: "i" } },
        { body: { $regex: searchPattern, $options: "i" } },
        { deliveryBody: { $regex: searchPattern, $options: "i" } },
        ...(groupIdWithoutSuffix !== search
          ? [
              { phone: { $regex: groupIdPattern, $options: "i" } },
              { remoteJid: { $regex: groupIdPattern, $options: "i" } },
            ]
          : []),
      ],
    });
  }
  const query = { $and: conditions };

  const [logs, total] = await Promise.all([
    OutboundMessageLogModel.find(query)
      .sort({ sentAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    OutboundMessageLogModel.countDocuments(query),
  ]);
  const cancellableIds = await cancellableLogIds(userId, logs);
  return {
    logs: logs.map((log) =>
      visibleLog(log, cancellableIds.has(log._id.toString())),
    ),
    total,
    page,
    limit,
    pages: Math.max(Math.ceil(total / limit), 1),
  };
}

export async function cancelPendingOutboundMessageLogs(userId, ids) {
  const selectedIds = [...new Set(ids.map(String))];
  const selectedLogs = await OutboundMessageLogModel.find({
    _id: { $in: selectedIds },
    userId,
    status: "pending",
    $or: [
      { deliveryGroupId: { $exists: false } },
      { deliveryGroupId: null },
      { isDeliverySummary: true },
    ],
  }).lean();

  let cancelled = 0;
  let skipped = selectedIds.length - selectedLogs.length;
  const campaignRecipientIds = new Set();
  const messageJobRecipientIds = new Set();
  const deliveryGroupIds = new Set();
  const batchIds = new Set();

  for (const selected of selectedLogs) {
    const parts = await OutboundMessageLogModel.find({
      userId,
      ...(selected.deliveryGroupId
        ? { deliveryGroupId: selected.deliveryGroupId }
        : { _id: selected._id }),
    })
      .select(
        "_id status inboxMessageId campaignRecipientId messageJobRecipientId deliveryGroupId batchId",
      )
      .lean();
    if (!parts.length || parts.some((part) => part.status !== "pending")) {
      skipped += 1;
      continue;
    }

    const partIds = parts.map((part) => part._id);
    const update = await OutboundMessageLogModel.updateMany(
      { _id: { $in: partIds }, status: "pending" },
      {
        $set: {
          status: "cancelled",
          creditDown: 0,
          blockedByRateLimit: false,
          blockedBySenderChange: false,
          error: CANCELLED_MESSAGE,
        },
        $unset: { leaseExpiresAt: 1 },
      },
    );
    if (update.modifiedCount !== partIds.length) {
      // A dispatcher claimed a part while this cancellation was being applied. Restore the untouched work.
      await OutboundMessageLogModel.updateMany(
        {
          _id: { $in: partIds },
          status: "cancelled",
          error: CANCELLED_MESSAGE,
        },
        {
          $set: {
            status: "pending",
            error: "Waiting for the WhatsApp number to be available",
          },
        },
      );
      skipped += 1;
      continue;
    }

    const inboxMessageIds = parts
      .map((part) => part.inboxMessageId)
      .filter(Boolean);
    await removePendingInboxPlaceholders(inboxMessageIds);
    parts.forEach((part) => {
      if (part.campaignRecipientId)
        campaignRecipientIds.add(part.campaignRecipientId.toString());
      if (part.messageJobRecipientId)
        messageJobRecipientIds.add(part.messageJobRecipientId.toString());
      if (part.deliveryGroupId) deliveryGroupIds.add(part.deliveryGroupId);
      if (part.batchId) batchIds.add(part.batchId.toString());
    });
    cancelled += 1;
  }

  await Promise.all([...deliveryGroupIds].map(refreshOutboundDeliverySummary));
  await Promise.all([...batchIds].map(refreshOutboundBatch));
  await skipCancelledSourceRecipients(
    userId,
    campaignRecipientIds,
    messageJobRecipientIds,
  );
  return { cancelled, skipped };
}

export async function retryableOutboundMessageLog(userId, id) {
  const log = await OutboundMessageLogModel.findOne({
    _id: id,
    userId,
    $or: [
      {
        deliveryGroupId: { $exists: true, $ne: null },
        deliveryStatus: "failed",
      },
      { deliveryGroupId: null, status: "failed" },
    ],
  }).lean();
  if (!log) throw new ApiError(404, "Failed message log not found");
  return log;
}

export async function markOutboundMessageLogRetried(userId, id) {
  await OutboundMessageLogModel.updateOne(
    { _id: id, userId },
    { $inc: { retryCount: 1 }, $set: { lastRetriedAt: new Date() } },
  );
}

export function outboundLogFailure(error) {
  return errorMessage(error);
}
