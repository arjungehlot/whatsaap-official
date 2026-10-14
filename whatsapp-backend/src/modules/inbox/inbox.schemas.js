import { z } from "zod";

const mongoId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid conversation id");

export const listConversationsSchema = z.object({
  query: z.object({
    filter: z.enum(["all", "unread", "assigned", "starred"]).optional(),
    view: z.enum(["personal", "groups"]).optional(),
    search: z.string().trim().max(80).optional(),
    cursor: z.string().datetime().optional(),
    limit: z.coerce.number().int().min(1).max(75).optional(),
  }),
});

export const listMessagesSchema = z.object({
  params: z.object({
    id: mongoId,
  }),
  query: z.object({
    before: z.string().datetime().optional(),
    limit: z.coerce.number().int().min(1).max(75).optional(),
  }),
});

export const inboxMessageIdSchema = z.object({
  params: z.object({
    id: mongoId,
  }),
});

const inboxAttachmentSchema = z.object({
  kind: z.enum(["image", "video", "document"]),
  bucket: z.string().trim().min(1),
  key: z.string().trim().min(1),
  name: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().min(1).max(255),
  size: z.coerce.number().int().min(1).max(25 * 1024 * 1024),
});

// Older inbox clients submitted one or more text parts. Normalize that legacy
// shape at the boundary so every downstream sender receives one text string.
const inboxMessageBodySchema = z.union([
  z.string().trim().max(4000, "Message is too long"),
  z.array(z.string().trim().max(4000, "Message is too long")).max(10),
]).optional().transform((value) => (
  Array.isArray(value) ? value.filter(Boolean).join("\n") : value || ""
));

export const sendMessageSchema = z.object({
  params: z.object({
    id: mongoId,
  }),
  body: z.object({
    body: inboxMessageBodySchema,
    attachments: z.array(inboxAttachmentSchema).max(10).optional(),
  })
    .refine((value) => value.body.length <= 4000, { path: ["body"], message: "Message is too long" })
    .refine((value) => Boolean(value.body || value.attachments?.length), "Write a message or attach a file"),
});
