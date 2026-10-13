const express = require('express');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const openApi = require('../docs/openapi');
const { router: storageRoutes, uploadDir } = require('./routes/storage.routes');
const app = express();

function apiBaseUrl(req) {
  const configured = String(process.env.API_BASE_URL || '').trim().replace(/\/+$/, '');
  if (configured) {
    try {
      const parsed = new URL(configured);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        // Caddy/nginx terminate TLS before forwarding to Express. Keep an
        // accidentally HTTP-configured public origin from making Swagger send
        // browser requests to an insecure URL (mixed content) when the
        // original request demonstrably arrived over HTTPS.
        const forwardedProtocol = String(req.get('x-forwarded-proto') || '')
          .split(',')[0]
          .trim()
          .toLowerCase();
        if (parsed.protocol === 'http:' && forwardedProtocol === 'https')
          parsed.protocol = 'https:';
        return parsed.toString().replace(/\/$/, '');
      }
    } catch {
      // Fall through to the request origin. A malformed optional display URL
      // must never make the API documentation unavailable.
    }
  }
  return `${req.protocol}://${req.get('host')}`;
}

function runtimeOpenApi(req) {
  return {
    ...openApi,
    info: { ...openApi.info, contact: { name: 'API Support' } },
    servers: [{ url: apiBaseUrl(req), description: 'Current WACRM backend' }],
  };
}
app.use(
  cors({
    origin: (process.env.FRONTEND_URL || 'http://localhost:3000').split(','),
    credentials: true,
  })
);
app.use(
  express.json({
    limit: '10mb',
    verify: (req, _res, buffer) => {
      req.rawBody = buffer;
    },
  })
);
app.get('/health', (_req, res) =>
  res.json({ ok: true, service: 'wacrm-node-backend', database: 'mongodb' })
);
// Swagger UI is intentionally public: callers still need a scoped WACRM API
// key to execute any operation. It is a live console, not a static preview.
app.get('/api/v1/openapi.json', (req, res) => res.json(runtimeOpenApi(req)));
app.use(
  '/api/docs',
  swaggerUi.serve,
  swaggerUi.setup(null, {
    customSiteTitle: 'WhatsApp Business API',
    swaggerOptions: {
      url: '/api/v1/openapi.json',
      persistAuthorization: true,
    },
  })
);
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/data', require('./routes/data.routes'));
app.use('/api/rpc', require('./routes/rpc.routes'));
app.use('/api/storage', storageRoutes);
app.use('/api/account', require('./routes/account.routes'));
app.use('/api/quick-replies', require('./routes/quick-replies.routes'));
app.use('/api', require('./routes/workflows.routes'));
app.use('/api', require('./routes/contacts.routes'));
app.use('/api/invitations', require('./routes/invitations.routes'));
app.use('/api/ai', require('./routes/ai.routes'));
app.use('/api/whatsapp', require('./routes/whatsapp.routes'));
app.use('/api/v1', require('./routes/public-api.routes'));
app.use('/api/v1', require('./routes/legacy-whatsapp-api.routes').router);
app.use('/api/whatsapp/webhook', require('./routes/webhook.routes'));
app.use((error, _req, res, _next) => {
  console.error(error);
  res
    .status(error.status || 500)
    .json({ error: error.message || 'Internal server error' });
});
module.exports = app;
