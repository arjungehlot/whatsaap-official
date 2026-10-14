import { InboxConversationModel } from "../../models/InboxConversation.js";
import { InboxMessageModel } from "../../models/InboxMessage.js";
import { OutboundMessageLogModel } from "../../models/OutboundMessageLog.js";
import { WhatsAppAccountModel } from "../../models/WhatsAppAccount.js";
import { env } from "../../config/env.js";
import { ApiError } from "../../utils/apiError.js";
import { getPhoneJidForLid } from "../whatsapp/whatsapp.auth-store.js";
import { getWhatsAppGroupMetadata, isWhatsAppSocketOpen } from "../whatsapp/whatsapp.engine.js";
import { getEntitlements } from "../billing/entitlements.service.js";
import { sendApiMessage } from "../messages/messages.service.js";
import { downloadAttachmentBuffer } from "../templates/template-storage.service.js";

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 75;

async function assertConversationFeature(userId, conversation) {
  const feature = conversation.isGroup ? "inbox-groups" : "inbox";
  const entitlements = await getEntitlements(userId);
  if (!entitlements.features?.[feature]) {
    throw new ApiError(403, `Your plan does not include ${feature}. Upgrade your plan to continue.`);
  }
}

function toLimit(value) {
  return Math.min(Math.max(Number(value) || DEFAULT_LIMIT, 1), MAX_LIMIT);
}

function jidUser(remoteJid) {
  return String(remoteJid || "").split("@")[0].split(":")[0].split("_")[0];
}

function phoneFromJid(remoteJid) {
  const raw = jidUser(remoteJid).replace(/\D/g, "");
  return raw ? `+${raw}` : "Unknown number";
}

function isGeneratedLidLabel(value, remoteJid) {
  const label = String(value || "").trim();
  const raw = jidUser(remoteJid);

  return !label || label === "WhatsApp user" || label === `+${raw}` || label === raw;
}

function personalConversationFilter() {
  return {
    isGroup: { $ne: true },
    remoteJid: {
      $nin: ["status@broadcast"],
      $not: /@g\.us$/i,
    },
  };
}

function groupConversationFilter() {
  return {
    isGroup: true,
    remoteJid: { $regex: /@g\.us$/i },
  };
}

function connectedConversationFilter(accountMap) {
  return {
    $or: [...accountMap.entries()].map(([accountId, account]) => ({
      accountId,
      accountPhone: account.phone,
      ...(account.inboxVisibleSince ? { lastMessageAt: { $gte: new Date(account.inboxVisibleSince) } } : {}),
    })),
  };
}

async function resolveDisplayIdentity(conversation) {
  if (!conversation.remoteJid?.endsWith("@lid")) {
    return {
      contactName: conversation.contactName,
      phone: conversation.phone,
    };
  }

  const phoneJid = await getPhoneJidForLid(conversation.accountId, conversation.remoteJid);
  if (!phoneJid) {
    return {
      contactName: isGeneratedLidLabel(conversation.contactName, conversation.remoteJid)
        ? "WhatsApp user"
        : conversation.contactName,
      phone: "Phone number not shared yet",
    };
  }

  const phone = phoneFromJid(phoneJid);
  const contactName = isGeneratedLidLabel(conversation.contactName, conversation.remoteJid)
    ? phone
    : conversation.contactName;

  if (conversation.phone !== phone || conversation.contactName !== contactName) {
    await InboxConversationModel.updateOne({ _id: conversation._id }, { $set: { phone, contactName } });
  }

  return { contactName, phone };
}

async function visibleConversation(conversation, account) {
  const identity = await resolveDisplayIdentity(conversation);

  return {
    id: conversation._id.toString(),
    accountId: account?.channelId,
    channelId: account?.channelId,
    accountName: account?.displayName || "WhatsApp",
    contactId: conversation.remoteJid,
    contactName: identity.contactName,
    phone: conversation.isGroup ? conversation.remoteJid : identity.phone,
    lastMessage: conversation.lastMessage,
    lastMessageAt: conversation.lastMessageAt.toISOString(),
    unreadCount: conversation.unreadCount,
    online: false,
    starred: conversation.starred,
    assignedTo: conversation.assignedTo,
    isGroup: conversation.isGroup,
    groupSubject: conversation.groupSubject || conversation.contactName,
    ...(conversation.isGroup
      ? { groupMemberCount: Array.isArray(conversation.groupMembers) ? conversation.groupMembers.length : 0 }
      : {}),
    labels: conversation.labels,
  };
}

function visibleGroupDetails(conversation, metadataWarning) {
  const members = Array.isArray(conversation.groupMembers) ? conversation.groupMembers : [];

  return {
    conversationId: conversation._id.toString(),
    groupId: conversation.remoteJid,
    subject: conversation.groupSubject || conversation.contactName || "WhatsApp group",
    description: conversation.groupDescription || "",
    memberCount: members.length,
    members: members.map((member) => ({
      jid: member.jid,
      phone: member.phone || "WhatsApp linked ID",
      name: member.name || member.phone || "WhatsApp user",
      role: member.role || "member",
    })),
    ...(metadataWarning ? { metadataWarning } : {}),
  };
}

function visibleMessage(message) {
  return {
    id: message._id.toString(),
    conversationId: message.conversationId.toString(),
    body: message.body,
    direction: message.direction,
    status: message.status,
    at: message.at.toISOString(),
    senderJid: message.senderJid || undefined,
    senderName: message.senderName || undefined,
    senderPhone: message.senderPhone || undefined,
    attachment: message.attachment,
  };
}

async function connectedAccountMap(userId) {
  const accounts = await WhatsAppAccountModel.find({ userId, state: "CONNECTED" })
    .select("_id channelId displayName phone inboxVisibleSince")
    .lean();

  return new Map(
    accounts
      .filter((account) => isWhatsAppSocketOpen(account._id))
      .map((account) => [account._id.toString(), account]),
  );
}

export async function listInboxConversations(userId, filters = {}) {
  const accountMap = await connectedAccountMap(userId);
  const activeAccounts = [...accountMap.entries()].map(([accountId, account]) => ({ accountId, phone: account.phone }));

  if (activeAccounts.length === 0) {
    return { conversations: [], nextCursor: null };
  }

  const limit = toLimit(filters.limit);
  const conversationTypeFilter = filters.view === "groups" ? groupConversationFilter() : personalConversationFilter();
  const query = {
    userId,
    ...conversationTypeFilter,
    ...connectedConversationFilter(accountMap),
  };

  if (filters.filter === "unread") query.unreadCount = { $gt: 0 };
  if (filters.filter === "assigned") query.assignedTo = { $exists: true, $ne: "" };
  if (filters.filter === "starred") query.starred = true;
  if (filters.cursor) query.lastMessageAt = { $lt: new Date(filters.cursor) };

  const search = filters.search?.trim();
  if (search) {
    query.$and = [
      { $or: query.$or },
      {
        $or: [
          { contactName: { $regex: search, $options: "i" } },
          { phone: { $regex: search, $options: "i" } },
          { lastMessage: { $regex: search, $options: "i" } },
        ],
      },
    ];
    delete query.$or;
  }

  const conversations = await InboxConversationModel.find(query)
    .sort({ lastMessageAt: -1, _id: -1 })
    .limit(limit + 1)
    .lean();

  const page = conversations.slice(0, limit);
  const nextCursor = conversations.length > limit ? page.at(-1)?.lastMessageAt.toISOString() : null;

  return {
    conversations: await Promise.all(
      page.map((conversation) =>
        visibleConversation(conversation, accountMap.get(conversation.accountId.toString())),
      ),
    ),
    nextCursor,
  };
}

export async function listInboxMessages(userId, conversationId, filters = {}) {
  const accountMap = await connectedAccountMap(userId);
  const conversation = await InboxConversationModel.findOne({
    _id: conversationId,
    userId,
    remoteJid: { $nin: ["status@broadcast"] },
    ...connectedConversationFilter(accountMap),
  }).lean();

  if (!conversation) {
    throw new ApiError(404, "Conversation not found or WhatsApp number is disconnected");
  }
  await assertConversationFeature(userId, conversation);

  const limit = toLimit(filters.limit);
  const query = { conversationId: conversation._id };
  const account = accountMap.get(conversation.accountId.toString());
  if (account?.inboxVisibleSince) {
    query.at = { $gte: new Date(account.inboxVisibleSince) };
  }
  if (filters.before) query.at = { ...(query.at || {}), $lt: new Date(filters.before) };

  const messages = await InboxMessageModel.find(query).sort({ at: -1, _id: -1 }).limit(limit + 1).lean();
  const page = messages.slice(0, limit);
  const nextCursor = messages.length > limit ? page.at(-1)?.at.toISOString() : null;

  if (conversation.unreadCount > 0) {
    await InboxConversationModel.updateOne({ _id: conversation._id }, { $set: { unreadCount: 0 } });
  }

  return {
    messages: page.reverse().map(visibleMessage),
    nextCursor,
  };
}

export async function getInboxGroupDetails(userId, conversationId) {
  const accountMap = await connectedAccountMap(userId);
  const conversation = await InboxConversationModel.findOne({
    _id: conversationId,
    userId,
    isGroup: true,
    remoteJid: { $regex: /@g\.us$/i },
    ...connectedConversationFilter(accountMap),
  }).lean();

  if (!conversation) {
    throw new ApiError(404, "Group conversation not found or WhatsApp number is disconnected");
  }
  await assertConversationFeature(userId, conversation);

  const account = accountMap.get(conversation.accountId.toString());
  let metadataWarning;
  try {
    // This is the only Inbox request that may fetch group members from WhatsApp.
    await getWhatsAppGroupMetadata(account._id, conversation.remoteJid);
  } catch (error) {
    // Last-known MongoDB metadata remains useful while WhatsApp throttles or rejects a refresh.
    metadataWarning = error instanceof Error ? error.message : "The latest group details are temporarily unavailable.";
  }

  const refreshedConversation = await InboxConversationModel.findById(conversation._id)
    .select("remoteJid contactName groupSubject groupDescription groupMembers")
    .lean();

  if (!refreshedConversation) {
    throw new ApiError(404, "Group conversation no longer exists");
  }

  return visibleGroupDetails(refreshedConversation, metadataWarning);
}

function validateInboxAttachments(userId, attachments) {
  const expectedPrefix = `templates/${userId}/`;
  for (const attachment of attachments) {
    if (env.awsS3BucketName && attachment.bucket !== env.awsS3BucketName) {
      throw new ApiError(400, "Inbox attachment bucket is invalid");
    }
    if (!attachment.key?.startsWith(expectedPrefix)) {
      throw new ApiError(400, "Inbox attachment does not belong to this user");
    }
  }
}

export async function sendInboxMessage(userId, conversationId, body, options = {}) {
  const accountMap = await connectedAccountMap(userId);
  const conversation = await InboxConversationModel.findOne({
    _id: conversationId,
    userId,
    remoteJid: { $nin: ["status@broadcast"] },
    ...connectedConversationFilter(accountMap),
  });

  if (!conversation) {
    throw new ApiError(404, "Conversation not found");
  }
  await assertConversationFeature(userId, conversation);

  const text = String(body || "").trim();
  const attachments = Array.isArray(options.attachments) ? options.attachments : [];
  if (!text && !attachments.length) throw new ApiError(400, "Write a message or attach a file");
  validateInboxAttachments(userId, attachments);
  const account = accountMap.get(conversation.accountId.toString());
  if (!account?.channelId) throw new ApiError(404, "The WhatsApp number for this conversation no longer exists");
  const source = options.chargeCredits === false ? "inbox" : "api";
  const result = await sendApiMessage(
    userId,
    { to: conversation.remoteJid, accountId: account.channelId, body: text, attachments },
    {
      source,
      chargeCredits: options.chargeCredits !== false,
      attachmentsAlreadyStored: true,
      contactName: conversation.contactName,
      conversationId: conversation._id,
    },
  );
  return result.messages;
}

export async function getInboxAttachment(userId, messageId) {
  const message = await InboxMessageModel.findOne({ _id: messageId, userId })
    .select("outboundLogId attachment")
    .lean();
  if (!message?.attachment || !message.outboundLogId) {
    throw new ApiError(404, "This attachment is not available for download");
  }

  const log = await OutboundMessageLogModel.findOne({
    _id: message.outboundLogId,
    userId,
    inboxMessageId: message._id,
  }).select("payload").lean();
  const attachment = log?.payload?.attachment;
  if (!attachment?.key) {
    throw new ApiError(404, "This attachment is not available for download");
  }

  return downloadAttachmentBuffer(attachment);
}
