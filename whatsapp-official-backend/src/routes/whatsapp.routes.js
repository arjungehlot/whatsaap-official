const router = require('express').Router();
const { randomUUID } = require('crypto');
const {
  requireAuth,
  requireWriter,
  requireAdmin,
} = require('../middleware/auth.middleware');
const { error } = require('../services/data.service');
const domain = require('../services/domain.service');
const { encrypt, decrypt } = require('../utils/crypto');
const meta = require('../services/meta.service');
const messages = require('../services/message.service');
const broadcasts = require('../services/broadcast.service');

router.get('/config', requireAuth, async (req, res, next) => {
  try {
    const config = await domain
      .model('whatsapp_config')
      .findOne({ account_id: domain.accountId(req.auth) })
      .lean();
    if (!config)
      return res.json({
        connected: false,
        reason: 'no_config',
        message: 'No WhatsApp configuration saved yet.',
      });
    try {
      const phone_info = await meta.verifyPhoneNumber(
        config.phone_number_id,
        decrypt(config.access_token)
      );
      return res.json({ connected: true, phone_info });
    } catch (cause) {
      const unableToReadSavedCredential =
        cause?.code === 'ERR_OSSL_BAD_DECRYPT' ||
        /authenticate data|unsupported state|bad decrypt/i.test(
          String(cause?.message || '')
        );
      return res.json({
        connected: false,
        reason: unableToReadSavedCredential
          ? 'credentials_need_resave'
          : 'meta_api_error',
        message: unableToReadSavedCredential
          ? 'Saved WhatsApp credentials were encrypted with a previous key. Save this configuration again to encrypt it with the current key.'
          : cause.message,
      });
    }
  } catch (cause) {
    next(cause);
  }
});
router.get('/message-logs', requireAuth, async (req, res, next) => {
  try {
    const accountId = domain.accountId(req.auth);
    const allowedStatuses = new Set([
      'sending',
      'sent',
      'delivered',
      'read',
      'failed',
    ]);
    const requestedStatus = String(req.query.status || 'all');
    if (requestedStatus !== 'all' && !allowedStatuses.has(requestedStatus))
      throw error('Invalid message status filter');
    const page = Math.max(1, Number.parseInt(String(req.query.page || '1'), 10) || 1);
    const limit = Math.min(
      100,
      Math.max(10, Number.parseInt(String(req.query.limit || '50'), 10) || 50)
    );
    const criteria = {
      account_id: accountId,
      sender_type: { $in: ['agent', 'bot'] },
      ...(requestedStatus === 'all' ? {} : { status: requestedStatus }),
    };
    const Messages = domain.model('messages');
    const [rows, total, summary] = await Promise.all([
      Messages.find(criteria)
        .sort({ created_at: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Messages.countDocuments(criteria),
      Messages.aggregate([
        {
          $match: {
            account_id: accountId,
            sender_type: { $in: ['agent', 'bot'] },
          },
        },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
    ]);
    const conversationIds = [...new Set(rows.map((row) => row.conversation_id).filter(Boolean))];
    const conversations = conversationIds.length
      ? await domain
          .model('conversations')
          .find({ account_id: accountId, id: { $in: conversationIds } })
          .select('id contact_id')
          .lean()
      : [];
    const contactIds = [...new Set(conversations.map((row) => row.contact_id).filter(Boolean))];
    const contacts = contactIds.length
      ? await domain
          .model('contacts')
          .find({ account_id: accountId, id: { $in: contactIds } })
          .select('id name phone')
          .lean()
      : [];
    const conversationById = new Map(conversations.map((row) => [row.id, row]));
    const contactById = new Map(contacts.map((row) => [row.id, row]));
    const counts = Object.fromEntries(summary.map((row) => [row._id || 'unknown', row.count]));
    res.json({
      data: rows.map((row) => {
        const conversation = conversationById.get(row.conversation_id);
        return {
          ...row,
          contact: conversation ? contactById.get(conversation.contact_id) || null : null,
        };
      }),
      count: total,
      page,
      limit,
      summary: {
        total: Object.values(counts).reduce((sum, value) => sum + Number(value), 0),
        accepted: Number(counts.sent || 0) + Number(counts.sending || 0),
        delivered: Number(counts.delivered || 0) + Number(counts.read || 0),
        read: Number(counts.read || 0),
        failed: Number(counts.failed || 0),
      },
    });
  } catch (cause) {
    next(cause);
  }
});
router.post('/config', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const body = req.body || {};
    const phone_number_id = domain.assertString(
      body.phone_number_id,
      'phone_number_id',
      80
    );
    const access_token = domain.assertString(
      body.access_token,
      'access_token',
      4096
    );
    if (body.pin && !/^\d{6}$/.test(body.pin))
      throw error('PIN must be exactly 6 digits.');
    const claimed = await domain
      .model('whatsapp_config')
      .findOne({
        phone_number_id,
        account_id: { $ne: domain.accountId(req.auth) },
      })
      .lean();
    if (claimed)
      throw error(
        'This WhatsApp phone number is already linked to another account.',
        409
      );
    const phoneInfo = await meta.verifyPhoneNumber(
      phone_number_id,
      access_token
    );
    let registrationError = null;
    let registeredAt = null;
    if (body.pin) {
      try {
        await meta.registerPhoneNumber(phone_number_id, access_token, body.pin);
        registeredAt = domain.now();
      } catch (cause) {
        registrationError = cause.message;
      }
    }
    let subscribedAt = null;
    if (body.waba_id) {
      try {
        await meta.subscribeWaba(body.waba_id, access_token);
        subscribedAt = domain.now();
      } catch (cause) {
        console.warn('[whatsapp] WABA subscription failed:', cause.message);
      }
    }
    const values = {
      phone_number_id,
      waba_id: body.waba_id || null,
      access_token: encrypt(access_token),
      verify_token: body.verify_token ? encrypt(body.verify_token) : null,
      status: registrationError ? 'disconnected' : 'connected',
      connected_at: registrationError ? null : domain.now(),
      registered_at: registeredAt,
      subscribed_apps_at: subscribedAt,
      last_registration_error: registrationError,
      user_id: domain.userId(req.auth),
    };
    const existing = await domain
      .model('whatsapp_config')
      .findOne({ account_id: domain.accountId(req.auth) })
      .lean();
    if (existing)
      await domain
        .model('whatsapp_config')
        .updateOne(
          { id: existing.id },
          { $set: { ...values, updated_at: domain.now() } }
        );
    else await domain.insert('whatsapp_config', req.auth, values);
    res.json({
      success: !registrationError,
      saved: true,
      registered: Boolean(registeredAt),
      registration_error: registrationError,
      phone_info: phoneInfo,
    });
  } catch (cause) {
    next(cause);
  }
});
router.patch(
  '/config/media-retention',
  requireAuth,
  requireAdmin,
  async (req, res, next) => {
    try {
      const enabled = req.body?.enabled;
      if (typeof enabled !== 'boolean')
        throw error('enabled must be a boolean');
      const result = await domain.model('whatsapp_config').updateOne(
        { account_id: domain.accountId(req.auth) },
        { $set: { mirror_inbound_media: enabled, updated_at: domain.now() } }
      );
      if (!result.matchedCount) throw error('WhatsApp is not configured.', 404);
      res.json({ success: true, mirror_inbound_media: enabled });
    } catch (cause) {
      next(cause);
    }
  }
);
router.delete('/config', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    await domain
      .model('whatsapp_config')
      .deleteMany({ account_id: domain.accountId(req.auth) });
    res.json({ success: true });
  } catch (cause) {
    next(cause);
  }
});
router.get(
  '/config/verify-registration',
  requireAuth,
  async (req, res, next) => {
    try {
      const config = await domain
        .model('whatsapp_config')
        .findOne({ account_id: domain.accountId(req.auth) })
        .lean();
      if (!config) throw error('WhatsApp is not configured.', 400);
      const phone_info = await meta.verifyPhoneNumber(
        config.phone_number_id,
        decrypt(config.access_token)
      );
      res.json({
        registered: Boolean(config.registered_at),
        registered_at: config.registered_at || null,
        phone_info,
        registration_error: config.last_registration_error || null,
      });
    } catch (cause) {
      next(cause);
    }
  }
);

router.post('/send', requireAuth, requireWriter, async (req, res, next) => {
  try {
    const result = await messages.send(req.auth, req.body);
    res.json({
      success: true,
      message_id: result.message.id,
      whatsapp_message_id: result.whatsappMessageId,
    });
  } catch (cause) {
    next(cause);
  }
});
router.post('/react', requireAuth, requireWriter, async (req, res, next) => {
  try {
    const id = req.body?.message_id;
    const emoji = req.body?.emoji;
    if (typeof id !== 'string' || typeof emoji !== 'string')
      throw error('message_id and emoji are required');
    const message = await domain.one('messages', req.auth, { id });
    if (!message?.message_id)
      throw error('Message not found or not sent to WhatsApp', 404);
    const conversation = await domain.one('conversations', req.auth, {
      id: message.conversation_id,
    });
    const contact =
      conversation &&
      (await domain.one('contacts', req.auth, { id: conversation.contact_id }));
    if (!contact) throw error('Conversation not found', 404);
    const { config, accessToken } = await messages.configFor(req.auth);
    await meta.sendMessage(config.phone_number_id, accessToken, {
      to: messages.phone(contact.phone),
      type: 'reaction',
      reaction: { message_id: message.message_id, emoji },
    });
    if (!emoji)
      await domain
        .model('message_reactions')
        .deleteMany({
          account_id: domain.accountId(req.auth),
          message_id: message.id,
          actor_type: 'agent',
          actor_id: domain.userId(req.auth),
        });
    else
      await domain
        .model('message_reactions')
        .findOneAndUpdate(
          {
            account_id: domain.accountId(req.auth),
            message_id: message.id,
            actor_type: 'agent',
            actor_id: domain.userId(req.auth),
          },
          {
            $set: {
              emoji,
              conversation_id: message.conversation_id,
              updated_at: domain.now(),
            },
            $setOnInsert: { id: randomUUID(), created_at: domain.now() },
          },
          { upsert: true }
        );
    res.json({ success: true });
  } catch (cause) {
    next(cause);
  }
});

router.post(
  '/templates/submit',
  requireAuth,
  requireAdmin,
  async (req, res, next) => {
    try {
      const body = req.body || {};
      const name = domain.assertString(body.name, 'name', 512);
      const language = body.language || 'en_US';
      const dry_run = process.env.WHATSAPP_TEMPLATES_DRY_RUN === 'true';
      const base = {
        user_id: domain.userId(req.auth),
        name,
        category: body.category || 'Marketing',
        language,
        header_type: body.header_type || null,
        header_content: body.header_content || null,
        header_media_url: body.header_media_url || null,
        body_text: domain.assertString(body.body_text, 'body_text', 4096),
        footer_text: body.footer_text || null,
        buttons: body.buttons || null,
        sample_values: body.sample_values || null,
        status: dry_run ? 'PENDING' : 'DRAFT',
        meta_template_id: dry_run ? `dry-run-${randomUUID()}` : null,
        submission_error: null,
        last_submitted_at: domain.now(),
      };
      if (!dry_run) {
        const { config, accessToken } = await messages.configFor(req.auth);
        if (!config.waba_id)
          throw error('WABA ID is missing. Re-connect your account.', 400);
        if (base.header_type && base.header_type !== 'text')
          throw error(
            'Media-header template submission requires a Meta resumable-upload handle. Use Sync from Meta for existing media templates.',
            400
          );
        const components = [{ type: 'BODY', text: base.body_text }];
        if (base.header_type === 'text' && base.header_content)
          components.unshift({
            type: 'HEADER',
            format: 'TEXT',
            text: base.header_content,
          });
        if (base.footer_text)
          components.push({ type: 'FOOTER', text: base.footer_text });
        if (Array.isArray(base.buttons) && base.buttons.length)
          components.push({
            type: 'BUTTONS',
            buttons: base.buttons.map((button) => ({
              ...button,
              type: String(button.type || '').toUpperCase(),
            })),
          });
        const response = await meta.request(
          `/${encodeURIComponent(config.waba_id)}/message_templates`,
          accessToken,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name,
              language,
              category: String(base.category).toUpperCase(),
              components,
            }),
          }
        );
        base.meta_template_id = response.id || null;
        base.status = response.status || 'PENDING';
      }
      let row = await domain
        .model('message_templates')
        .findOne({ account_id: domain.accountId(req.auth), name, language })
        .lean();
      if (row) {
        await domain
          .model('message_templates')
          .updateOne(
            { id: row.id },
            { $set: { ...base, updated_at: domain.now() } }
          );
        row = { ...row, ...base };
      } else row = await domain.insert('message_templates', req.auth, base);
      res.status(201).json({ success: true, template: row, dry_run });
    } catch (cause) {
      next(cause);
    }
  }
);
router.post(
  '/templates/sync',
  requireAuth,
  requireAdmin,
  async (req, res, next) => {
    try {
      const { config, accessToken } = await messages.configFor(req.auth);
      if (!config.waba_id)
        throw error('WABA ID is missing. Re-connect your account.', 400);
      const body = await meta.request(
        `/${encodeURIComponent(config.waba_id)}/message_templates?limit=100&fields=id,name,language,status,category,components,quality_score`,
        accessToken
      );
      let inserted = 0;
      let updated = 0;
      for (const item of body.data || []) {
        const components = item.components || [];
        const part = (type) =>
          components.find((component) => component.type === type);
        const header = part('HEADER');
        const bodyPart = part('BODY');
        const footer = part('FOOTER');
        const buttons = part('BUTTONS');
        const values = {
          user_id: domain.userId(req.auth),
          name: item.name,
          language: item.language,
          category: item.category || 'Marketing',
          header_type: header?.format?.toLowerCase() || null,
          header_content: header?.text || null,
          body_text: bodyPart?.text || '',
          footer_text: footer?.text || null,
          buttons: buttons?.buttons || null,
          status: item.status || 'PENDING',
          meta_template_id: item.id,
          quality_score:
            typeof item.quality_score === 'string'
              ? item.quality_score
              : item.quality_score?.score || null,
        };
        const existing = await domain
          .model('message_templates')
          .findOne({
            account_id: domain.accountId(req.auth),
            name: item.name,
            language: item.language,
          })
          .lean();
        if (existing) {
          await domain
            .model('message_templates')
            .updateOne(
              { id: existing.id },
              { $set: { ...values, updated_at: domain.now() } }
            );
          updated++;
        } else {
          await domain.insert('message_templates', req.auth, values);
          inserted++;
        }
      }
      res.json({
        success: true,
        total: (body.data || []).length,
        inserted,
        updated,
        errors: [],
        truncated: false,
      });
    } catch (cause) {
      next(cause);
    }
  }
);
router.patch(
  '/templates/:id',
  requireAuth,
  requireAdmin,
  async (req, res, next) => {
    try {
      const values = {};
      for (const key of [
        'category',
        'language',
        'header_type',
        'header_content',
        'header_media_url',
        'body_text',
        'footer_text',
        'buttons',
        'sample_values',
      ])
        if (key in (req.body || {})) values[key] = req.body[key];
      const row = await domain.updateOne(
        'message_templates',
        req.auth,
        req.params.id,
        values
      );
      if (!row) throw error('Template not found', 404);
      res.json({ success: true, template: row });
    } catch (cause) {
      next(cause);
    }
  }
);
router.delete(
  '/templates/:id',
  requireAuth,
  requireAdmin,
  async (req, res, next) => {
    try {
      if (
        !(await domain.removeOne('message_templates', req.auth, req.params.id))
      )
        throw error('Template not found', 404);
      res.json({ success: true });
    } catch (cause) {
      next(cause);
    }
  }
);
router.post(
  '/broadcast',
  requireAuth,
  requireWriter,
  async (req, res, next) => {
    try {
      const body = req.body || {};
      const recipients =
        Array.isArray(body.recipients) && body.recipients.length
          ? body.recipients
          : Array.isArray(body.phone_numbers)
            ? body.phone_numbers.map((phone) => ({
                phone,
                params: body.template_params || [],
              }))
            : [];
      if (!recipients.length)
        throw error('recipients or phone_numbers must be a non-empty array');
      if (
        recipients.length > Number(process.env.MAX_BROADCAST_RECIPIENTS || 1000)
      )
        throw error('Broadcast exceeds the configured recipient limit');
      const template_name = domain.assertString(
        body.template_name,
        'template_name',
        512
      );
      const template_language = body.template_language || 'en_US';
      const template = await domain
        .model('message_templates')
        .findOne({
          account_id: domain.accountId(req.auth),
          name: template_name,
          language: template_language,
        })
        .lean();
      if (!template) throw error('Template not found', 404);
      const { config, accessToken } = await messages.configFor(req.auth);
      const results = [];
      for (const recipient of recipients) {
        try {
          const params =
            recipient.messageParams?.body || recipient.params || [];
          const components =
            Array.isArray(params) && params.length
              ? [
                  {
                    type: 'body',
                    parameters: params.map((value) => ({
                      type: 'text',
                      text: String(value),
                    })),
                  },
                ]
              : [];
          const response = await meta.sendMessage(
            config.phone_number_id,
            accessToken,
            {
              to: messages.phone(recipient.phone),
              type: 'template',
              template: {
                name: template.name,
                language: { code: template.language || template_language },
                ...(components.length ? { components } : {}),
              },
            }
          );
          results.push({
            phone: recipient.phone,
            status: 'sent',
            whatsapp_message_id: response?.messages?.[0]?.id || null,
          });
        } catch (cause) {
          results.push({
            phone: recipient.phone,
            status: 'failed',
            error: cause.message || 'Unknown error',
          });
        }
      }
      const sent = results.filter((item) => item.status === 'sent').length;
      res.json({
        success: true,
        total: results.length,
        sent,
        failed: results.length - sent,
        results,
      });
    } catch (cause) {
      next(cause);
    }
  }
);
router.post(
  '/broadcast/:id/resume',
  requireAuth,
  requireWriter,
  async (req, res, next) => {
    try {
      const scope = req.body?.scope === 'failed' ? 'failed' : 'pending';
      const count = await domain.model('broadcast_recipients').countDocuments({
        account_id: domain.accountId(req.auth),
        broadcast_id: req.params.id,
        status: scope,
      });
      if (!count) throw error(`No ${scope} recipients remain.`, 400);
      broadcasts.startDispatch({
        auth: req.auth,
        broadcastId: req.params.id,
        statuses: [scope],
      });
      res.status(202).json({ success: true, resuming: count, remaining: 0 });
    } catch (cause) {
      next(cause);
    }
  }
);
router.post(
  '/broadcast/:id/rerun',
  requireAuth,
  requireWriter,
  async (req, res, next) => {
    try {
      const rerun = await broadcasts.createRerun(req.auth, req.params.id);
      broadcasts.startDispatch({
        auth: req.auth,
        broadcastId: rerun.id,
        statuses: ['pending'],
      });
      res.status(202).json({ success: true, broadcast: rerun });
    } catch (cause) {
      next(cause);
    }
  }
);
router.get('/media/:mediaId', requireAuth, async (req, res, next) => {
  try {
    const { config, accessToken } = await messages.configFor(req.auth);
    const metadata = await meta.request(
      `/${encodeURIComponent(req.params.mediaId)}`,
      accessToken
    );
    if (!metadata.url) throw error('Media is unavailable from Meta', 404);
    const upstream = await fetch(metadata.url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!upstream.ok || !upstream.body)
      throw error('Unable to download media from Meta', 502);
    res.status(200);
    res.setHeader(
      'Content-Type',
      metadata.mime_type ||
        upstream.headers.get('content-type') ||
        'application/octet-stream'
    );
    if (metadata.file_size)
      res.setHeader('Content-Length', String(metadata.file_size));
    const { Readable } = require('stream');
    Readable.fromWeb(upstream.body).pipe(res);
  } catch (cause) {
    next(cause);
  }
});
module.exports = router;
