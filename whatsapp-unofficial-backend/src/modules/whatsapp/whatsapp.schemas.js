import { z } from "zod";

const channelId = z.string().regex(/^ch_[A-Za-z0-9_-]{24}$/, "Invalid WhatsApp channel ID");

export const accountIdSchema = z.object({
  params: z.object({
    id: channelId,
  }),
});

export const disconnectAccountSchema = accountIdSchema.extend({
  body: z.object({
    confirm: z.literal(true, { errorMap: () => ({ message: "Explicit disconnect confirmation is required" }) }),
  }),
});

export const createAccountSchema = z.object({
  body: z.object({
    phone: z.string().trim().min(8).optional(),
    displayName: z.string().trim().min(2).optional(),
    accountType: z.enum(["business", "personal"]).optional(),
    sendSettings: z
      .object({
        hourlyCap: z.coerce.number().int().min(1).max(250).optional(),
        dailyCap: z.coerce.number().int().min(1).max(5000).optional(),
        warmupHourlyCap: z.coerce.number().int().min(1).max(250).optional(),
        warmupDailyCap: z.coerce.number().int().min(1).max(5000).optional(),
        minDelayMs: z.coerce.number().int().min(3000).max(600000).optional(),
        maxDelayMs: z.coerce.number().int().min(3000).max(600000).optional(),
        warmupMinDelayMs: z.coerce.number().int().min(3000).max(600000).optional(),
        warmupMaxDelayMs: z.coerce.number().int().min(3000).max(600000).optional(),
      })
      .optional(),
  }),
});

export const updateAccountSchema = accountIdSchema.extend({
  body: z.object({
    displayName: z.string().trim().min(2, "Display name must be at least 2 characters").max(60).optional(),
    sendSettings: z
      .object({
        hourlyCap: z.coerce.number().int().min(1).max(250).optional(),
        dailyCap: z.coerce.number().int().min(1).max(5000).optional(),
        warmupHourlyCap: z.coerce.number().int().min(1).max(250).optional(),
        warmupDailyCap: z.coerce.number().int().min(1).max(5000).optional(),
        minDelayMs: z.coerce.number().int().min(3000).max(600000).optional(),
        maxDelayMs: z.coerce.number().int().min(3000).max(600000).optional(),
        warmupMinDelayMs: z.coerce.number().int().min(3000).max(600000).optional(),
        warmupMaxDelayMs: z.coerce.number().int().min(3000).max(600000).optional(),
      })
      .optional(),
  }),
});

export const listEventsSchema = accountIdSchema.extend({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(10),
  }),
});
