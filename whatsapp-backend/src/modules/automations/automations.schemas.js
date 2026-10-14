import { z } from "zod";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid id");
const channelId = z.string().regex(/^ch_[A-Za-z0-9_-]{24}$/, "Invalid WhatsApp channel ID");
const body = z.object({
  name: z.string().trim().min(1).max(140),
  triggerType: z.enum(["birthday", "event"]),
  dateField: z.string().trim().min(1).max(80).default("dateOfBirth"),
  eventDate: z.string().min(16).max(40).optional(),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).default("09:00"),
  timezone: z.string().trim().min(1).max(80).default("Asia/Kolkata"),
  accountId: channelId,
  mode: z.enum(["direct", "template"]),
  message: z.string().trim().max(4000).optional(),
  templateId: objectId.optional(),
  audienceType: z.enum(["all", "tag", "contacts"]),
  audienceTag: z.string().trim().min(1).max(40).optional(),
  contactIds: z.array(objectId).max(10000).optional(),
}).refine((value) => value.mode !== "direct" || Boolean(value.message), "A direct message is required")
  .refine((value) => value.mode !== "template" || Boolean(value.templateId), "Select a template")
  .refine((value) => value.triggerType !== "event" || Boolean(value.eventDate), "Event date is required")
  .refine((value) => value.audienceType !== "tag" || Boolean(value.audienceTag), "Select an audience tag")
  .refine((value) => value.audienceType !== "contacts" || Boolean(value.contactIds?.length), "Select at least one contact");

export const createAutomationSchema = z.object({ body });
export const listAutomationsSchema = z.object({ query: z.object({}) });
export const automationIdSchema = z.object({ params: z.object({ id: objectId }) });
export const updateAutomationStatusSchema = automationIdSchema.extend({ body: z.object({ status: z.enum(["active", "paused"]) }) });
