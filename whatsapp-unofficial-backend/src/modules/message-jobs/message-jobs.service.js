import { ContactModel } from "../../models/Contact.js";
import { MessageJobModel } from "../../models/MessageJob.js";
import { MessageJobRecipientModel } from "../../models/MessageJobRecipient.js";
import { MessageTemplateModel } from "../../models/MessageTemplate.js";
import { OutboundMessageLogModel } from "../../models/OutboundMessageLog.js";
import { InboxMessageModel } from "../../models/InboxMessage.js";
import { ApiError } from "../../utils/apiError.js";
import { normalizePhone } from "../contacts/contacts.service.js";
import { sendApiMessage } from "../messages/messages.service.js";
import { WhatsAppAccountModel } from "../../models/WhatsAppAccount.js";
import {
  DEFAULT_TIMEZONE,
  localDateTimeToUtc,
  requireTimezone,
} from "../../utils/timezone.js";
import { refreshMessageJobCounts } from "../messages/message-status.service.js";
import { refreshOutboundDeliverySummary } from "../message-logs/message-logs.service.js";
import {
  SENDER_IDENTITY_CHANGED_MESSAGE,
  senderIdentityForAccount,
  senderIdentityMatches,
} from "../whatsapp/whatsapp.sender-identity.js";

const timers = new Map();
const runningUsers = new Set();
const REMOVED_RECIPIENT_MESSAGE =
  "Removed from this scheduled send before delivery";
const DELETED_JOB_MESSAGE = "This scheduled send was deleted before delivery";

function visibleJob(job) {
  return {
    id: job._id.toString(),
    name: job.name,
    accountId: job.channelId,
    channelId: job.channelId,
    mode: job.mode,
    templateId: job.templateId?.toString(),
    templateName: job.templateName,
    body: job.body,
    recipients: job.recipients,
    sent: job.sent,
    delivered: job.delivered || 0,
    read: job.read || 0,
    failed: job.failed,
    status: job.status,
    scheduledAt: job.scheduledAt?.toISOString(),
    startedAt: job.startedAt?.toISOString(),
    completedAt: job.completedAt?.toISOString(),
    timezone: job.timezone || DEFAULT_TIMEZONE,
    lastError: job.lastError,
    createdAt: job.createdAt?.toISOString(),
  };
}

function renderBody(body, contact) {
  return String(body || "").replace(
    /\{\{\s*([\w.]+)\s*\}\}/g,
    (_match, key) => {
      if (key === "name") return contact.name || "";
      if (key === "phone") return contact.phone || "";
      if (key.startsWith("customFields."))
        return (
          contact.customFields?.get?.(key.slice(13)) ||
          contact.customFields?.[key.slice(13)] ||
          ""
        );
      return "";
    },
  );
}

async function resolveContacts(userId, payload) {
  const query = { userId, status: "active" };
  if (payload.audienceType === "tag") query.tags = payload.audienceTag;
  if (payload.audienceType === "contacts")
    query._id = { $in: payload.contactIds || [] };
  return ContactModel.find(query).sort({ createdAt: 1 });
}

async function getAccount(userId, channelId) {
  const query = channelId ? { channelId, userId } : { userId };
  const account = await WhatsAppAccountModel.findOne(query).sort({
    createdAt: 1,
  });
  if (!account)
    throw new ApiError(
      409,
      "Connect a WhatsApp number before sending messages",
    );
  return account;
}

function visibleRecipient(recipient) {
  return {
    id: recipient._id.toString(),
    contactId: recipient.contactId.toString(),
    name: recipient.name,
    phone: recipient.phone,
    body: recipient.body || "",
    status: recipient.status,
    sentAt: recipient.sentAt?.toISOString(),
    deliveredAt: recipient.deliveredAt?.toISOString(),
    readAt: recipient.readAt?.toISOString(),
    error: recipient.error || undefined,
  };
}

function clearJobTimer(jobId) {
  const key = jobId.toString();
  const timer = timers.get(key);
  if (timer) clearTimeout(timer);
  timers.delete(key);
}

async function stopQueuedRecipientLogs(jobId, options = {}) {
  const filter = {
    messageJobId: jobId,
    status: { $in: ["pending", "processing"] },
    ...(options.recipientId
      ? { messageJobRecipientId: options.recipientId }
      : {}),
  };
  const logs = await OutboundMessageLogModel.find(filter)
    .select("_id inboxMessageId deliveryGroupId batchId")
    .lean();
  if (!logs.length) return;

  const logIds = logs.map((log) => log._id);
  const inboxIds = logs.map((log) => log.inboxMessageId).filter(Boolean);
  await OutboundMessageLogModel.updateMany(
    { _id: { $in: logIds }, status: { $in: ["pending", "processing"] } },
    {
      $set: {
        status: "failed",
        creditDown: 0,
        error: options.reason || REMOVED_RECIPIENT_MESSAGE,
      },
      $unset: { leaseExpiresAt: 1 },
    },
  );
  if (inboxIds.length) {
    await InboxMessageModel.updateMany(
      { _id: { $in: inboxIds }, status: { $in: ["pending", "processing"] } },
      {
        $set: {
          status: "failed",
          error: options.reason || REMOVED_RECIPIENT_MESSAGE,
        },
      },
    );
  }
  await Promise.all(
    [...new Set(logs.map((log) => log.deliveryGroupId).filter(Boolean))].map(
      refreshOutboundDeliverySummary,
    ),
  );
}

async function ensureJobRecipients(job) {
  const existing = await MessageJobRecipientModel.countDocuments({
    jobId: job._id,
  });
  if (existing || !job.contactIds?.length) return;

  const contacts = await ContactModel.find({
    userId: job.userId,
    _id: { $in: job.contactIds },
  });
  if (!contacts.length) return;
  await MessageJobRecipientModel.insertMany(
    contacts.map((contact) => ({
      userId: job.userId,
      jobId: job._id,
      contactId: contact._id,
      name: contact.name,
      phone: contact.phone,
      body: renderBody(job.body, contact),
    })),
    { ordered: false },
  ).catch((error) => {
    if (error?.code !== 11000) throw error;
  });
}

async function processJob(jobId) {
  const jobKey = jobId.toString();
  const job = await MessageJobModel.findById(jobId);
  if (!job || !["scheduled", "running"].includes(job.status)) return;
  if (
    job.status === "scheduled" &&
    job.scheduledAt &&
    job.scheduledAt.getTime() > Date.now()
  )
    return;
  const userKey = job.userId.toString();
  if (runningUsers.has(userKey)) {
    // Keep the job queued behind the active sender for this workspace.
    scheduleJob({
      ...job.toObject(),
      _id: job._id,
      scheduledAt: new Date(Date.now() + 1000),
    });
    return;
  }
  runningUsers.add(userKey);

  try {
    const account = await getAccount(job.userId, job.channelId);
    if (
      !job.senderNormalizedPhone ||
      !senderIdentityMatches(account, job.senderNormalizedPhone)
    ) {
      job.status = "paused";
      job.lastError = SENDER_IDENTITY_CHANGED_MESSAGE;
      await job.save();
      return;
    }
    job.status = "running";
    job.startedAt ||= new Date();
    await job.save();
    await ensureJobRecipients(job);
    const recipients = await MessageJobRecipientModel.find({
      jobId,
      status: "pending",
    }).sort({ createdAt: 1 });
    for (const recipient of recipients) {
      const current = await MessageJobModel.findById(jobId);
      if (!current || ["paused", "cancelled"].includes(current.status)) break;
      let claimedRecipient;
      try {
        // Claim the recipient only if it has not been removed or claimed by another worker.
        claimedRecipient = await MessageJobRecipientModel.findOneAndUpdate(
          { _id: recipient._id, jobId, status: "pending" },
          { $set: { status: "under_processing", error: undefined } },
          { returnDocument: "after" },
        );
        if (!claimedRecipient) continue;

        const contact = await ContactModel.findOne({
          _id: claimedRecipient.contactId,
          userId: job.userId,
          status: "active",
        });
        if (!contact) {
          claimedRecipient.status = "skipped";
          claimedRecipient.error = "Contact is no longer active";
          await claimedRecipient.save();
          continue;
        }
        const result = await sendApiMessage(
          job.userId,
          {
            to: `+${normalizePhone(claimedRecipient.phone)}`,
            body: claimedRecipient.body,
            attachments: job.attachments,
            accountId: job.channelId,
          },
          {
            source: "send-message",
            messageJobId: job._id,
            messageJobRecipientId: claimedRecipient._id,
            contactName: claimedRecipient.name,
            senderNormalizedPhone: job.senderNormalizedPhone,
          },
        );
        if (result.messages.some((message) => message.status === "pending")) {
          await refreshMessageJobCounts(jobId);
          break;
        }
      } catch (error) {
        if (error?.statusCode === 429) {
          if (claimedRecipient) {
            await MessageJobRecipientModel.updateOne(
              { _id: claimedRecipient._id, status: "under_processing" },
              { $set: { status: "pending", error: error.message } },
            );
          }
          await MessageJobModel.updateOne(
            { _id: jobId },
            { $set: { status: "paused", lastError: error.message } },
          );
          break;
        }
        const message =
          error instanceof Error ? error.message : "Message failed";
        if (claimedRecipient) {
          claimedRecipient.status = "failed";
          claimedRecipient.error = message;
          await claimedRecipient.save();
        }
        await MessageJobModel.updateOne(
          { _id: jobId },
          { $set: { lastError: message } },
        );
      }
      await refreshMessageJobCounts(jobId);
    }
    const finished = await MessageJobModel.findById(jobId);
    const waiting = await MessageJobRecipientModel.countDocuments({
      jobId,
      status: { $in: ["pending", "under_processing"] },
    });
    if (finished && finished.status === "running" && waiting === 0) {
      finished.status = "completed";
      finished.completedAt = new Date();
      await finished.save();
    }
  } catch (error) {
    await MessageJobModel.findByIdAndUpdate(jobId, {
      status: "failed",
      lastError: error instanceof Error ? error.message : "Message job failed",
    });
  } finally {
    runningUsers.delete(userKey);
    timers.delete(jobKey);
  }
}

// Called by the durable outbound dispatcher after a held recipient settles.
export function resumeMessageJobDelivery(jobId) {
  void (async () => {
    const now = new Date();
    await OutboundMessageLogModel.updateMany(
      { messageJobId: jobId, status: "pending", blockedByRateLimit: true },
      { $set: { blockedByRateLimit: false, nextAttemptAt: now } },
    );
    const log = await OutboundMessageLogModel.findOne({
      messageJobId: jobId,
      status: "pending",
      blockedByRateLimit: { $ne: true },
    })
      .select("accountId")
      .lean();
    if (log) {
      const { dispatchPendingOutboundMessages } =
        await import("../messages/message-dispatch.service.js");
      void dispatchPendingOutboundMessages(log.accountId);
    }
    await processJob(jobId);
  })();
}

function scheduleJob(job) {
  const key = job._id.toString();
  clearJobTimer(key);
  const delay = Math.max(
    new Date(job.scheduledAt || Date.now()).getTime() - Date.now(),
    0,
  );
  timers.set(
    key,
    setTimeout(() => void processJob(job._id), delay),
  );
}

export async function createMessageJob(userId, payload) {
  const [account, contacts] = await Promise.all([
    getAccount(userId, payload.accountId),
    resolveContacts(userId, payload),
  ]);
  if (!contacts.length)
    throw new ApiError(400, "No active contacts match this audience");
  let body = payload.message || "";
  let template;
  if (payload.mode === "template") {
    template = await MessageTemplateModel.findOne({
      _id: payload.templateId,
      userId,
    }).lean();
    if (!template) throw new ApiError(404, "Template not found");
    body = template.body;
  }
  let timezone;
  let scheduledAt;
  try {
    timezone = requireTimezone(payload.timezone || DEFAULT_TIMEZONE);
    scheduledAt = payload.sendNow
      ? new Date()
      : payload.scheduledAt
        ? localDateTimeToUtc(payload.scheduledAt, timezone)
        : undefined;
  } catch (error) {
    throw new ApiError(
      400,
      error instanceof Error
        ? error.message
        : "Invalid timezone or scheduled date",
    );
  }
  if (!payload.sendNow && !scheduledAt)
    throw new ApiError(400, "Choose send now or a scheduled time");
  const job = await MessageJobModel.create({
    userId,
    accountId: account._id,
    channelId: account.channelId,
    senderNormalizedPhone:
      payload.senderNormalizedPhone || senderIdentityForAccount(account),
    name: payload.name,
    mode: payload.mode,
    templateId: template?._id,
    templateName: template?.name,
    body,
    attachments: template?.attachments?.length
      ? template.attachments
      : template?.attachment
        ? [template.attachment]
        : [],
    contactIds: contacts.map((contact) => contact._id),
    recipients: contacts.length,
    scheduledAt,
    timezone,
    status: "scheduled",
  });
  await MessageJobRecipientModel.insertMany(
    contacts.map((contact) => ({
      userId,
      jobId: job._id,
      contactId: contact._id,
      name: contact.name,
      phone: contact.phone,
      body: renderBody(body, contact),
    })),
  );
  if (payload.sendNow) void processJob(job._id);
  else scheduleJob(job);
  return visibleJob(job);
}

export async function listMessageJobs(userId, filters = {}) {
  const query = { userId };
  if (filters.status && filters.status !== "all") query.status = filters.status;
  const jobs = await MessageJobModel.find(query)
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();
  return { jobs: jobs.map(visibleJob) };
}

export async function listMessageJobRecipients(userId, jobId) {
  const job = await MessageJobModel.findOne({ _id: jobId, userId }).select(
    "_id",
  );
  if (!job) throw new ApiError(404, "Message send not found");
  const recipients = await MessageJobRecipientModel.find({ jobId })
    .sort({ createdAt: 1 })
    .lean();
  return recipients.map(visibleRecipient);
}

export async function updateMessageJobStatus(userId, id, status) {
  const job = await MessageJobModel.findOne({ _id: id, userId });
  if (!job) throw new ApiError(404, "Message job not found");
  if (["completed", "cancelled"].includes(job.status))
    throw new ApiError(409, "This message send can no longer be changed");

  if (status === "paused") {
    job.status = "paused";
    await job.save();
    clearJobTimer(job._id);
    return visibleJob(job);
  }

  if (status === "cancelled") {
    job.status = "cancelled";
    await job.save();
    clearJobTimer(job._id);
    await MessageJobRecipientModel.updateMany(
      { jobId: job._id, status: { $in: ["pending", "under_processing"] } },
      { $set: { status: "skipped", error: DELETED_JOB_MESSAGE } },
    );
    await stopQueuedRecipientLogs(job._id, { reason: DELETED_JOB_MESSAGE });
    await refreshMessageJobCounts(job._id);
    return visibleJob(job);
  }

  const shouldWaitForSchedule =
    !job.startedAt && job.scheduledAt && job.scheduledAt.getTime() > Date.now();
  job.status = shouldWaitForSchedule ? "scheduled" : "running";
  job.lastError = undefined;
  await job.save();
  if (shouldWaitForSchedule) scheduleJob(job);
  else resumeMessageJobDelivery(job._id);
  return visibleJob(job);
}

export async function removeMessageJobRecipient(userId, jobId, recipientId) {
  const job = await MessageJobModel.findOne({ _id: jobId, userId });
  if (!job) throw new ApiError(404, "Message send not found");
  if (["completed", "cancelled"].includes(job.status))
    throw new ApiError(
      409,
      "Recipients cannot be removed from a completed send",
    );

  const alreadyAccepted = await OutboundMessageLogModel.exists({
    messageJobId: job._id,
    messageJobRecipientId: recipientId,
    status: { $in: ["sent", "delivered", "read"] },
  });
  if (alreadyAccepted)
    throw new ApiError(
      409,
      "This recipient has already been sent a message and cannot be removed",
    );

  const recipient = await MessageJobRecipientModel.findOneAndUpdate(
    {
      _id: recipientId,
      jobId: job._id,
      userId,
      status: { $in: ["pending", "under_processing"] },
    },
    { $set: { status: "skipped", error: REMOVED_RECIPIENT_MESSAGE } },
    { returnDocument: "after" },
  );
  if (!recipient) {
    const existing = await MessageJobRecipientModel.exists({
      _id: recipientId,
      jobId: job._id,
      userId,
    });
    if (!existing)
      throw new ApiError(404, "Recipient not found in this scheduled send");
    throw new ApiError(
      409,
      "This recipient has already been processed and cannot be removed",
    );
  }

  await stopQueuedRecipientLogs(job._id, {
    recipientId: recipient._id,
    reason: REMOVED_RECIPIENT_MESSAGE,
  });
  await refreshMessageJobCounts(job._id);
  const refreshedJob = await MessageJobModel.findById(job._id);
  return {
    job: visibleJob(refreshedJob),
    recipient: visibleRecipient(recipient),
  };
}

export async function deleteMessageJobForUser(userId, jobId) {
  const job = await MessageJobModel.findOneAndUpdate(
    { _id: jobId, userId, status: { $nin: ["completed", "cancelled"] } },
    { $set: { status: "cancelled", lastError: DELETED_JOB_MESSAGE } },
    { returnDocument: "before" },
  );
  if (!job) {
    const existing = await MessageJobModel.exists({ _id: jobId, userId });
    if (!existing) throw new ApiError(404, "Message send not found");
    throw new ApiError(
      409,
      "Completed sends are kept as delivery history and cannot be deleted",
    );
  }

  clearJobTimer(job._id);
  await MessageJobRecipientModel.updateMany(
    { jobId: job._id, status: { $in: ["pending", "under_processing"] } },
    { $set: { status: "skipped", error: DELETED_JOB_MESSAGE } },
  );
  await stopQueuedRecipientLogs(job._id, { reason: DELETED_JOB_MESSAGE });
  await MessageJobRecipientModel.deleteMany({ jobId: job._id });
  await MessageJobModel.deleteOne({ _id: job._id, userId });
}

export async function restoreMessageJobs() {
  const jobs = await MessageJobModel.find({
    status: "scheduled",
    scheduledAt: { $exists: true },
  });
  for (const job of jobs) scheduleJob(job);
  const running = await MessageJobModel.find({ status: "running" });
  running.forEach((job) => void processJob(job._id));
  return jobs.length + running.length;
}
