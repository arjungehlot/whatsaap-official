import { app } from "./app.js";
import { connectDatabase } from "./config/db.js";
import { env } from "./config/env.js";
import { restoreScheduledCampaigns } from "./modules/campaigns/campaigns.service.js";
import { restoreMessageJobs } from "./modules/message-jobs/message-jobs.service.js";
import { dispatchPendingMessagesForConnectedAccounts } from "./modules/messages/message-dispatch.service.js";
import { runDueAutomations } from "./modules/automations/automations.service.js";
import { restoreConnectedWhatsAppSockets } from "./modules/whatsapp/whatsapp.engine.js";
import { backfillTrials, ensureDefaultFeatures, ensureTrialPlan } from "./modules/billing/billing.service.js";
import { ensureSuperAdmin } from "./modules/auth/superadmin.service.js";

try {
  await connectDatabase();
  await ensureSuperAdmin();
  await ensureTrialPlan();
  await ensureDefaultFeatures();
  const backfilledTrials = await backfillTrials();
  const restoredSockets = await restoreConnectedWhatsAppSockets();
  const restoredCampaigns = await restoreScheduledCampaigns();
  const restoredMessageJobs = await restoreMessageJobs();
  const recoveredMessages = await dispatchPendingMessagesForConnectedAccounts();
  await runDueAutomations();

  app.listen(env.port, () => {
    console.log(`Whatsaap API running on http://localhost:${env.port}`);
    console.log(`WhatsApp auto-connect restored ${restoredSockets} session(s)`);
    console.log(`Campaign scheduler restored ${restoredCampaigns} campaign(s)`);
    console.log(`Message scheduler restored ${restoredMessageJobs} job(s)`);
    console.log(`Pending outbound messages recovered ${recoveredMessages}`);
    console.log(`Free trials ensured for ${backfilledTrials} existing account(s)`);
    setInterval(() => void runDueAutomations().catch((error) => console.error("Automation scheduler error", error)), 60_000);
    setInterval(() => void dispatchPendingMessagesForConnectedAccounts().catch((error) => console.error("Outbound dispatcher error", error)), 15_000);
  });
} catch (error) {
  console.error("Failed to start Whatsaap API", error);
  process.exit(1);
}
