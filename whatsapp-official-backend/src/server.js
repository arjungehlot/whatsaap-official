const path = require('path');
const dotenv = require('dotenv');
// During local migration the existing root file supplies only shared runtime
// settings (ENCRYPTION_KEY / Meta credentials). A deployed Node service must
// put the same values in this folder's .env; no Supabase setting is read by
// the running server.
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });
dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env.local') });
const app = require('./app');
const { connectDatabase } = require('./config/database');

async function start() {
  for (const key of ['MONGODB_URI', 'JWT_SECRET'])
    if (!process.env[key])
      throw new Error(`${key} must be configured in node backend/.env`);
  await connectDatabase();
  // Resume only jobs which never started. A job already marked processing may
  // have reached Meta before a process restart, so it is deliberately left for
  // operator review instead of risking a duplicate WhatsApp send.
  await require('./routes/public-api.routes').resumeQueuedBulkJobs();
  const legacyApi = require('./routes/legacy-whatsapp-api.routes');
  // A single PM2 fork owns scheduled campaign dispatch. Running this in one
  // process prevents duplicate sends while still recovering due work on boot.
  await legacyApi.runDueCampaigns();
  setInterval(() => {
    legacyApi.runDueCampaigns().catch((error) =>
      console.error('[legacy-api] scheduled campaign check failed:', error)
    );
  }, 30000).unref();
  const port = Number(process.env.PORT || 4000);
  app.listen(port, () =>
    console.log(`wacrm Node backend listening on http://localhost:${port}`)
  );
}
start().catch((error) => {
  console.error('Unable to start backend:', error);
  process.exit(1);
});
