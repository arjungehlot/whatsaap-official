import cors from "cors";
import express from "express";
import morgan from "morgan";
import "./middleware/asyncErrors.js";
import { env } from "./config/env.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { apiKeysRouter } from "./modules/api-keys/api-keys.routes.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { adminRouter } from "./modules/admin/admin.routes.js";
import { billingRouter } from "./modules/billing/billing.routes.js"; 
import { campaignsRouter } from "./modules/campaigns/campaigns.routes.js";
import { contactsRouter } from "./modules/contacts/contacts.routes.js";
import { dashboardRouter } from "./modules/dashboard/dashboard.routes.js";
import { docsRouter } from "./modules/docs/docs.routes.js";
import { inboxRouter } from "./modules/inbox/inbox.routes.js";
import { messagesRouter } from "./modules/messages/messages.routes.js";
import { messageJobsRouter } from "./modules/message-jobs/message-jobs.routes.js";
import { messageLogsRouter } from "./modules/message-logs/message-logs.routes.js";
import { automationsRouter } from "./modules/automations/automations.routes.js";
import { publicApiRouter } from "./modules/public-api/public-api.routes.js";
import { templatesRouter } from "./modules/templates/templates.routes.js";
import { storageRouter } from "./modules/storage/storage.routes.js";
import { whatsappRouter } from "./modules/whatsapp/whatsapp.routes.js";
import { webhooksRouter } from "./modules/webhooks/webhooks.routes.js";
import { webhookTestRouter } from "./modules/webhook-test/webhook-test.routes.js";

export const app = express();

if (env.nodeEnv !== "production") {
  app.use("/webhook/testworkflow", express.raw({ type: "application/json", limit: "1mb" }));
}

const localApiOrigins = env.nodeEnv === "production"
  ? []
  : [`http://localhost:${env.port}`, `http://127.0.0.1:${env.port}`];
const allowedCorsOrigins = new Set([...env.clientOrigins, ...localApiOrigins]);

const corsMiddleware = cors({
  origin(origin, callback) {
    const allowsLocalNullOrigin = env.nodeEnv !== "production" && env.allowNullOrigin && origin === "null";
    if (!origin || allowsLocalNullOrigin || allowedCorsOrigins.has(origin)) {
      return callback(null, true);
    }

    return callback(new Error(`CORS blocked for origin ${origin}`));
  },
  credentials: true,
});

app.use((req, res, next) => {
  // PayU / Razorpay webhooks come from external payment gateways
  if (req.path === "/api/billing/payu/callback" || req.path === "/api/billing/razorpay/webhook") return next();
  return corsMiddleware(req, res, next);
});
app.use(express.json({ limit: "1mb", verify: (req, _res, buf) => { req.rawBody = buf; } }));
app.use(express.urlencoded({ extended: false, limit: "1mb" }));
app.use(morgan(env.nodeEnv === "production" ? "combined" : "dev"));

app.get("/api/health", (_req, res) => {
  res.json({ success: true, message: "WAFlow API is running" });
});

app.use("/api/auth", authRouter);
app.use("/api/admin", adminRouter);
app.use("/api/billing", billingRouter);
app.use("/api/api-keys", apiKeysRouter);
app.use("/api/docs", docsRouter);
app.use("/api/whatsapp", whatsappRouter);
app.use("/api/webhooks", webhooksRouter);
if (env.nodeEnv !== "production") app.use("/webhook", webhookTestRouter);
app.use("/api/messages", messagesRouter);
app.use("/api/message-jobs", messageJobsRouter);
app.use("/api/message-logs", messageLogsRouter);
app.use("/api/automations", automationsRouter);
app.use("/api/v1", publicApiRouter);
app.use("/api/inbox", inboxRouter);
app.use("/api/contacts", contactsRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/templates", templatesRouter);
app.use("/api/campaigns", campaignsRouter);
app.use("/api/storage", storageRouter);

app.use(notFoundHandler);
app.use(errorHandler);
