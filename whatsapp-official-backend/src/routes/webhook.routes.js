const router = require('express').Router();
const crypto = require('crypto');
const { randomUUID } = require('crypto');
const domain = require('../services/domain.service');
const { decrypt } = require('../utils/crypto');
const { mirrorInboundMedia } = require('../services/inbound-media.service');
const { refreshCounts } = require('../services/broadcast.service');

const MEDIA_TYPES = new Set(['image', 'video', 'document', 'audio', 'sticker']);

const STATUS_PREDECESSORS = {
  sent: ['sending', 'sent'],
  delivered: ['sending', 'sent', 'delivered'],
  read: ['sending', 'sent', 'delivered', 'read'],
  failed: ['sending', 'sent'],
};

function safeEqual(a, b) {
  const left = Buffer.from(String(a || ''));
  const right = Buffer.from(String(b || ''));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}
function signatureValid(req) {
  const secret = process.env.META_APP_SECRET;
  if (!secret) return process.env.NODE_ENV !== 'production';
  const supplied = (req.get('x-hub-signature-256') || '').replace(
    /^sha256=/,
    ''
  );
  const expected = crypto
    .createHmac('sha256', secret)
    .update(req.rawBody || '')
    .digest('hex');
  return safeEqual(supplied, expected);
}
function content(message) {
  if (message.type === 'text')
    return { content_text: message.text?.body || null };
  if (message.type === 'interactive') {
    const reply =
      message.interactive?.button_reply || message.interactive?.list_reply;
    return {
      content_text: reply?.title || reply?.id || '[Interactive reply]',
      interactive_reply_id: reply?.id || null,
    };
  }
  if (message.type === 'button')
    return {
      content_text: message.button?.text || message.button?.payload || null,
      interactive_reply_id: message.button?.payload || null,
    };
  if (MEDIA_TYPES.has(message.type))
    return {
      content_text:
        message[message.type]?.caption ||
        message[message.type]?.filename ||
        null,
      media_id: message[message.type]?.id || null,
      mime_type: message[message.type]?.mime_type || null,
      media_url: message[message.type]?.id
        ? `/api/whatsapp/media/${encodeURIComponent(message[message.type].id)}`
        : null,
    };
  return { content_text: `[${message.type || 'unknown'}]` };
}
async function receive(config, message, contactName) {
  if (!message?.id || !message.from) return;
  const auth = {
    account_id: config.account_id,
    sub: config.user_id,
    role: 'owner',
  };
  const Messages = domain.model('messages');
  if (
    await Messages.exists({
      account_id: config.account_id,
      message_id: message.id,
    })
  )
    return;
  const phone = String(message.from).replace(/\D/g, '');
  if (!phone) return;
  let contact = await domain.one('contacts', auth, { phone });
  if (!contact)
    contact = await domain.insert('contacts', auth, {
      user_id: config.user_id,
      phone,
      name: contactName || phone,
    });
  let conversation = await domain.one('conversations', auth, {
    contact_id: contact.id,
  });
  if (!conversation)
    conversation = await domain.insert('conversations', auth, {
      user_id: config.user_id,
      contact_id: contact.id,
      status: 'open',
      unread_count: 0,
    });
  const value = content(message);
  const storedMessage = await domain.insert('messages', auth, {
    conversation_id: conversation.id,
    user_id: config.user_id,
    // Keep the persisted value compatible with the frontend's historic
    // message contract. Older Node-written rows used "contact", which is
    // still accepted by the session checker for migration compatibility.
    sender_type: 'customer',
    direction: 'inbound',
    content_type: message.type || 'text',
    message_id: message.id,
    status: 'delivered',
    ...value,
  });
  // A Meta webhook must return quickly. Persist the message immediately and
  // copy the attachment to S3 in the background; failures keep the temporary
  // authenticated Meta-media URL rather than causing Meta to retry the event.
  if (
    config.mirror_inbound_media !== false &&
    MEDIA_TYPES.has(message.type) &&
    value.media_id
  ) {
    void mirrorInboundMedia({
      accountId: config.account_id,
      messageId: storedMessage.id,
      mediaId: value.media_id,
      mediaType: message.type,
      accessToken: decrypt(config.access_token),
    })
      .then((stored) => {
        if (!stored) return;
        return Messages.updateOne(
          { id: storedMessage.id, account_id: config.account_id },
          {
            $set: {
              media_url: stored.publicUrl,
              mime_type: value.mime_type || null,
              updated_at: domain.now(),
            },
          }
        );
      })
      .catch((cause) =>
        console.warn(
          `[whatsapp] Unable to mirror inbound media ${value.media_id}:`,
          cause.message
        )
      );
  }
  await domain
    .model('conversations')
    .updateOne(
      { id: conversation.id, account_id: config.account_id },
      {
        $set: {
          status: 'open',
          unread_count: Number(conversation.unread_count || 0) + 1,
          last_message_at: domain.now(),
          last_message_text: value.content_text || `[${message.type}]`,
          updated_at: domain.now(),
        },
      }
    );
}

function statusError(status) {
  if (status.status !== 'failed') return null;
  const messages = (status.errors || [])
    .map((item) => item?.message || item?.title || item?.code)
    .filter(Boolean);
  return messages.length ? messages.join('; ') : 'WhatsApp could not deliver this message.';
}

/**
 * The POST /messages API only confirms that Meta accepted a message.  Its
 * final delivery outcome is emitted later through this webhook.  Persisting
 * those events keeps the inbox and broadcast pages truthful instead of
 * leaving a rejected message labelled "sent" forever.
 */
async function receiveStatus(config, status) {
  if (!status?.id || !STATUS_PREDECESSORS[status.status]) return;
  const accountId = config.account_id;
  const timestamp = Number(status.timestamp);
  const occurredAt = Number.isFinite(timestamp) && timestamp > 0
    ? new Date(timestamp * 1000)
    : domain.now();
  const patch = {
    status: status.status,
    updated_at: domain.now(),
  };
  if (status.status === 'sent') patch.sent_at = occurredAt;
  if (status.status === 'delivered') patch.delivered_at = occurredAt;
  if (status.status === 'read') patch.read_at = occurredAt;
  if (status.status === 'failed') patch.error_message = statusError(status);

  const Messages = domain.model('messages');
  await Messages.updateMany(
    {
      account_id: accountId,
      message_id: status.id,
      status: { $in: STATUS_PREDECESSORS[status.status] },
    },
    {
      $set: patch,
      $push: {
        status_history: {
          status: status.status,
          timestamp: String(status.timestamp || Math.floor(occurredAt.getTime() / 1000)),
        },
      },
    }
  );

  const Recipients = domain.model('broadcast_recipients');
  const recipients = await Recipients.find({
    account_id: accountId,
    whatsapp_message_id: status.id,
    status: { $in: STATUS_PREDECESSORS[status.status] },
  })
    .select('id broadcast_id')
    .lean();
  if (!recipients.length) return;

  const recipientPatch = { ...patch };
  if (status.status === 'failed')
    recipientPatch.error_message = statusError(status);
  await Recipients.updateMany(
    { id: { $in: recipients.map((recipient) => recipient.id) }, account_id: accountId },
    { $set: recipientPatch }
  );
  await Promise.all(
    [...new Set(recipients.map((recipient) => recipient.broadcast_id))].map(
      (broadcastId) => refreshCounts(accountId, broadcastId)
    )
  );
}

router.get('/', async (req, res) => {
  const mode = req.query['hub.mode'];
  const challenge = req.query['hub.challenge'];
  const token = req.query['hub.verify_token'];
  if (mode !== 'subscribe' || !challenge || typeof token !== 'string')
    return res.status(400).send('Bad Request');
  const configs = await domain.model('whatsapp_config').find({}).lean();
  for (const config of configs) {
    try {
      if (config.verify_token && safeEqual(decrypt(config.verify_token), token))
        return res.status(200).send(String(challenge));
    } catch {
      /* corrupted row is ignored */
    }
  }
  return res.status(403).send('Forbidden');
});
router.post('/', async (req, res, next) => {
  try {
    if (!signatureValid(req))
      return res.status(401).json({ error: 'Invalid Meta webhook signature' });
    const changes =
      req.body?.entry?.flatMap((entry) => entry.changes || []) || [];
    for (const change of changes) {
      if (change.field !== 'messages') continue;
      const value = change.value || {};
      const phoneId = value.metadata?.phone_number_id;
      if (!phoneId) continue;
      const config = await domain
        .model('whatsapp_config')
        .findOne({ phone_number_id: phoneId })
        .lean();
      if (!config) continue;
      const names = new Map(
        (value.contacts || []).map((contact) => [
          contact.wa_id,
          contact.profile?.name || '',
        ])
      );
      for (const status of value.statuses || [])
        await receiveStatus(config, status);
      for (const message of value.messages || [])
        await receive(config, message, names.get(message.from));
    }
    return res.status(200).json({ success: true });
  } catch (cause) {
    return next(cause);
  }
});
module.exports = router;
