import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
} from "@whiskeysockets/baileys";
import P from "pino";
import { env } from "../../config/env.js";
import { ConnectionEventModel } from "../../models/ConnectionEvent.js";
import { WhatsAppAccountModel } from "../../models/WhatsAppAccount.js";
import { WhatsAppPhoneClaimModel } from "../../models/WhatsAppPhoneClaim.js";
import { ApiError } from "../../utils/apiError.js";
import { normalizeAttachmentMetadata } from "../../utils/attachment-media.js";
import {
  getStoredInboxGroupMetadata,
  markInboxGroupMetadataUnavailable,
  persistInboxGroupMetadata,
  updateInboxContactFromWhatsApp,
  upsertInboxMessageFromWhatsApp,
} from "../inbox/inbox.ingest.js";
import { applyWhatsAppMessageReceipts } from "../messages/message-status.service.js";
import { dispatchWebhookEvent } from "../webhooks/webhooks.service.js";
import { clearMongoAuthState, hasMongoAuthState, useMongoAuthState } from "./whatsapp.auth-store.js";
import { enqueueWhatsAppMessage } from "./whatsapp.send-queue.js";
import { normalizeWhatsAppPhone } from "./whatsapp.phone.js";

const activeSockets = new Map();
const pendingQrResolvers = new Map();
const reconnectTimers = new Map();
const intentionallyClosedSockets = new WeakSet();
const logger = P({ level: env.nodeEnv === "production" ? "info" : "warn" });
const MAX_RECONNECT_ATTEMPTS = 3;
const MAX_AUTO_RECONNECT_ATTEMPTS = 8;
const AUTO_RECONNECT_BASE_DELAY_MS = 5000;
const AUTO_RECONNECT_MAX_DELAY_MS = 5 * 60 * 1000;
const groupMetadataCache = new Map();
const groupMetadataRequests = new Map();
const groupMetadataRefreshTails = new Map();
const groupMetadataLastRequestAt = new Map();
const GROUP_METADATA_TTL_MS = 5 * 60 * 1000;
const GROUP_METADATA_UNAVAILABLE_TTL_MS = 60 * 60 * 1000;
const GROUP_METADATA_RATE_LIMIT_TTL_MS = 15 * 60 * 1000;
const GROUP_METADATA_ERROR_TTL_MS = 2 * 60 * 1000;
const GROUP_METADATA_AUTO_REFRESH_GAP_MS = 1500;
const DUPLICATE_PHONE_MESSAGE =
  "This WhatsApp number is already connected to another WAFlow account. Disconnect it there before linking it here.";

async function getCachedGroupMetadata(sock, accountId, remoteJid, options = {}) {
  const cacheKey = `${accountId}:${remoteJid}`;
  const cached = groupMetadataCache.get(cacheKey);
  if (!options.force && cached && cached.expiresAt > Date.now()) return cached.metadata;

  const existingRequest = groupMetadataRequests.get(cacheKey);
  if (existingRequest) return existingRequest;

  const request = (async () => {
    if (!options.force) {
      try {
        const stored = await getStoredInboxGroupMetadata(accountId, remoteJid);
        const retryAfter = stored.retryAfter ? new Date(stored.retryAfter).getTime() : 0;
        if (retryAfter > Date.now()) {
          groupMetadataCache.set(cacheKey, { metadata: null, expiresAt: retryAfter });
          return null;
        }

        const fetchedAt = stored.fetchedAt ? new Date(stored.fetchedAt).getTime() : 0;
        if (stored.metadata && fetchedAt + GROUP_METADATA_TTL_MS > Date.now()) {
          groupMetadataCache.set(cacheKey, { metadata: stored.metadata, expiresAt: fetchedAt + GROUP_METADATA_TTL_MS });
          return stored.metadata;
        }
      } catch (error) {
        logger.debug({ accountId, remoteJid, error }, "Could not read cached WhatsApp group metadata");
      }
    }

    try {
      const metadata = await sock.groupMetadata(remoteJid);
      groupMetadataCache.set(cacheKey, { metadata, expiresAt: Date.now() + GROUP_METADATA_TTL_MS });
      await persistInboxGroupMetadata(accountId, remoteJid, metadata).catch((error) => {
        logger.warn({ accountId, remoteJid, error }, "Could not persist WhatsApp group metadata");
      });
      return metadata;
    } catch (error) {
      const statusCode = Number(error?.data || error?.output?.statusCode || error?.statusCode || 0);
      const cooldownMs = statusCode === 429
        ? GROUP_METADATA_RATE_LIMIT_TTL_MS
        : [403, 404].includes(statusCode)
          ? GROUP_METADATA_UNAVAILABLE_TTL_MS
          : GROUP_METADATA_ERROR_TTL_MS;

      // Missing or inaccessible groups are expected in synced history. Avoid repeatedly querying WhatsApp for them.
      groupMetadataCache.set(cacheKey, { metadata: null, expiresAt: Date.now() + cooldownMs });
      await markInboxGroupMetadataUnavailable(accountId, remoteJid, new Date(Date.now() + cooldownMs)).catch((cacheError) => {
        logger.warn({ accountId, remoteJid, error: cacheError }, "Could not persist WhatsApp group metadata cooldown");
      });
      logger.debug({ remoteJid, statusCode, cooldownMs }, "WhatsApp group metadata unavailable");
      return null;
    }
  })().finally(() => {
      groupMetadataRequests.delete(cacheKey);
    });

  groupMetadataRequests.set(cacheKey, request);
  return request;
}

function cachedGroupMetadataForMessage(accountId, remoteJid) {
  const cached = groupMetadataCache.get(`${accountId}:${remoteJid}`);
  if (!cached || cached.expiresAt <= Date.now()) return { hit: false, metadata: null };
  return { hit: true, metadata: cached.metadata };
}

function queueGroupMetadataRefresh(sock, accountId, remoteJid) {
  const accountKey = accountId.toString();
  const previous = groupMetadataRefreshTails.get(accountKey) || Promise.resolve();
  const task = previous
    .catch(() => undefined)
    .then(async () => {
      const waitMs = Math.max(0, (groupMetadataLastRequestAt.get(accountKey) || 0) + GROUP_METADATA_AUTO_REFRESH_GAP_MS - Date.now());
      if (waitMs) await new Promise((resolve) => setTimeout(resolve, waitMs));
      groupMetadataLastRequestAt.set(accountKey, Date.now());
      return getCachedGroupMetadata(sock, accountKey, remoteJid);
    });

  groupMetadataRefreshTails.set(accountKey, task);
  void task.finally(() => {
    if (groupMetadataRefreshTails.get(accountKey) === task) groupMetadataRefreshTails.delete(accountKey);
  });
  return task;
}

function clearGroupMetadataCache(accountId) {
  const accountKey = `${accountId}:`;
  for (const cacheKey of groupMetadataCache.keys()) {
    if (cacheKey.startsWith(accountKey)) groupMetadataCache.delete(cacheKey);
  }
  groupMetadataRefreshTails.delete(accountId.toString());
  groupMetadataLastRequestAt.delete(accountId.toString());
}

function withTimeout(promise, label, timeoutMs, message) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return promise;

  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      reject(new ApiError(504, message || `${label} timed out after ${Math.round(timeoutMs / 1000)} seconds`));
    }, timeoutMs);
  });

  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function withSendTimeout(promise, label) {
  return withTimeout(promise, label, env.whatsappMessageSendTimeoutMs);
}

function groupOperationTimeoutMs(participantCount = 0) {
  const baseTimeoutMs = Number.isFinite(env.whatsappGroupOperationTimeoutMs) && env.whatsappGroupOperationTimeoutMs > 0
    ? env.whatsappGroupOperationTimeoutMs
    : 15000;
  // A group change is one WhatsApp request, but larger member lists take longer for WhatsApp to validate.
  return Math.min(60000, baseTimeoutMs + Math.ceil(Math.max(0, participantCount) / 50) * 4000);
}

function withGroupOperationTimeout(promise, label, participantCount = 0) {
  const timeoutMs = groupOperationTimeoutMs(participantCount);
  const seconds = Math.round(timeoutMs / 1000);
  return withTimeout(
    promise,
    label,
    timeoutMs,
    `WhatsApp did not confirm this group operation within ${seconds} seconds. Check that the selected number is connected and every participant is a real WhatsApp user, then try again.`,
  );
}

async function addEvent(accountId, type, label, detail) {
  await ConnectionEventModel.create({
    accountId,
    at: new Date(),
    type,
    label,
    detail,
  });
}

function getDisconnectStatusCode(update) {
  return update.lastDisconnect?.error?.output?.statusCode;
}

function getDisconnectMessage(update) {
  const error = update.lastDisconnect?.error;
  const statusCode = getDisconnectStatusCode(update);
  const reason = DisconnectReason[statusCode] || "unknown";
  const message = error?.message || "WhatsApp connection closed";

  return `${message} (${reason}${statusCode ? ` ${statusCode}` : ""})`;
}

async function clearSession(accountId) {
  await clearMongoAuthState(accountId);
}

function isDuplicateKeyError(error) {
  return error?.code === 11000;
}

async function claimWhatsAppPhone(account, normalizedPhone) {
  const existingClaim = await WhatsAppPhoneClaimModel.findOne({ normalizedPhone }).select("_id accountId").lean();
  if (existingClaim) {
    if (existingClaim.accountId.toString() === account._id.toString()) return true;

    const claimedAccount = await WhatsAppAccountModel.findById(existingClaim.accountId).select("state").lean();
    if (claimedAccount?.state === "CONNECTED") return false;

    const replacement = await WhatsAppPhoneClaimModel.updateOne(
      { _id: existingClaim._id, accountId: existingClaim.accountId },
      { $set: { accountId: account._id, userId: account.userId } },
    );
    if (replacement.modifiedCount === 1) return true;

    const winningClaim = await WhatsAppPhoneClaimModel.findOne({ normalizedPhone }).select("accountId").lean();
    return winningClaim?.accountId?.toString() === account._id.toString();
  }

  try {
    await WhatsAppPhoneClaimModel.create({
      normalizedPhone,
      accountId: account._id,
      userId: account.userId,
    });
    return true;
  } catch (error) {
    if (!isDuplicateKeyError(error)) throw error;

    const winningClaim = await WhatsAppPhoneClaimModel.findOne({ normalizedPhone }).select("accountId").lean();
    return winningClaim?.accountId?.toString() === account._id.toString();
  }
}

async function releaseWhatsAppPhoneClaim(accountId) {
  await WhatsAppPhoneClaimModel.deleteMany({ accountId });
}

async function reconcileConnectedPhoneOwnership() {
  const accounts = await WhatsAppAccountModel.find({ state: "CONNECTED" })
    .sort({ lastConnectedAt: -1, updatedAt: -1, _id: -1 })
    .select("_id userId phone normalizedPhone lastConnectedAt updatedAt")
    .lean();
  const owners = new Map();
  const duplicates = [];

  for (const account of accounts) {
    const normalizedPhone = normalizeWhatsAppPhone(account.normalizedPhone || account.phone);
    if (!normalizedPhone) continue;

    if (owners.has(normalizedPhone)) {
      duplicates.push({ account, normalizedPhone, owner: owners.get(normalizedPhone) });
    } else {
      owners.set(normalizedPhone, { ...account, normalizedPhone });
    }
  }

  const ownerIds = [...owners.values()].map((owner) => owner._id);
  await WhatsAppPhoneClaimModel.deleteMany({ accountId: { $nin: ownerIds } });

  for (const owner of owners.values()) {
    await WhatsAppPhoneClaimModel.updateOne(
      { normalizedPhone: owner.normalizedPhone },
      { $set: { accountId: owner._id, userId: owner.userId } },
      { upsert: true },
    );
  }

  for (const duplicate of duplicates) {
    await clearSession(duplicate.account._id);
    await WhatsAppAccountModel.findByIdAndUpdate(duplicate.account._id, {
      state: "ERROR",
      uptime: "0m",
      sessionStatus: "expired",
      connectionError: DUPLICATE_PHONE_MESSAGE,
    });
    await addEvent(duplicate.account._id, "error", "Duplicate WhatsApp number", DUPLICATE_PHONE_MESSAGE);
  }

  return { owners: owners.size, duplicates: duplicates.length };
}

function waitForQr(accountId) {
  const existing = pendingQrResolvers.get(accountId);
  if (existing) {
    existing.reject(new Error("A new QR request was started for this WhatsApp slot."));
  }

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pendingQrResolvers.delete(accountId);
      reject(new Error("WhatsApp did not return a QR code in time. Please try again."));
    }, 30000);

    pendingQrResolvers.set(accountId, {
      resolve(qrPayload) {
        clearTimeout(timeout);
        pendingQrResolvers.delete(accountId);
        resolve(qrPayload);
      },
      reject(error) {
        clearTimeout(timeout);
        pendingQrResolvers.delete(accountId);
        reject(error);
      },
    });
  });
}

async function updateConnectedAccount(accountId, sock) {
  const phone = sock.user?.id ? `+${sock.user.id.split("@")[0].split(":")[0]}` : undefined;
  const normalizedPhone = normalizeWhatsAppPhone(phone);
  const account = await WhatsAppAccountModel.findById(accountId).select("_id userId inboxPhone inboxVisibleSince");

  if (!account) return false;

  if (!normalizedPhone) {
    await WhatsAppAccountModel.findByIdAndUpdate(accountId, {
      state: "ERROR",
      phone,
      normalizedPhone,
      uptime: "0m",
      sessionStatus: "expired",
      connectionError: "WhatsApp did not provide a valid phone number for this connection. Scan the QR code again.",
    });
    await addEvent(
      accountId,
      "error",
      "Linked phone unavailable",
      "WhatsApp did not provide a valid phone number for this connection. Scan the QR code again.",
    );
    await sock.logout().catch(() => undefined);
    await clearSession(accountId);
    activeSockets.delete(accountId);
    return false;
  }

  const hasPhoneClaim = await claimWhatsAppPhone(account, normalizedPhone);
  if (!hasPhoneClaim) {
    await WhatsAppAccountModel.findByIdAndUpdate(accountId, {
      state: "ERROR",
      phone,
      normalizedPhone,
      uptime: "0m",
      sessionStatus: "expired",
      connectionError: DUPLICATE_PHONE_MESSAGE,
    });
    await addEvent(accountId, "error", "Duplicate WhatsApp number", DUPLICATE_PHONE_MESSAGE);
    await sock.logout().catch(() => undefined);
    await clearSession(accountId);
    activeSockets.delete(accountId);
    return false;
  }

  const numberChanged = Boolean(account.inboxPhone && account.inboxPhone !== normalizedPhone);
  const connectedAt = new Date();

  await WhatsAppAccountModel.findByIdAndUpdate(accountId, {
    $set: {
      state: "CONNECTED",
      phone,
      normalizedPhone,
      inboxPhone: normalizedPhone,
      ...(numberChanged ? { inboxVisibleSince: connectedAt } : {}),
      lastConnectedAt: connectedAt,
      lastSyncedAt: connectedAt,
      uptime: "Just connected",
      sessionStatus: "active",
      device: { platform: "WhatsApp Web", appVersion: "Baileys", battery: 100 },
    },
    $unset: { connectionError: 1 },
  });
  await addEvent(accountId, "connected", "Device linked", "WhatsApp session connected successfully");
  void dispatchWebhookEvent(account.userId, "session.connected", {
    account_id: account.channelId,
    channel_id: account.channelId,
    phone,
  }).catch(() => {});
  return true;
}

async function updateDisconnectedAccount(accountId, update) {
  const statusCode = getDisconnectStatusCode(update);
  const loggedOut = statusCode === DisconnectReason.loggedOut;
  const detail = getDisconnectMessage(update);
  const existingAccount = await WhatsAppAccountModel.findById(accountId).select("connectionError").lean();
  const rejectedDuplicate = existingAccount?.connectionError === DUPLICATE_PHONE_MESSAGE;

  const account = await WhatsAppAccountModel.findByIdAndUpdate(accountId, {
    state: rejectedDuplicate ? "ERROR" : loggedOut ? "DISCONNECTED" : "SESSION_EXPIRED",
    uptime: "0m",
    sessionStatus: rejectedDuplicate || !loggedOut ? "expired" : "stale",
  }).select("_id userId channelId phone");

  if (rejectedDuplicate) return;

  await addEvent(
    accountId,
    loggedOut ? "disconnected" : "error",
    loggedOut ? "Device logged out" : "Connection closed",
    loggedOut
      ? "The WhatsApp device was logged out"
      : detail,
  );
  if (account && loggedOut) {
    await releaseWhatsAppPhoneClaim(accountId);
    await clearSession(accountId);
    void dispatchWebhookEvent(account.userId, "session.disconnected", {
      account_id: account.channelId,
      channel_id: account.channelId,
      phone: account.phone,
      reason: detail,
    }).catch(() => {});
  }
}

function shouldReconnectAfterClose(update, reconnectAttempt) {
  const statusCode = getDisconnectStatusCode(update);
  return statusCode === DisconnectReason.restartRequired && reconnectAttempt < MAX_RECONNECT_ATTEMPTS;
}

function shouldAutoReconnect(update, options) {
  const statusCode = getDisconnectStatusCode(update);
  return (
    options.allowAutoReconnect &&
    !options.intentionalClose &&
    statusCode !== DisconnectReason.loggedOut &&
    // WhatsApp explicitly replaced this linked-device session. Retrying it can
    // fight the newer session and cause a reconnect loop.
    statusCode !== DisconnectReason.connectionReplaced
  );
}

function getReconnectDelay(attempt) {
  return Math.min(AUTO_RECONNECT_BASE_DELAY_MS * 2 ** Math.max(attempt - 1, 0), AUTO_RECONNECT_MAX_DELAY_MS);
}

function clearReconnectTimer(accountId) {
  const key = accountId.toString();
  const timer = reconnectTimers.get(key);

  if (timer) {
    clearTimeout(timer);
    reconnectTimers.delete(key);
  }
}

async function markAccountReconnecting(accountId, attempt, detail) {
  await WhatsAppAccountModel.findByIdAndUpdate(accountId, {
    state: "CONNECTING",
    uptime: "0m",
    sessionStatus: "stale",
  });
  await addEvent(
    accountId,
    "sync",
    "Auto reconnect scheduled",
    `Attempt ${attempt}/${MAX_AUTO_RECONNECT_ATTEMPTS}. ${detail}`,
  );
}

async function scheduleAutoReconnect(accountId, update, attempt = 1) {
  const key = accountId.toString();

  clearReconnectTimer(key);

  const hasAuth = await hasMongoAuthState(key);
  if (!hasAuth) {
    await WhatsAppAccountModel.findByIdAndUpdate(key, {
      state: "SESSION_EXPIRED",
      uptime: "0m",
      sessionStatus: "expired",
    });
    await addEvent(key, "error", "Session auth missing", "Reconnect this WhatsApp number with a fresh QR code");
    return;
  }

  if (attempt > MAX_AUTO_RECONNECT_ATTEMPTS) {
    await WhatsAppAccountModel.findByIdAndUpdate(key, {
      state: "SESSION_EXPIRED",
      uptime: "0m",
      sessionStatus: "expired",
    });
    await addEvent(
      key,
      "error",
      "Auto reconnect stopped",
      "WhatsApp did not reconnect after multiple attempts. Generate a fresh QR code.",
    );
    return;
  }

  const delayMs = getReconnectDelay(attempt);
  const detail = getDisconnectMessage(update);
  await markAccountReconnecting(key, attempt, detail);

  const timer = setTimeout(async () => {
    reconnectTimers.delete(key);

    try {
      const account = await WhatsAppAccountModel.findById(key);
      if (!account || account.state === "DISCONNECTED" || account.state === "QR_REQUIRED") return;

      await createSocket(account, { autoReconnectAttempt: attempt });
    } catch (error) {
      await scheduleAutoReconnect(key, { lastDisconnect: { error } }, attempt + 1);
    }
  }, delayMs);

  reconnectTimers.set(key, timer);
}

export function hasManagedWhatsAppSocket(accountId) {
  return activeSockets.has(accountId.toString());
}

export function isWhatsAppSocketOpen(accountId) {
  return Boolean(activeSockets.get(accountId.toString())?.ws?.isOpen);
}

async function createSocket(account, options = {}) {
  const accountId = account._id.toString();
  const reconnectAttempt = options.reconnectAttempt || 0;
  const autoReconnectAttempt = options.autoReconnectAttempt || 0;
  let allowAutoReconnect = !options.pairingMode;
  const existing = activeSockets.get(accountId);

  clearReconnectTimer(accountId);

  if (existing) {
    existing.ev.removeAllListeners("connection.update");
    existing.ev.removeAllListeners("creds.update");
    existing.ev.removeAllListeners("messages.upsert");
    existing.ev.removeAllListeners("messages.update");
    existing.ev.removeAllListeners("contacts.update");
    existing.ws?.close?.();
    activeSockets.delete(accountId);
  }

  if (options.freshSession) {
    await clearSession(accountId);
  }

  const { state, saveCreds } = await useMongoAuthState(accountId);
  await saveCreds();
  const { version } = await fetchLatestBaileysVersion();
  const sock = makeWASocket({
    auth: state,
    browser: ["WAFlow", "Chrome", "1.0.0"],
    logger,
    printQRInTerminal: false,
    version,
    syncFullHistory: false,
  });

  sock.ev.on("creds.update", saveCreds);
  sock.ev.on("contacts.update", async (contacts) => {
    try {
      const latestAccount = await WhatsAppAccountModel.findById(accountId).select("_id userId state phone");
      if (!latestAccount) return;

      await Promise.all(contacts.map((contact) => updateInboxContactFromWhatsApp(latestAccount, contact)));
    } catch (error) {
      logger.warn({ error, accountId }, "Failed to update WhatsApp inbox contact");
    }
  });
  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    try {
      // Bulk WhatsApp history uses append events. The inbox intentionally stores
      // only new live messages for the currently linked number.
      if (type !== "notify") return;
      const latestAccount = await WhatsAppAccountModel.findById(accountId).select("_id userId state phone");
      if (!latestAccount || latestAccount.state !== "CONNECTED") return;

      await Promise.all(messages.map(async (message) => {
        const remoteJid = message.key?.remoteJid;
        if (!remoteJid?.endsWith("@g.us")) {
          return upsertInboxMessageFromWhatsApp(latestAccount, message);
        }

        // Never hold a live group message behind a metadata query. Persist it first, then refresh details safely.
        const cached = cachedGroupMetadataForMessage(accountId, remoteJid);
        const conversation = await upsertInboxMessageFromWhatsApp(latestAccount, message, cached.metadata);
        if (!cached.hit) void queueGroupMetadataRefresh(sock, accountId, remoteJid);
        return conversation;
      }));
    } catch (error) {
      logger.warn({ error, accountId }, "Failed to persist WhatsApp inbox message");
    }
  });
  sock.ev.on("messages.update", async (updates) => {
    try {
      const latestAccount = await WhatsAppAccountModel.findById(accountId).select("_id userId state");
      if (!latestAccount || latestAccount.state !== "CONNECTED") return;
      await applyWhatsAppMessageReceipts(latestAccount, updates);
    } catch (error) {
      logger.warn({ error, accountId }, "Failed to persist WhatsApp delivery receipt");
    }
  });
  sock.ev.on("connection.update", async (update) => {
    try {
      // Ignore late lifecycle events from a socket that has already been replaced.
      if (activeSockets.get(accountId) !== sock) return;

      if (update.qr) {
        await WhatsAppAccountModel.findByIdAndUpdate(accountId, {
          state: "QR_REQUIRED",
          sessionStatus: "stale",
        });
        await addEvent(accountId, "qr", "QR generated", "Scan this QR from WhatsApp linked devices");
        pendingQrResolvers.get(accountId)?.resolve(update.qr);
      }

      if (update.connection === "open") {
        allowAutoReconnect = true;
        const connected = await updateConnectedAccount(accountId, sock);
        if (connected) {
          // Loaded dynamically to keep the socket engine independent from outbound delivery persistence.
          void import("../messages/message-dispatch.service.js")
            .then(({ dispatchPendingOutboundMessages }) => dispatchPendingOutboundMessages(accountId))
            .catch((error) => logger.warn({ accountId, error }, "Could not resume pending outbound messages"));
        }
      }

      if (update.connection === "close") {
        // A cancelled/replaced socket can emit its close event after a fresh socket is active.
        // Only the socket that is still current may change account connection state.
        if (activeSockets.get(accountId) === sock) {
          activeSockets.delete(accountId);
        }

        if (intentionallyClosedSockets.has(sock)) return;

        const pendingQr = pendingQrResolvers.get(accountId);

        if (pendingQr) {
          const detail = getDisconnectMessage(update);
          await WhatsAppAccountModel.findByIdAndUpdate(accountId, {
            state: "ERROR",
            uptime: "0m",
            sessionStatus: "expired",
          });
          pendingQr.reject(new Error(`WhatsApp closed before QR was generated: ${detail}`));
          return;
        }

        if (shouldReconnectAfterClose(update, reconnectAttempt)) {
          const nextAttempt = reconnectAttempt + 1;

          await WhatsAppAccountModel.findByIdAndUpdate(accountId, {
            state: "CONNECTING",
            sessionStatus: "stale",
          });
          await addEvent(
            accountId,
            "sync",
            "Completing WhatsApp login",
            `WhatsApp accepted the QR scan and requested a reconnect (${nextAttempt}/${MAX_RECONNECT_ATTEMPTS})`,
          );

          const latestAccount = await WhatsAppAccountModel.findById(accountId);
          if (latestAccount) {
            await createSocket(latestAccount, { reconnectAttempt: nextAttempt });
          }
          return;
        }

        if (shouldAutoReconnect(update, { ...options, allowAutoReconnect })) {
          await scheduleAutoReconnect(accountId, update, autoReconnectAttempt + 1);
          return;
        }

        await updateDisconnectedAccount(accountId, update);
      }
    } catch (error) {
      pendingQrResolvers.get(accountId)?.reject(error);
    }
  });

  activeSockets.set(accountId, sock);
  return sock;
}

export async function startWhatsAppPairing(account) {
  const accountId = account._id.toString();
  const qrPromise = waitForQr(accountId);

  try {
    await createSocket(account, { freshSession: true, pairingMode: true });
  } catch (error) {
    pendingQrResolvers.get(accountId)?.reject(error);
    throw error;
  }

  const qrPayload = await qrPromise;
  return { qrPayload, expiresIn: 45 };
}

async function sendRawWhatsAppTextMessage(accountId, remoteJid, body) {
  const sock = activeSockets.get(accountId.toString());

  if (!sock?.ws?.isOpen) {
    throw new ApiError(409, "This WhatsApp number is not connected. Reconnect it before sending messages.");
  }

  try {
    await sock.presenceSubscribe(remoteJid);
    await sock.sendPresenceUpdate("composing", remoteJid);
  } catch (_error) {
    // Presence is best-effort; sending should not fail just because typing state failed.
  }

  try {
    return await withSendTimeout(sock.sendMessage(remoteJid, { text: body }), "WhatsApp text message send");
  } finally {
    sock.sendPresenceUpdate("paused", remoteJid).catch(() => undefined);
  }
}

async function sendRawWhatsAppMediaMessage(accountId, remoteJid, message) {
  const sock = activeSockets.get(accountId.toString());

  if (!sock?.ws?.isOpen) {
    throw new ApiError(409, "This WhatsApp number is not connected. Reconnect it before sending messages.");
  }

  try {
    await sock.presenceSubscribe(remoteJid);
    await sock.sendPresenceUpdate("composing", remoteJid);
  } catch (_error) {
    // Presence is best-effort; sending should not fail just because typing state failed.
  }

  const caption = message.body || undefined;
  const media = Buffer.isBuffer(message.buffer) ? message.buffer : Buffer.from(message.buffer);
  const metadata = normalizeAttachmentMetadata({
    mimeType: message.mimeType,
    fileName: message.fileName || message.name,
    buffer: media,
  });

  try {
    if (metadata.kind === "image") {
      return await withSendTimeout(
        sock.sendMessage(remoteJid, { image: media, mimetype: metadata.mimeType, caption }),
        "WhatsApp image message send",
      );
    }
    if (metadata.kind === "video") {
      return await withSendTimeout(
        sock.sendMessage(remoteJid, { video: media, mimetype: metadata.mimeType, caption }),
        "WhatsApp video message send",
      );
    }
    return await withSendTimeout(
      sock.sendMessage(remoteJid, {
        document: media,
        mimetype: metadata.mimeType,
        fileName: metadata.fileName,
      }),
      "WhatsApp document message send",
    );
  } finally {
    sock.sendPresenceUpdate("paused", remoteJid).catch(() => undefined);
  }
}

async function sendRawWhatsAppButtonMessage(accountId, remoteJid, message) {
  const sock = activeSockets.get(accountId.toString());

  if (!sock?.ws?.isOpen) {
    throw new ApiError(409, "This WhatsApp number is not connected. Reconnect it before sending messages.");
  }

  try {
    await sock.presenceSubscribe(remoteJid);
    await sock.sendPresenceUpdate("composing", remoteJid);
  } catch (_error) {
    // Presence is best-effort; sending should not fail just because typing state failed.
  }

  const buttons = (message.buttons || []).map((button, index) => ({
    buttonId: button.id || `button_${index + 1}`,
    buttonText: { displayText: button.text },
    type: 1,
  }));

  try {
    return await withSendTimeout(
      sock.sendMessage(remoteJid, {
        text: message.body,
        footer: message.footer || undefined,
        title: message.title || undefined,
        buttons,
        headerType: 1,
      }),
      "WhatsApp button message send",
    );
  } finally {
    sock.sendPresenceUpdate("paused", remoteJid).catch(() => undefined);
  }
}

export async function sendWhatsAppTextMessage(accountId, remoteJid, body) {
  const sock = activeSockets.get(accountId.toString());

  if (!sock?.ws?.isOpen) {
    throw new ApiError(409, "This WhatsApp number is not connected. Reconnect it before sending messages.");
  }

  return enqueueWhatsAppMessage(accountId, remoteJid, body, (jid, text) =>
    sendRawWhatsAppTextMessage(accountId, jid, text),
  );
}

export async function sendWhatsAppMediaMessage(accountId, remoteJid, message) {
  const sock = activeSockets.get(accountId.toString());

  if (!sock?.ws?.isOpen) {
    throw new ApiError(409, "This WhatsApp number is not connected. Reconnect it before sending messages.");
  }

  return enqueueWhatsAppMessage(accountId, remoteJid, message, (jid, payload) =>
    sendRawWhatsAppMediaMessage(accountId, jid, payload),
  );
}

export async function sendWhatsAppButtonMessage(accountId, remoteJid, message) {
  const sock = activeSockets.get(accountId.toString());

  if (!sock?.ws?.isOpen) {
    throw new ApiError(409, "This WhatsApp number is not connected. Reconnect it before sending messages.");
  }

  return enqueueWhatsAppMessage(accountId, remoteJid, message, (jid, payload) =>
    sendRawWhatsAppButtonMessage(accountId, jid, payload),
  );
}

function connectedSocketForGroup(accountId) {
  const sock = activeSockets.get(accountId.toString());
  if (!sock?.ws?.isOpen) {
    throw new ApiError(409, "This WhatsApp number is not connected. Reconnect it before managing groups.");
  }
  return sock;
}

function ensureGroupJid(groupId) {
  const jid = String(groupId || "").trim();
  if (!jid.endsWith("@g.us")) throw new ApiError(400, "groupId must be a WhatsApp group ID ending with @g.us");
  return jid;
}

export async function listWhatsAppGroups(accountId) {
  const sock = connectedSocketForGroup(accountId);
  try {
    const groups = await withGroupOperationTimeout(sock.groupFetchAllParticipating(), "WhatsApp group list request");
    return Object.values(groups || {});
  } catch (error) {
    if (error instanceof ApiError) throw error;
    logger.warn({ accountId, error }, "WhatsApp group list request failed");
    throw new ApiError(502, "WhatsApp could not load groups for this number. Reconnect the WhatsApp number and try again.");
  }
}

export async function getWhatsAppGroupMetadata(accountId, groupId, options = {}) {
  const jid = ensureGroupJid(groupId);
  const sock = connectedSocketForGroup(accountId);
  try {
    const metadata = await withGroupOperationTimeout(
      getCachedGroupMetadata(sock, accountId.toString(), jid, { force: options.force, throwOnError: true }),
      "WhatsApp group detail request",
    );
    if (!metadata) throw new ApiError(404, "WhatsApp group was not found or is no longer available to this number");
    return metadata;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    logger.warn({ accountId, groupId: jid, error }, "WhatsApp group detail request failed");
    throw new ApiError(502, "WhatsApp could not load this group. Confirm the group ID and reconnect the WhatsApp number if needed.");
  }
}

export async function createWhatsAppGroup(accountId, subject, participants) {
  const sock = connectedSocketForGroup(accountId);
  try {
    const metadata = await withGroupOperationTimeout(
      sock.groupCreate(subject, participants),
      "WhatsApp group creation",
      participants.length,
    );
    if (metadata?.id) groupMetadataCache.set(`${accountId}:${metadata.id}`, { metadata, expiresAt: Date.now() + GROUP_METADATA_TTL_MS });
    return metadata;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    logger.warn({ accountId, subject, participantCount: participants.length, error }, "WhatsApp group creation failed");
    throw new ApiError(
      422,
      "WhatsApp could not create the group. Use real WhatsApp phone numbers or direct JIDs for every participant, then try again.",
    );
  }
}

export async function leaveWhatsAppGroup(accountId, groupId) {
  const jid = ensureGroupJid(groupId);
  const sock = connectedSocketForGroup(accountId);
  try {
    await withGroupOperationTimeout(sock.groupLeave(jid), "WhatsApp group leave request");
    groupMetadataCache.delete(`${accountId}:${jid}`);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    logger.warn({ accountId, groupId: jid, error }, "WhatsApp group leave request failed");
    throw new ApiError(502, "WhatsApp could not leave this group. Reconnect the WhatsApp number and try again.");
  }
}

export async function updateWhatsAppGroupParticipants(accountId, groupId, participants, action) {
  const jid = ensureGroupJid(groupId);
  const sock = connectedSocketForGroup(accountId);
  try {
    const results = await withGroupOperationTimeout(
      sock.groupParticipantsUpdate(jid, participants, action),
      "WhatsApp group participant update",
      participants.length,
    );
    groupMetadataCache.delete(`${accountId}:${jid}`);

    try {
      const metadata = await getWhatsAppGroupMetadata(accountId, jid, { force: true });
      return { results, metadata };
    } catch (metadataError) {
      // The participant command already completed. Metadata can be unavailable briefly
      // while WhatsApp propagates the group change, so do not turn a completed update
      // into a false failure.
      logger.warn({ accountId, groupId: jid, action, metadataError }, "Group updated but metadata refresh failed");
      return { results, metadata: null, metadataWarning: "Participants were updated, but the latest group details are not available yet. Fetch the group again in a few seconds." };
    }
  } catch (error) {
    if (error instanceof ApiError) throw error;
    logger.warn({ accountId, groupId: jid, participantCount: participants.length, action, error }, "WhatsApp group participant update failed");
    throw new ApiError(
      422,
      "WhatsApp could not update the group participants. Use real WhatsApp phone numbers or direct JIDs and verify this number is a group admin.",
    );
  }
}

export async function resumeWhatsAppSocket(account) {
  const accountId = account._id.toString();
  const hasAuth = await hasMongoAuthState(accountId);

  if (!hasAuth) {
    await WhatsAppAccountModel.findByIdAndUpdate(accountId, {
      state: "SESSION_EXPIRED",
      uptime: "0m",
      sessionStatus: "expired",
    });
    await addEvent(accountId, "error", "Session auth missing", "Reconnect this WhatsApp number with a fresh QR code");
    return;
  }

  await WhatsAppAccountModel.findByIdAndUpdate(accountId, {
    state: "CONNECTING",
    sessionStatus: "stale",
  });
  await addEvent(accountId, "sync", "Restoring WhatsApp session", "Checking whether this linked device is still active");
  await createSocket(account);
}

export async function restoreConnectedWhatsAppSockets() {
  await reconcileConnectedPhoneOwnership();
  const accounts = await WhatsAppAccountModel.find({
    state: { $in: ["CONNECTED", "CONNECTING", "SESSION_EXPIRED"] },
  }).sort({ lastConnectedAt: -1, updatedAt: -1, _id: -1 });

  let restored = 0;

  for (const account of accounts) {
    if (activeSockets.has(account._id.toString())) continue;
    if (!(await hasMongoAuthState(account._id))) continue;

    restored += 1;
    await resumeWhatsAppSocket(account).catch(async (error) => {
      await scheduleAutoReconnect(account._id, { lastDisconnect: { error } }, 1);
    });
  }

  return restored;
}

export async function disconnectWhatsAppSocket(accountId) {
  const key = accountId.toString();
  const sock = activeSockets.get(key);

  clearReconnectTimer(key);
  pendingQrResolvers.get(key)?.reject(new Error("WhatsApp connection attempt was cancelled."));

  if (sock) {
    intentionallyClosedSockets.add(sock);
    await sock.logout().catch(() => undefined);
    sock.ws?.close?.();
    if (activeSockets.get(key) === sock) activeSockets.delete(key);
  }

  await clearSession(key);
  await releaseWhatsAppPhoneClaim(key);
  clearGroupMetadataCache(key);
}
