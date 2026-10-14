import { z } from "zod";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid id");
const valueType = z.enum(["boolean", "number", "unlimited", "text"]);
const featureInput = z.object({
  featureId: objectId,
  valueType,
  booleanValue: z.boolean().optional(),
  numberValue: z.coerce.number().min(0).optional(),
  textValue: z.string().trim().max(200).optional(),
});

export const userListSchema = z.object({ query: z.object({ search: z.string().trim().optional(), plan: z.string().trim().optional(), accountStatus: z.enum(["active", "suspended", "deactivated"]).optional(), subscriptionStatus: z.string().trim().optional(), billingCycle: z.enum(["monthly", "yearly"]).optional(), page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(25), sort: z.string().trim().optional(), direction: z.enum(["asc", "desc"]).default("desc") }) });
export const idSchema = z.object({ params: z.object({ id: objectId }) });
export const userStatusSchema = idSchema.extend({ body: z.object({ accountStatus: z.enum(["active", "suspended", "deactivated"]) }) });
export const assignPlanSchema = idSchema.extend({ body: z.object({ planId: objectId, billingCycle: z.enum(["monthly", "yearly"]), autoRenew: z.boolean().default(false) }) });
export const userExpirySchema = idSchema.extend({ body: z.object({ expiryDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Expiry date must use YYYY-MM-DD") }) });
export const deleteUserSchema = idSchema.extend({ body: z.object({ confirmation: z.string().trim().min(1).max(320) }) });
export const featureCreateSchema = z.object({ body: z.object({ key: z.string().trim().regex(/^[a-z0-9_-]+$/), name: z.string().trim().min(1).max(120), description: z.string().trim().max(500).optional(), valueType, active: z.boolean().default(true), displayOrder: z.coerce.number().int().min(0).default(0) }) });
export const featureUpdateSchema = idSchema.extend({ body: featureCreateSchema.shape.body.partial() });
const planBodySchema = z.object({ name: z.string().trim().min(1).max(100), slug: z.string().trim().regex(/^[a-z0-9-]+$/), description: z.string().trim().max(500).optional(), monthlyPrice: z.coerce.number().min(0), yearlyPrice: z.coerce.number().min(0), currency: z.string().trim().length(3).default("INR"), status: z.enum(["active", "inactive"]).default("active"), visibility: z.enum(["public", "private"]).default("public"), popular: z.boolean().default(false), isTrial: z.boolean().default(false), trialDays: z.coerce.number().int().min(1).max(365).optional(), messageCreditsUnlimited: z.boolean().default(true), monthlyMessageCredits: z.coerce.number().int().min(0).default(0), dailyMessageCredits: z.coerce.number().int().min(0).default(0), displayOrder: z.coerce.number().int().min(0).default(0), features: z.array(featureInput).default([]) });
export const planCreateSchema = z.object({ body: planBodySchema.superRefine((body, ctx) => { if (body.isTrial && !body.trialDays) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["trialDays"], message: "Trial days are required for a trial plan" }); if (body.isTrial && (body.monthlyPrice !== 0 || body.yearlyPrice !== 0)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["monthlyPrice"], message: "Trial plans must be free" }); if (!body.messageCreditsUnlimited && !body.monthlyMessageCredits && !body.dailyMessageCredits) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["monthlyMessageCredits"], message: "Set a monthly or daily message credit limit, or select unlimited credits" }); }) });
export const planUpdateSchema = idSchema.extend({ body: planBodySchema.partial().extend({ features: z.array(featureInput).optional() }) });
export const planDuplicateSchema = idSchema.extend({ body: z.object({ name: z.string().trim().min(1).max(100).optional(), slug: z.string().trim().regex(/^[a-z0-9-]+$/).optional() }) });
export const planReorderSchema = z.object({ body: z.object({ planIds: z.array(objectId).min(1) }) });
export const pageSchema = z.object({ query: z.object({ page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(25), status: z.string().optional() }) });
