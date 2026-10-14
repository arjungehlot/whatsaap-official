import { AutomationModel } from "../../models/Automation.js";
import { ContactModel } from "../../models/Contact.js";
import { ApiError } from "../../utils/apiError.js";
import { createMessageJob } from "../message-jobs/message-jobs.service.js";
import { WhatsAppAccountModel } from "../../models/WhatsAppAccount.js";
import { DEFAULT_TIMEZONE, isDueAtTime, localDateKey, localDateTimeToUtc, requireTimezone, zonedParts } from "../../utils/timezone.js";
import {
  SENDER_IDENTITY_CHANGED_MESSAGE,
  senderIdentityForAccount,
  senderIdentityMatches,
} from "../whatsapp/whatsapp.sender-identity.js";

function visibleAutomation(item) {
  return {
    id: item._id.toString(), name: item.name, triggerType: item.triggerType, dateField: item.dateField,
    eventDate: item.eventDate?.toISOString(), time: item.time, timezone: item.timezone || DEFAULT_TIMEZONE, accountId: item.channelId, channelId: item.channelId, mode: item.mode,
    message: item.message, templateId: item.templateId?.toString(), audienceType: item.audienceType,
    audienceTag: item.audienceTag, contactIds: item.contactIds?.map((id) => id.toString()), status: item.status,
    lastRunAt: item.lastRunAt?.toISOString(), lastError: item.lastError,
  };
}

export async function listAutomations(userId) {
  const items = await AutomationModel.find({ userId }).sort({ createdAt: -1 }).lean();
  return { automations: items.map(visibleAutomation) };
}

export async function getAutomationDetails(userId, id) {
  const item = await AutomationModel.findOne({ _id: id, userId }).lean();
  if (!item) throw new ApiError(404, "Scheduler not found");
  const query = {
    userId,
    status: "active",
    ...(item.audienceType === "tag" ? { tags: item.audienceTag } : item.audienceType === "contacts" ? { _id: { $in: item.contactIds || [] } } : {}),
  };
  const contacts = await ContactModel.find(query).sort({ name: 1 }).lean();
  const recipients = contacts.map((contact) => ({
    id: contact._id.toString(),
    name: contact.name,
    phone: contact.phone,
    dateOfBirth: contact.dateOfBirth || contact.customFields?.birthday || contact.customFields?.[item.dateField || "dateOfBirth"],
  }));
  return {
    scheduler: visibleAutomation(item),
    recipients,
    birthdayReady: item.triggerType === "birthday" ? recipients.filter((contact) => contact.dateOfBirth) : recipients,
    missingDateOfBirth: item.triggerType === "birthday" ? recipients.filter((contact) => !contact.dateOfBirth).length : 0,
  };
}

export async function createAutomation(userId, payload) {
  let timezone;
  let eventDate;
  try {
    timezone = requireTimezone(payload.timezone || DEFAULT_TIMEZONE);
    eventDate = payload.eventDate ? localDateTimeToUtc(payload.eventDate, timezone) : undefined;
  } catch (error) {
    throw new ApiError(400, error instanceof Error ? error.message : "Invalid timezone or event date");
  }
  const account = await WhatsAppAccountModel.findOne({ userId, channelId: payload.accountId }).select("_id channelId phone normalizedPhone");
  if (!account) throw new ApiError(404, "WhatsApp channel not found");
  const item = await AutomationModel.create({ userId, ...payload, accountId: account._id, channelId: account.channelId, senderNormalizedPhone: senderIdentityForAccount(account), timezone, eventDate });
  return visibleAutomation(item);
}

export async function updateAutomationStatus(userId, id, status) {
  const item = await AutomationModel.findOneAndUpdate({ _id: id, userId }, { $set: { status } }, { returnDocument: "after" });
  if (!item) throw new ApiError(404, "Automation not found");
  return visibleAutomation(item);
}

function isBirthdayMatch(value, month, day) {
  if (!value) return false;
  const text = value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
  return text.slice(5) === `${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export async function runDueAutomations(now = new Date()) {
  const items = await AutomationModel.find({ status: "active" });
  for (const item of items) {
    const account = await WhatsAppAccountModel.findOne({ _id: item.accountId, userId: item.userId }).select("phone normalizedPhone").lean();
    if (!item.senderNormalizedPhone || !senderIdentityMatches(account, item.senderNormalizedPhone)) {
      item.status = "paused";
      item.lastError = SENDER_IDENTITY_CHANGED_MESSAGE;
      await item.save();
      continue;
    }
    const timezone = item.timezone || DEFAULT_TIMEZONE;
    const runKey = item.lastRunAt ? localDateKey(item.lastRunAt, timezone) : "";
    if (runKey === localDateKey(now, timezone)) continue;
    if (item.triggerType === "event" && (!item.eventDate || item.eventDate > now)) continue;
    if (item.triggerType === "birthday" && !isDueAtTime(item.time, now, timezone)) continue;
    if (item.triggerType === "event" && !isDueAtTime(item.time, now, timezone)) continue;

    const contacts = await ContactModel.find({ userId: item.userId, status: "active", ...(item.audienceType === "tag" ? { tags: item.audienceTag } : item.audienceType === "contacts" ? { _id: { $in: item.contactIds } } : {}) }).lean();
    const zonedNow = zonedParts(now, timezone);
    const matches = item.triggerType === "birthday" ? contacts.filter((contact) => isBirthdayMatch(contact.dateOfBirth || contact.customFields?.birthday || contact.customFields?.[item.dateField || "dateOfBirth"], zonedNow.month, zonedNow.day)) : contacts;
    if (!matches.length) {
      item.lastRunAt = now;
      await item.save();
      continue;
    }
    try {
      await createMessageJob(item.userId, { name: `${item.name} ${localDateKey(now, timezone)}`, accountId: item.channelId, mode: item.mode, templateId: item.templateId?.toString(), message: item.message, audienceType: "contacts", contactIds: matches.map((contact) => contact._id.toString()), sendNow: true, timezone, senderNormalizedPhone: item.senderNormalizedPhone });
      item.lastRunAt = now;
      item.lastError = undefined;
      if (item.triggerType === "event") item.status = "completed";
    } catch (error) {
      item.lastError = error instanceof Error ? error.message : "Automation failed";
    }
    await item.save();
  }
}
