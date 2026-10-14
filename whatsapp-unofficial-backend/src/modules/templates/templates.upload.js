import multer from "multer";
import { ApiError } from "../../utils/apiError.js";

const allowedExtensions = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
  ".mp4",
  ".mov",
  ".mkv",
  ".pdf",
  ".xls",
  ".xlsx",
  ".csv",
  ".doc",
  ".docx",
  ".ppt",
  ".pptx",
  ".txt",
]);

const allowedMimePrefixes = ["image/", "video/"];
const allowedMimeTypes = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/csv",
  "text/plain",
  "application/csv",
  "application/octet-stream",
]);

function extensionOf(filename = "") {
  const dot = filename.lastIndexOf(".");
  return dot >= 0 ? filename.slice(dot).toLowerCase() : "";
}

function isAllowed(file) {
  const mimetype = String(file.mimetype || "").toLowerCase();
  const extension = extensionOf(file.originalname);
  return (
    allowedExtensions.has(extension) &&
    (allowedMimeTypes.has(mimetype) || allowedMimePrefixes.some((prefix) => mimetype.startsWith(prefix)))
  );
}

export const uploadTemplateAttachment = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    if (!isAllowed(file)) {
      cb(new ApiError(400, "Upload an image, video, PDF, Excel, CSV or document file"));
      return;
    }
    cb(null, true);
  },
});
