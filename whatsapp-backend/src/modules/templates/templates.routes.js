import { Router } from "express";
import { requireAuth, requireScope } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import {
  deleteTemplateById,
  getTemplateById,
  getTemplates,
  patchTemplate,
  postTemplate,
  postTemplateAttachment,
  postTemplateDuplicate,
} from "./templates.controller.js";
import {
  createTemplateSchema,
  duplicateTemplateSchema,
  listTemplatesSchema,
  templateIdSchema,
  updateTemplateSchema,
} from "./templates.schemas.js";
import { uploadTemplateAttachment } from "./templates.upload.js";
import { requireFeature } from "../billing/entitlements.service.js";

export const templatesRouter = Router();

templatesRouter.use(requireAuth);
templatesRouter.use(requireFeature("template"));

templatesRouter.get("/", requireScope("templates:read"), validate(listTemplatesSchema), getTemplates);
templatesRouter.post("/attachments", requireScope("templates:write"), uploadTemplateAttachment.single("file"), postTemplateAttachment);
templatesRouter.post("/", requireScope("templates:write"), validate(createTemplateSchema), postTemplate);
templatesRouter.get("/:id", requireScope("templates:read"), validate(templateIdSchema), getTemplateById);
templatesRouter.patch("/:id", requireScope("templates:write"), validate(updateTemplateSchema), patchTemplate);
templatesRouter.post("/:id/duplicate", requireScope("templates:write"), validate(duplicateTemplateSchema), postTemplateDuplicate);
templatesRouter.delete("/:id", requireScope("templates:write"), validate(templateIdSchema), deleteTemplateById);
