import { ApiKeyModel } from "../../models/ApiKey.js";
import { CampaignModel } from "../../models/Campaign.js";
import { CampaignRecipientModel } from "../../models/CampaignRecipient.js";
import { OutboundMessageBatchModel } from "../../models/OutboundMessageBatch.js";
import { OutboundMessageLogModel } from "../../models/OutboundMessageLog.js";
import { SenderReplacementAuditModel } from "../../models/SenderReplacementAudit.js";
import { WhatsAppAccountModel } from "../../models/WhatsAppAccount.js";
import { ApiError } from "../../utils/apiError.js";
import { refreshOutboundDeliverySummary } from "../message-logs/message-logs.service.js";
import { refreshOutboundBatch } from "../messages/outbound-batches.service.js";
import { senderIdentityForAccount, senderIdentityMatches } from "./whatsapp.sender-identity.js";

function visiblePhone(account) {
  return account.phone || `+${senderIdentityForAccount(account)}`;
}

function recipientCount(logs) {
  return new Set(logs.map((log) => log.deliveryGroupId?.toString() || log._id.toString())).size;
}

export async function resumeBlockedOutboundMessages({ userId, account, filter }) {
  const logs = await OutboundMessageLogModel.find({
    userId,
    accountId: account._id,
    source: filter.source,
    status: "pending",
    blockedBySenderChange: true,
    ...filter.conditions,
  }).select("_id deliveryGroupId batchId").lean();

  if (!logs.length) return { resumedRecipients: 0 };

  await OutboundMessageLogModel.updateMany(
    { _id: { $in: logs.map((log) => log._id) } },
    {
      $set: {
        senderNormalizedPhone: senderIdentityForAccount(account),
        blockedBySenderChange: false,
        nextAttemptAt: new Date(),
      },
      $unset: { error: 1, leaseExpiresAt: 1 },
    },
  );

  await Promise.all([
    ...new Set(logs.map((log) => log.deliveryGroupId?.toString()).filter(Boolean)),
  ].map(refreshOutboundDeliverySummary));
  await Promise.all([
    ...new Set(logs.map((log) => log.batchId?.toString()).filter(Boolean)),
  ].map(refreshOutboundBatch));

  return { resumedRecipients: recipientCount(logs) };
}

export async function resumeBlockedApiKeyMessages(userId, account, apiKeyId) {
  const batchIds = await OutboundMessageBatchModel.find({ userId, apiKeyId }).distinct("_id");
  if (!batchIds.length) return { resumedRecipients: 0 };
  return resumeBlockedOutboundMessages({
    userId,
    account,
    filter: { source: "api", conditions: { batchId: { $in: batchIds } } },
  });
}

export async function resumeBlockedCampaignMessages(userId, account, campaignId) {
  return resumeBlockedOutboundMessages({
    userId,
    account,
    filter: { source: "campaign", conditions: { campaignId } },
  });
}

export async function createSenderReplacementAudit(payload) {
  await SenderReplacementAuditModel.create(payload);
}

export async function getSenderReplacementPreview(userId, channelId) {
  const account = await WhatsAppAccountModel.findOne({ userId, channelId }).lean();
  if (!account) throw new ApiError(404, "WhatsApp number was not found");

  const currentIdentity = senderIdentityForAccount(account);
  const [keys, campaigns] = await Promise.all([
    ApiKeyModel.find({ userId, defaultAccountId: account._id }).lean(),
    CampaignModel.find({ userId, accountId: account._id, status: { $in: ["running", "scheduled", "paused"] } }).lean(),
  ]);

  const replacementKeys = await Promise.all(keys
    .filter((key) => !senderIdentityMatches(account, key.defaultAccountPhone))
    .map(async (key) => {
      const batchIds = await OutboundMessageBatchModel.find({ userId, apiKeyId: key._id }).distinct("_id");
      const logs = batchIds.length
        ? await OutboundMessageLogModel.find({
            userId,
            accountId: account._id,
            source: "api",
            batchId: { $in: batchIds },
            status: "pending",
            blockedBySenderChange: true,
          }).select("_id deliveryGroupId").lean()
        : [];
      return {
        id: key._id.toString(),
        label: key.label,
        previousPhone: key.defaultAccountPhone || "Unknown number",
        pendingRecipients: recipientCount(logs),
      };
    }));

  const replacementCampaigns = await Promise.all(campaigns
    .filter((campaign) => !senderIdentityMatches(account, campaign.senderNormalizedPhone))
    .map(async (campaign) => ({
      id: campaign._id.toString(),
      name: campaign.name,
      previousPhone: campaign.senderNormalizedPhone || "Unknown number",
      pendingRecipients: await CampaignRecipientModel.countDocuments({
        campaignId: campaign._id,
        status: { $in: ["pending", "under_processing"] },
      }),
    })));

  return {
    account: {
      id: account.channelId,
      replacementPhone: visiblePhone(account),
      replacementIdentity: currentIdentity,
    },
    apiKeys: replacementKeys,
    campaigns: replacementCampaigns,
  };
}
