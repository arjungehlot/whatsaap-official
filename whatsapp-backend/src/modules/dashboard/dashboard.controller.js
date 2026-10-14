import { getDashboardOverview } from "./dashboard.service.js";

export async function getOverview(req, res, next) {
  try {
    res.json({ success: true, data: await getDashboardOverview(req.user._id) });
  } catch (error) {
    next(error);
  }
}
