import { randomUUID } from "node:crypto";
import { OutboundMessageLogModel } from "../../models/OutboundMessageLog.js";
import { WhatsAppAccountModel } from "../../models/WhatsAppAccount.js";
import { WhatsAppSendWindowModel } from "../../models/WhatsAppSendWindow.js";
import { env } from "../../config/env.js";
import { ApiError } from "../../utils/apiError.js";

/** Per-process queues preserve ordering while MongoDB owns shared send limits. */
const queues = new Map();

export const MAX_WHATSAPP_HOURLY_SEND_CAP = 250;
export const MAX_WHATSAPP_DAILY_SEND_CAP = 5000;
const MIN_DELAY_MS = 3000;
const MAX_DELAY_MS = 10 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

function randomBetween(min, max) {
  return Math.floor(min + Math.random() * (max - min));
}

function clampInt(value, fallback, min, max) {
  const next = Number(value);
  const whole = Number.isFinite(next) ? Math.round(next) : fallback;
  return Math.min(Math.max(whole, min), max);
}

export function normalizeSendSettings(settings = {}) {
  const hourlyCap = clampInt(settings.hourlyCap, env.whatsappHourlySendCap, 1, MAX_WHATSAPP_HOURLY_SEND_CAP);
  const warmupHourlyCap = clampInt(
    settings.warmupHourlyCap,
    env.whatsappWarmupHourlySendCap,
    1,
    MAX_WHATSAPP_HOURLY_SEND_CAP,
  );
  const dailyCap = clampInt(settings.dailyCap, env.whatsappDailySendCap, hourlyCap, MAX_WHATSAPP_DAILY_SEND_CAP);
  const warmupDailyCap = clampInt(
    settings.warmupDailyCap,
    env.whatsappWarmupDailySendCap,
    warmupHourlyCap,
    MAX_WHATSAPP_DAILY_SEND_CAP,
  );
  const minDelayMs = clampInt(settings.minDelayMs, env.whatsappSendMinDelayMs, MIN_DELAY_MS, MAX_DELAY_MS);
  const maxDelayMs = clampInt(settings.maxDelayMs, env.whatsappSendMaxDelayMs, minDelayMs, MAX_DELAY_MS);
  const warmupMinDelayMs = clampInt(settings.warmupMinDelayMs, env.whatsappWarmupMinDelayMs, MIN_DELAY_MS, MAX_DELAY_MS);
  const warmupMaxDelayMs = clampInt(
    settings.warmupMaxDelayMs,
    env.whatsappWarmupMaxDelayMs,
    warmupMinDelayMs,
    MAX_DELAY_MS,
  );

  return {
    hourlyCap,
    dailyCap,
    warmupHourlyCap,
    warmupDailyCap,
    minDelayMs,
    maxDelayMs,
    warmupMinDelayMs,
    warmupMaxDelayMs,
  };
}

function getEffectiveSendSettings(account) {
  const raw = account?.sendSettings?.toObject ? account.sendSettings.toObject() : account?.sendSettings;
  return normalizeSendSettings(raw || {});
}

function isWarmingUp(account) {
  if (!account?.lastConnectedAt) return true;
  return Date.now() - new Date(account.lastConnectedAt).getTime() < env.whatsappWarmupDays * DAY_MS;
}

function usageFromEvents(events = [], now = Date.now()) {
  const hourCutoff = now - HOUR_MS;
  const dayCutoff = now - DAY_MS;
  let lastHour = 0;
  let last24h = 0;

  for (const event of events) {
    const at = new Date(event.at).getTime();
    if (Number.isNaN(at) || at < dayCutoff) continue;
    last24h += 1;
    if (at >= hourCutoff) lastHour += 1;
  }

  return { lastHour, last24h };
}

async function ensureSendWindow(accountId) {
  const key = accountId.toString();
  const existing = await WhatsAppSendWindowModel.findOne({ accountId: key }).select("events").lean();
  if (existing) return existing;

  const historicalSends = await OutboundMessageLogModel.find({
    accountId: key,
    status: { $in: ["sent", "delivered", "read"] },
    sentAt: { $gte: new Date(Date.now() - DAY_MS) },
  })
    .select("sentAt")
    .lean();

  try {
    return await WhatsAppSendWindowModel.create({
      accountId: key,
      events: historicalSends.map((log) => ({ reservationId: randomUUID(), at: log.sentAt || new Date() })),
    });
  } catch (error) {
    if (error?.code !== 11000) throw error;
    return WhatsAppSendWindowModel.findOne({ accountId: key }).select("events").lean();
  }
}

async function getSendUsage(accountId) {
  const window = await ensureSendWindow(accountId);
  return usageFromEvents(window?.events);
}

/** Return the first rolling-window time at which one more send can be reserved. */
export async function getNextSendAvailability(accountId) {
  const account = await WhatsAppAccountModel.findById(accountId).select("lastConnectedAt sendSettings").lean();
  const window = await ensureSendWindow(accountId.toString());
  const settings = getEffectiveSendSettings(account);
  const warmup = isWarmingUp(account);
  const hourlyCap = warmup ? settings.warmupHourlyCap : settings.hourlyCap;
  const dailyCap = warmup ? settings.warmupDailyCap : settings.dailyCap;
  const now = Date.now();
  const hourCutoff = now - HOUR_MS;
  const dayCutoff = now - DAY_MS;
  const events = (window?.events || [])
    .map((event) => new Date(event.at).getTime())
    .filter((at) => Number.isFinite(at) && at >= dayCutoff)
    .sort((a, b) => a - b);
  const hourEvents = events.filter((at) => at >= hourCutoff);
  const candidates = [now];

  if (hourEvents.length >= hourlyCap) candidates.push(hourEvents[hourEvents.length - hourlyCap] + HOUR_MS);
  if (events.length >= dailyCap) candidates.push(events[events.length - dailyCap] + DAY_MS);

  return new Date(Math.max(...candidates) + 1000);
}

export async function getSendLimitSnapshot(accountId, account) {
  const usage = await getSendUsage(accountId.toString());
  const settings = getEffectiveSendSettings(account);
  const warmup = isWarmingUp(account);
  const hourlyCap = warmup ? settings.warmupHourlyCap : settings.hourlyCap;
  const dailyCap = warmup ? settings.warmupDailyCap : settings.dailyCap;

  return {
    ...usage,
    warmup,
    settings,
    hourlyCap,
    dailyCap,
    hourlyRemaining: Math.max(hourlyCap - usage.lastHour, 0),
    dailyRemaining: Math.max(dailyCap - usage.last24h, 0),
    maxHourlyCap: MAX_WHATSAPP_HOURLY_SEND_CAP,
    maxDailyCap: MAX_WHATSAPP_DAILY_SEND_CAP,
  };
}

function limitError(snapshot, requiredMessages = 1) {
  if (snapshot.lastHour + requiredMessages > snapshot.hourlyCap) {
    return new ApiError(
      429,
      `Hourly send limit reached for this WhatsApp number (${snapshot.hourlyCap}/hr). ${snapshot.hourlyRemaining} message slots remaining, ${requiredMessages} needed. Wait for the rolling hour window to free capacity.`,
    );
  }
  if (snapshot.last24h + requiredMessages > snapshot.dailyCap) {
    return new ApiError(
      429,
      `Daily send limit reached for this WhatsApp number (${snapshot.dailyCap}/day). ${snapshot.dailyRemaining} message slots remaining, ${requiredMessages} needed. Wait for the rolling 24-hour window to free capacity.`,
    );
  }
  return undefined;
}

async function checkCaps(accountId, account, requiredMessages = 1) {
  const snapshot = await getSendLimitSnapshot(accountId, account);
  const error = limitError(snapshot, requiredMessages);
  if (error) throw error;
  return snapshot;
}

function currentEventsExpression() {
  return { $ifNull: ["$events", []] };
}

function countEventsSinceExpression(cutoff) {
  return {
    $size: {
      $filter: {
        input: currentEventsExpression(),
        as: "event",
        cond: { $gte: ["$$event.at", cutoff] },
      },
    },
  };
}

async function reserveSendSlot(accountId, account) {
  const window = await ensureSendWindow(accountId);
  const snapshot = await checkCaps(accountId, account);
  const now = new Date();
  const hourCutoff = new Date(now.getTime() - HOUR_MS);
  const dayCutoff = new Date(now.getTime() - DAY_MS);
  const reservationId = randomUUID();
  const retainedEvents = {
    $filter: {
      input: currentEventsExpression(),
      as: "event",
      cond: { $gte: ["$$event.at", dayCutoff] },
    },
  };

  const reserved = await WhatsAppSendWindowModel.findOneAndUpdate(
    {
      _id: window._id,
      $expr: {
        $and: [
          { $lt: [countEventsSinceExpression(hourCutoff), snapshot.hourlyCap] },
          { $lt: [countEventsSinceExpression(dayCutoff), snapshot.dailyCap] },
        ],
      },
    },
    [
      {
        $set: {
          events: { $concatArrays: [retainedEvents, [{ reservationId, at: now }]] },
          updatedAt: now,
        },
      },
    ],
    { returnDocument: "after", updatePipeline: true },
  );

  if (reserved) return reservationId;

  const latest = await getSendLimitSnapshot(accountId, account);
  throw limitError(latest) || new ApiError(429, "This WhatsApp number has reached its send limit. Try again later.");
}

async function releaseSendSlot(accountId, reservationId) {
  await WhatsAppSendWindowModel.updateOne({ accountId }, { $pull: { events: { reservationId } } });
}

export async function assertWhatsAppSendCapacity(accountId, requiredMessages = 1) {
  if (requiredMessages <= 0) return;
  const account = await WhatsAppAccountModel.findById(accountId).select("lastConnectedAt sendSettings");
  await checkCaps(accountId.toString(), account, requiredMessages);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function processQueue(accountId, sendFn) {
  const state = queues.get(accountId);
  if (!state || state.processing) return;
  state.processing = true;

  try {
    while (state.queue.length > 0) {
      const job = state.queue.shift();
      let reservationId;

      try {
        const account = await WhatsAppAccountModel.findById(accountId).select("lastConnectedAt sendSettings");
        reservationId = await reserveSendSlot(accountId, account);
        await sleep(randomBetween(env.whatsappTypingMinDelayMs, env.whatsappTypingMaxDelayMs));

        const result = await sendFn(job.jid, job.payload, { warmup: isWarmingUp(account) });
        job.resolve(result);
      } catch (error) {
        if (reservationId) await releaseSendSlot(accountId, reservationId).catch(() => {});
        job.reject(error);
      }

      if (state.queue.length > 0) {
        const account = await WhatsAppAccountModel.findById(accountId).select("lastConnectedAt sendSettings");
        const settings = getEffectiveSendSettings(account);
        const [minDelay, maxDelay] = isWarmingUp(account)
          ? [settings.warmupMinDelayMs, settings.warmupMaxDelayMs]
          : [settings.minDelayMs, settings.maxDelayMs];
        await sleep(randomBetween(minDelay, maxDelay));
      }
    }
  } finally {
    state.processing = false;
    queues.delete(accountId);
  }
}

export function enqueueWhatsAppMessage(accountId, remoteJid, payload, sendFn) {
  const key = accountId.toString();

  return new Promise((resolve, reject) => {
    let state = queues.get(key);
    if (!state) {
      state = { queue: [], processing: false };
      queues.set(key, state);
    }

    state.queue.push({ jid: remoteJid, payload, resolve, reject });
    processQueue(key, sendFn);
  });
}

export function getQueueDepth(accountId) {
  return queues.get(accountId.toString())?.queue.length ?? 0;
}

export async function getSendStats(accountId) {
  return getSendUsage(accountId.toString());
}
