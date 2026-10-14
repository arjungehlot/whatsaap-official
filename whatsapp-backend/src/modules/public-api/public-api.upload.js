import multer from "multer";
import { ApiError } from "../../utils/apiError.js";

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

export const uploadPublicMessageFiles = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024, files: 10 },
  fileFilter(_req, file, cb) {
    const mimetype = String(file.mimetype || "").toLowerCase();
    if (allowedMimeTypes.has(mimetype) || allowedMimePrefixes.some((prefix) => mimetype.startsWith(prefix))) {
      cb(null, true);
      return;
    }
    cb(new ApiError(400, "Upload an image, video, PDF, Excel, CSV or document file"));
  },
});
