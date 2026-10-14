import { z } from "zod";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid contact id");
const source = z.enum(["Manual", "CSV Import", "Website Form", "API", "WhatsApp"]);
const status = z.enum(["active", "inactive", "blocked"]);

const contactBody = z.object({
  name: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(8).max(30),
  email: z.string().trim().email().optional().or(z.literal("")),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date of birth must be YYYY-MM-DD").optional().or(z.literal("")),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
  source: source.optional(),
  status: status.optional(),
  notes: z.string().trim().max(1000).optional(),
  customFields: z.record(z.string().trim().max(200)).optional(),
});

export const listContactsSchema = z.object({
  query: z.object({
    search: z.string().trim().optional(),
    tag: z.string().trim().optional(),
    status: z.union([status, z.literal("all")]).optional(),
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  }),
});

export const contactIdSchema = z.object({
  params: z.object({ id: objectId }),
});

export const createContactSchema = z.object({ body: contactBody });

export const updateContactSchema = contactIdSchema.extend({
  body: contactBody.partial().refine((value) => Object.keys(value).length > 0, "Nothing to update"),
});

export const bulkDeleteContactsSchema = z.object({
  body: z.object({ ids: z.array(objectId).min(1).max(500) }),
});
