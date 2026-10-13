const router = require('express').Router();
const {
  requireAuth,
  requireWriter,
  requireAdmin,
} = require('../middleware/auth.middleware');
const { error, plain } = require('../services/data.service');
const domain = require('../services/domain.service');
const { encrypt } = require('../utils/crypto');
const ai = require('../services/ai.service');

async function configRow(auth) {
  return domain
    .model('ai_configs')
    .findOne({ account_id: domain.accountId(auth) })
    .lean();
}
function safeConfig(row) {
  if (!row) return { configured: false };
  const { api_key, embeddings_api_key, ...safe } = row;
  return {
    configured: true,
    has_key: Boolean(api_key),
    has_embeddings_key: Boolean(embeddings_api_key),
    ...plain(safe),
  };
}
async function knowledge(auth, input) {
  const docs = await domain
    .model('ai_knowledge_documents')
    .find({
      account_id: domain.accountId(auth),
      content: {
        $regex: String(input || '')
          .split(/\s+/)
          .filter(Boolean)
          .slice(0, 4)
          .join('|'),
        $options: 'i',
      },
    })
    .sort({ updated_at: -1 })
    .limit(3)
    .lean();
  return docs.map((doc) => String(doc.content || '').slice(0, 3000));
}
async function usage(auth, values) {
  try {
    await domain.insert('ai_usage_log', auth, {
      user_id: domain.userId(auth),
      ...values,
    });
  } catch (cause) {
    console.error('[ai] usage log skipped:', cause.message);
  }
}

router.get('/config', requireAuth, async (req, res, next) => {
  try {
    res.json(safeConfig(await configRow(req.auth)));
  } catch (cause) {
    next(cause);
  }
});
router.post('/config', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const body = req.body || {};
    if (!['openai', 'anthropic'].includes(body.provider))
      throw error('provider must be "openai" or "anthropic"');
    const model = domain.assertString(body.model, 'model', 160);
    const existing = await configRow(req.auth);
    const rawKey = typeof body.api_key === 'string' ? body.api_key.trim() : '';
    if (!rawKey && !existing?.api_key) throw error('api_key is required');
    const values = {
      provider: body.provider,
      model,
      system_prompt:
        typeof body.system_prompt === 'string'
          ? body.system_prompt.trim() || null
          : null,
      is_active: body.is_active === true,
      auto_reply_enabled: body.auto_reply_enabled === true,
      auto_reply_max_per_conversation: Math.min(
        20,
        Math.max(
          1,
          Math.floor(Number(body.auto_reply_max_per_conversation) || 3)
        )
      ),
      handoff_agent_id:
        typeof body.handoff_agent_id === 'string' && body.handoff_agent_id
          ? body.handoff_agent_id
          : null,
      updated_at: domain.now(),
    };
    if (rawKey) values.api_key = encrypt(rawKey);
    if ('embeddings_api_key' in body)
      values.embeddings_api_key = body.embeddings_api_key
        ? encrypt(String(body.embeddings_api_key).trim())
        : null;
    if (existing)
      await domain
        .model('ai_configs')
        .updateOne(
          { id: existing.id, account_id: domain.accountId(req.auth) },
          { $set: values }
        );
    else
      await domain.insert('ai_configs', req.auth, {
        ...values,
        api_key: values.api_key,
        created_by: domain.userId(req.auth),
      });
    res.json({ success: true });
  } catch (cause) {
    next(cause);
  }
});
router.delete('/config', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    await domain
      .model('ai_configs')
      .deleteMany({ account_id: domain.accountId(req.auth) });
    res.json({ success: true });
  } catch (cause) {
    next(cause);
  }
});
router.post('/test', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const body = req.body || {};
    const row = await configRow(req.auth);
    const config = {
      provider: body.provider,
      model: body.model,
      apiKey:
        typeof body.api_key === 'string' && body.api_key.trim()
          ? body.api_key.trim()
          : ai.loadConfig(row, false)?.apiKey,
      systemPrompt: '',
    };
    if (
      !['openai', 'anthropic'].includes(config.provider) ||
      !config.model ||
      !config.apiKey
    )
      throw error('provider, model, and api_key are required');
    await ai.generate(
      config,
      [{ role: 'user', content: 'Reply with OK.' }],
      'Reply with exactly OK.'
    );
    res.json({ ok: true });
  } catch (cause) {
    next(cause);
  }
});
router.get('/knowledge', requireAuth, async (req, res, next) => {
  try {
    const documents = await domain.many('ai_knowledge_documents', req.auth);
    res.json({ documents: documents.map(({ content, ...doc }) => doc) });
  } catch (cause) {
    next(cause);
  }
});
router.post('/knowledge', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const title = domain.assertString(req.body?.title, 'title', 240);
    const content = domain.assertString(req.body?.content, 'content', 200000);
    const document = await domain.insert('ai_knowledge_documents', req.auth, {
      title,
      content,
      created_by: domain.userId(req.auth),
    });
    res.status(201).json({ success: true, id: document.id });
  } catch (cause) {
    next(cause);
  }
});
router.get('/knowledge/:id', requireAuth, async (req, res, next) => {
  try {
    const document = await domain.one('ai_knowledge_documents', req.auth, {
      id: req.params.id,
    });
    if (!document) throw error('Document not found', 404);
    res.json({ document });
  } catch (cause) {
    next(cause);
  }
});
router.patch(
  '/knowledge/:id',
  requireAuth,
  requireAdmin,
  async (req, res, next) => {
    try {
      const values = {};
      if ('title' in (req.body || {}))
        values.title = domain.assertString(req.body.title, 'title', 240);
      if ('content' in (req.body || {}))
        values.content = domain.assertString(
          req.body.content,
          'content',
          200000
        );
      const document = await domain.updateOne(
        'ai_knowledge_documents',
        req.auth,
        req.params.id,
        values
      );
      if (!document) throw error('Document not found', 404);
      res.json({ document });
    } catch (cause) {
      next(cause);
    }
  }
);
router.delete(
  '/knowledge/:id',
  requireAuth,
  requireAdmin,
  async (req, res, next) => {
    try {
      if (
        !(await domain.removeOne(
          'ai_knowledge_documents',
          req.auth,
          req.params.id
        ))
      )
        throw error('Document not found', 404);
      await domain
        .model('ai_knowledge_chunks')
        .deleteMany({
          account_id: domain.accountId(req.auth),
          document_id: req.params.id,
        });
      res.json({ success: true });
    } catch (cause) {
      next(cause);
    }
  }
);
router.post(
  '/knowledge/reindex',
  requireAuth,
  requireAdmin,
  async (req, res, next) => {
    try {
      res.json({
        success: true,
        message:
          'Keyword indexing is always current. Configure an embeddings key to enable semantic indexing.',
      });
    } catch (cause) {
      next(cause);
    }
  }
);

router.post(
  '/playground',
  requireAuth,
  requireWriter,
  async (req, res, next) => {
    try {
      const messages = Array.isArray(req.body?.messages)
        ? req.body.messages
            .filter(
              (m) =>
                m &&
                ['user', 'assistant'].includes(m.role) &&
                typeof m.content === 'string' &&
                m.content.trim()
            )
            .slice(-20)
        : [];
      if (!messages.length) throw error('messages is required');
      const config = ai.loadConfig(await configRow(req.auth), false);
      if (!config)
        throw error('No agent configured yet. Add your provider key in Setup.');
      const result = await ai.generate(
        config,
        messages,
        ai.defaultPrompt(
          config,
          'auto_reply',
          await knowledge(req.auth, messages.at(-1)?.content)
        )
      );
      await usage(req.auth, {
        mode: 'playground',
        provider: config.provider,
        model: config.model,
        input_tokens:
          result.usage.input_tokens || result.usage.prompt_tokens || null,
        output_tokens:
          result.usage.output_tokens || result.usage.completion_tokens || null,
      });
      res.json({ reply: result.text, handoff: false });
    } catch (cause) {
      next(cause);
    }
  }
);
router.post('/draft', requireAuth, requireWriter, async (req, res, next) => {
  try {
    const conversationId = req.body?.conversation_id;
    if (typeof conversationId !== 'string')
      throw error('conversation_id is required');
    const conversation = await domain.one('conversations', req.auth, {
      id: conversationId,
    });
    if (!conversation) throw error('Conversation not found', 404);
    const rows = await domain.many(
      'messages',
      req.auth,
      { conversation_id: conversationId },
      { created_at: -1 }
    );
    const messages = rows
      .slice(0, 20)
      .reverse()
      .filter((row) => row.content_text)
      .map((row) => ({
        role:
          row.direction === 'outbound' || row.sender_type === 'agent'
            ? 'assistant'
            : 'user',
        content: row.content_text,
      }));
    if (!messages.length) throw error('No messages to draft from yet.');
    const config = ai.loadConfig(await configRow(req.auth));
    if (!config)
      throw error(
        'AI assistant is not set up. Enable it in Settings → AI Assistant.'
      );
    const result = await ai.generate(
      config,
      messages,
      ai.defaultPrompt(
        config,
        'draft',
        await knowledge(req.auth, messages.at(-1)?.content)
      )
    );
    await usage(req.auth, {
      conversation_id: conversationId,
      mode: 'draft',
      provider: config.provider,
      model: config.model,
      input_tokens:
        result.usage.input_tokens || result.usage.prompt_tokens || null,
      output_tokens:
        result.usage.output_tokens || result.usage.completion_tokens || null,
    });
    res.json({ draft: result.text });
  } catch (cause) {
    next(cause);
  }
});
router.get('/usage', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const days = Math.min(90, Math.max(1, Number(req.query.days) || 30));
    const since = new Date(Date.now() - days * 86400000);
    const rows = await domain
      .model('ai_usage_log')
      .find({
        account_id: domain.accountId(req.auth),
        created_at: { $gte: since },
      })
      .sort({ created_at: -1 })
      .lean();
    res.json({ usage: rows.map(plain) });
  } catch (cause) {
    next(cause);
  }
});
module.exports = router;
