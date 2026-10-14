import { z } from "zod";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid plan id");
const checkoutBodySchema = z.object({ planId: objectId, billingCycle: z.enum(["monthly", "yearly"]) });
export const checkoutPreviewSchema = z.object({ body: checkoutBodySchema });
export const checkoutSchema = z.object({ body: checkoutBodySchema.extend({ phone: z.string().trim().regex(/^\+?[1-9]\d{7,14}$/, "Enter a valid billing mobile number") }) });
export const razorpayVerifySchema = z.object({
  body: z.object({
    paymentId: z.string().optional(),
    razorpay_order_id: z.string().min(1, "Order ID is required"),
    razorpay_payment_id: z.string().min(1, "Payment ID is required"),
    razorpay_signature: z.string().min(1, "Signature is required"),
  }),
});
