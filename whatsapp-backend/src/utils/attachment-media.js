const DEFAULT_MIME_TYPE = "application/octet-stream";

const GENERIC_MIME_TYPES = new Set([
  "",
  DEFAULT_MIME_TYPE,
  "binary/octet-stream",
  "application/binary",
  "application/x-binary",
  "application/unknown",
]);

const MIME_BY_EXTENSION = new Map([
  [".pdf", "application/pdf"],
  [".doc", "application/msword"],
  [".docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  [".xls", "application/vnd.ms-excel"],
  [".xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  [".ppt", "application/vnd.ms-powerpoint"],
  [".pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation"],
  [".csv", "text/csv"],
  [".txt", "text/plain"],
  [".zip", "application/zip"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".png", "image/png"],
  [".gif", "image/gif"],
  [".webp", "image/webp"],
  [".mp4", "video/mp4"],
  [".mov", "video/quicktime"],
  [".webm", "video/webm"],
]);

const EXTENSION_BY_MIME = new Map([
  ["application/pdf", ".pdf"],
  ["application/msword", ".doc"],
  ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", ".docx"],
  ["application/vnd.ms-excel", ".xls"],
  ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ".xlsx"],
  ["application/vnd.ms-powerpoint", ".ppt"],
  ["application/vnd.openxmlformats-officedocument.presentationml.presentation", ".pptx"],
  ["text/csv", ".csv"],
  ["text/plain", ".txt"],
  ["application/zip", ".zip"],
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/gif", ".gif"],
  ["image/webp", ".webp"],
  ["video/mp4", ".mp4"],
  ["video/quicktime", ".mov"],
  ["video/webm", ".webm"],
]);

function normalizedMimeType(value) {
  return String(value || "").split(";", 1)[0].trim().toLowerCase();
}

function extensionOf(filename = "") {
  const cleanName = String(filename || "").split(/[?#]/, 1)[0];
  const dot = cleanName.lastIndexOf(".");
  return dot >= 0 ? cleanName.slice(dot).toLowerCase() : "";
}

function mimeTypeFromBytes(buffer) {
  if (!Buffer.isBuffer(buffer) || !buffer.length) return "";
  if (buffer.subarray(0, 5).toString("ascii") === "%PDF-") return "application/pdf";
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buffer.length >= 3 && buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return "image/jpeg";
  if (buffer.length >= 6 && ["GIF87a", "GIF89a"].includes(buffer.subarray(0, 6).toString("ascii"))) return "image/gif";
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  if (buffer.length >= 12 && buffer.subarray(4, 8).toString("ascii") === "ftyp") return "video/mp4";
  return "";
}

export function isGenericMimeType(value) {
  return GENERIC_MIME_TYPES.has(normalizedMimeType(value));
}

export function attachmentKind(mimeType = "", filename = "") {
  const resolvedMimeType = normalizedMimeType(mimeType);
  const extension = extensionOf(filename);
  if (resolvedMimeType.startsWith("image/") || [".jpg", ".jpeg", ".png", ".gif", ".webp"].includes(extension)) return "image";
  if (resolvedMimeType.startsWith("video/") || [".mp4", ".mov", ".mkv", ".webm"].includes(extension)) return "video";
  return "document";
}

/**
 * WhatsApp mobile clients use the declared MIME type to decide whether a document is viewable.
 * File hosts frequently label PDFs as application/octet-stream, so recover trusted metadata from
 * the filename and well-known file signatures before persisting or sending the file.
 */
export function normalizeAttachmentMetadata({ mimeType, fileName, name, buffer } = {}) {
  const originalName = String(fileName || name || "attachment").trim() || "attachment";
  const declaredMimeType = normalizedMimeType(mimeType);
  const detectedMimeType = mimeTypeFromBytes(buffer);
  const extensionMimeType = MIME_BY_EXTENSION.get(extensionOf(originalName));
  const resolvedMimeType = detectedMimeType || (!isGenericMimeType(declaredMimeType) ? declaredMimeType : extensionMimeType || DEFAULT_MIME_TYPE);
  const resolvedFileName = extensionOf(originalName) || !EXTENSION_BY_MIME.has(resolvedMimeType)
    ? originalName
    : `${originalName}${EXTENSION_BY_MIME.get(resolvedMimeType)}`;

  return {
    mimeType: resolvedMimeType,
    fileName: resolvedFileName,
    kind: attachmentKind(resolvedMimeType, resolvedFileName),
  };
}
