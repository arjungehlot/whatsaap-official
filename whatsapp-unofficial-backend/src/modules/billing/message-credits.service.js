import { MessageCreditUsageModel } from "../../models/MessageCreditUsage.js";
import { PlanModel } from "../../models/Plan.js";
import { SubscriptionModel } from "../../models/Subscription.js";
import { UserModel } from "../../models/User.js";
import { ApiError } from "../../utils/apiError.js";

function periodKey(date, timezone, scope) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone || "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const day = `${values.year}-${values.month}-${values.day}`;
  return scope === "monthly" ? day.slice(0, 7) : day;
}

function trialDaysFor(subscription, plan) {
  const start = new Date(subscription.startDate).getTime();
  const end = new Date(subscription.expiryDate).getTime();
  if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
    return Math.max(1, Math.ceil((end - start) / (24 * 60 * 60 * 1000)));
  }
  return Math.max(1, Number(plan.trialDays) || 3);
}

function trialCreditLimit(dailyCredits, trialDays) {
  if (!dailyCredits) return 0;
  return dailyCredits * trialDays;
}

async function contextFor(userId, now = new Date()) {
  const [subscription, user] = await Promise.all([
    SubscriptionModel.findOne({ userId, status: "active", expiryDate: { $gt: now } }).sort({ expiryDate: -1 }).lean(),
    UserModel.findById(userId).select("timezone").lean(),
  ]);
  if (!subscription) throw new ApiError(403, "Your subscription is inactive or expired. Upgrade your plan to send messages.");
  const plan = await PlanModel.findById(subscription.planId).lean();
  if (!plan || plan.status !== "active") throw new ApiError(403, "Your plan is not available for sending messages");
  return { userId, subscription, plan, timezone: user?.timezone || "Asia/Kolkata", now };
}

function limitsFor(context) {
  const { plan, subscription } = context;
  if (plan.messageCreditsUnlimited !== false) return { unlimited: true, monthly: 0, daily: 0 };
  const daily = Math.max(0, Number(plan.dailyMessageCredits) || 0);
  const limits = {
    unlimited: false,
    monthly: subscription.isTrial ? 0 : Math.max(0, Number(plan.monthlyMessageCredits) || 0),
    daily,
    trial: subscription.isTrial ? trialCreditLimit(daily, trialDaysFor(subscription, plan)) : 0,
  };
  if (subscription.isTrial && !limits.daily) {
    throw new ApiError(500, "This trial plan needs a daily message credit limit. Ask an administrator to update the plan.");
  }
  if (!subscription.isTrial && !limits.monthly && !limits.daily) {
    throw new ApiError(500, "This plan has no message credit limit configured. Ask an administrator to update the plan.");
  }
  return limits;
}

async function getUsed(context, scope, key) {
  const usage = await MessageCreditUsageModel.findOne({ subscriptionId: context.subscription._id, scope, periodKey: key }).select("used").lean();
  return usage?.used || 0;
}

async function ensureUsageDocument(context, scope, key) {
  try {
    await MessageCreditUsageModel.updateOne(
      { subscriptionId: context.subscription._id, scope, periodKey: key },
      { $setOnInsert: { userId: context.userId, subscriptionId: context.subscription._id, scope, periodKey: key, used: 0 } },
      { upsert: true },
    );
  } catch (error) {
    if (error?.code !== 11000) throw error;
  }
}

async function reserveScope(context, scope, key, limit, count) {
  if (!limit) return null;
  await ensureUsageDocument(context, scope, key);
  const usage = await MessageCreditUsageModel.findOneAndUpdate(
    { subscriptionId: context.subscription._id, scope, periodKey: key, used: { $lte: limit - count } },
    { $inc: { used: count } },
    { returnDocument: "after" },
  );
  if (!usage) {
    const label = scope === "daily" ? "Daily" : scope === "trial" ? "Trial" : "Monthly";
    throw new ApiError(429, `${label} message credit limit reached`);
  }
  return { scope, key, count };
}

export async function getMessageCreditSummary(userId) {
  const context = await contextFor(userId);
  const limits = limitsFor(context);
  const monthKey = periodKey(context.now, context.timezone, "monthly");
  const dayKey = periodKey(context.now, context.timezone, "daily");
  const trialKey = `trial-${context.subscription._id}`;
  const [monthlyUsed, dailyUsed, trialUsed] = await Promise.all([
    limits.unlimited || !limits.monthly ? Promise.resolve(0) : getUsed(context, "monthly", monthKey),
    limits.unlimited || !limits.daily ? Promise.resolve(0) : getUsed(context, "daily", dayKey),
    limits.unlimited || !limits.trial ? Promise.resolve(0) : getUsed(context, "trial", trialKey),
  ]);
  const monthlyRemaining = limits.unlimited || !limits.monthly ? null : Math.max(0, limits.monthly - monthlyUsed);
  const dailyRemaining = limits.unlimited || !limits.daily ? null : Math.max(0, limits.daily - dailyUsed);
  const trialRemaining = limits.unlimited || !limits.trial ? null : Math.max(0, limits.trial - trialUsed);
  const boundedRemaining = [monthlyRemaining, dailyRemaining, trialRemaining].filter((value) => value !== null);
  const remaining = limits.unlimited || !boundedRemaining.length ? null : Math.min(...boundedRemaining);
  return {
    unlimited: limits.unlimited,
    remaining,
    timezone: context.timezone,
    monthly: { limit: limits.monthly || null, used: monthlyUsed, remaining: monthlyRemaining, period: monthKey },
    daily: { limit: limits.daily || null, used: dailyUsed, remaining: dailyRemaining, period: dayKey },
    trial: { limit: limits.trial || null, used: trialUsed, remaining: trialRemaining, period: limits.trial ? trialKey : null },
  };
}

export async function reserveMessageCredit(userId, count = 1) {
  if (!Number.isInteger(count) || count < 1) throw new ApiError(400, "Credit usage must be a positive whole number");
  const context = await contextFor(userId);
  const limits = limitsFor(context);
  if (limits.unlimited) return { unlimited: true, reservations: [] };
  const reservation = { unlimited: false, subscriptionId: context.subscription._id.toString(), reservations: [] };
  try {
    if (limits.monthly) reservation.reservations.push(await reserveScope(context, "monthly", periodKey(context.now, context.timezone, "monthly"), limits.monthly, count));
    if (limits.daily) reservation.reservations.push(await reserveScope(context, "daily", periodKey(context.now, context.timezone, "daily"), limits.daily, count));
    if (limits.trial) reservation.reservations.push(await reserveScope(context, "trial", `trial-${context.subscription._id}`, limits.trial, count));
    return reservation;
  } catch (error) {
    await releaseMessageCredit(reservation).catch(() => undefined);
    throw error;
  }
}

export async function releaseMessageCredit(reservation) {
  const rows = reservation?.reservations || [];
  await Promise.all(rows.map((row) => MessageCreditUsageModel.updateOne(
    { subscriptionId: reservation.subscriptionId, scope: row.scope, periodKey: row.key, used: { $gte: row.count } },
    { $inc: { used: -row.count } },
  )));
}

export async function sendWithMessageCredit(userId, send) {
  const reservation = await reserveMessageCredit(userId);
  try {
    return await send();
  } catch (error) {
    await releaseMessageCredit(reservation).catch(() => undefined);
    throw error;
  }
}
