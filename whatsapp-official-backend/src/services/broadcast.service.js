const { randomUUID } = require('crypto');
const domain = require('./domain.service');
const { error } = require('./data.service');
const { decrypt } = require('../utils/crypto');
const meta = require('./meta.service');
const { phone } = require('./message.service');

const BATCH_SIZE = 10;
const BATCH_DELAY_MS = 1000;

function pause(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function refreshCounts(accountId, broadcastId) {
  const Recipients = domain.model('broadcast_recipients');
  const [total, sent, failed] = await Promise.all([
    Recipients.countDocuments({ account_id: accountId, broadcast_id: broadcastId }),
    Recipients.countDocuments({
      account_id: accountId,
      broadcast_id: broadcastId,
      status: { $in: ['sent', 'delivered', 'read', 'replied'] },
    }),
    Recipients.countDocuments({
      account_id: accountId,
      broadcast_id: broadcastId,
      status: 'failed',
    }),
  ]);
  const pending = await Recipients.countDocuments({
    account_id: accountId,
    broadcast_id: broadcastId,
    status: 'pending',
  });
  const status = pending > 0 ? 'sending' : failed === total ? 'failed' : 'sent';
  await domain.model('broadcasts').updateOne(
    { account_id: accountId, id: broadcastId },
    {
      $set: {
        total_recipients: total,
        sent_count: sent,
        failed_count: failed,
        status,
        completed_at: pending === 0 ? domain.now() : null,
        updated_at: domain.now(),
      },
    }
  );
  return { total, sent, failed, pending, status };
}

async function dispatchBroadcast({ auth, broadcastId, statuses = ['pending'] }) {
  const accountId = domain.accountId(auth);
  const broadcast = await domain
    .model('broadcasts')
    .findOne({ account_id: accountId, id: broadcastId })
    .lean();
  if (!broadcast) throw error('Broadcast not found', 404);
  const config = await domain
    .model('whatsapp_config')
    .findOne({ account_id: accountId })
    .lean();
  if (!config?.phone_number_id || !config?.access_token)
    throw error('WhatsApp is not configured.', 400);
  const template = await domain
    .model('message_templates')
    .findOne({
      account_id: accountId,
      name: broadcast.template_name,
      language: broadcast.template_language || 'en_US',
    })
    .lean();
  if (!template) throw error('The broadcast template no longer exists.', 404);

  const recipients = await domain
    .model('broadcast_recipients')
    .find({ account_id: accountId, broadcast_id: broadcastId, status: { $in: statuses } })
    .lean();
  if (!recipients.length) return { ...await refreshCounts(accountId, broadcastId), processed: 0 };

  const contacts = await domain
    .model('contacts')
    .find({ account_id: accountId, id: { $in: recipients.map((row) => row.contact_id) } })
    .lean();
  const contactsById = new Map(contacts.map((contact) => [contact.id, contact]));
  const Recipients = domain.model('broadcast_recipients');
  const accessToken = decrypt(config.access_token);
  await domain.model('broadcasts').updateOne(
    { account_id: accountId, id: broadcastId },
    { $set: { status: 'sending', completed_at: null, updated_at: domain.now() } }
  );

  for (let offset = 0; offset < recipients.length; offset += BATCH_SIZE) {
    const batch = recipients.slice(offset, offset + BATCH_SIZE);
    for (const recipient of batch) {
      const contact = contactsById.get(recipient.contact_id);
      try {
        if (!contact?.phone) throw error('No phone number on contact');
        const params = Array.isArray(recipient.template_params)
          ? recipient.template_params
          : [];
        const components = params.length
          ? [
              {
                type: 'body',
                parameters: params.map((text) => ({ type: 'text', text: String(text) })),
              },
            ]
          : [];
        const response = await meta.sendMessage(config.phone_number_id, accessToken, {
          to: phone(contact.phone),
          type: 'template',
          template: {
            name: template.name,
            language: { code: template.language || broadcast.template_language || 'en_US' },
            ...(components.length ? { components } : {}),
          },
        });
        await Recipients.updateOne(
          { account_id: accountId, id: recipient.id },
          {
            $set: {
              status: 'sent',
              sent_at: domain.now(),
              whatsapp_message_id: response?.messages?.[0]?.id || null,
              error_message: null,
              updated_at: domain.now(),
            },
          }
        );
      } catch (cause) {
        await Recipients.updateOne(
          { account_id: accountId, id: recipient.id },
          {
            $set: {
              status: 'failed',
              error_message: cause.message || 'Unknown send error',
              updated_at: domain.now(),
            },
          }
        );
      }
    }
    await refreshCounts(accountId, broadcastId);
    if (offset + BATCH_SIZE < recipients.length) await pause(BATCH_DELAY_MS);
  }
  return { ...await refreshCounts(accountId, broadcastId), processed: recipients.length };
}

async function createRerun(auth, sourceId) {
  const accountId = domain.accountId(auth);
  const source = await domain
    .model('broadcasts')
    .findOne({ account_id: accountId, id: sourceId })
    .lean();
  if (!source) throw error('Broadcast not found', 404);
  if (source.status === 'sending')
    throw error('Wait for the active broadcast to finish before rerunning it.', 409);
  const sourceRecipients = await domain
    .model('broadcast_recipients')
    .find({ account_id: accountId, broadcast_id: sourceId })
    .lean();
  if (!sourceRecipients.length) throw error('This broadcast has no recipients to rerun.', 400);

  const rerun = await domain.insert('broadcasts', auth, {
    user_id: domain.userId(auth),
    name: `${source.name} (rerun)`,
    template_name: source.template_name,
    template_language: source.template_language || 'en_US',
    template_variables: source.template_variables || {},
    audience_filter: source.audience_filter || null,
    rerun_of: source.id,
    status: 'sending',
    total_recipients: sourceRecipients.length,
    sent_count: 0,
    delivered_count: 0,
    read_count: 0,
    replied_count: 0,
    failed_count: 0,
  });
  await domain.model('broadcast_recipients').insertMany(
    sourceRecipients.map((recipient) => ({
      id: randomUUID(),
      account_id: accountId,
      broadcast_id: rerun.id,
      contact_id: recipient.contact_id,
      template_params: Array.isArray(recipient.template_params)
        ? recipient.template_params
        : [],
      status: 'pending',
      created_at: domain.now(),
      updated_at: domain.now(),
    }))
  );
  return rerun;
}

function startDispatch(args) {
  void dispatchBroadcast(args).catch((cause) =>
    console.error(`[broadcast] Dispatch failed for ${args.broadcastId}:`, cause)
  );
}

module.exports = { createRerun, dispatchBroadcast, refreshCounts, startDispatch };
