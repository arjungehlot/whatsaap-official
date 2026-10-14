import { CampaignModel } from "../../models/Campaign.js";
import { CampaignRecipientModel } from "../../models/CampaignRecipient.js";
import { ContactModel } from "../../models/Contact.js";
import { InboxConversationModel } from "../../models/InboxConversation.js";
import { InboxMessageModel } from "../../models/InboxMessage.js";
import { MessageJobRecipientModel } from "../../models/MessageJobRecipient.js";
import { WhatsAppAccountModel } from "../../models/WhatsAppAccount.js";

function startOfUtcDay(date = new Date()) {
  const result = new Date(date);
  result.setUTCHours(0, 0, 0, 0);
  return result;
}

function dayLabel(date) {
  return new Intl.DateTimeFormat("en", { weekday: "short", timeZone: "UTC" }).format(date);
}

function visibleCampaign(campaign, deliveryCounts) {
  return {
    id: campaign._id.toString(),
    name: campaign.name,
    status: campaign.status,
    audience: campaign.audience,
    templateName: campaign.templateName,
    recipients: campaign.recipients,
    sent: deliveryCounts?.sent ?? campaign.sent,
    delivered: deliveryCounts?.delivered ?? campaign.delivered,
    read: deliveryCounts?.read ?? campaign.read,
    failed: deliveryCounts?.failed ?? campaign.failed,
    scheduledAt: campaign.scheduledAt?.toISOString(),
    createdAt: campaign.createdAt.toISOString(),
  };
}

function campaignCountsFromRows(rows) {
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

async function recentCampaignDeliveryCounts(campaignIds) {
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
  return new Map([...grouped.entries()].map(([id, counts]) => [id, campaignCountsFromRows(counts)]));
}

function visibleConversation(conversation, account) {
  return {
    id: conversation._id.toString(),
    accountId: account?.channelId,
    channelId: account?.channelId,
    accountName: account?.displayName || "WhatsApp",
    contactId: conversation.remoteJid,
    contactName: conversation.contactName,
    phone: conversation.phone,
    lastMessage: conversation.lastMessage,
    lastMessageAt: conversation.lastMessageAt.toISOString(),
    unreadCount: conversation.unreadCount,
    online: false,
    starred: conversation.starred,
    assignedTo: conversation.assignedTo,
    isGroup: Boolean(conversation.isGroup),
    labels: conversation.labels || [],
  };
}

export async function getDashboardOverview(userId) {
  const today = startOfUtcDay();
  const start = new Date(today);
  start.setUTCDate(start.getUTCDate() - 6);

  const [messageRows, campaignDeliveryRows, campaignFailureRows, jobFailureRows, totalContacts, activeCampaigns, recentCampaigns, accounts, recentConversations] = await Promise.all([
    InboxMessageModel.aggregate([
      { $match: { userId, at: { $gte: start } } },
      {
        $project: {
          day: { $dateToString: { format: "%Y-%m-%d", date: "$at", timezone: "UTC" } },
          direction: 1,
          status: 1,
        },
      },
      { $group: { _id: { day: "$day", direction: "$direction", status: "$status" }, count: { $sum: 1 } } },
    ]),
    CampaignRecipientModel.aggregate([
      { $match: { userId, sentAt: { $gte: start }, status: { $in: ["sent", "delivered", "read"] } } },
      {
        $project: {
          day: { $dateToString: { format: "%Y-%m-%d", date: "$sentAt", timezone: "UTC" } },
          status: 1,
        },
      },
      { $group: { _id: { day: "$day", status: "$status" }, count: { $sum: 1 } } },
    ]),
    CampaignRecipientModel.aggregate([
      { $match: { userId, status: "failed", updatedAt: { $gte: start } } },
      { $group: { _id: null, count: { $sum: 1 } } },
    ]),
    MessageJobRecipientModel.aggregate([
      { $match: { userId, status: "failed", updatedAt: { $gte: start } } },
      { $group: { _id: null, count: { $sum: 1 } } },
    ]),
    ContactModel.countDocuments({ userId }),
    CampaignModel.countDocuments({ userId, status: { $in: ["scheduled", "running"] } }),
    CampaignModel.find({ userId }).sort({ createdAt: -1 }).limit(5).lean(),
    WhatsAppAccountModel.find({ userId }).select("_id channelId displayName").lean(),
    InboxConversationModel.find({
      userId,
      isGroup: { $ne: true },
      remoteJid: { $nin: ["status@broadcast"], $not: /@(g\.us|newsletter|broadcast)$/i },
    }).sort({ lastMessageAt: -1 }).limit(5).lean(),
  ]);

  const accountMap = new Map(accounts.map((account) => [account._id.toString(), account]));
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + index);
    return { key: date.toISOString().slice(0, 10), label: dayLabel(date), sent: 0, delivered: 0 };
  });
  const dayMap = new Map(days.map((day) => [day.key, day]));
  let sent = 0;
  let delivered = 0;
  let read = 0;
  let failed = 0;
  let replied = 0;
  failed += Number(campaignFailureRows[0]?.count || 0) + Number(jobFailureRows[0]?.count || 0);

  for (const row of messageRows) {
    const count = Number(row.count || 0);
    const { day, direction, status } = row._id;
    if (direction === "outbound") {
      if (status !== "failed") {
        sent += count;
        if (dayMap.has(day)) dayMap.get(day).sent += count;
      }
      if (status === "delivered" || status === "read") {
        delivered += count;
        if (dayMap.has(day)) dayMap.get(day).delivered += count;
      }
      if (status === "read") read += count;
    } else if (direction === "inbound") {
      replied += count;
    }
  }

  const campaignDaily = new Map();
  for (const row of campaignDeliveryRows) {
    const key = row._id.day;
    if (!campaignDaily.has(key)) campaignDaily.set(key, []);
    campaignDaily.get(key).push(row);
  }
  const campaignTotals = campaignCountsFromRows(campaignDeliveryRows);
  sent = Math.max(sent, campaignTotals.sent);
  delivered = Math.max(delivered, campaignTotals.delivered);
  read = Math.max(read, campaignTotals.read);
  for (const [day, rows] of campaignDaily) {
    const dayCounts = campaignCountsFromRows(rows);
    if (!dayMap.has(day)) continue;
    const current = dayMap.get(day);
    current.sent = Math.max(current.sent, dayCounts.sent);
    current.delivered = Math.max(current.delivered, dayCounts.delivered);
  }

  const deliveryRate = sent ? Math.round((delivered / sent) * 1000) / 10 : 0;
  const readRate = sent ? Math.round((read / sent) * 1000) / 10 : 0;
  const replyRate = sent ? Math.round((replied / sent) * 1000) / 10 : 0;
  const failedRate = sent + failed ? Math.round((failed / (sent + failed)) * 1000) / 10 : 0;

  const recentCampaignCounts = await recentCampaignDeliveryCounts(recentCampaigns.map((campaign) => campaign._id));

  return {
    analytics: {
      range: "7d",
      series: days,
      totals: { sent, delivered, read, failed, replied, deliveryRate, readRate, replyRate, failedRate },
    },
    activeCampaigns,
    totalContacts,
    recentCampaigns: recentCampaigns.map((campaign) => visibleCampaign(campaign, recentCampaignCounts.get(campaign._id.toString()))),
    recentConversations: recentConversations.map((conversation) =>
      visibleConversation(conversation, accountMap.get(conversation.accountId.toString())),
    ),
  };
}
