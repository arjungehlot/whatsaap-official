const router = require('express').Router();
const { createHash, randomUUID } = require('crypto');
const { requireApiKey } = require('../middleware/api-key.middleware');
const { error, plain } = require('../services/data.service');
const domain = require('../services/domain.service');
const messages = require('../services/message.service');

function ok(res, data, status = 200) {
  return res.status(status).json({ data });
}
function list(res, items, next_cursor = null) {
  return res.json({ data: items, meta: { next_cursor } });
}
function page(req, rows) {
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
  const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : '';
  const start = cursor
    ? Math.max(0, rows.findIndex((row) => row.id === cursor) + 1)
    : 0;
  const items = rows.slice(start, start + limit);
  return { items, next_cursor: rows[start + limit]?.id || null };
}
function safeContact(row) {
  return {
    id: row.id,
    name: row.name || null,
    phone: row.phone,
    email: row.email || null,
    company: row.company || null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}
async function findOrCreateContact(auth, value) {
  const phone = messages.phone(value.to || value.phone);
  let contact = await domain.one('contacts', auth, { phone });
  let created = false;
  if (!contact) {
    contact = await domain.insert('contacts', auth, {
      user_id: auth.sub,
      phone,
      name: typeof value.name === 'string' ? value.name : phone,
      email: typeof value.email === 'string' ? value.email : null,
      company: typeof value.company === 'string' ? value.company : null,
    });
    created = true;
  }
  return { contact, created };
}
async function conversationFor(auth, contact) {
  return (
    (await domain.one('conversations', auth, { contact_id: contact.id })) ||
    domain.insert('conversations', auth, {
      user_id: auth.sub,
      contact_id: contact.id,
      status: 'open',
    })
  );
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonical(value[key])])
    );
  return value;
}
function requestHash(value) {
  return createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
}
function publicMessageBody(input) {
  const body = input && typeof input === 'object' ? input : {};
  const type = String(body.type || 'text').toLowerCase();
  if (!['text', 'image', 'video', 'audio', 'document', 'template'].includes(type))
    throw error('type must be text, image, video, audio, document, or template');
  const to = messages.phone(body.to);
  const clientReference = body.client_reference
    ? domain.assertString(body.client_reference, 'client_reference', 120)
    : null;
  const output = {
    to,
    name: typeof body.name === 'string' ? body.name.trim().slice(0, 160) : null,
    type,
    text: typeof body.text === 'string' ? body.text : null,
    file_url: body.file_url || body.media_url || null,
    filename: typeof body.filename === 'string' ? body.filename.slice(0, 255) : null,
    caption: typeof body.caption === 'string' ? body.caption : null,
    client_reference: clientReference,
    template: body.template && typeof body.template === 'object' ? body.template : null,
  };
  if (type === 'text' && !String(output.text || '').trim())
    throw error('text is required for text messages');
  if (['image', 'video', 'audio', 'document'].includes(type)) {
    output.file_url = messages.publicHttpsUrl(output.file_url, 'file_url');
    if (output.caption && type === 'audio')
      throw error('Audio messages do not support a caption');
  }
  if (type === 'template' && !output.template?.name)
    throw error('template.name is required for template messages');
  return output;
}
async function sendPublicMessage(auth, input) {
  const body = publicMessageBody(input);
  const { contact, created } = await findOrCreateContact(auth, body);
  const conversation = await conversationFor(auth, contact);
  const template = body.template || {};
  const result = await messages.send(auth, {
    conversation_id: conversation.id,
    message_type: body.type,
    content_text:
      body.type === 'text' ? body.text : body.caption || body.text || null,
    media_url: body.file_url,
    filename: body.filename,
    template_name: template.name,
    template_language: template.language || 'en_US',
    template_components: Array.isArray(template.components)
      ? template.components
      : null,
    template_params: Array.isArray(template.params) ? template.params : null,
    template_message_params:
      !Array.isArray(template.params) && template.params ? template.params : null,
    client_reference: body.client_reference,
  });
  return {
    message_id: result.message.id,
    whatsapp_message_id: result.whatsappMessageId,
    conversation_id: conversation.id,
    contact_id: contact.id,
    contact_created: created,
    status: 'accepted',
    client_reference: body.client_reference,
  };
}
function publicJob(job) {
  return {
    job_id: job.id,
    status: job.status,
    total: job.total || 0,
    accepted: job.accepted || 0,
    failed: job.failed || 0,
    status_url: `/api/v1/messages/bulk/${job.id}`,
  };
}
async function processBulkJob(jobId) {
  const Jobs = domain.model('api_message_jobs');
  const Items = domain.model('api_message_job_items');
  const job = await Jobs.findOneAndUpdate(
    { id: jobId, status: 'queued' },
    { $set: { status: 'processing', started_at: domain.now(), updated_at: domain.now() } },
    { new: true }
  ).lean();
  if (!job) return;
  const auth = { account_id: job.account_id, sub: job.created_by, role: 'owner' };
  try {
    const items = await Items.find({ account_id: job.account_id, job_id: job.id, status: 'pending' })
      .sort({ position: 1 })
      .lean();
    for (const item of items) {
      await Items.updateOne(
        { id: item.id, account_id: job.account_id, status: 'pending' },
        { $set: { status: 'processing', updated_at: domain.now() } }
      );
      try {
        const result = await sendPublicMessage(auth, item.payload);
        await Items.updateOne(
          { id: item.id, account_id: job.account_id },
          { $set: { status: 'accepted', result, completed_at: domain.now(), updated_at: domain.now() } }
        );
      } catch (cause) {
        await Items.updateOne(
          { id: item.id, account_id: job.account_id },
          { $set: { status: 'failed', error: cause.message || 'Message send failed', completed_at: domain.now(), updated_at: domain.now() } }
        );
      }
    }
    const [accepted, failed] = await Promise.all([
      Items.countDocuments({ account_id: job.account_id, job_id: job.id, status: 'accepted' }),
      Items.countDocuments({ account_id: job.account_id, job_id: job.id, status: 'failed' }),
    ]);
    await Jobs.updateOne(
      { id: job.id, account_id: job.account_id },
      { $set: { status: failed ? 'completed_with_failures' : 'completed', accepted, failed, completed_at: domain.now(), updated_at: domain.now() } }
    );
  } catch (cause) {
    await Jobs.updateOne(
      { id: job.id, account_id: job.account_id },
      { $set: { status: 'failed', error: cause.message || 'Bulk job failed', completed_at: domain.now(), updated_at: domain.now() } }
    );
    console.error('[public-api] Bulk message job failed:', cause);
  }
}
function queueBulkJob(jobId) {
  setImmediate(() => processBulkJob(jobId));
}

router.get('/me', requireApiKey(), async (req, res, next) => {
  try {
    ok(res, {
      account_id: req.apiAuth.account_id,
      key_prefix: req.apiAuth.key.key_prefix,
      scopes: req.apiAuth.key.scopes || [],
    });
  } catch (cause) {
    next(cause);
  }
});
router.get(
  '/contacts',
  requireApiKey('contacts:read'),
  async (req, res, next) => {
    try {
      let rows = await domain.many('contacts', req.apiAuth);
      const search = String(req.query.search || '').toLowerCase();
      if (search)
        rows = rows.filter((row) =>
          `${row.name || ''} ${row.phone || ''}`.toLowerCase().includes(search)
        );
      const result = page(req, rows);
      list(res, result.items.map(safeContact), result.next_cursor);
    } catch (cause) {
      next(cause);
    }
  }
);
router.post(
  '/contacts',
  requireApiKey('contacts:write'),
  async (req, res, next) => {
    try {
      const { contact, created } = await findOrCreateContact(
        req.apiAuth,
        req.body || {}
      );
      ok(res, { ...safeContact(contact), created }, created ? 201 : 200);
    } catch (cause) {
      next(cause);
    }
  }
);
router.get(
  '/contacts/:id',
  requireApiKey('contacts:read'),
  async (req, res, next) => {
    try {
      const contact = await domain.one('contacts', req.apiAuth, {
        id: req.params.id,
      });
      if (!contact) throw error('Contact not found', 404);
      ok(res, safeContact(contact));
    } catch (cause) {
      next(cause);
    }
  }
);
router.patch(
  '/contacts/:id',
  requireApiKey('contacts:write'),
  async (req, res, next) => {
    try {
      const values = {};
      for (const key of ['name', 'email', 'company'])
        if (key in (req.body || {})) values[key] = req.body[key];
      const contact = await domain.updateOne(
        'contacts',
        req.apiAuth,
        req.params.id,
        values
      );
      if (!contact) throw error('Contact not found', 404);
      ok(res, safeContact(contact));
    } catch (cause) {
      next(cause);
    }
  }
);
router.get(
  '/conversations',
  requireApiKey('conversations:read'),
  async (req, res, next) => {
    try {
      const result = page(req, await domain.many('conversations', req.apiAuth));
      list(res, result.items, result.next_cursor);
    } catch (cause) {
      next(cause);
    }
  }
);
router.get(
  '/conversations/:id',
  requireApiKey('conversations:read'),
  async (req, res, next) => {
    try {
      const conversation = await domain.one('conversations', req.apiAuth, {
        id: req.params.id,
      });
      if (!conversation) throw error('Conversation not found', 404);
      ok(res, conversation);
    } catch (cause) {
      next(cause);
    }
  }
);
router.get(
  '/conversations/:id/messages',
  requireApiKey('messages:read'),
  async (req, res, next) => {
    try {
      const conversation = await domain.one('conversations', req.apiAuth, {
        id: req.params.id,
      });
      if (!conversation) throw error('Conversation not found', 404);
      const result = page(
        req,
        await domain.many('messages', req.apiAuth, {
          conversation_id: conversation.id,
        })
      );
      list(res, result.items, result.next_cursor);
    } catch (cause) {
      next(cause);
    }
  }
);
router.post(
  '/messages',
  requireApiKey('messages:send'),
  async (req, res, next) => {
    try {
      ok(res, await sendPublicMessage(req.apiAuth, req.body), 201);
    } catch (cause) {
      next(cause);
    }
  }
);

router.post(
  '/messages/bulk',
  requireApiKey('messages:send'),
  async (req, res, next) => {
    try {
      const body = req.body && typeof req.body === 'object' ? req.body : {};
      const idempotencyKey = domain.assertString(
        body.idempotency_key,
        'idempotency_key',
        120
      );
      if (idempotencyKey.length < 8)
        throw error('idempotency_key must be at least 8 characters');
      if (!Array.isArray(body.messages) || body.messages.length < 1 || body.messages.length > 100)
        throw error('messages must contain between 1 and 100 messages');

      // Validate the complete payload before any message is sent. This makes a
      // malformed row safe to correct and retry with the same API key.
      const payloads = body.messages.map(publicMessageBody);
      const hash = requestHash(payloads);
      const Jobs = domain.model('api_message_jobs');
      const existing = await Jobs.findOne({
        account_id: domain.accountId(req.apiAuth),
        idempotency_key: idempotencyKey,
      }).lean();
      if (existing) {
        if (existing.request_hash !== hash)
          throw error('idempotency_key was already used with a different batch', 409);
        return ok(res, publicJob(existing), 200);
      }
      const job = await domain.insert('api_message_jobs', req.apiAuth, {
        created_by: domain.userId(req.apiAuth),
        idempotency_key: idempotencyKey,
        request_hash: hash,
        status: 'queued',
        total: payloads.length,
        accepted: 0,
        failed: 0,
      });
      await Promise.all(
        payloads.map((payload, position) =>
          domain.insert('api_message_job_items', req.apiAuth, {
            job_id: job.id,
            position,
            payload,
            status: 'pending',
          })
        )
      );
      queueBulkJob(job.id);
      ok(res, publicJob(job), 202);
    } catch (cause) {
      next(cause);
    }
  }
);
router.get(
  '/messages/bulk/:id',
  requireApiKey('messages:send'),
  async (req, res, next) => {
    try {
      const job = await domain.one('api_message_jobs', req.apiAuth, {
        id: req.params.id,
      });
      if (!job) throw error('Bulk message job not found', 404);
      const items = await domain.many('api_message_job_items', req.apiAuth, {
        job_id: job.id,
      }, { position: 1 });
      ok(res, {
        ...publicJob(job),
        items: items.map((item) => ({
          position: item.position,
          to: item.payload?.to || null,
          client_reference: item.payload?.client_reference || null,
          status: item.status,
          result: item.result || null,
          error: item.error || null,
        })),
      });
    } catch (cause) {
      next(cause);
    }
  }
);

router.get(
  '/broadcasts',
  requireApiKey('broadcasts:read'),
  async (req, res, next) => {
    try {
      const result = page(req, await domain.many('broadcasts', req.apiAuth));
      list(res, result.items, result.next_cursor);
    } catch (cause) {
      next(cause);
    }
  }
);
router.get(
  '/broadcasts/:id',
  requireApiKey('broadcasts:read'),
  async (req, res, next) => {
    try {
      const broadcast = await domain.one('broadcasts', req.apiAuth, {
        id: req.params.id,
      });
      if (!broadcast) throw error('Broadcast not found', 404);
      ok(res, broadcast);
    } catch (cause) {
      next(cause);
    }
  }
);
router.get(
  '/webhooks',
  requireApiKey('webhooks:read'),
  async (req, res, next) => {
    try {
      list(res, await domain.many('webhook_endpoints', req.apiAuth));
    } catch (cause) {
      next(cause);
    }
  }
);
router.post(
  '/webhooks',
  requireApiKey('webhooks:write'),
  async (req, res, next) => {
    try {
      const url = domain.assertString(req.body?.url, 'url', 2048);
      if (!/^https:\/\//i.test(url)) throw error('Webhook URL must use HTTPS');
      const endpoint = await domain.insert('webhook_endpoints', req.apiAuth, {
        user_id: req.apiAuth.sub,
        url,
        events: Array.isArray(req.body?.events)
          ? req.body.events.filter((event) => typeof event === 'string')
          : [],
        secret: randomUUID(),
        is_active: true,
      });
      ok(res, endpoint, 201);
    } catch (cause) {
      next(cause);
    }
  }
);
router.delete(
  '/webhooks/:id',
  requireApiKey('webhooks:write'),
  async (req, res, next) => {
    try {
      if (
        !(await domain.removeOne(
          'webhook_endpoints',
          req.apiAuth,
          req.params.id
        ))
      )
        throw error('Webhook endpoint not found', 404);
      res.status(204).end();
    } catch (cause) {
      next(cause);
    }
  }
);
module.exports = router;
module.exports.resumeQueuedBulkJobs = async function resumeQueuedBulkJobs() {
  const Jobs = domain.model('api_message_jobs');
  const queued = await Jobs.find({ status: 'queued' }).select('id').lean();
  queued.forEach((job) => queueBulkJob(job.id));
};
