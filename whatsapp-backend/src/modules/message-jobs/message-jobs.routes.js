import { Router } from "express";
import { requireAuth, requireScope, requireSessionAuth } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { deleteMessageJob, deleteMessageJobRecipient, getMessageJobRecipients, getMessageJobs, patchMessageJobStatus, postMessageJob } from "./message-jobs.controller.js";
import { createMessageJobSchema, listMessageJobsSchema, messageJobIdSchema, messageJobRecipientIdSchema, messageJobStatusSchema } from "./message-jobs.schemas.js";

export const messageJobsRouter = Router();
messageJobsRouter.use(requireAuth);
messageJobsRouter.get("/", requireScope("messages:read"), validate(listMessageJobsSchema), getMessageJobs);
messageJobsRouter.post("/", requireSessionAuth, requireScope("messages:write"), validate(createMessageJobSchema), postMessageJob);
messageJobsRouter.get("/:id/recipients", requireScope("messages:read"), validate(messageJobIdSchema), getMessageJobRecipients);
messageJobsRouter.delete("/:id/recipients/:recipientId", requireSessionAuth, requireScope("messages:write"), validate(messageJobRecipientIdSchema), deleteMessageJobRecipient);
messageJobsRouter.patch("/:id/status", requireSessionAuth, requireScope("messages:write"), validate(messageJobStatusSchema), patchMessageJobStatus);
messageJobsRouter.delete("/:id", requireSessionAuth, requireScope("messages:write"), validate(messageJobIdSchema), deleteMessageJob);
