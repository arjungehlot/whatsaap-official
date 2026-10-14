import { FeatureModel } from "../../models/Feature.js";
import { PlanFeatureModel } from "../../models/PlanFeature.js";
import { SubscriptionModel } from "../../models/Subscription.js";
import { ApiError } from "../../utils/apiError.js";

function isEnabled(entitlement) {
  return entitlement?.value === true || entitlement?.value === "unlimited" || (typeof entitlement?.value === "number" && entitlement.value > 0) || (typeof entitlement?.value === "string" && entitlement.value.length > 0);
}

export async function getEntitlement(userId, key) {
  const subscription = await SubscriptionModel.findOne({ userId, status: "active", expiryDate: { $gt: new Date() } }).sort({ expiryDate: -1 }).lean();
  if (!subscription) return null;
  const feature = await FeatureModel.findOne({ key, active: true }).lean();
  if (!feature) return null;
  const row = await PlanFeatureModel.findOne({ planId: subscription.planId, featureId: feature._id }).lean();
  if (!row) return { value: false, valueType: feature.valueType };
  if (row.valueType === "boolean") return { value: row.booleanValue === true, valueType: row.valueType };
  if (row.valueType === "number") return { value: row.numberValue || 0, valueType: row.valueType };
  if (row.valueType === "unlimited") return { value: "unlimited", valueType: row.valueType };
  return { value: row.textValue || "", valueType: row.valueType };
}

export async function getEntitlements(userId) {
  const [subscription, features] = await Promise.all([
    SubscriptionModel.findOne({ userId, status: "active", expiryDate: { $gt: new Date() } }).sort({ expiryDate: -1 }).lean(),
    FeatureModel.find({ active: true }).select("_id key").lean(),
  ]);
  const values = Object.fromEntries(features.map((feature) => [feature.key, false]));
  if (!subscription) return { subscription: null, features: values };

  const rows = await PlanFeatureModel.find({ planId: subscription.planId, featureId: { $in: features.map((feature) => feature._id) } }).lean();
  const keyById = new Map(features.map((feature) => [feature._id.toString(), feature.key]));
  for (const row of rows) {
    const key = keyById.get(row.featureId.toString());
    if (!key) continue;
    values[key] = isEnabled(row.valueType === "boolean" ? { value: row.booleanValue === true } : row.valueType === "number" ? { value: row.numberValue || 0 } : row.valueType === "unlimited" ? { value: "unlimited" } : { value: row.textValue || "" });
  }
  return { subscription, features: values };
}

export function requireFeature(key) {
  return async (req, _res, next) => {
    try {
      const entitlement = await getEntitlement(req.user?._id, key);
      if (!isEnabled(entitlement)) throw new ApiError(403, `Your plan does not include ${key}. Upgrade your plan to continue.`);
      return next();
    } catch (error) { return next(error); }
  };
}

export function requireInboxFeature(req, res, next) {
  return requireFeature(req.query?.view === "groups" ? "inbox-groups" : "inbox")(req, res, next);
}
