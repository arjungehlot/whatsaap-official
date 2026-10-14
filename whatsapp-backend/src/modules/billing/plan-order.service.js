import { PlanModel } from "../../models/Plan.js";

function monthlyPrice(plan) {
  const monthly = Number(plan.monthlyPrice || 0);
  return monthly > 0 ? monthly : Number(plan.yearlyPrice || 0) / 12;
}

// Older plans were all created with displayOrder: 0. Give those plans one sensible
// initial order, then preserve the explicit order set from Super Admin.
export async function normalizeInitialPaidPlanOrder() {
  const plans = await PlanModel.find().select("_id isTrial displayOrder monthlyPrice yearlyPrice createdAt").lean();
  const paidPlans = plans.filter((plan) => !plan.isTrial);
  if (paidPlans.length < 2 || new Set(paidPlans.map((plan) => Number(plan.displayOrder || 0))).size > 1) return;

  const ordered = [...paidPlans].sort(
    (left, right) =>
      monthlyPrice(left) - monthlyPrice(right) ||
      Number(left.yearlyPrice || 0) - Number(right.yearlyPrice || 0) ||
      new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
  );
  await PlanModel.bulkWrite(
    ordered.map((plan, index) => ({ updateOne: { filter: { _id: plan._id }, update: { $set: { displayOrder: index + 1 } } } })),
  );
}
