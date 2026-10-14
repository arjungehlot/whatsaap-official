import { env } from "../../config/env.js";
import { ConnectionEventModel } from "../../models/ConnectionEvent.js";
import { WhatsAppAccountModel } from "../../models/WhatsAppAccount.js";
import { ApiError } from "../../utils/apiError.js";
import {
  disconnectWhatsAppSocket,
  hasManagedWhatsAppSocket,
  isWhatsAppSocketOpen,
  resumeWhatsAppSocket,
  startWhatsAppPairing,
} from "./whatsapp.engine.js";
import { getSendLimitSnapshot, normalizeSendSettings } from "./whatsapp.send-queue.js";
import { normalizeWhatsAppPhone, sameWhatsAppPhone } from "./whatsapp.phone.js";

async function addEvent(accountId, type, label, detail) {
  return ConnectionEventModel.create({
    accountId,
    at: new Date().toISOString(),
    type,
    label,
    detail,
  });
}

async function getUserAccount(userId, accountId) {
  const account = await WhatsAppAccountModel.findOne({ channelId: accountId, userId });

  if (!account) {
    throw new ApiError(404, "WhatsApp account not found");
  }

  return account;
}

async function visibleAccount(account) {
  const sendUsage = await getSendLimitSnapshot(account._id.toString(), account);

  return {
    id: account.channelId,
    channelId: account.channelId,
    state: account.state,
    phone: account.phone,
    connectionError: account.connectionError || undefined,
    displayName: account.displayName,
    accountType: account.accountType,
    lastConnectedAt: account.lastConnectedAt.toISOString(),
    lastSyncedAt: account.lastSyncedAt.toISOString(),
    uptime: account.uptime,
    messagesSentToday: account.messagesSentToday,
    device: account.device,
    sessionStatus: account.sessionStatus,
    sendSettings: sendUsage.settings,
    sendUsage: {
      lastHour: sendUsage.lastHour,
      last24h: sendUsage.last24h,
      warmup: sendUsage.warmup,
      hourlyCap: sendUsage.hourlyCap,
      dailyCap: sendUsage.dailyCap,
      hourlyRemaining: sendUsage.hourlyRemaining,
      dailyRemaining: sendUsage.dailyRemaining,
      maxHourlyCap: sendUsage.maxHourlyCap,
      maxDailyCap: sendUsage.maxDailyCap,
    },
  };
}

function visibleEvent(event, channelId) {
  return {
    id: event._id.toString(),
    accountId: channelId,
    channelId,
    at: event.at.toISOString(),
    type: event.type,
    label: event.label,
    detail: event.detail,
  };
}

export function getWhatsappLimit() {
  return env.maxWhatsappDevices;
}

async function reconcileAccountHealth(accounts) {
  const checks = accounts
    .filter((account) => account.state === "CONNECTED")
    .map(async (account) => {
      if (isWhatsAppSocketOpen(account._id)) return;

      if (hasManagedWhatsAppSocket(account._id)) {
        await WhatsAppAccountModel.findByIdAndUpdate(account._id, {
          state: "CONNECTING",
          sessionStatus: "stale",
        });
        return;
      }

      await resumeWhatsAppSocket(account);
    });

  await Promise.all(checks);
}

export async function listAccounts(userId) {
  const accounts = await WhatsAppAccountModel.find({ userId }).sort({ createdAt: 1 });
  await reconcileAccountHealth(accounts);

  const updatedAccounts = await WhatsAppAccountModel.find({ userId }).sort({ createdAt: 1 });
  return Promise.all(updatedAccounts.map(visibleAccount));
}

export async function listEvents(userId, accountId, options = {}) {
  let accountIds;

  if (accountId) {
    const account = await getUserAccount(userId, accountId);
    accountIds = [account._id];
  } else {
    const accounts = await WhatsAppAccountModel.find({ userId }).select("_id channelId");
    accountIds = accounts.map((account) => account._id);
  }

  const page = Math.max(Number(options.page) || 1, 1);
  const limit = Math.min(Math.max(Number(options.limit) || 10, 1), 50);
  const filter = { accountId: { $in: accountIds } };
  const [total, events] = await Promise.all([
    ConnectionEventModel.countDocuments(filter),
    ConnectionEventModel.find(filter)
      .sort({ at: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
  ]);

  const channelIdByAccountId = new Map(
    (await WhatsAppAccountModel.find({ _id: { $in: accountIds } }).select("_id channelId").lean())
      .map((account) => [account._id.toString(), account.channelId]),
  );

  return {
    events: events.map((event) => visibleEvent(event, channelIdByAccountId.get(event.accountId.toString()))),
    total,
    page,
    limit,
    pages: Math.max(Math.ceil(total / limit), 1),
  };
}

export async function createAccount(userId, payload) {
  const currentCount = await WhatsAppAccountModel.countDocuments({ userId });

  if (currentCount >= env.maxWhatsappDevices) {
    throw new ApiError(403, `You can connect up to ${env.maxWhatsappDevices} WhatsApp devices only`);
  }

  const slot = currentCount + 1;
  const phone = payload.phone || `+91 90000 ${String(10000 + slot).slice(-5)}`;
  const normalizedPhone = normalizeWhatsAppPhone(phone);
  const existingAccounts = await WhatsAppAccountModel.find({ userId }).select("_id phone normalizedPhone").lean();
  if (existingAccounts.some((account) => sameWhatsAppPhone(account.normalizedPhone || account.phone, phone))) {
    throw new ApiError(409, "This WhatsApp number already has a slot. Reconnect the existing slot instead of creating another one.");
  }

  const account = await WhatsAppAccountModel.create({
    userId,
    state: "DISCONNECTED",
    phone,
    normalizedPhone,
    displayName: payload.displayName || `WhatsApp Line ${slot}`,
    accountType: payload.accountType || "business",
    lastConnectedAt: new Date().toISOString(),
    lastSyncedAt: new Date().toISOString(),
    uptime: "0m",
    messagesSentToday: 0,
    device: { platform: "Awaiting link", appVersion: "-", battery: 0 },
    sessionStatus: "stale",
    sendSettings: normalizeSendSettings(payload.sendSettings),
  });

  await addEvent(account._id, "disconnected", "Slot created", "This number is ready for QR pairing");

  return visibleAccount(account);
}

export async function updateAccount(userId, accountId, payload) {
  const account = await getUserAccount(userId, accountId);

  if (payload.displayName !== undefined) account.displayName = payload.displayName;
  if (payload.sendSettings !== undefined) account.sendSettings = normalizeSendSettings(payload.sendSettings);
  await account.save();

  if (payload.displayName !== undefined) {
    await addEvent(account._id, "sync", "Display name updated", `Renamed to ${payload.displayName}`);
  }
  if (payload.sendSettings !== undefined) {
    await addEvent(account._id, "sync", "Send limits updated", "Outbound hourly, daily and delay limits were changed");
  }

  return visibleAccount(account);
}

export async function startPairing(userId, accountId) {
  const account = await getUserAccount(userId, accountId);

  account.state = "CONNECTING";
  account.sessionStatus = "stale";
  account.connectionError = undefined;
  await account.save();

  let pairingResult;

  try {
    pairingResult = await startWhatsAppPairing(account);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to start WhatsApp pairing";

    // A replacement QR request deliberately rejects the prior request. The newer
    // request owns the account state and must not be overwritten by this one.
    if (message === "WhatsApp connection attempt was cancelled.") {
      throw new ApiError(409, "This pairing attempt was cancelled. A fresh QR code is being generated.");
    }

    await WhatsAppAccountModel.findByIdAndUpdate(account._id, {
      state: "ERROR",
      uptime: "0m",
      sessionStatus: "expired",
    });
    await addEvent(account._id, "error", "QR pairing failed", message);

    throw new ApiError(502, message);
  }

  const { qrPayload, expiresIn } = pairingResult;
  const updatedAccount = await getUserAccount(userId, accountId);

  return { account: await visibleAccount(updatedAccount), qrPayload, expiresIn };
}

export async function restartPairing(userId, accountId) {
  const account = await getUserAccount(userId, accountId);

  await disconnectWhatsAppSocket(account._id);
  await addEvent(
    account._id,
    "disconnected",
    "Connection attempt cancelled",
    "The incomplete WhatsApp session was cleared. A fresh QR code is being generated.",
  );

  return startPairing(userId, accountId);
}

export async function disconnectAccount(userId, accountId) {
  const account = await getUserAccount(userId, accountId);

  await disconnectWhatsAppSocket(account._id);
  account.state = "DISCONNECTED";
  account.uptime = "0m";
  account.sessionStatus = "stale";
  account.connectionError = undefined;
  await account.save();
  await addEvent(account._id, "disconnected", "Device unlinked", "Sending is paused for this number");

  return visibleAccount(account);
}

export async function refreshAccount(userId, accountId) {
  const account = await getUserAccount(userId, accountId);

  if (account.state !== "CONNECTED") {
    throw new ApiError(409, "Only connected sessions can be refreshed");
  }

  account.lastSyncedAt = new Date();
  await account.save();
  await addEvent(account._id, "sync", "Session refreshed", "Latest device state was synced");

  return visibleAccount(account);
}
