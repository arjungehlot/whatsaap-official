import { z } from "zod";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid template id");
const category = z.enum(["Marketing", "Transactional", "Reminder", "Welcome", "Follow-up", "Other"]);
const status = z.enum(["draft", "active", "inactive"]);
const attachmentObject = z.object({
    kind: z.enum(["image", "video", "document"]),
    bucket: z.string().trim().min(1).optional(),
    key: z.string().trim().min(1).optional(),
    name: z.string().trim().min(1),
    mimeType: z.string().trim().min(1),
    size: z.number().int().positive(),
  });
const attachment = attachmentObject
  .nullable()
  .optional();
const attachments = z.array(attachmentObject).max(10, "A template can have up to 10 attachments").optional();

const templateBody = z.object({
  name: z.string().trim().min(2).max(120),
  category: category.default("Marketing"),
  language: z.string().trim().min(2).max(40).default("English"),
  status: status.default("draft"),
  body: z.string().trim().min(1).max(4000),
  attachment,
  attachments,
});

export const listTemplatesSchema = z.object({
  query: z.object({
    search: z.string().trim().optional(),
    category: z.union([category, z.literal("all")]).optional(),
    status: z.union([status, z.literal("all")]).optional(),
  }),
});

export const templateIdSchema = z.object({
  params: z.object({ id: objectId }),
});

export const createTemplateSchema = z.object({ body: templateBody });
export const updateTemplateSchema = templateIdSchema.extend({ body: templateBody.partial() });
export const duplicateTemplateSchema = templateIdSchema.extend({
  body: z.object({ name: z.string().trim().min(2).max(120).optional() }).optional(),
});
