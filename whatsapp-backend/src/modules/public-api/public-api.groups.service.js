import { ApiError } from "../../utils/apiError.js";
import { normalizePhone } from "../contacts/contacts.service.js";
import { getEntitlements } from "../billing/entitlements.service.js";
import { resolveApiWhatsAppAccount } from "../messages/messages.service.js";
import {
  createWhatsAppGroup,
  getWhatsAppGroupMetadata,
  leaveWhatsAppGroup,
  listWhatsAppGroups,
  updateWhatsAppGroupParticipants,
} from "../whatsapp/whatsapp.engine.js";
import { getPhoneJidForLid } from "../whatsapp/whatsapp.auth-store.js";

function visibleMember(member) {
  const jid = member.id || member.jid || "";
  const isLinkedId = jid.endsWith("@lid");
  const phone = isLinkedId ? "WhatsApp linked ID" : jid.endsWith("@s.whatsapp.net") ? `+${jid.replace("@s.whatsapp.net", "")}` : jid;
  return {
    jid,
    phone,
    name: member.notify || member.name || phone,
    role: member.admin === "superadmin" ? "superadmin" : member.admin === "admin" ? "admin" : "member",
  };
}

function visibleGroup(metadata) {
  return {
    id: metadata.id,
    groupId: metadata.id,
    subject: metadata.subject || "Untitled group",
    description: metadata.desc || "",
    owner: metadata.owner || undefined,
    createdAt: metadata.creation ? new Date(Number(metadata.creation) * 1000).toISOString() : undefined,
    memberCount: metadata.participants?.length || 0,
    members: (metadata.participants || []).map(visibleMember),
  };
}

function visibleGroupListItem(metadata) {
  return {
    id: metadata.id,
    groupId: metadata.id,
    subject: metadata.subject || "Untitled group",
  };
}

function ensureGroupId(groupId) {
  const value = String(groupId || "").trim();
  if (!value.endsWith("@g.us")) throw new ApiError(400, "groupId must be a WhatsApp group ID ending with @g.us");
  return value;
}

async function assertGroupsFeature(userId) {
  const entitlements = await getEntitlements(userId);
  if (!entitlements.features?.["inbox-groups"]) {
    throw new ApiError(403, "Your plan does not include WhatsApp groups. Upgrade your plan to use group APIs.");
  }
}

async function resolveParticipant(accountId, value) {
  const raw = String(value || "").trim();
  if (!raw || raw.endsWith("@g.us")) throw new ApiError(400, "Group participants must be phone numbers or individual WhatsApp JIDs, not group IDs");
  if (raw.endsWith("@lid")) {
    const phoneJid = await getPhoneJidForLid(accountId.toString(), raw);
    if (!phoneJid) {
      throw new ApiError(422, "This member JID has not been mapped to a WhatsApp phone identity for the selected account. Use the member phone number or wait for identity sync.");
    }
    return phoneJid;
  }
  if (raw.endsWith("@s.whatsapp.net")) return raw;
  if (raw.endsWith("@c.us")) return `${normalizePhone(raw.replace("@c.us", ""))}@s.whatsapp.net`;
  return `${normalizePhone(raw)}@s.whatsapp.net`;
}

function visibleParticipantUpdateResult(result, fallbackParticipant) {
  const status = String(result?.status || "unknown");
  const success = status === "200";

  return {
    participant: result?.jid || fallbackParticipant,
    status,
    success,
    message: success ? "Updated" : `WhatsApp returned status ${status} for this participant.`,
  };
}

async function groupAccount(userId, input, options) {
  await assertGroupsFeature(userId);
  return resolveApiWhatsAppAccount(userId, input, options);
}

export async function listPublicGroups(userId, input, options = {}) {
  const account = await groupAccount(userId, input, options);
  const groups = await listWhatsAppGroups(account._id);
  return { channelId: account.channelId, groups: groups.map(visibleGroupListItem) };
}

export async function getPublicGroup(userId, input, options = {}) {
  const account = await groupAccount(userId, input, options);
  const metadata = await getWhatsAppGroupMetadata(account._id, ensureGroupId(input.groupId));
  return { channelId: account.channelId, group: visibleGroup(metadata) };
}

export async function createPublicGroup(userId, input, options = {}) {
  const account = await groupAccount(userId, input, options);
  const participants = await Promise.all(input.participants.map((participant) => resolveParticipant(account._id, participant)));
  const metadata = await createWhatsAppGroup(account._id, input.subject, [...new Set(participants)]);
  return { channelId: account.channelId, group: visibleGroup(metadata) };
}

export async function leavePublicGroup(userId, input, options = {}) {
  const account = await groupAccount(userId, input, options);
  const groupId = ensureGroupId(input.groupId);
  await leaveWhatsAppGroup(account._id, groupId);
  return { channelId: account.channelId, groupId, left: true };
}

export async function updatePublicGroupParticipants(userId, input, options = {}) {
  const account = await groupAccount(userId, input, options);
  const groupId = ensureGroupId(input.groupId);
  const participants = await Promise.all(input.participants.map((participant) => resolveParticipant(account._id, participant)));
  const result = await updateWhatsAppGroupParticipants(account._id, groupId, [...new Set(participants)], input.action);
  const results = result.results.map((entry, index) => visibleParticipantUpdateResult(entry, participants[index]));

  return {
    channelId: account.channelId,
    action: input.action,
    groupId,
    allSucceeded: results.every((entry) => entry.success),
    ...(result.metadata ? { group: visibleGroup(result.metadata) } : {}),
    ...(result.metadataWarning ? { metadataWarning: result.metadataWarning } : {}),
    results,
  };
}
