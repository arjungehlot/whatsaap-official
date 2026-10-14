import { Router } from "express";
import { requireAuth, requireScope, requireSessionAuth } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import {
  deleteWebhookById,
  getWebhookDeliveries,
  getWebhooks,
  patchWebhook,
  postWebhook,
  postWebhookReplay,
  postWebhookTest,
} from "./webhooks.controller.js";
import { createWebhookSchema, deliveryIdSchema, listWebhooksSchema, updateWebhookSchema, webhookIdSchema } from "./webhooks.schemas.js";
import { WEBHOOK_EVENTS } from "./webhooks.service.js";
import { requireFeature } from "../billing/entitlements.service.js";

export const webhooksRouter = Router();
webhooksRouter.use(requireAuth);
webhooksRouter.use(requireFeature("webhook"));
webhooksRouter.get("/events", requireScope("webhooks:read"), (_req, res) => res.json({ success: true, data: { events: WEBHOOK_EVENTS } }));
webhooksRouter.get("/", requireScope("webhooks:read"), validate(listWebhooksSchema), getWebhooks);
webhooksRouter.post("/", requireSessionAuth, requireScope("webhooks:write"), validate(createWebhookSchema), postWebhook);
webhooksRouter.patch("/:id", requireSessionAuth, requireScope("webhooks:write"), validate(updateWebhookSchema), patchWebhook);
webhooksRouter.delete("/:id", requireSessionAuth, requireScope("webhooks:write"), validate(webhookIdSchema), deleteWebhookById);
webhooksRouter.get("/:id/deliveries", requireScope("webhooks:read"), validate(webhookIdSchema), getWebhookDeliveries);
webhooksRouter.post("/:id/test", requireSessionAuth, requireScope("webhooks:write"), validate(webhookIdSchema), postWebhookTest);
webhooksRouter.post("/deliveries/:id/replay", requireSessionAuth, requireScope("webhooks:write"), validate(deliveryIdSchema), postWebhookReplay);
