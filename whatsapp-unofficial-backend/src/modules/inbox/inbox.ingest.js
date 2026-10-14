import { InboxConversationModel } from "../../models/InboxConversation.js";
import { InboxMessageModel } from "../../models/InboxMessage.js";
import { getPhoneJidForLid } from "../whatsapp/whatsapp.auth-store.js";
import { dispatchWebhookEvent } from "../webhooks/webhooks.service.js";

function jidParts(remoteJid) {
  const [userWithDevice = "", server = ""] = String(remoteJid || "").split("@");
  const user = userWithDevice.split(":")[0].split("_")[0];
  return { user, server };
}

function normalizeRemoteJid(remoteJid) {
  const { user, server } = jidParts(remoteJid);
  if (!user || !server) return remoteJid;

  return `${user}@${server === "c.us" ? "s.whatsapp.net" : server}`;
}

function isLidJid(remoteJid) {
  return jidParts(remoteJid).server === "lid";
}

function isInboxJid(remoteJid) {
  const { server } = jidParts(remoteJid);
  return server === "s.whatsapp.net" || server === "c.us" || server === "lid" || server === "g.us";
}

function phoneFromJid(remoteJid) {
  const { user, server } = jidParts(remoteJid);
  if (!user) return "Unknown number";
  if (server === "lid") return "WhatsApp linked ID";

  const raw = user.replace(/\D/g, "");
  if (!raw) return "Unknown number";
  return raw.startsWith("+") ? raw : `+${raw}`;
}

function groupMembersFromMetadata(metadata) {
  return (metadata?.participants || [])
    .map((participant) => {
      const jid = participant?.id || participant?.jid;
      if (!jid) return null;
      return {
        jid,
        phone: phoneFromJid(jid),
        name: participant?.name || participant?.notify || participant?.verifiedName || phoneFromJid(jid),
        role: participant?.admin || "member",
      };
    })
    .filter(Boolean);
}

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value || {}, key);
}

function groupDetailsFromMetadata(metadata) {
  if (!metadata || typeof metadata !== "object") return null;

  const subject = String(metadata.subject || "").trim();
  const hasDescription = hasOwn(metadata, "desc");
  const hasMembers = Array.isArray(metadata.participants);
  if (!subject && !hasDescription && !hasMembers) return null;

  return {
    subject,
    hasDescription,
    description: hasDescription ? String(metadata.desc || "") : "",
    hasMembers,
    members: hasMembers ? groupMembersFromMetadata(metadata) : [],
  };
}

function groupMetadataUpdate(metadata) {
  const details = groupDetailsFromMetadata(metadata);
  if (!details) return null;

  return {
    ...(details.subject ? { groupSubject: details.subject, contactName: details.subject } : {}),
    ...(details.hasDescription ? { groupDescription: details.description } : {}),
    ...(details.hasMembers ? { groupMembers: details.members } : {}),
    groupMetadataFetchedAt: new Date(),
    groupMetadataRetryAfter: null,
  };
}

function groupMetadataFromConversation(conversation) {
  if (!conversation?.groupMetadataFetchedAt) return null;

  return {
    id: conversation.remoteJid,
    subject: conversation.groupSubject || conversation.contactName || "WhatsApp group",
    desc: conversation.groupDescription || "",
    participants: (conversation.groupMembers || []).map((member) => ({
      id: member.jid,
      name: member.name,
      notify: member.name,
      admin: member.role === "superadmin" ? "superadmin" : member.role === "admin" ? "admin" : undefined,
    })),
  };
}

export async function getStoredInboxGroupMetadata(accountId, remoteJid) {
  const conversation = await InboxConversationModel.findOne({ accountId, remoteJid, isGroup: true })
    .select("remoteJid contactName groupSubject groupDescription groupMembers groupMetadataFetchedAt groupMetadataRetryAfter")
    .sort({ groupMetadataFetchedAt: -1, updatedAt: -1 })
    .lean();

  return {
    metadata: groupMetadataFromConversation(conversation),
    fetchedAt: conversation?.groupMetadataFetchedAt || null,
    retryAfter: conversation?.groupMetadataRetryAfter || null,
  };
}

export async function persistInboxGroupMetadata(accountId, remoteJid, metadata) {
  const update = groupMetadataUpdate(metadata);
  if (!update) return;

  await InboxConversationModel.updateMany(
    { accountId, remoteJid, isGroup: true },
    { $set: update },
  );
}

export async function markInboxGroupMetadataUnavailable(accountId, remoteJid, retryAfter) {
  await InboxConversationModel.updateMany(
    { accountId, remoteJid, isGroup: true },
    { $set: { groupMetadataRetryAfter: retryAfter } },
  );
}

function accountPhoneForInbox(account) {
  return account?.phone || "Unknown WhatsApp number";
}

async function resolveContactIdentity(accountId, remoteJid) {
  const normalizedJid = normalizeRemoteJid(remoteJid);
  const phoneJid = isLidJid(normalizedJid) ? await getPhoneJidForLid(accountId, normalizedJid) : null;
  const displayJid = phoneJid || normalizedJid;

  return {
    rawJid: normalizedJid,
    remoteJid: displayJid,
    phone: phoneFromJid(displayJid),
    hasPhone: Boolean(phoneJid || !isLidJid(displayJid)),
  };
}

async function mergeLegacyConversation({ account, identity, contactName, at, body }) {
  if (identity.rawJid === identity.remoteJid) return;

  const accountPhone = accountPhoneForInbox(account);
  const filter = { userId: account.userId, accountId: account._id, accountPhone };
  const [canonical, legacy] = await Promise.all([
    InboxConversationModel.findOne({ ...filter, remoteJid: identity.remoteJid }),
    InboxConversationModel.findOne({ ...filter, remoteJid: identity.rawJid }),
  ]);

  if (canonical && legacy && !canonical._id.equals(legacy._id)) {
    await InboxMessageModel.updateMany(
      { conversationId: legacy._id },
      { $set: { conversationId: canonical._id, remoteJid: identity.remoteJid } },
    );
    await InboxConversationModel.deleteOne({ _id: legacy._id });
    return;
  }

  if (legacy && !canonical) {
    await InboxConversationModel.updateOne(
      { _id: legacy._id },
      {
        $set: {
          accountPhone,
          remoteJid: identity.remoteJid,
          contactName,
          phone: identity.phone,
          lastMessage: body,
          lastMessageAt: at,
          isGroup: identity.remoteJid.endsWith("@g.us"),
        },
      },
    );
    await InboxMessageModel.updateMany(
      { conversationId: legacy._id },
      { $set: { remoteJid: identity.remoteJid, accountPhone } },
    );
  }
}

function extractMessageBody(message) {
  if (!message) return "";

  const content = message.ephemeralMessage?.message || message.viewOnceMessage?.message || message;

  return (
    content.conversation ||
    content.extendedTextMessage?.text ||
    content.imageMessage?.caption ||
    content.videoMessage?.caption ||
    content.documentMessage?.caption ||
    content.buttonsResponseMessage?.selectedDisplayText ||
    content.listResponseMessage?.title ||
    (content.imageMessage ? "Image" : "") ||
    (content.videoMessage ? "Video" : "") ||
    (content.audioMessage ? "Voice message" : "") ||
    (content.stickerMessage ? "Sticker" : "") ||
    (content.documentMessage ? content.documentMessage.fileName || "Document" : "") ||
    (content.locationMessage ? "Location" : "") ||
    (content.contactMessage ? "Contact card" : "") ||
    ""
  ).trim();
}

export async function upsertInboxMessageFromWhatsApp(account, message, groupMetadata = null, options = {}) {
  const rawRemoteJid = message.key?.remoteJid;
  if (!rawRemoteJid || rawRemoteJid === "status@broadcast" || !isInboxJid(rawRemoteJid)) return null;

  const body = extractMessageBody(message.message);
  if (!body) return null;

  const identity = await resolveContactIdentity(account._id, rawRemoteJid);
  const isGroup = identity.remoteJid.endsWith("@g.us");
  const direction = message.key?.fromMe ? "outbound" : "inbound";
  const at = message.messageTimestamp ? new Date(Number(message.messageTimestamp) * 1000) : new Date();
  const accountPhone = accountPhoneForInbox(account);
  const conversationFilter = { userId: account.userId, accountId: account._id, accountPhone, remoteJid: identity.remoteJid };
  const storedGroup = isGroup
    ? await InboxConversationModel.findOne(conversationFilter)
      .select("contactName groupSubject groupDescription groupMembers")
      .lean()
    : null;
  const groupDetails = isGroup ? groupDetailsFromMetadata(groupMetadata) : null;
  const groupMembers = groupDetails?.hasMembers ? groupDetails.members : storedGroup?.groupMembers || [];
  const groupSubject = isGroup
    ? groupDetails?.subject || storedGroup?.groupSubject || storedGroup?.contactName || "WhatsApp group"
    : "";
  const groupDescription = isGroup
    ? groupDetails?.hasDescription ? groupDetails.description : storedGroup?.groupDescription || ""
    : "";
  const senderJid = isGroup ? message.key?.participant || (message.key?.fromMe ? account.phone : "") : "";
  const sender = groupMembers.find((member) => member.jid === senderJid);
  const senderName = isGroup ? message.pushName || sender?.name || "Group member" : "";
  const senderPhone = isGroup && senderJid ? phoneFromJid(senderJid) : "";
  const contactName = isGroup ? groupSubject : message.pushName || (identity.hasPhone ? identity.phone : "WhatsApp user");
  const waMessageId = message.key?.id || `${identity.remoteJid}-${direction}-${at.getTime()}`;
  await mergeLegacyConversation({ account, identity, contactName, at, body });

  const conversation = await InboxConversationModel.findOneAndUpdate(
    conversationFilter,
    {
      $set: {
        accountPhone,
        contactName,
        phone: identity.phone,
        isGroup,
        ...(isGroup && !storedGroup ? { groupSubject, groupDescription, groupMembers } : {}),
        ...(isGroup && groupDetails
          ? {
              ...(groupDetails.subject ? { groupSubject: groupDetails.subject, contactName: groupDetails.subject } : {}),
              ...(groupDetails.hasDescription ? { groupDescription: groupDetails.description } : {}),
              ...(groupDetails.hasMembers ? { groupMembers: groupDetails.members } : {}),
            }
          : {}),
        lastMessage: body,
        lastMessageAt: at,
      },
      ...(direction === "inbound" && !options.isHistory ? { $inc: { unreadCount: 1 } } : {}),
      $setOnInsert: { labels: ["WhatsApp"], starred: false },
    },
    { upsert: true, returnDocument: "after" },
  );

  await InboxMessageModel.updateOne(
    { accountId: account._id, accountPhone, waMessageId },
    {
      $setOnInsert: {
        userId: account.userId,
        accountId: account._id,
        accountPhone,
        conversationId: conversation._id,
        waMessageId,
        remoteJid: identity.remoteJid,
        senderJid,
        senderName,
        senderPhone,
        body,
        direction,
        status: direction === "outbound" ? "sent" : "read",
        at,
      },
    },
    { upsert: true },
  );

  if (!options.isHistory) {
    void dispatchWebhookEvent(account.userId, direction === "inbound" ? "message.received" : "message.sent", {
      message_id: waMessageId,
      conversation_id: conversation._id.toString(),
      from: senderPhone || identity.phone,
      body,
      account_id: account.channelId,
      channel_id: account.channelId,
      received_at: at.toISOString(),
      is_group: isGroup,
    });
  }

  return conversation;
}

export async function updateInboxContactFromWhatsApp(account, contact) {
  if (!contact?.id) return;

  const identity = await resolveContactIdentity(account._id, contact.id);
  const displayName = contact.verifiedName || contact.name || contact.notify;
  const remoteJids = [...new Set([identity.rawJid, identity.remoteJid])];
  const accountPhone = accountPhoneForInbox(account);
  const $set = { phone: identity.phone, accountPhone };

  if (displayName) {
    $set.contactName = displayName;
  }

  await InboxConversationModel.updateMany(
    {
      userId: account.userId,
      accountId: account._id,
      accountPhone,
      remoteJid: { $in: remoteJids },
    },
    { $set },
  );
}
