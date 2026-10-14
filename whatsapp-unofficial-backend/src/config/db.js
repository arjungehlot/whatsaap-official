import mongoose from "mongoose";
import { env } from "./env.js";
import { InboxConversationModel } from "../models/InboxConversation.js";
import { InboxMessageModel } from "../models/InboxMessage.js";
import { WhatsAppAccountModel } from "../models/WhatsAppAccount.js";
import { WhatsAppPhoneClaimModel } from "../models/WhatsAppPhoneClaim.js";
import { WhatsAppSendWindowModel } from "../models/WhatsAppSendWindow.js";
import { ApiKeyModel } from "../models/ApiKey.js";
import { AutomationModel } from "../models/Automation.js";
import { CampaignModel } from "../models/Campaign.js";
import { MessageJobModel } from "../models/MessageJob.js";
import { OutboundMessageLogModel } from "../models/OutboundMessageLog.js";
import { OutboundMessageBatchModel } from "../models/OutboundMessageBatch.js";
import { SenderReplacementAuditModel } from "../models/SenderReplacementAudit.js";
import { UserModel } from "../models/User.js";
import { normalizeWhatsAppPhone } from "../modules/whatsapp/whatsapp.phone.js";
import { generateChannelId } from "../modules/whatsapp/whatsapp.channel-id.js";
import { LEGACY_SENDER_IDENTITY_MESSAGE } from "../modules/whatsapp/whatsapp.sender-identity.js";

async function dropIndexIfExists(collection, name) {
  const indexes = await collection.indexes().catch(() => []);
  if (!indexes.some((index) => index.name === name)) return;
  await collection.dropIndex(name);
}

async function migrateUserIndexes() {
  await dropIndexIfExists(UserModel.collection, "id_1");
  await UserModel.createIndexes();
}

async function migrateInboxIndexes() {
  await dropIndexIfExists(InboxConversationModel.collection, "userId_1_accountId_1_remoteJid_1");
  await dropIndexIfExists(InboxMessageModel.collection, "accountId_1_waMessageId_1");
  await Promise.all([InboxConversationModel.createIndexes(), InboxMessageModel.createIndexes()]);
}

async function migrateWhatsAppAccountPhoneIndex() {
  const accounts = await WhatsAppAccountModel.find({}).select("_id userId phone normalizedPhone").lean();
  const seen = new Map();

  for (const account of accounts) {
    const normalizedPhone = normalizeWhatsAppPhone(account.phone);
    const key = `${account.userId.toString()}:${normalizedPhone}`;
    const previous = seen.get(key);
    if (previous) {
      throw new Error(
        `Duplicate WhatsApp number detected for account ${account._id}: ${account.phone}. Resolve duplicate slots before starting the backend.`,
      );
    }
    seen.set(key, account._id.toString());

    if (account.normalizedPhone !== normalizedPhone) {
      await WhatsAppAccountModel.updateOne({ _id: account._id }, { $set: { normalizedPhone } });
    }
  }

  await WhatsAppAccountModel.collection.createIndex(
    { userId: 1, normalizedPhone: 1 },
    { unique: true, sparse: true, name: "userId_1_normalizedPhone_1" },
  );
}

async function migrateInboxVisibilityBoundaries() {
  const accounts = await WhatsAppAccountModel.find({
    $or: [{ inboxPhone: { $exists: false } }, { inboxVisibleSince: { $exists: false } }],
  })
    .select("_id normalizedPhone phone lastConnectedAt createdAt inboxPhone inboxVisibleSince")
    .lean();

  const updates = accounts.map((account) => {
    const normalizedPhone = normalizeWhatsAppPhone(account.normalizedPhone || account.phone);
    const visibleSince = account.lastConnectedAt || account.createdAt || new Date();
    const $set = {};

    if (!account.inboxPhone && normalizedPhone) $set.inboxPhone = normalizedPhone;
    if (!account.inboxVisibleSince) $set.inboxVisibleSince = visibleSince;

    return { updateOne: { filter: { _id: account._id }, update: { $set } } };
  });

  if (updates.length) await WhatsAppAccountModel.bulkWrite(updates, { ordered: false });
}

async function migrateWhatsAppChannelIds() {
  const accounts = await WhatsAppAccountModel.find({
    $or: [{ channelId: { $exists: false } }, { channelId: null }, { channelId: "" }],
  })
    .select("_id")
    .lean();

  for (const account of accounts) {
    let assigned = false;
    while (!assigned) {
      try {
        // channelId is immutable for normal application writes; legacy backfill must use the raw collection.
        const result = await WhatsAppAccountModel.collection.updateOne(
          {
            _id: account._id,
            $or: [{ channelId: { $exists: false } }, { channelId: null }, { channelId: "" }],
          },
          { $set: { channelId: generateChannelId() } },
        );
        assigned = result.modifiedCount === 1 || result.matchedCount === 0;
      } catch (error) {
        if (error?.code !== 11000) throw error;
      }
    }
  }

  await WhatsAppAccountModel.collection.createIndex(
    { channelId: 1 },
    { unique: true, name: "channelId_1" },
  );
}

async function migrateApiKeyChannelIds() {
  const keys = await ApiKeyModel.find({
    defaultAccountId: { $exists: true, $ne: null },
    $or: [{ defaultChannelId: { $exists: false } }, { defaultChannelId: null }, { defaultChannelId: "" }],
  })
    .select("_id defaultAccountId")
    .lean();
  if (!keys.length) return;

  const accountIds = keys.map((key) => key.defaultAccountId);
  const accounts = await WhatsAppAccountModel.find({ _id: { $in: accountIds } }).select("_id channelId").lean();
  const channelIdByAccountId = new Map(accounts.map((account) => [account._id.toString(), account.channelId]));

  const updates = keys.flatMap((key) => {
    const channelId = channelIdByAccountId.get(key.defaultAccountId.toString());
    return channelId ? [{ updateOne: { filter: { _id: key._id }, update: { $set: { defaultChannelId: channelId } } } }] : [];
  });
  if (updates.length) await ApiKeyModel.bulkWrite(updates, { ordered: false });
}

async function migrateChannelReferenceSnapshots() {
  const accounts = await WhatsAppAccountModel.find({}).select("_id channelId").lean();
  const operations = accounts.flatMap((account) => {
    const filter = {
      accountId: account._id,
      $or: [{ channelId: { $exists: false } }, { channelId: null }, { channelId: "" }],
    };
    return [
      CampaignModel.updateMany(filter, { $set: { channelId: account.channelId } }),
      MessageJobModel.updateMany(filter, { $set: { channelId: account.channelId } }),
      AutomationModel.updateMany(filter, { $set: { channelId: account.channelId } }),
    ];
  });
  if (operations.length) await Promise.all(operations);
}

async function migrateWhatsAppPhoneClaims() {
  await WhatsAppPhoneClaimModel.collection.createIndex(
    { normalizedPhone: 1 },
    { unique: true, name: "normalizedPhone_1" },
  );
}

async function migrateWhatsAppSendWindows() {
  await WhatsAppSendWindowModel.collection.createIndex(
    { accountId: 1 },
    { unique: true, name: "accountId_1" },
  );
}

async function migrateOutboundMessageDispatches() {
  await OutboundMessageBatchModel.createIndexes();
  await SenderReplacementAuditModel.createIndexes();
  await OutboundMessageLogModel.createIndexes();
  await OutboundMessageLogModel.updateMany(
    {
      status: { $in: ["pending", "processing"] },
      $or: [
        { senderNormalizedPhone: { $exists: false } },
        { senderNormalizedPhone: null },
        { senderNormalizedPhone: "" },
      ],
    },
    {
      $set: {
        status: "pending",
        blockedBySenderChange: true,
        error: LEGACY_SENDER_IDENTITY_MESSAGE,
      },
      $unset: { leaseExpiresAt: 1 },
    },
  );
}

export async function connectDatabase() {
  if (!env.mongoUri) {
    throw new Error("MONGO_URI is required in backend/.env");
  }

  mongoose.set("strictQuery", true);
  await mongoose.connect(env.mongoUri);
  await migrateUserIndexes();
  await migrateInboxIndexes();
  await migrateWhatsAppAccountPhoneIndex();
  await migrateInboxVisibilityBoundaries();
  await migrateWhatsAppChannelIds();
  await migrateApiKeyChannelIds();
  await migrateChannelReferenceSnapshots();
  await migrateWhatsAppPhoneClaims();
  await migrateWhatsAppSendWindows();
  await migrateOutboundMessageDispatches();
  console.log("MongoDB connected");
}
