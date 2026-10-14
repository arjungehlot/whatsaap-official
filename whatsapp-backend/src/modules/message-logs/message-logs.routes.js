import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import {
  cancelPendingMessageLogs,
  getMessageLogs,
  retryMessageLog,
} from "./message-logs.controller.js";
import {
  cancelPendingMessageLogsSchema,
  listMessageLogsSchema,
  retryMessageLogSchema,
} from "./message-logs.schemas.js";

export const messageLogsRouter = Router();

messageLogsRouter.use(requireAuth);
messageLogsRouter.get("/", validate(listMessageLogsSchema), getMessageLogs);
messageLogsRouter.post(
  "/bulk-cancel",
  validate(cancelPendingMessageLogsSchema),
  cancelPendingMessageLogs,
);
messageLogsRouter.post(
  "/:id/retry",
  validate(retryMessageLogSchema),
  retryMessageLog,
);
