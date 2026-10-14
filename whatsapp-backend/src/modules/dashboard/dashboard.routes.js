import { Router } from "express";
import { requireAuth, requireScope } from "../../middleware/auth.js";
import { getOverview } from "./dashboard.controller.js";

export const dashboardRouter = Router();

dashboardRouter.use(requireAuth);
dashboardRouter.get("/overview", requireScope("whatsapp:read"), getOverview);
