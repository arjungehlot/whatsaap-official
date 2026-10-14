import { Router } from "express";
import { requireAuth, requireScope, requireSessionAuth } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { requireFeature } from "../billing/entitlements.service.js";
import {
  deleteCampaignById,
  postContinueCampaignWithReplacement,
  getCampaignById,
  getCampaigns,
  getRecipients,
  patchCampaign,
  patchCampaignStatus,
  postCampaign,
  postCampaignRerun,
  streamCampaignUpdates,
} from "./campaigns.controller.js";
import {
  campaignIdSchema,
  continueCampaignWithReplacementSchema,
  createCampaignSchema,
  listCampaignsSchema,
  updateCampaignSchema,
  updateCampaignStatusSchema,
} from "./campaigns.schemas.js";

export const campaignsRouter = Router();

campaignsRouter.use(requireAuth);
campaignsRouter.use(requireFeature("campaign-message"));

campaignsRouter.get("/", requireScope("campaigns:read"), validate(listCampaignsSchema), getCampaigns);
campaignsRouter.post("/", requireScope("campaigns:write"), validate(createCampaignSchema), postCampaign);
campaignsRouter.get("/stream", requireScope("campaigns:read"), streamCampaignUpdates);
campaignsRouter.get("/:id", requireScope("campaigns:read"), validate(campaignIdSchema), getCampaignById);
campaignsRouter.get("/:id/recipients", requireScope("campaigns:read"), validate(campaignIdSchema), getRecipients);
campaignsRouter.patch("/:id", requireScope("campaigns:write"), validate(updateCampaignSchema), patchCampaign);
campaignsRouter.post("/:id/rerun", requireScope("campaigns:write"), validate(campaignIdSchema), postCampaignRerun);
campaignsRouter.post("/:id/replacement/resume", requireSessionAuth, validate(continueCampaignWithReplacementSchema), postContinueCampaignWithReplacement);
campaignsRouter.patch("/:id/status", requireScope("campaigns:write"), validate(updateCampaignStatusSchema), patchCampaignStatus);
campaignsRouter.delete("/:id", requireScope("campaigns:write"), validate(campaignIdSchema), deleteCampaignById);
