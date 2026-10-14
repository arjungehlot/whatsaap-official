import { ApiKeyModel } from "../../models/ApiKey.js";
import { AutomationModel } from "../../models/Automation.js";
import { CampaignRecipientModel } from "../../models/CampaignRecipient.js";
import { CampaignModel } from "../../models/Campaign.js";
import { ConnectionEventModel } from "../../models/ConnectionEvent.js";
import { ContactModel } from "../../models/Contact.js";
import { FeatureModel } from "../../models/Feature.js";
import { InboxConversationModel } from "../../models/InboxConversation.js";
import { InboxMessageModel } from "../../models/InboxMessage.js";
import { MessageCreditUsageModel } from "../../models/MessageCreditUsage.js";
import { MessageJobRecipientModel } from "../../models/MessageJobRecipient.js";
import { MessageJobModel } from "../../models/MessageJob.js";
import { MessageTemplateModel } from "../../models/MessageTemplate.js";
import { OutboundMessageLogModel } from "../../models/OutboundMessageLog.js";
import { PaymentModel } from "../../models/Payment.js";
import { PlanFeatureModel } from "../../models/PlanFeature.js";
import { PlanModel } from "../../models/Plan.js";
import { SubscriptionModel } from "../../models/Subscription.js";
import { UserModel } from "../../models/User.js";
import { WebhookDeliveryModel } from "../../models/WebhookDelivery.js";
import { WebhookEndpointModel } from "../../models/WebhookEndpoint.js";
import { WhatsAppAccountModel } from "../../models/WhatsAppAccount.js";
import { WhatsAppAuthStateModel } from "../../models/WhatsAppAuthState.js";
import { WhatsAppPhoneClaimModel } from "../../models/WhatsAppPhoneClaim.js";
import { WhatsAppSendWindowModel } from "../../models/WhatsAppSendWindow.js";
import { env } from "../../config/env.js";
import { ApiError } from "../../utils/apiError.js";
import { normalizeInitialPaidPlanOrder } from "../billing/plan-order.service.js";
import { disconnectWhatsAppSocket } from "../whatsapp/whatsapp.engine.js";

const legacyPlans = new Set(["free", "starter", "professional", "business"]);

function featureValue(row) {
  if (row.valueType === "boolean") return row.booleanValue === true;
  if (row.valueType === "number") return row.numberValue ?? 0;
  if (row.valueType === "unlimited") return "unlimited";
  return row.textValue || "";
}

async function serializePlan(plan) {
  const rows = await PlanFeatureModel.find({ planId: plan._id }).populate("featureId").sort({ createdAt: 1 }).lean();
  return { id: plan._id.toString(), name: plan.name, slug: plan.slug, description: plan.description, monthlyPrice: plan.monthlyPrice, yearlyPrice: plan.yearlyPrice, currency: plan.currency, status: plan.status, visibility: plan.visibility, popular: plan.popular, isTrial: plan.isTrial, trialDays: plan.trialDays, messageCreditsUnlimited: plan.messageCreditsUnlimited !== false, monthlyMessageCredits: plan.monthlyMessageCredits || 0, dailyMessageCredits: plan.dailyMessageCredits || 0, displayOrder: plan.displayOrder, features: rows.filter((row) => row.featureId).map((row) => ({ id: row.featureId._id.toString(), key: row.featureId.key, name: row.featureId.name, description: row.featureId.description, valueType: row.valueType, value: featureValue(row) })) };
}

async function savePlanFeatures(planId, features = []) {
  const ids = features.map((item) => item.featureId);
  const definitions = await FeatureModel.find({ _id: { $in: ids } }).lean();
  if (definitions.length !== ids.length) throw new ApiError(400, "One or more selected features do not exist");
  await PlanFeatureModel.deleteMany({ planId });
  await PlanFeatureModel.insertMany(features.map((item) => ({ planId, ...item })));
}

export async function listAdminPlans() {
  await normalizeInitialPaidPlanOrder();
  const plans = await PlanModel.find().sort({ displayOrder: 1, createdAt: 1 });
  return Promise.all(plans.map(serializePlan));
}

export async function createAdminPlan(payload) {
  if (payload.isTrial && await PlanModel.exists({ isTrial: true })) throw new ApiError(409, "Only one trial plan is allowed");
  if (payload.isTrial && !payload.messageCreditsUnlimited && !payload.dailyMessageCredits) throw new ApiError(400, "Set a daily message credit limit for a trial plan, or select unlimited credits");
  const lastPlan = await PlanModel.findOne().sort({ displayOrder: -1 }).select("displayOrder").lean();
  const displayOrder = Math.max(Number(lastPlan?.displayOrder || 0), 0) + 1;
  const plan = await PlanModel.create(payload.isTrial ? { ...payload, monthlyMessageCredits: 0, displayOrder: -1 } : { ...payload, displayOrder });
  await savePlanFeatures(plan._id, payload.features);
  return serializePlan(plan);
}

export async function updateAdminPlan(id, payload) {
  const existing = await PlanModel.findById(id).lean();
  if (!existing) throw new ApiError(404, "Plan not found");
  if (existing.isTrial && payload.isTrial === false) throw new ApiError(400, "The automatic trial plan cannot be disabled");
  if (existing.isTrial && payload.trialDays !== undefined && payload.trialDays < 1) throw new ApiError(400, "Trial days must be at least 1");
  if (payload.isTrial && await PlanModel.exists({ isTrial: true, _id: { $ne: id } })) throw new ApiError(409, "Only one trial plan is allowed");
  const isTrial = payload.isTrial ?? existing.isTrial;
  const unlimitedCredits = payload.messageCreditsUnlimited ?? (existing.messageCreditsUnlimited !== false);
  const monthlyCredits = isTrial ? 0 : payload.monthlyMessageCredits ?? existing.monthlyMessageCredits ?? 0;
  const dailyCredits = payload.dailyMessageCredits ?? existing.dailyMessageCredits ?? 0;
  if (!unlimitedCredits && isTrial && !dailyCredits) {
    throw new ApiError(400, "Set a daily message credit limit for a trial plan, or select unlimited credits");
  }
  if (!unlimitedCredits && !isTrial && !monthlyCredits && !dailyCredits) {
    throw new ApiError(400, "Set a monthly or daily message credit limit, or select unlimited credits");
  }
  const plan = await PlanModel.findByIdAndUpdate(id, { $set: { ...Object.fromEntries(Object.entries(payload).filter(([key]) => key !== "features")), ...(isTrial ? { monthlyMessageCredits: 0 } : {}) } }, { returnDocument: "after", runValidators: true });
  if (!plan) throw new ApiError(404, "Plan not found");
  if (payload.features) await savePlanFeatures(plan._id, payload.features);
  return serializePlan(plan);
}

export async function duplicateAdminPlan(id, payload) {
  const source = await PlanModel.findById(id).lean();
  if (!source) throw new ApiError(404, "Plan not found");
  const sourceFeatures = await PlanFeatureModel.find({ planId: id }).lean();
  const lastPlan = await PlanModel.findOne().sort({ displayOrder: -1 }).select("displayOrder").lean();
  const plan = await PlanModel.create({ name: payload.name || `${source.name} copy`, slug: payload.slug || `${source.slug}-copy-${Date.now()}`, description: source.description, monthlyPrice: source.monthlyPrice, yearlyPrice: source.yearlyPrice, currency: source.currency, status: "inactive", visibility: source.visibility, popular: false, messageCreditsUnlimited: source.messageCreditsUnlimited !== false, monthlyMessageCredits: source.monthlyMessageCredits || 0, dailyMessageCredits: source.dailyMessageCredits || 0, displayOrder: Math.max(Number(lastPlan?.displayOrder || 0), 0) + 1 });
  await PlanFeatureModel.insertMany(sourceFeatures.map(({ _id, createdAt, updatedAt, planId: _planId, ...row }) => ({ ...row, planId: plan._id })));
  return serializePlan(plan);
}

export async function reorderAdminPlans(planIds) {
  const [plans, totalPlans] = await Promise.all([
    PlanModel.find({ _id: { $in: planIds } }).select("_id isTrial").lean(),
    PlanModel.countDocuments(),
  ]);
  if (plans.length !== totalPlans || plans.length !== planIds.length || new Set(planIds).size !== planIds.length) throw new ApiError(400, "Provide every plan exactly once");
  const trialId = plans.find((plan) => plan.isTrial)?._id.toString();
  if (trialId && planIds[0] !== trialId) throw new ApiError(400, "The free trial must remain first");
  await PlanModel.bulkWrite(planIds.map((id, index) => ({ updateOne: { filter: { _id: id }, update: { $set: { displayOrder: index } } } })));
  return listAdminPlans();
}

export async function deleteAdminPlan(id) {
  if (await SubscriptionModel.exists({ planId: id, status: { $in: ["active", "pending"] } })) throw new ApiError(409, "A plan with active subscriptions cannot be deleted");
  await PlanFeatureModel.deleteMany({ planId: id });
  const result = await PlanModel.deleteOne({ _id: id });
  if (!result.deletedCount) throw new ApiError(404, "Plan not found");
}

export async function listFeatures() { const rows = await FeatureModel.find().sort({ displayOrder: 1, name: 1 }).lean(); return rows.map((row) => ({ ...row, id: row._id.toString() })); }
export async function createFeature(payload) { return FeatureModel.create(payload); }
export async function updateFeature(id, payload) { const row = await FeatureModel.findByIdAndUpdate(id, { $set: payload }, { returnDocument: "after", runValidators: true }); if (!row) throw new ApiError(404, "Feature not found"); return row; }
export async function deleteFeature(id) { if (await PlanFeatureModel.exists({ featureId: id })) throw new ApiError(409, "Remove this feature from plans before deleting it"); const result = await FeatureModel.deleteOne({ _id: id }); if (!result.deletedCount) throw new ApiError(404, "Feature not found"); }

function subscriptionFor(userId, subscriptions) { return subscriptions.find((row) => row.userId.toString() === userId.toString() && row.status === "active" && row.expiryDate > new Date()); }

export async function listUsers(filters) {
  const page = filters.page; const limit = filters.limit; const query = {};
  if (filters.search) query.$or = [{ name: { $regex: filters.search, $options: "i" } }, { email: { $regex: filters.search, $options: "i" } }, { phone: { $regex: filters.search, $options: "i" } }];
  if (filters.accountStatus) query.accountStatus = filters.accountStatus;
  if (filters.plan || filters.subscriptionStatus || filters.billingCycle) {
    const subscriptionQuery = {};
    if (filters.subscriptionStatus) subscriptionQuery.status = filters.subscriptionStatus;
    if (filters.billingCycle) subscriptionQuery.billingCycle = filters.billingCycle;
    if (filters.plan) {
      const plan = await PlanModel.findOne({ $or: [{ slug: filters.plan }, { name: { $regex: filters.plan, $options: "i" } }] }).select("_id").lean();
      subscriptionQuery.planId = plan?._id || null;
    }
    const ids = await SubscriptionModel.find(subscriptionQuery).distinct("userId");
    query._id = { $in: ids };
  }
  const sort = ["name", "email", "createdAt", "lastActiveAt"].includes(filters.sort) ? filters.sort : "createdAt";
  const [users, total] = await Promise.all([UserModel.find(query).sort({ [sort]: filters.direction === "asc" ? 1 : -1 }).skip((page - 1) * limit).limit(limit).lean(), UserModel.countDocuments(query)]);
  const subs = await SubscriptionModel.find({ userId: { $in: users.map((user) => user._id) } }).populate("planId", "name slug").sort({ expiryDate: -1, startDate: -1 }).lean();
  const filtered = users.map((user) => { const subscription = subscriptionFor(user._id, subs); return { id: user._id.toString(), name: user.name, email: user.email, phone: user.phone, role: user.role, authProvider: user.authProvider || (user.googleId ? "google" : "local"), accountStatus: user.accountStatus || "active", plan: subscription?.planId?.name || user.plan || "-", planSlug: subscription?.planId?.slug || user.plan, billingCycle: subscription?.billingCycle, subscriptionStatus: subscription?.status || "none", planStartDate: subscription?.startDate, planExpiryDate: subscription?.expiryDate, registeredAt: user.createdAt, lastActiveAt: user.lastActiveAt }; });
  return { users: filtered, total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) };
}

export async function getUserDetails(id) {
  const user = await UserModel.findById(id).lean(); if (!user) throw new ApiError(404, "User not found");
  const [subscriptions, payments] = await Promise.all([SubscriptionModel.find({ userId: id }).populate("planId", "name slug").sort({ createdAt: -1 }).lean(), PaymentModel.find({ userId: id }).populate("planId", "name slug").sort({ createdAt: -1 }).lean()]);
  return { user: { ...user, id: user._id.toString() }, subscriptions, payments };
}

export async function updateUserStatus(id, accountStatus) { const user = await UserModel.findByIdAndUpdate(id, { $set: { accountStatus } }, { returnDocument: "after" }); if (!user) throw new ApiError(404, "User not found"); return { id: user._id.toString(), accountStatus: user.accountStatus }; }

export async function updateUserExpiry(userId, expiryDate) {
  const expiresAt = new Date(`${expiryDate}T23:59:59.999`);
  if (Number.isNaN(expiresAt.getTime())) throw new ApiError(400, "Expiry date is invalid");

  const subscription = await SubscriptionModel.findOne({ userId, status: { $in: ["active", "expired"] } })
    .sort({ expiryDate: -1, createdAt: -1 });
  if (!subscription) throw new ApiError(409, "Assign a plan before setting an expiry date");

  subscription.expiryDate = expiresAt;
  subscription.status = expiresAt > new Date() ? "active" : "expired";
  await subscription.save();
  return { id: subscription._id.toString(), expiryDate: subscription.expiryDate, status: subscription.status };
}

export async function deleteUserAccount(userId, actorUserId, confirmation) {
  const user = await UserModel.findById(userId).select("name email role").lean();
  if (!user) throw new ApiError(404, "User not found");
  if (user._id.toString() === actorUserId.toString()) throw new ApiError(400, "You cannot delete your own super-admin account");
  if (user.role === "super_admin" || env.superAdminEmails.includes(String(user.email).toLowerCase())) {
    throw new ApiError(403, "Configured super-admin accounts cannot be deleted here");
  }
  if (String(confirmation).trim().toLowerCase() !== String(user.email).toLowerCase()) {
    throw new ApiError(400, "Type the user's email exactly to confirm permanent deletion");
  }

  const [accounts, campaigns, jobs] = await Promise.all([
    WhatsAppAccountModel.find({ userId }).select("_id").lean(),
    CampaignModel.find({ userId }).select("_id").lean(),
    MessageJobModel.find({ userId }).select("_id").lean(),
  ]);
  const accountIds = accounts.map((account) => account._id);
  const campaignIds = campaigns.map((campaign) => campaign._id);
  const jobIds = jobs.map((job) => job._id);

  // Stop all active sockets before erasing their auth/session records and queued outbound work.
  await Promise.allSettled(accounts.map((account) => disconnectWhatsAppSocket(account._id)));

  await Promise.all([
    AutomationModel.updateMany({ userId }, { $set: { status: "paused" } }),
    CampaignModel.updateMany({ userId, status: { $in: ["scheduled", "running"] } }, { $set: { status: "paused" } }),
    MessageJobModel.updateMany({ userId, status: { $in: ["scheduled", "running"] } }, { $set: { status: "cancelled" } }),
  ]);

  await Promise.all([
    ApiKeyModel.deleteMany({ userId }),
    AutomationModel.deleteMany({ userId }),
    CampaignRecipientModel.deleteMany({ userId, ...(campaignIds.length ? { campaignId: { $in: campaignIds } } : {}) }),
    CampaignModel.deleteMany({ userId }),
    ConnectionEventModel.deleteMany(accountIds.length ? { accountId: { $in: accountIds } } : { _id: null }),
    ContactModel.deleteMany({ userId }),
    InboxConversationModel.deleteMany({ userId }),
    InboxMessageModel.deleteMany({ userId }),
    MessageCreditUsageModel.deleteMany({ userId }),
    MessageJobRecipientModel.deleteMany({ userId, ...(jobIds.length ? { jobId: { $in: jobIds } } : {}) }),
    MessageJobModel.deleteMany({ userId }),
    MessageTemplateModel.deleteMany({ userId }),
    OutboundMessageLogModel.deleteMany({ userId }),
    PaymentModel.deleteMany({ userId }),
    SubscriptionModel.deleteMany({ userId }),
    WebhookDeliveryModel.deleteMany({ userId }),
    WebhookEndpointModel.deleteMany({ userId }),
    WhatsAppAuthStateModel.deleteMany(accountIds.length ? { accountId: { $in: accountIds } } : { _id: null }),
    WhatsAppPhoneClaimModel.deleteMany({ $or: [{ userId }, ...(accountIds.length ? [{ accountId: { $in: accountIds } }] : [])] }),
    WhatsAppSendWindowModel.deleteMany(accountIds.length ? { accountId: { $in: accountIds } } : { _id: null }),
    WhatsAppAccountModel.deleteMany({ userId }),
  ]);

  await UserModel.deleteOne({ _id: userId });
  return { id: userId.toString(), email: user.email };
}

export async function assignUserPlan(userId, { planId, billingCycle, autoRenew }) {
  const [user, plan] = await Promise.all([UserModel.findById(userId), PlanModel.findOne({ _id: planId, status: "active" })]);
  if (!user || !plan) throw new ApiError(404, "User or active plan not found");
  await SubscriptionModel.updateMany({ userId, status: "active" }, { $set: { status: "cancelled", expiryDate: new Date() } });
  const startDate = new Date(); const expiryDate = new Date(startDate); if (plan.isTrial) expiryDate.setDate(expiryDate.getDate() + (plan.trialDays || 3)); else if (billingCycle === "monthly") expiryDate.setMonth(expiryDate.getMonth() + 1); else expiryDate.setFullYear(expiryDate.getFullYear() + 1);
  const subscription = await SubscriptionModel.create({ userId, planId, billingCycle, status: "active", startDate, expiryDate, autoRenew, isTrial: Boolean(plan.isTrial), planNameSnapshot: plan.name, amountSnapshot: plan.isTrial ? 0 : billingCycle === "monthly" ? plan.monthlyPrice : plan.yearlyPrice, currencySnapshot: plan.currency });
  if (legacyPlans.has(plan.slug)) { user.plan = plan.slug; await user.save(); }
  return subscription;
}

export async function listAdminSubscriptions(page, limit, status) { const query = status ? { status } : {}; const [rows, total] = await Promise.all([SubscriptionModel.find(query).populate("userId", "name email").populate("planId", "name slug").sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(), SubscriptionModel.countDocuments(query)]); return { subscriptions: rows, total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) }; }
export async function listAdminPayments(page, limit, status) { const query = status ? { status } : {}; const [rows, total] = await Promise.all([PaymentModel.find(query).populate("userId", "name email").populate("planId", "name slug").sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(), PaymentModel.countDocuments(query)]); return { payments: rows, total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) }; }
