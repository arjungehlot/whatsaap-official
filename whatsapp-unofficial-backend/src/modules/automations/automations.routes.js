import { Router } from "express";
import { requireAuth, requireScope, requireSessionAuth } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { requireFeature } from "../billing/entitlements.service.js";
import { getAutomationDetailsById, getAutomations, patchAutomationStatus, postAutomation } from "./automations.controller.js";
import { automationIdSchema, createAutomationSchema, listAutomationsSchema, updateAutomationStatusSchema } from "./automations.schemas.js";

export const automationsRouter = Router();
automationsRouter.use(requireAuth);
automationsRouter.use(requireFeature("scheduler"));
automationsRouter.get("/", requireScope("messages:read"), validate(listAutomationsSchema), getAutomations);
automationsRouter.get("/:id/details", requireScope("messages:read"), validate(automationIdSchema), getAutomationDetailsById);
automationsRouter.post("/", requireSessionAuth, requireScope("messages:write"), validate(createAutomationSchema), postAutomation);
automationsRouter.patch("/:id/status", requireSessionAuth, requireScope("messages:write"), validate(updateAutomationStatusSchema), patchAutomationStatus);
