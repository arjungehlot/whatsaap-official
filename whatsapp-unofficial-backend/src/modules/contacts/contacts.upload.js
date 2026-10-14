import multer from "multer";

import { ApiError } from "../../utils/apiError.js";

const allowedMimeTypes = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/csv",
  "application/csv",
  "application/octet-stream",
]);

export const uploadContactFile = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter(_req, file, callback) {
    const name = file.originalname.toLowerCase();
    const allowedExtension = name.endsWith(".csv") || name.endsWith(".xlsx") || name.endsWith(".xls");

    if (!allowedExtension || !allowedMimeTypes.has(file.mimetype)) {
      return callback(new ApiError(400, "Upload a CSV, XLS or XLSX contact file"));
    }

    return callback(null, true);
  },
});
