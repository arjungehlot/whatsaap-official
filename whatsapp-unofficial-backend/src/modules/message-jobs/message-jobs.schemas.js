import { z } from "zod";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid id");
const channelId = z.string().regex(/^ch_[A-Za-z0-9_-]{24}$/, "Invalid WhatsApp channel ID");

export const createMessageJobSchema = z.object({
  body: z.object({
    name: z.string().trim().min(1).max(140),
    accountId: channelId.optional(),
    mode: z.enum(["direct", "template"]),
    templateId: objectId.optional(),
    message: z.string().trim().max(4000).optional(),
    audienceType: z.enum(["all", "tag", "contacts"]),
    audienceTag: z.string().trim().min(1).max(40).optional(),
    contactIds: z.array(objectId).max(10000).optional(),
    scheduledAt: z.string().min(16).max(40).optional(),
    timezone: z.string().trim().min(1).max(80).default("Asia/Kolkata"),
    sendNow: z.boolean().default(false),
  }).refine((value) => value.mode !== "direct" || Boolean(value.message?.trim()), "A direct message is required")
    .refine((value) => value.mode !== "template" || Boolean(value.templateId), "Select a template")
    .refine((value) => value.audienceType !== "tag" || Boolean(value.audienceTag), "Select an audience tag")
    .refine((value) => value.audienceType !== "contacts" || Boolean(value.contactIds?.length), "Select at least one contact"),
});

export const listMessageJobsSchema = z.object({
  query: z.object({ status: z.string().optional() }),
});

export const messageJobIdSchema = z.object({ params: z.object({ id: objectId }) });
export const messageJobRecipientIdSchema = z.object({ params: z.object({ id: objectId, recipientId: objectId }) });
export const messageJobStatusSchema = messageJobIdSchema.extend({
  body: z.object({ status: z.enum(["running", "paused", "cancelled"]) }),
});
