import { z } from "zod";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid message log id");

export const listMessageLogsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    search: z.string().trim().max(200).optional(),
    source: z
      .enum(["campaign", "send-message", "api", "inbox", "all"])
      .optional(),
    status: z
      .enum(["pending", "sent", "delivered", "read", "failed", "all"])
      .optional(),
  }),
});

export const retryMessageLogSchema = z.object({
  params: z.object({ id: objectId }),
});

export const cancelPendingMessageLogsSchema = z.object({
  body: z.object({ ids: z.array(objectId).min(1).max(100) }),
});
