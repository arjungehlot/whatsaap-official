import { z } from "zod";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid id");
const channelId = z.string().regex(/^ch_[A-Za-z0-9_-]{24}$/, "Invalid WhatsApp channel ID");
const scope = z.enum([
  "messages:write",
  "contacts:read",
  "contacts:write",
  "templates:read",
  "templates:write",
  "campaigns:read",
  "campaigns:write",
  "whatsapp:read",
  "whatsapp:manage",
]);

export const createApiKeySchema = z.object({
  body: z.object({
    label: z.string().trim().min(2).max(80),
    environment: z.enum(["test", "live"]).default("live"),
    defaultAccountId: channelId.optional(),
    scopes: z.array(scope).min(1).max(9).optional(),
  }),
});

export const updateApiKeySchema = z.object({
  params: z.object({ id: objectId }),
  body: z.object({
    label: z.string().trim().min(2).max(80).optional(),
    defaultAccountId: channelId.optional(),
  }).refine((payload) => payload.label !== undefined || payload.defaultAccountId !== undefined, {
    message: "Provide a label or WhatsApp number to update",
  }),
});

export const apiKeyIdSchema = z.object({
  params: z.object({ id: objectId }),
});

export const rebindApiKeyReplacementSchema = apiKeyIdSchema.extend({
  body: z.object({
    confirm: z.literal(true, { errorMap: () => ({ message: "Explicit replacement confirmation is required" }) }),
  }),
});
