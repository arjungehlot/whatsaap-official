import { z } from "zod";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid webhook id");
const event = z.string().trim().regex(/^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$/, "Invalid event name");
const endpointBody = z.object({
  name: z.string().trim().min(1).max(120),
  url: z.string().url().refine((value) => value.startsWith("https://"), "Webhook URL must use HTTPS"),
  description: z.string().trim().max(500).optional(),
  events: z.array(event).min(1).max(50),
  retries: z.boolean().optional(),
});

export const listWebhooksSchema = z.object({ query: z.object({}) });
export const createWebhookSchema = z.object({ body: endpointBody });
export const updateWebhookSchema = z.object({
  params: z.object({ id: objectId }),
  body: endpointBody.partial().extend({ status: z.enum(["active", "paused"]).optional() }).refine((value) => Object.keys(value).length > 0, "Nothing to update"),
});
export const webhookIdSchema = z.object({ params: z.object({ id: objectId }) });
export const deliveryIdSchema = z.object({ params: z.object({ id: objectId }) });
