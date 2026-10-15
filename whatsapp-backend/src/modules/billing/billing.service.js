import crypto from "node:crypto";
import Razorpay from "razorpay";
import { env } from "../../config/env.js";
import { FeatureModel } from "../../models/Feature.js";
import { PaymentModel } from "../../models/Payment.js";
import { PlanFeatureModel } from "../../models/PlanFeature.js";
import { PlanModel } from "../../models/Plan.js";
import { SubscriptionModel } from "../../models/Subscription.js";
import { UserModel } from "../../models/User.js";
import { ApiError } from "../../utils/apiError.js";
import { normalizeInitialPaidPlanOrder } from "./plan-order.service.js";

function value(row) { if (row.valueType === "boolean") return row.booleanValue === true; if (row.valueType === "number") return row.numberValue ?? 0; if (row.valueType === "unlimited") return "unlimited"; return row.textValue || ""; }
function trialMessageCredits(plan) { if (!plan.isTrial || plan.messageCreditsUnlimited !== false || !plan.dailyMessageCredits) return null; return plan.dailyMessageCredits * Math.max(1, plan.trialDays || 3); }
async function serializePlan(plan) { const rows = await PlanFeatureModel.find({ planId: plan._id }).populate("featureId").lean(); return { id: plan._id.toString(), name: plan.name, slug: plan.slug, description: plan.description, monthlyPrice: plan.monthlyPrice, yearlyPrice: plan.yearlyPrice, currency: plan.currency, popular: plan.popular, isTrial: plan.isTrial, trialDays: plan.trialDays, messageCreditsUnlimited: plan.messageCreditsUnlimited !== false, monthlyMessageCredits: plan.monthlyMessageCredits || 0, dailyMessageCredits: plan.dailyMessageCredits || 0, trialMessageCredits: trialMessageCredits(plan), features: rows.filter((row) => row.featureId?.active !== false).map((row) => ({ key: row.featureId.key, name: row.featureId.name, description: row.featureId.description, valueType: row.valueType, value: value(row) })) }; }
export async function ensureDefaultFeatures() {
  const definitions = [["send-message", "Send message"], ["campaign-message", "Campaign message"], ["webhook", "Webhooks"], ["api-keys", "API keys"], ["inbox", "Inbox"], ["inbox-groups", "Inbox groups"], ["template", "Templates"], ["scheduler", "Scheduler"]];
  const saved = await Promise.all(definitions.map(([key, name], displayOrder) => FeatureModel.findOneAndUpdate({ key }, { $setOnInsert: { key, name, valueType: "boolean", active: true, displayOrder } }, { upsert: true, returnDocument: "after" })));
  const core = saved.filter((feature) => ["send-message", "campaign-message", "template", "scheduler", "inbox"].includes(feature.key));
  const plans = await PlanModel.find().select("_id").lean();
  await Promise.all(plans.map(async (plan) => { if (!(await PlanFeatureModel.exists({ planId: plan._id }))) await PlanFeatureModel.insertMany(core.map((feature) => ({ planId: plan._id, featureId: feature._id, valueType: "boolean", booleanValue: true }))); }));
}
export async function ensureTrialPlan() { return PlanModel.findOneAndUpdate({ slug: "free-trial" }, { $set: { isTrial: true, monthlyPrice: 0, yearlyPrice: 0, status: "active", visibility: "public" }, $setOnInsert: { name: "3-Day Free Trial", slug: "free-trial", description: "Try Whatsaap free for three days.", currency: "INR", popular: false, displayOrder: -1, trialDays: 3 } }, { upsert: true, returnDocument: "after" }); }
export async function listPublicPlans() { await normalizeInitialPaidPlanOrder(); const plans = await PlanModel.find({ status: "active", visibility: "public" }).sort({ displayOrder: 1, createdAt: 1 }); return Promise.all(plans.map(serializePlan)); }
export async function getCurrentSubscription(userId) {
  const now = new Date();
  await SubscriptionModel.updateMany(
    { userId, status: "active", expiryDate: { $lte: now } },
    { $set: { status: "expired" } },
  );

  return SubscriptionModel.findOne({ userId, status: "active", expiryDate: { $gt: now } })
    .populate("planId")
    .sort({ expiryDate: -1, createdAt: -1 })
    .lean();
}
export async function provisionTrial(userId) {
  const existing = await SubscriptionModel.exists({ userId }); if (existing) return;
  const plan = await ensureTrialPlan(); const startDate = new Date(); const expiryDate = new Date(startDate.getTime() + (plan.trialDays || 3) * 24 * 60 * 60 * 1000);
  return SubscriptionModel.create({ userId, planId: plan._id, billingCycle: "monthly", status: "active", startDate, expiryDate, isTrial: true, planNameSnapshot: plan.name, amountSnapshot: 0, currencySnapshot: plan.currency });
}
export async function backfillTrials() { const subscribedUserIds = await SubscriptionModel.distinct("userId"); const users = await UserModel.find({ _id: { $nin: subscribedUserIds }, accountStatus: { $ne: "deactivated" } }).select("_id").lean(); for (const user of users) await provisionTrial(user._id); return users.length; }
const money = (amount) => Math.round((Number(amount) + Number.EPSILON) * 100) / 100;
const GST_RATE = 18;
const planPrice = (plan, billingCycle) => money(billingCycle === "yearly" ? plan.yearlyPrice : plan.monthlyPrice);
const planTierValue = (plan) => money(Number(plan.yearlyPrice) || Number(plan.monthlyPrice) * 12);
const subscriptionId = (subscription) => subscription?._id?.toString();
const populatedPlanId = (subscription) => subscription?.planId?._id?.toString() || subscription?.planId?.toString();

function createPayuTransactionId() {
  // PayU hosted checkout accepts an alphanumeric transaction ID of at most 25 characters.
  return `WF${Date.now().toString(36).toUpperCase()}${crypto.randomBytes(5).toString("hex").toUpperCase()}`;
}

async function reservePayuCheckout(userId) {
  const now = new Date();
  const lockUntil = new Date(now.getTime() + env.payuCheckoutCooldownMs);
  const lockToken = crypto.randomBytes(16).toString("hex");
  const user = await UserModel.findOneAndUpdate(
    {
      _id: userId,
      $or: [
        { payuCheckoutLockedUntil: { $exists: false } },
        { payuCheckoutLockedUntil: null },
        { payuCheckoutLockedUntil: { $lte: now } },
      ],
    },
    { $set: { payuCheckoutLockedUntil: lockUntil, payuCheckoutLockToken: lockToken } },
    { returnDocument: "after" },
  ).select("_id").lean();

  if (user) return lockToken;

  const existing = await UserModel.findById(userId).select("payuCheckoutLockedUntil").lean();
  const retryAfterSeconds = Math.max(
    1,
    Math.ceil((new Date(existing?.payuCheckoutLockedUntil || now).getTime() - now.getTime()) / 1000),
  );
  throw new ApiError(429, `A secure checkout is already in progress. Try again in ${retryAfterSeconds} seconds.`);
}

async function releasePayuCheckout(userId, lockToken) {
  await UserModel.updateOne(
    { _id: userId, payuCheckoutLockToken: lockToken },
    { $unset: { payuCheckoutLockedUntil: 1, payuCheckoutLockToken: 1 } },
  );
}

async function cancelInvalidLegacyPayuPayments(userId) {
  await PaymentModel.updateMany(
    {
      userId,
      status: "pending",
      gateway: "payu",
      $expr: { $gt: [{ $strLenCP: { $ifNull: ["$gatewayTransactionId", ""] } }, 25] },
    },
    {
      $set: {
        status: "cancelled",
        failureReason: "Cancelled because the PayU transaction ID exceeded the gateway limit.",
      },
    },
  );
}

function subscriptionTierValue(subscription) {
  if (subscription?.planId?.yearlyPrice !== undefined) return planTierValue(subscription.planId);
  const amount = Number(subscription.taxableAmountSnapshot ?? subscription.amountSnapshot);
  return money(subscription.billingCycle === "yearly" ? amount : amount * 12);
}

function unusedSubscriptionCredit(subscription, now) {
  if (subscription.isTrial || !subscription.paymentId || !subscription.startDate || !subscription.expiryDate) return 0;
  const totalMs = new Date(subscription.expiryDate).getTime() - new Date(subscription.startDate).getTime();
  const remainingMs = new Date(subscription.expiryDate).getTime() - now.getTime();
  if (totalMs <= 0 || remainingMs <= 0) return 0;
  return money(Number(subscription.taxableAmountSnapshot ?? subscription.amountSnapshot) * Math.min(1, remainingMs / totalMs));
}

function checkoutQuote(subscription, plan, billingCycle, now) {
  const baseAmount = planPrice(plan, billingCycle);
  const isUpgrade = Boolean(subscription);
  let prorationCredit = 0;

  if (subscription) {
    const samePlan = populatedPlanId(subscription) === plan._id.toString();
    const isYearlySwitch = samePlan && subscription.billingCycle === "monthly" && billingCycle === "yearly";
    if (samePlan && subscription.billingCycle === billingCycle) throw new ApiError(409, "This plan and billing cycle are already active");
    if (!subscription.isTrial && !isYearlySwitch && planTierValue(plan) <= subscriptionTierValue(subscription)) {
      throw new ApiError(400, "Downgrades are not available. Choose a higher plan or switch your current monthly plan to yearly billing.");
    }
    prorationCredit = unusedSubscriptionCredit(subscription, now);
  }

  const taxableAmount = money(Math.max(0, baseAmount - prorationCredit));
  const gstAmount = money(taxableAmount * (GST_RATE / 100));
  return {
    planId: plan._id.toString(),
    planName: plan.name,
    billingCycle,
    currency: plan.currency,
    isUpgrade,
    currentPlanName: subscription?.planNameSnapshot || subscription?.planId?.name || null,
    baseAmount,
    prorationCredit,
    taxableAmount,
    gstRate: GST_RATE,
    gstAmount,
    amountDue: money(taxableAmount + gstAmount),
  };
}

async function quoteForUser(userId, { planId, billingCycle }) {
  const [plan, subscription] = await Promise.all([
    PlanModel.findOne({ _id: planId, status: "active", visibility: "public" }),
    getCurrentSubscription(userId),
  ]);
  if (!plan) throw new ApiError(404, "Plan not found");
  if (plan.isTrial) throw new ApiError(400, "The free trial is automatically applied to new accounts");
  return { plan, subscription, quote: checkoutQuote(subscription, plan, billingCycle, new Date()) };
}

export async function previewCheckout(userId, payload) {
  const { quote } = await quoteForUser(userId, payload);
  return quote;
}

async function activateSuccessfulPayment(payment, paymentMethod) {
  const plan = await PlanModel.findById(payment.planId).lean();
  if (!plan) throw new ApiError(404, "The selected plan no longer exists");
  const startDate = new Date();
  const expiryDate = new Date(startDate);
  if (payment.billingCycle === "monthly") expiryDate.setMonth(expiryDate.getMonth() + 1);
  else expiryDate.setFullYear(expiryDate.getFullYear() + 1);
  await SubscriptionModel.updateMany({ userId: payment.userId, status: "active" }, { $set: { status: "cancelled", expiryDate: startDate } });
  const subscription = await SubscriptionModel.create({ userId: payment.userId, planId: payment.planId, billingCycle: payment.billingCycle, status: "active", startDate, expiryDate, paymentId: payment._id, planNameSnapshot: plan.name, amountSnapshot: payment.amount, taxableAmountSnapshot: payment.baseAmount, gstAmountSnapshot: payment.gstAmount || 0, currencySnapshot: payment.currency });
  payment.status = "successful";
  payment.completedAt = new Date();
  payment.paymentMethod = paymentMethod;
  payment.subscriptionId = subscription._id;
  await payment.save();
  return payment;
}

async function verifyPayuPayment(payment) {
  const command = "verify_payment";
  const txnid = payment.gatewayTransactionId;
  const hash = crypto.createHash("sha512").update(`${env.payuKey}|${command}|${txnid}|${env.payuSalt}`).digest("hex");

  let response;
  try {
    response = await fetch(env.payuVerifyUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ key: env.payuKey, command, var1: txnid, hash }),
      signal: AbortSignal.timeout(env.payuVerifyTimeoutMs),
    });
  } catch (error) {
    throw new ApiError(502, `Unable to verify the PayU payment: ${error.message}`);
  }

  if (!response.ok) throw new ApiError(502, "PayU payment verification was unavailable");
  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new ApiError(502, "PayU payment verification returned an invalid response");
  }

  const transaction = payload?.transaction_details?.[txnid];
  const verifiedAmount = transaction?.amt ?? transaction?.amount ?? transaction?.transaction_amount;
  const isConfirmed = String(transaction?.status).toLowerCase() === "success"
    && String(transaction?.txnid) === txnid
    && money(verifiedAmount) === money(payment.amount);
  if (!isConfirmed) {
    console.warn("PayU payment verification mismatch", {
      txnid,
      verifyStatus: payload?.status,
      transactionStatus: transaction?.status,
      verifiedTransactionId: transaction?.txnid,
      expectedAmount: payment.amount,
      verifiedAmount,
    });
    throw new ApiError(400, "PayU could not confirm this payment as successful");
  }
}

let razorpayClientInstance = null;
function getRazorpayClient() {
  if (razorpayClientInstance) return razorpayClientInstance;
  if (!env.razorpayKeyId || !env.razorpayKeySecret) {
    throw new ApiError(503, "Razorpay payment gateway is not configured yet");
  }
  razorpayClientInstance = new Razorpay({
    key_id: env.razorpayKeyId,
    key_secret: env.razorpayKeySecret,
  });
  return razorpayClientInstance;
}

export async function createCheckout(userId, { planId, billingCycle, phone }) {
  const isRazorpayConfigured = Boolean(env.razorpayKeyId && env.razorpayKeySecret);
  const isPayuConfigured = Boolean(env.payuKey && env.payuSalt);
  if (!isRazorpayConfigured && !isPayuConfigured) {
    throw new ApiError(503, "Online payments are not configured yet");
  }

  const [{ plan, subscription, quote }, user] = await Promise.all([
    quoteForUser(userId, { planId, billingCycle }),
    UserModel.findById(userId).select("name email phone").lean(),
  ]);
  if (!user?.email?.trim()) throw new ApiError(400, "Your account needs an email address before checkout");
  const billingPhone = phone.replace(/[\s()-]/g, "");
  if (user.phone !== billingPhone) await UserModel.updateOne({ _id: userId }, { $set: { phone: billingPhone } });

  let payment;
  if (quote.amountDue === 0) {
    payment = await PaymentModel.create({
      userId,
      planId,
      billingCycle,
      amount: 0,
      baseAmount: quote.baseAmount,
      prorationCredit: quote.prorationCredit,
      taxableAmount: 0,
      gstRate: quote.gstRate,
      gstAmount: 0,
      upgradeFromSubscriptionId: quote.isUpgrade ? subscriptionId(subscription) : undefined,
      currency: plan.currency || "INR",
      status: "successful",
      gateway: "manual",
    });
    await activateSuccessfulPayment(payment, "proration credit");
    return { paymentId: payment._id.toString(), completed: true, quote };
  }

  // Use Razorpay if configured
  if (isRazorpayConfigured) {
    const razorpay = getRazorpayClient();
    const amountPaise = Math.round(quote.amountDue * 100);
    const receipt = `wf_${Date.now().toString(36)}_${crypto.randomBytes(3).toString("hex")}`.slice(0, 40);

    const rzpOrder = await razorpay.orders.create({
      amount: amountPaise,
      currency: plan.currency || "INR",
      receipt,
      notes: {
        userId: userId.toString(),
        planId: plan._id.toString(),
        planName: plan.name,
        billingCycle,
      },
    });

    payment = await PaymentModel.create({
      userId,
      planId,
      billingCycle,
      amount: quote.amountDue,
      baseAmount: quote.baseAmount,
      prorationCredit: quote.prorationCredit,
      taxableAmount: quote.taxableAmount,
      gstRate: quote.gstRate,
      gstAmount: quote.gstAmount,
      upgradeFromSubscriptionId: quote.isUpgrade ? subscriptionId(subscription) : undefined,
      currency: plan.currency || "INR",
      status: "pending",
      gateway: "razorpay",
      gatewayTransactionId: rzpOrder.id,
      razorpayOrderId: rzpOrder.id,
    });

    console.info("Razorpay order created", {
      paymentId: payment._id.toString(),
      orderId: rzpOrder.id,
      amount: quote.amountDue,
    });

    return {
      paymentId: payment._id.toString(),
      completed: false,
      quote,
      gateway: "razorpay",
      keyId: env.razorpayKeyId,
      orderId: rzpOrder.id,
      amount: rzpOrder.amount,
      currency: rzpOrder.currency,
      name: "Whatsaap",
      description: `${plan.name} (${billingCycle}${quote.isUpgrade ? " upgrade" : ""})`,
      prefill: {
        name: user.name || "Customer",
        email: user.email,
        contact: billingPhone,
      },
      theme: {
        color: "#25D366",
      },
    };
  }

  // Fallback to PayU if Razorpay is not configured
  const checkoutLockToken = await reservePayuCheckout(userId);
  try {
    const txnid = createPayuTransactionId();
    payment = await PaymentModel.create({
      userId,
      planId,
      billingCycle,
      amount: quote.amountDue,
      baseAmount: quote.baseAmount,
      prorationCredit: quote.prorationCredit,
      taxableAmount: quote.taxableAmount,
      gstRate: quote.gstRate,
      gstAmount: quote.gstAmount,
      upgradeFromSubscriptionId: quote.isUpgrade ? subscriptionId(subscription) : undefined,
      currency: plan.currency,
      status: "pending",
      gateway: "payu",
      gatewayTransactionId: txnid,
    });
    await cancelInvalidLegacyPayuPayments(userId);
  } catch (error) {
    if (checkoutLockToken) await releasePayuCheckout(userId, checkoutLockToken);
    throw error;
  }

  const txnid = payment.gatewayTransactionId;
  const amountValue = quote.amountDue.toFixed(2);
  const productinfo = `${plan.name} (${billingCycle}${quote.isUpgrade ? " upgrade" : ""})`.slice(0, 100);
  const firstname = (user.name?.trim() || "Whatsaap").slice(0, 60);
  const email = user.email.trim();
  const hashInput = `${env.payuKey}|${txnid}|${amountValue}|${productinfo}|${firstname}|${email}|||||||||||${env.payuSalt}`;
  const hash = crypto.createHash("sha512").update(hashInput).digest("hex");
  return {
    paymentId: payment._id.toString(),
    completed: false,
    quote,
    gateway: "payu",
    action: env.payuBaseUrl,
    fields: {
      key: env.payuKey,
      txnid,
      amount: amountValue,
      productinfo,
      firstname,
      email,
      phone: billingPhone,
      surl: env.payuSuccessUrl,
      furl: env.payuFailureUrl,
      hash,
    },
  };
}

export async function verifyRazorpayPayment({ userId, paymentId, razorpay_order_id, razorpay_payment_id, razorpay_signature }) {
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    throw new ApiError(400, "Missing required Razorpay verification parameters");
  }

  const expectedSignature = crypto
    .createHmac("sha256", env.razorpayKeySecret)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest("hex");

  if (expectedSignature !== razorpay_signature) {
    console.warn("Razorpay signature verification mismatch", {
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
    });
    throw new ApiError(400, "Razorpay payment verification failed: signature mismatch");
  }

  const query = paymentId
    ? { _id: paymentId }
    : { $or: [{ razorpayOrderId: razorpay_order_id }, { gatewayTransactionId: razorpay_order_id }] };

  if (userId) query.userId = userId;

  const payment = await PaymentModel.findOne(query);
  if (!payment) throw new ApiError(404, "Payment record not found");
  if (payment.status === "successful") return payment;

  payment.razorpayPaymentId = razorpay_payment_id;
  payment.razorpaySignature = razorpay_signature;
  payment.gatewayTransactionId = razorpay_payment_id;

  try {
    const razorpay = getRazorpayClient();
    const rzpPayment = await razorpay.payments.fetch(razorpay_payment_id);
    if (rzpPayment?.method) {
      payment.paymentMethod = rzpPayment.method;
    }
  } catch (err) {
    console.warn("Could not fetch payment details from Razorpay:", err.message);
  }

  return activateSuccessfulPayment(payment, payment.paymentMethod || "razorpay");
}

export async function applyRazorpayWebhook(rawBody, signatureHeader) {
  if (env.razorpayWebhookSecret && signatureHeader) {
    const bodyStr = typeof rawBody === "string" ? rawBody : JSON.stringify(rawBody);
    const expected = crypto.createHmac("sha256", env.razorpayWebhookSecret).update(bodyStr).digest("hex");
    if (signatureHeader !== expected) {
      throw new ApiError(400, "Invalid Razorpay webhook signature");
    }
  }

  const event = typeof rawBody === "string" ? JSON.parse(rawBody) : rawBody;
  const eventName = event.event;

  if (eventName === "payment.captured" || eventName === "order.paid") {
    const paymentEntity = event.payload?.payment?.entity;
    const orderEntity = event.payload?.order?.entity;
    const orderId = orderEntity?.id || paymentEntity?.order_id;
    const paymentId = paymentEntity?.id;

    if (orderId) {
      const payment = await PaymentModel.findOne({
        $or: [{ razorpayOrderId: orderId }, { gatewayTransactionId: orderId }],
      });
      if (payment && payment.status !== "successful") {
        payment.razorpayPaymentId = paymentId || payment.razorpayPaymentId;
        payment.paymentMethod = paymentEntity?.method || "razorpay";
        await activateSuccessfulPayment(payment, payment.paymentMethod);
      }
    }
  }

  return { received: true };
}

export async function applyPayuCallback(payload) {
  const { status, txnid, hash, key, amount, productinfo, firstname, email } = payload;
  if (!txnid) throw new ApiError(400, "Missing PayU transaction id");
  const reverse = `${env.payuSalt}|${status || ""}|||||||||||${email || ""}|${firstname || ""}|${productinfo || ""}|${amount || ""}|${txnid}|${key || env.payuKey}`;
  const expected = crypto.createHash("sha512").update(reverse).digest("hex");
  if (!hash || hash !== expected) throw new ApiError(400, "Invalid PayU callback signature");
  const payment = await PaymentModel.findOne({ gatewayTransactionId: txnid });
  if (!payment) throw new ApiError(404, "Payment not found");
  if (payment.status === "successful") return payment;
  if (payment.status === "cancelled") return payment;
  if (status !== "success") { payment.status = "failed"; payment.failureReason = payload.error || "Payment failed"; await payment.save(); return payment; }
  if (money(amount) !== money(payment.amount)) throw new ApiError(400, "PayU payment amount does not match this checkout");
  await verifyPayuPayment(payment);
  return activateSuccessfulPayment(payment, "payu");
}
