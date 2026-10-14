import { env } from "../../config/env.js";
import * as service from "./billing.service.js";
import { getEntitlements as getUserEntitlements } from "./entitlements.service.js";
import { getMessageCreditSummary } from "./message-credits.service.js";
export async function getPlans(_req, res) { res.json({ success: true, data: { plans: await service.listPublicPlans(), currency: "INR" } }); }
export async function getMe(req, res) { res.json({ success: true, data: { subscription: await service.getCurrentSubscription(req.user._id) } }); }
export async function getEntitlements(req, res) { res.json({ success: true, data: await getUserEntitlements(req.user._id) }); }
export async function getMessageCredits(req, res) { res.json({ success: true, data: await getMessageCreditSummary(req.user._id) }); }
export async function checkoutPreview(req, res) { res.json({ success: true, data: await service.previewCheckout(req.user._id, req.validated.body) }); }
export async function checkout(req, res) { res.status(201).json({ success: true, data: await service.createCheckout(req.user._id, req.validated.body) }); }
export async function razorpayVerify(req, res, next) {
  try {
    const payment = await service.verifyRazorpayPayment({
      userId: req.user._id,
      ...req.validated.body,
    });
    res.json({ success: true, data: { payment } });
  } catch (error) {
    next(error);
  }
}
export async function razorpayWebhook(req, res, next) {
  try {
    const signature = req.headers["x-razorpay-signature"];
    const result = await service.applyRazorpayWebhook(req.body, signature);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}
export async function payuCallback(req, res) { const result = await service.applyPayuCallback(req.body); const redirect = result.status === "successful" ? env.payuFrontendSuccessUrl : env.payuFrontendFailureUrl; res.redirect(303, redirect || "/pricing"); }

