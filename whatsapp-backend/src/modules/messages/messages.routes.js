import { Router } from "express";
import { requireAuth, requireScope } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { postMessage } from "./messages.controller.js";
import { sendMessageSchema } from "./messages.schemas.js";
import { requireFeature } from "../billing/entitlements.service.js";

export const messagesRouter = Router();

messagesRouter.use(requireAuth);
messagesRouter.use(requireFeature("send-message"));

messagesRouter.post("/", requireScope("messages:write"), validate(sendMessageSchema), postMessage);
