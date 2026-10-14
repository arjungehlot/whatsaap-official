import { CampaignModel } from "../../models/Campaign.js";
import { CampaignRecipientModel } from "../../models/CampaignRecipient.js";
import { InboxMessageModel } from "../../models/InboxMessage.js";
import { MessageJobModel } from "../../models/MessageJob.js";
import { MessageJobRecipientModel } from "../../models/MessageJobRecipient.js";
import { markOutboundMessageLogStatus } from "../message-logs/message-logs.service.js";
import { dispatchWebhookEvent } from "../webhooks/webhooks.service.js";
import { notifyCampaignDeliveryUpdate } from "../campaigns/campaigns.service.js";

function statusFromReceipt(receiptStatus) {
  if (receiptStatus === 3) return "delivered";
  if (receiptStatus === 4 || receiptStatus === 5) return "read";
  if (receiptStatus === 0) return "failed";
  return null;
}

function eligibleStatuses(status) {
  if (status === "read") return ["pending", "sent", "delivered"];
  if (status === "delivered") return ["pending", "sent"];
  return ["pending", "sent"];
}

async function refreshCampaignCounts(campaignId) {
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

export async function refreshMessageJobCounts(jobId) {
  const rows = await MessageJobRecipientModel.aggregate([
    { $match: { jobId } },
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);
  const counts = Object.fromEntries(rows.map((row) => [row._id, row.count]));
  await MessageJobModel.findByIdAndUpdate(jobId, {
    recipients: Math.max(
      0,
      rows.reduce((total, row) => total + row.count, 0) - (counts.skipped || 0),
    ),
    sent: (counts.sent || 0) + (counts.delivered || 0) + (counts.read || 0),
    delivered: (counts.delivered || 0) + (counts.read || 0),
    read: counts.read || 0,
    failed: counts.failed || 0,
  });
}

export async function applyWhatsAppMessageReceipts(account, updates) {
  const userId = account.userId;

  for (const receipt of updates || []) {
    const messageId = receipt?.key?.id;
    const status = statusFromReceipt(receipt?.update?.status);
    if (!messageId || !status) continue;

    const now = new Date();
    const set = { status };
    if (status === "delivered") set.deliveredAt = now;
    if (status === "read") set.readAt = now;
    if (status === "failed")
      set.error = "WhatsApp could not deliver this message";

    const inboxResult = await InboxMessageModel.updateMany(
      {
        userId,
        accountId: account._id,
        waMessageId: messageId,
        direction: "outbound",
        status: { $in: eligibleStatuses(status) },
      },
      { $set: set },
    );
    await markOutboundMessageLogStatus(
      userId,
      account._id,
      messageId,
      status,
      now,
    );

    const campaignRecipients = await CampaignRecipientModel.find({
      userId,
      messageId,
      status: { $in: eligibleStatuses(status) },
    })
      .select("campaignId")
      .lean();
    if (campaignRecipients.length) {
      await CampaignRecipientModel.updateMany(
        { _id: { $in: campaignRecipients.map((recipient) => recipient._id) } },
        { $set: set },
      );
      const campaignIds = [
        ...new Set(
          campaignRecipients.map((recipient) =>
            recipient.campaignId.toString(),
          ),
        ),
      ];
      await Promise.all(campaignIds.map(refreshCampaignCounts));
      campaignIds.forEach((campaignId) =>
        notifyCampaignDeliveryUpdate(userId, campaignId),
      );
    }

    const jobRecipients = await MessageJobRecipientModel.find({
      userId,
      messageIds: messageId,
      status: { $in: eligibleStatuses(status) },
    })
      .select("jobId")
      .lean();
    if (jobRecipients.length) {
      await MessageJobRecipientModel.updateMany(
        { _id: { $in: jobRecipients.map((recipient) => recipient._id) } },
        { $set: set },
      );
      await Promise.all(
        [
          ...new Set(
            jobRecipients.map((recipient) => recipient.jobId.toString()),
          ),
        ].map(refreshMessageJobCounts),
      );
    }

    if (
      inboxResult.modifiedCount > 0 &&
      ["delivered", "read", "failed"].includes(status)
    ) {
      void dispatchWebhookEvent(userId, `message.${status}`, {
        message_id: messageId,
        account_id: account.channelId,
        channel_id: account.channelId,
        status,
        at: now.toISOString(),
      }).catch(() => {});
    }
  }
}
