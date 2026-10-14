import crypto from "node:crypto";
import { ApiKeyModel } from "../../models/ApiKey.js";
import { UserModel } from "../../models/User.js";
import { WhatsAppAccountModel } from "../../models/WhatsAppAccount.js";
import { ApiError } from "../../utils/apiError.js";
import { dispatchPendingOutboundMessages } from "../messages/message-dispatch.service.js";
import { createSenderReplacementAudit, resumeBlockedApiKeyMessages } from "../whatsapp/sender-replacement.service.js";
import { senderIdentityMatches } from "../whatsapp/whatsapp.sender-identity.js";

const DEFAULT_SCOPES = [
  "messages:write",
  "contacts:read",
  "contacts:write",
  "templates:read",
  "templates:write",
  "campaigns:read",
  "campaigns:write",
  "whatsapp:read",
  "whatsapp:manage",
];
const ALLOWED_SCOPES = new Set([
  "messages:write",
  "contacts:read",
  "contacts:write",
  "templates:read",
  "templates:write",
  "campaigns:read",
  "campaigns:write",
  "whatsapp:read",
  "whatsapp:manage",
]);

export function hashApiKey(key) {
  return crypto.createHash("sha256").update(key).digest("hex");
}

function generateApiKey(environment) {
  const prefix = environment === "test" ? "wf_test" : "wf_live";
  return `${prefix}_${crypto.randomBytes(32).toString("base64url")}`;
}

function visibleApiKey(row, key) {
  return {
    id: row._id.toString(),
    label: row.label,
    prefix: row.prefix,
    key,
    defaultAccountId: row.defaultChannelId,
    defaultChannelId: row.defaultChannelId,
    defaultAccountName: row.defaultAccountName,
    defaultAccountPhone: row.defaultAccountPhone,
    scopes: row.scopes || [],
    environment: row.environment,
    createdAt: row.createdAt.toISOString(),
    lastUsedAt: row.lastUsedAt?.toISOString(),
    revokedAt: row.revokedAt?.toISOString(),
    requests30d: row.requests30d || 0,
  };
}

function cleanScopes(scopes) {
  const requested = Array.isArray(scopes) && scopes.length ? scopes : DEFAULT_SCOPES;
  const next = [...new Set(requested.map((scope) => String(scope || "").trim()).filter(Boolean))];
  const invalid = next.filter((scope) => !ALLOWED_SCOPES.has(scope));
  if (invalid.length) throw new ApiError(400, `Invalid API key scope: ${invalid.join(", ")}`);
  return next;
}

export async function createApiKey(userId, payload) {
  const environment = payload.environment || "live";
  const defaultAccount = payload.defaultAccountId
    ? await WhatsAppAccountModel.findOne({ channelId: payload.defaultAccountId, userId }).lean()
    : null;

  if (payload.defaultAccountId && !defaultAccount) {
    throw new ApiError(404, "Selected WhatsApp number was not found");
  }
  if (defaultAccount && defaultAccount.state !== "CONNECTED") {
    throw new ApiError(409, "Connect the selected WhatsApp number before binding an API key");
  }

  const key = generateApiKey(environment);
  const prefix = key.split("_").slice(0, 3).join("_").slice(0, 18);
  const row = await ApiKeyModel.create({
    userId,
    label: payload.label,
    prefix,
    keyHash: hashApiKey(key),
    defaultAccountId: defaultAccount?._id,
    defaultChannelId: defaultAccount?.channelId,
    defaultAccountName: defaultAccount?.displayName,
    defaultAccountPhone: defaultAccount?.phone,
    scopes: cleanScopes(payload.scopes),
    environment,
  });

  return visibleApiKey(row, key);
}

export async function listApiKeys(userId, onlyKeyId) {
  const rows = await ApiKeyModel.find({ userId, ...(onlyKeyId ? { _id: onlyKeyId } : {}) }).sort({ createdAt: -1 });
  return rows.map((row) => visibleApiKey(row));
}

export async function updateApiKey(userId, keyId, payload) {
  const key = await ApiKeyModel.findOne({ _id: keyId, userId });
  if (!key) throw new ApiError(404, "API key not found");

  if (payload.label !== undefined) key.label = payload.label;

  if (payload.defaultAccountId !== undefined) {
    const account = await WhatsAppAccountModel.findOne({ channelId: payload.defaultAccountId, userId }).lean();
    if (!account) throw new ApiError(404, "Selected WhatsApp number was not found");
    if (account.state !== "CONNECTED") {
      throw new ApiError(409, "Connect the selected WhatsApp number before binding this API key");
    }

    key.defaultAccountId = account._id;
    key.defaultChannelId = account.channelId;
    key.defaultAccountName = account.displayName;
    key.defaultAccountPhone = account.phone;
  }

  await key.save();
  return visibleApiKey(key);
}

/** Explicitly move one integration to a replacement number in the same slot. */
export async function rebindApiKeyToReplacement(userId, keyId) {
  const key = await ApiKeyModel.findOne({ _id: keyId, userId });
  if (!key) throw new ApiError(404, "API key not found");
  if (!key.defaultAccountId) throw new ApiError(409, "This API key is not bound to a WhatsApp number");

  const account = await WhatsAppAccountModel.findOne({ _id: key.defaultAccountId, userId });
  if (!account || account.state !== "CONNECTED") {
    throw new ApiError(409, "Connect the replacement WhatsApp number before resuming this API key");
  }
  if (senderIdentityMatches(account, key.defaultAccountPhone)) {
    throw new ApiError(409, "This API key is already bound to the currently connected WhatsApp number");
  }

  const previousPhone = key.defaultAccountPhone || "Unknown number";
  const { resumedRecipients } = await resumeBlockedApiKeyMessages(userId, account, key._id);

  key.defaultChannelId = account.channelId;
  key.defaultAccountName = account.displayName;
  key.defaultAccountPhone = account.phone;
  await key.save();

  await createSenderReplacementAudit({
    userId,
    accountId: account._id,
    channelId: account.channelId,
    action: "api_key_rebound",
    previousPhone,
    replacementPhone: account.phone,
    apiKeyId: key._id,
    resumedRecipients,
  });
  void dispatchPendingOutboundMessages(account._id).catch(() => {});

  return { key: visibleApiKey(key), resumedRecipients };
}

export async function revokeApiKey(userId, keyId) {
  const result = await ApiKeyModel.deleteOne({ _id: keyId, userId });
  if (!result.deletedCount) throw new ApiError(404, "API key not found");
}

export async function authenticateApiKey(key) {
  const keyHash = hashApiKey(key);
  const row = await ApiKeyModel.findOne({ keyHash, $or: [{ revokedAt: { $exists: false } }, { revokedAt: null }] });
  if (!row) return null;

  const user = await UserModel.findById(row.userId);
  if (!user) return null;

  row.lastUsedAt = new Date();
  row.requests30d = (row.requests30d || 0) + 1;
  await row.save();

  return {
    user,
    apiKey: row,
    scopes: row.scopes || [],
  };
}

export function hasApiScope(req, scope) {
  if (req.authType !== "api-key") return true;
  return req.apiKeyScopes?.includes(scope);
}
