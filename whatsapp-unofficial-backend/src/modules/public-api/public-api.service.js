import { InboxMessageModel } from "../../models/InboxMessage.js";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { MessageTemplateModel } from "../../models/MessageTemplate.js";
import { UserModel } from "../../models/User.js";
import { WhatsAppAccountModel } from "../../models/WhatsAppAccount.js";
import { ApiError } from "../../utils/apiError.js";
import { normalizePhone } from "../contacts/contacts.service.js";
import { getEntitlements } from "../billing/entitlements.service.js";
import { persistInlineAttachments, sendApiMessage } from "../messages/messages.service.js";
import { normalizeAttachmentMetadata } from "../../utils/attachment-media.js";
import {
  createOrReuseOutboundBatch,
  failOutboundBatch,
  finalizeOutboundBatch,
  getOutboundBatch,
  stablePayloadHash,
  visibleOutboundBatch,
} from "../messages/outbound-batches.service.js";

const MAX_EXTERNAL_FILE_BYTES = 25 * 1024 * 1024;
const MAX_REQUEST_FILE_BYTES = 50 * 1024 * 1024;
const DEFAULT_FILE_MIME = "application/octet-stream";
const MAX_PUBLIC_RECIPIENTS = 500;

function asArray(value, options = {}) {
  const splitComma = options.splitComma !== false;
  if (value === undefined || value === null || value === "") return [];
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
      try {
        const parsed = JSON.parse(trimmed);
        return asArray(parsed, options);
      } catch (_error) {
        return [value];
      }
    }
  }
  const values = Array.isArray(value) ? value : [value];
  return values
    .flatMap((item) => (splitComma && typeof item === "string" && item.includes(",") ? item.split(",") : item))
    .map((item) => (typeof item === "string" ? item.trim() : item))
    .filter((item) => item !== undefined && item !== null && (options.keepEmpty || String(item).trim() !== ""));
}

function asBoolean(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return ["true", "1", "yes", "on"].includes(value.toLowerCase());
  return false;
}

function normalizeButton(input) {
  if (input.button && typeof input.button === "object") return input.button;

  const title = input["button.title"];
  const body = input["button.body"];
  const footer = input["button.footer"];
  const buttons = [0, 1, 2]
    .map((index) => {
      const text = input[`button.buttons[${index}].text`] || input[`button.buttons.${index}.text`];
      return text ? { text: String(text).trim() } : null;
    })
    .filter(Boolean);

  if (!title && !body && !footer && !buttons.length) return null;
  return { title, body, footer, buttons };
}

function filenameFromUrl(url) {
  try {
    const pathname = new URL(url).pathname;
    const name = decodeURIComponent(pathname.split("/").filter(Boolean).pop() || "");
    return name || "remote-file";
  } catch (_error) {
    return "remote-file";
  }
}

function filenameFromContentDisposition(value) {
  const filenameStar = String(value || "").match(/filename\*=(?:UTF-8'')?([^;]+)/i)?.[1];
  const filename = String(value || "").match(/filename=\"?([^\";]+)\"?/i)?.[1];
  const candidate = filenameStar || filename;
  if (!candidate) return null;
  try {
    return decodeURIComponent(candidate.trim().replace(/^\"|\"$/g, ""));
  } catch (_error) {
    return candidate.trim().replace(/^\"|\"$/g, "");
  }
}

function googleDriveDownloadUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch (_error) {
    throw new ApiError(400, "filePathUrl must be a valid public HTTP or HTTPS URL");
  }
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new ApiError(400, "filePathUrl must use HTTP or HTTPS");
  }

  const host = url.hostname.toLowerCase();
  const fileId = host === "drive.google.com"
    ? url.pathname.match(/\/file\/d\/([^/]+)/)?.[1] || url.searchParams.get("id")
    : null;
  if (fileId) {
    // Public Drive share pages are HTML. This endpoint returns the actual file bytes instead.
    return `https://drive.usercontent.google.com/download?id=${encodeURIComponent(fileId)}&export=download&confirm=t`;
  }

  if (host === "docs.google.com") {
    const match = url.pathname.match(/^\/(document|spreadsheets|presentation)\/d\/([^/]+)/);
    if (match) {
      const format = { document: "pdf", spreadsheets: "xlsx", presentation: "pptx" }[match[1]];
      return `https://docs.google.com/${match[1]}/d/${encodeURIComponent(match[2])}/export?format=${format}`;
    }
  }
  return url.toString();
}

function isPrivateNetworkAddress(address) {
  if (isIP(address) === 4) {
    const [a, b] = address.split(".").map(Number);
    return a === 10 || a === 127 || a === 0 || a === 169 && b === 254 || a === 172 && b >= 16 && b <= 31 || a === 192 && b === 168;
  }
  const normalized = String(address || "").toLowerCase();
  return normalized === "::1" || normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe80:") || normalized.startsWith("::ffff:127.");
}

async function assertPublicFileUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch (_error) {
    throw new ApiError(400, "filePathUrl must be a valid public HTTP or HTTPS URL");
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new ApiError(400, "filePathUrl must be a public HTTP or HTTPS URL without credentials");
  }
  const hostname = url.hostname.toLowerCase();
  if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local")) {
    throw new ApiError(400, "filePathUrl must not point to a private network host");
  }
  if (isIP(hostname)) {
    if (isPrivateNetworkAddress(hostname)) throw new ApiError(400, "filePathUrl must not point to a private network address");
    return url;
  }
  let addresses;
  try {
    addresses = await lookup(hostname, { all: true, verbatim: true });
  } catch (_error) {
    throw new ApiError(424, `Cannot resolve file host: ${hostname}`);
  }
  if (!addresses.length || addresses.some((entry) => isPrivateNetworkAddress(entry.address))) {
    throw new ApiError(400, "filePathUrl must not point to a private network address");
  }
  return url;
}

async function fetchPublicFile(url) {
  let nextUrl = await assertPublicFileUrl(url);
  for (let redirects = 0; redirects <= 3; redirects += 1) {
    let response;
    try {
      response = await fetch(nextUrl, { redirect: "manual", signal: AbortSignal.timeout(30000) });
    } catch (_error) {
      throw new ApiError(424, `Cannot get file from path: ${url}`);
    }
    if (response.status < 300 || response.status >= 400) return response;
    const location = response.headers.get("location");
    if (!location) throw new ApiError(424, `Cannot get file from path: ${url}`);
    nextUrl = await assertPublicFileUrl(new URL(location, nextUrl).toString());
  }
  throw new ApiError(424, `Too many redirects while downloading file: ${url}`);
}

function remoteJidToNumber(remoteJid) {
  if (remoteJid.endsWith("@g.us")) return remoteJid.replace("@g.us", "");
  if (remoteJid.endsWith("@c.us")) return remoteJid.replace("@c.us", "");
  if (remoteJid.endsWith("@s.whatsapp.net")) return remoteJid.replace("@s.whatsapp.net", "");
  return remoteJid;
}

function toReceiverTargets(input) {
  const receiverNumbers = asArray(input.receiverMobileNo).map((phone) => {
    const normalized = normalizePhone(phone);
    return {
      input: phone,
      number: normalized,
      to: `+${normalized}`,
      recipientId: `${normalized}@c.us`,
    };
  });

  const recipientIds = asArray(input.recipientIds).map((recipientId) => {
    const raw = String(recipientId).trim();
    if (!raw.endsWith("@c.us") && !raw.endsWith("@g.us") && !raw.endsWith("@s.whatsapp.net") && !raw.endsWith("@lid")) {
      throw new ApiError(400, "recipientIds must be WhatsApp chat ids ending with @c.us, @s.whatsapp.net, @g.us or @lid");
    }
    const number = remoteJidToNumber(raw);
    return {
      input: raw,
      number,
      to: raw.endsWith("@g.us") || raw.endsWith("@lid") ? raw : `+${normalizePhone(number)}`,
      recipientId: raw,
    };
  });

  const targets = [...receiverNumbers, ...recipientIds];
  if (!targets.length) throw new ApiError(400, "At least one receiverMobileNo or recipientIds value is required");

  const unique = new Map();
  for (const target of targets) {
    const recipientId = String(target.recipientId).toLowerCase();
    const identity = recipientId.endsWith("@g.us") || recipientId.endsWith("@lid")
      ? recipientId
      : `${normalizePhone(target.number)}@s.whatsapp.net`;
    if (!unique.has(identity)) unique.set(identity, target);
  }
  if (unique.size > MAX_PUBLIC_RECIPIENTS) {
    throw new ApiError(400, `A maximum of ${MAX_PUBLIC_RECIPIENTS} unique recipients is allowed in one request`);
  }
  return { targets: [...unique.values()], duplicatesIgnored: targets.length - unique.size };
}

async function assertGroupMessagingAccess(userId, targets) {
  if (!targets.some((target) => target.recipientId.endsWith("@g.us"))) return;
  const entitlements = await getEntitlements(userId);
  if (!entitlements.features?.["inbox-groups"]) {
    throw new ApiError(403, "Your plan does not include group messaging. Upgrade your plan to send WhatsApp group messages.");
  }
}

function parseBase64File(value) {
  if (typeof value === "string") {
    const [maybeName, maybeBody] = value.includes(":") ? value.split(/:(.*)/s) : ["base64-file", value];
    return { name: maybeName || "base64-file", body: maybeBody || value };
  }
  return value;
}

function attachmentFromBuffer({ name, mimeType, buffer }) {
  const metadata = normalizeAttachmentMetadata({ mimeType, fileName: name, buffer });
  return {
    kind: metadata.kind,
    name: metadata.fileName,
    fileName: metadata.fileName,
    mimeType: metadata.mimeType,
    size: buffer.length,
    buffer,
    body: "",
  };
}

async function attachmentFromUrl(url) {
  const downloadUrl = googleDriveDownloadUrl(url);
  const response = await fetchPublicFile(downloadUrl);

  if (!response.ok) throw new ApiError(424, `Cannot get file from path: ${url}`);
  const length = Number(response.headers.get("content-length"));
  if (Number.isFinite(length) && length > MAX_EXTERNAL_FILE_BYTES) {
    throw new ApiError(400, `File is larger than ${MAX_EXTERNAL_FILE_BYTES / 1024 / 1024} MB: ${url}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length > MAX_EXTERNAL_FILE_BYTES) {
    throw new ApiError(400, `File is larger than ${MAX_EXTERNAL_FILE_BYTES / 1024 / 1024} MB: ${url}`);
  }

  const mimeType = response.headers.get("content-type")?.split(";")[0]?.toLowerCase() || DEFAULT_FILE_MIME;
  const contentDisposition = response.headers.get("content-disposition");
  if (mimeType === "text/html" && !/attachment/i.test(contentDisposition || "")) {
    throw new ApiError(400, `The link did not return a downloadable file: ${url}. Use a public direct-download link.`);
  }

  return attachmentFromBuffer({
    name: filenameFromContentDisposition(contentDisposition) || filenameFromUrl(response.url || url),
    mimeType,
    buffer,
  });
}

function attachmentsFromUploads(files = []) {
  return files.map((file, index) =>
    attachmentFromBuffer({
      name: file.originalname || `upload-${index + 1}`,
      mimeType: file.mimetype || DEFAULT_FILE_MIME,
      buffer: file.buffer,
    }),
  );
}

function attachmentsFromBase64(values = []) {
  return values.map((item, index) => {
    const file = parseBase64File(item);
    if (!file?.body) throw new ApiError(400, "base64File item must include name and body");
    const body = String(file.body).includes(",") ? String(file.body).split(",").pop() : String(file.body);
    return attachmentFromBuffer({
      name: file.name || `base64-file-${index + 1}`,
      mimeType: file.mimeType || DEFAULT_FILE_MIME,
      buffer: Buffer.from(body, "base64"),
    });
  });
}

async function attachmentsFromUrls(values = []) {
  const attachments = [];
  for (const url of values) {
    attachments.push(await attachmentFromUrl(String(url)));
  }
  return attachments;
}

async function buildAttachments(input, files = [], options = {}) {
  // Group sends use a simpler contract: message becomes the caption only for one image.
  const captions = options.ignoreCaptions
    ? []
    : asArray(input.caption, { splitComma: false, keepEmpty: true }).map(String).filter((caption) => caption.trim());
  const savedAttachments = Array.isArray(input.attachments) ? input.attachments : input.attachment ? [input.attachment] : [];
  const uploaded = attachmentsFromUploads(files);
  const base64Files = attachmentsFromBase64(asArray(input.base64File, { splitComma: false }));
  const remoteFiles = await attachmentsFromUrls(asArray(input.filePathUrl, { splitComma: false }));

  if (asArray(input.ftpFilePathUrl).length) {
    throw new ApiError(400, "ftpFilePathUrl is not supported on this installation. Use filePathUrl, base64File or uploadFile.");
  }

  const attachments = [...savedAttachments, ...uploaded, ...base64Files, ...remoteFiles];
  if (attachments.length > 10) throw new ApiError(400, "A maximum of 10 files can be sent in one request");
  const totalBytes = attachments.reduce((total, attachment) => total + Math.max(0, Number(attachment.size) || 0), 0);
  if (totalBytes > MAX_REQUEST_FILE_BYTES) throw new ApiError(400, "Total attachment size cannot exceed 50 MB per request");

  // Caption values are assigned to eligible media, not raw file positions. This lets a PDF
  // appear before an image without forcing callers to provide empty placeholder captions.
  const captionableAttachments = attachments.filter((attachment) => ["image", "video"].includes(attachment.kind));
  captions.forEach((caption, index) => {
    if (captionableAttachments[index]) captionableAttachments[index].body = caption;
  });

  return attachments;
}

function visibleStatus(message) {
  return {
    id: message._id.toString(),
    number: remoteJidToNumber(message.remoteJid),
    retryCount: -1,
    status: String(message.status || "sent").toUpperCase(),
    lastUpdateTime: (message.updatedAt || message.at || new Date()).toISOString(),
  };
}

function recipientDeliveryStatus(messages) {
  const statuses = messages.map((message) => String(message.status || "pending").toLowerCase());
  if (statuses.some((status) => status === "pending" || status === "processing")) return "PENDING";
  if (statuses.some((status) => status === "failed")) return "FAILED";
  if (statuses.length && statuses.every((status) => status === "read")) return "READ";
  if (statuses.length && statuses.every((status) => ["delivered", "read"].includes(status))) return "DELIVERED";
  return "SENT";
}

function legacySuccess(result) {
  return {
    status: 200,
    message: "success",
    result,
  };
}

function pickMessage(messages, randomizeItems) {
  if (!messages.length) return "";
  if (!randomizeItems) return String(messages[0]);
  return String(messages[Math.floor(Math.random() * messages.length)]);
}

function hydrateTemplateBody(template, placeHolders = {}) {
  return String(template.body || "").replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_match, key) => {
    const normalizedKey = String(key).trim();
    return placeHolders[normalizedKey] ?? placeHolders[`user.${normalizedKey}`] ?? "";
  });
}

async function sendOneTarget(userId, target, input, attachments, options = {}) {
  const messages = asArray(input.message, { splitComma: false }).map(String);
  const textMessages = asBoolean(input.randomizeItems) ? [pickMessage(messages, true)].filter(Boolean) : messages;
  const button = normalizeButton(input);
  const isGroup = target.recipientId.endsWith("@g.us");
  const groupUsesMessageAsImageCaption = isGroup && attachments.length === 1 && attachments[0].kind === "image";
  const targetAttachments = isGroup
    ? attachments.map((attachment) => ({ ...attachment, body: "" }))
    : attachments;

  if (groupUsesMessageAsImageCaption) {
    targetAttachments[0].body = textMessages.join("\n\n");
  }

  // A request can still send text and several files physically, but it is one recipient delivery.
  const result = await sendApiMessage(userId, {
    to: target.to,
    channelId: input.channelId || input.accountId,
    bodyParts: groupUsesMessageAsImageCaption ? [] : textMessages,
    button,
    inlineAttachments: targetAttachments,
  }, { ...options, source: "api", awaitDispatch: false, attachmentsAlreadyStored: true });

  return {
    target,
    result: {
      messages: result.messages,
      channel: result.channel,
    },
  };
}

export async function createPublicMessage(userId, input, files = [], options = {}) {
  const { targets, duplicatesIgnored } = toReceiverTargets(input);
  await assertGroupMessagingAccess(userId, targets);
  const groupOnly = targets.every((target) => target.recipientId.endsWith("@g.us"));
  const attachments = await buildAttachments(input, files, { ignoreCaptions: groupOnly });
  const storedAttachments = await persistInlineAttachments(userId, attachments);
  const messages = asArray(input.message, { splitComma: false });

  if (!messages.length && !attachments.length) {
    const button = normalizeButton(input);
    if (!button) throw new ApiError(400, "At least one message, button, uploadFile, base64File or filePathUrl value is required");
  }

  const requestHash = stablePayloadHash({
    recipients: targets.map((target) => target.recipientId),
    channelId: input.channelId || input.accountId || undefined,
    messages,
    button: normalizeButton(input),
    randomizeItems: asBoolean(input.randomizeItems),
    attachments: storedAttachments.map((attachment) => ({ name: attachment.name, key: attachment.key, mimeType: attachment.mimeType, size: attachment.size, body: attachment.body })),
  });
  const { batch, replayed } = await createOrReuseOutboundBatch({
    userId,
    apiKeyId: options.apiKey?._id,
    idempotencyKey: options.idempotencyKey,
    requestHash,
    recipientCount: targets.length,
    duplicatesIgnored,
  });

  if (replayed) {
    if (batch.responsePayload) return legacySuccess({ ...batch.responsePayload, idempotentReplay: true });
    if (batch.status === "failed") throw new ApiError(409, batch.lastError || "The previous request using this Idempotency-Key failed");
    return legacySuccess({
      id: batch._id.toString(),
      groupId: batch._id.toString(),
      batchId: batch._id.toString(),
      delivery: { batch: visibleOutboundBatch(batch), message: "This idempotent request is already being processed." },
      idempotentReplay: true,
    });
  }

  const sent = [];
  try {
    for (const target of targets) {
      sent.push(await sendOneTarget(userId, target, input, storedAttachments, { ...options, batchId: batch._id }));
    }
  } catch (error) {
    await failOutboundBatch(batch._id, error);
    throw error;
  }

  const flatMessages = sent.flatMap((item) => item.result.messages);
  const channels = [...new Map(sent
    .map((item) => item.result.channel)
    .filter(Boolean)
    .map((channel) => [channel.id, channel]))
    .values()];
  const pending = flatMessages.filter((message) => String(message.status).toLowerCase() === "pending").length;
  const result = {
    id: flatMessages[0]?.id,
    groupId: flatMessages[0]?.id,
    batchId: batch._id.toString(),
    creationTime: new Date().toISOString(),
    duplicatesIgnored,
    recipients: sent.map(({ target, result }) => ({
      // Keep the existing Mongo message id for the status endpoint; the internal delivery group is not public API input.
      id: result.messages[0]?.id,
      number: target.recipientId,
      retryCount: -1,
      status: recipientDeliveryStatus(result.messages),
      lastUpdateTime: result.messages.map((message) => message.at).filter(Boolean).sort().at(-1),
    })),
    messages: flatMessages,
    delivery: {
      queued: pending,
      dispatched: flatMessages.length - pending,
      channels,
      batch: visibleOutboundBatch(batch),
      message: pending
        ? "Some messages are queued until their bound WhatsApp number is connected. They will send automatically after that same number reconnects."
        : "Messages were accepted for delivery.",
    },
  };
  const refreshedBatch = await finalizeOutboundBatch(batch._id, result, channels[0]?.id);
  result.delivery.batch = refreshedBatch ? visibleOutboundBatch(refreshedBatch) : result.delivery.batch;
  return legacySuccess(result);
}

export async function createPublicMessageFromTemplate(userId, input, options = {}) {
  const template = await MessageTemplateModel.findOne({ _id: input.templateId, userId }).lean();
  if (!template) throw new ApiError(404, "Template not found");

  const hydrated = {
    ...input,
    message: [hydrateTemplateBody(template, input.placeHolders || {})],
    attachments: template.attachments?.length ? template.attachments : template.attachment ? [template.attachment] : [],
  };

  return createPublicMessage(userId, hydrated, [], options);
}

export async function getPublicMessageStatus(userId, input) {
  const ids = asArray(input.messageId || input.id).filter((id) => /^[a-f\d]{24}$/i.test(String(id)));
  if (!ids.length) throw new ApiError(400, "messageId is required");

  const messages = await InboxMessageModel.find({ _id: { $in: ids }, userId }).sort({ at: 1 }).lean();
  if (!messages.length) throw new ApiError(404, "Message does not exists or does not belong to customer");

  return legacySuccess({
    id: ids[0],
    groupId: ids[0],
    creationTime: messages[0].createdAt?.toISOString() || messages[0].at?.toISOString(),
    recipients: messages.map(visibleStatus),
  });
}

export async function getPublicMessageBatch(userId, batchId, options = {}) {
  return legacySuccess({ batch: await getOutboundBatch(userId, batchId, options.apiKey?._id) });
}

export async function getPublicAccountDetail(userId) {
  const [user, accounts] = await Promise.all([
    UserModel.findById(userId).lean(),
    WhatsAppAccountModel.find({ userId }).sort({ createdAt: 1 }).lean(),
  ]);

  return legacySuccess({
    id: user?._id?.toString(),
    username: user?.email,
    name: user?.name,
    company: user?.company,
    plan: user?.plan,
    channels: accounts.map((account) => ({
      id: account.channelId,
      name: account.displayName || account.phone || "WhatsApp",
      phone: account.phone,
      state: account.state,
      connected: account.state === "CONNECTED",
    })),
  });
}
