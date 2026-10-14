import { Router } from "express";
import { requireAuth, requireScope } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { getAttachment, getConversations, getGroupDetails, getMessages, postInboxAttachments, postMessage } from "./inbox.controller.js";
import { inboxMessageIdSchema, listConversationsSchema, listMessagesSchema, sendMessageSchema } from "./inbox.schemas.js";
import { requireInboxFeature } from "../billing/entitlements.service.js";
import { uploadTemplateAttachment } from "../templates/templates.upload.js";

export const inboxRouter = Router();

inboxRouter.use(requireAuth);

inboxRouter.get("/conversations", requireScope("whatsapp:read"), requireInboxFeature, validate(listConversationsSchema), getConversations);
inboxRouter.get("/conversations/:id/group-details", requireScope("whatsapp:read"), validate(listMessagesSchema), getGroupDetails);
inboxRouter.get("/conversations/:id/messages", requireScope("whatsapp:read"), validate(listMessagesSchema), getMessages);
inboxRouter.get("/messages/:id/attachment", requireScope("whatsapp:read"), validate(inboxMessageIdSchema), getAttachment);
inboxRouter.post("/attachments", requireScope("messages:write"), requireInboxFeature, uploadTemplateAttachment.array("files", 10), postInboxAttachments);
inboxRouter.post("/conversations/:id/messages", requireScope("messages:write"), validate(sendMessageSchema), postMessage);
