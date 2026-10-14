import { z } from "zod";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid id");
const channelId = z.string().regex(/^ch_[A-Za-z0-9_-]{24}$/, "Invalid WhatsApp channel ID");
const status = z.enum(["draft", "scheduled", "running", "paused", "completed", "failed"]);

export const listCampaignsSchema = z.object({
  query: z.object({
    search: z.string().trim().optional(),
    status: z.union([status, z.literal("all")]).optional(),
  }),
});

export const campaignIdSchema = z.object({
  params: z.object({ id: objectId }),
});

export const createCampaignSchema = z.object({
  body: z.object({
    name: z.string().trim().min(3).max(140),
    description: z.string().trim().max(1000).optional(),
    accountId: channelId.optional(),
    templateId: objectId,
    audienceType: z.enum(["all", "tag", "contacts"]).default("all"),
    audienceTag: z.string().trim().min(1).max(40).optional(),
    contactIds: z.array(objectId).max(10000).optional(),
    scheduledAt: z.string().min(16).max(40).optional(),
    timezone: z.string().trim().min(1).max(80).default("Asia/Kolkata"),
    sendNow: z.boolean().default(false),
    ratePerMinute: z.coerce.number().int().min(1).max(250).default(120),
  }),
});

export const updateCampaignSchema = campaignIdSchema.extend({
  body: z.object({
    name: z.string().trim().min(3).max(140).optional(),
    description: z.string().trim().max(1000).optional(),
    accountId: channelId.optional(),
    templateId: objectId.optional(),
    audienceType: z.enum(["all", "tag", "contacts"]).optional(),
    audienceTag: z.string().trim().min(1).max(40).optional(),
    contactIds: z.array(objectId).max(10000).optional(),
    scheduledAt: z.string().min(16).max(40).nullable().optional(),
    timezone: z.string().trim().min(1).max(80).optional(),
    ratePerMinute: z.coerce.number().int().min(1).max(250).optional(),
  }),
});

export const updateCampaignStatusSchema = campaignIdSchema.extend({
  body: z.object({
    status: z.enum(["running", "paused", "scheduled", "draft"]),
    scheduledAt: z.string().min(16).max(40).optional(),
    timezone: z.string().trim().min(1).max(80).optional(),
  }),
});

export const continueCampaignWithReplacementSchema = campaignIdSchema.extend({
  body: z.object({
    confirm: z.literal(true, { errorMap: () => ({ message: "Explicit replacement confirmation is required" }) }),
  }),
});
