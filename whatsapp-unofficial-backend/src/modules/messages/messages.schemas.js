import { z } from "zod";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid id");
const channelId = z.string().regex(/^ch_[A-Za-z0-9_-]{24}$/, "Invalid WhatsApp channel ID");
const attachment = z.object({
  kind: z.enum(["image", "video", "document"]),
  bucket: z.string().trim().min(1).optional(),
  key: z.string().trim().min(1),
  name: z.string().trim().min(1),
  mimeType: z.string().trim().min(1),
  size: z.number().int().positive().optional(),
});

const button = z.object({
  title: z.string().trim().max(20).optional(),
  body: z.string().trim().min(1).max(1024),
  footer: z.string().trim().max(60).optional(),
  buttons: z.array(z.object({ id: z.string().trim().max(80).optional(), text: z.string().trim().min(1).max(20) })).min(1).max(3),
});

export const sendMessageSchema = z.object({
  body: z.object({
    to: z.string().trim().min(8).max(90),
    body: z.string().trim().max(4000).optional(),
    accountId: channelId.optional(),
    channelId: channelId.optional(),
    attachment: attachment.optional(),
    attachments: z.array(attachment).max(10).optional(),
    button: button.optional(),
  }).refine((value) => Boolean(value.body || value.attachment || value.attachments?.length || value.button), {
    message: "Provide body, button, attachment or attachments",
  }),
});
