const { randomUUID } = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const domain = require('./domain.service');
const { error } = require('./data.service');
const { decrypt } = require('../utils/crypto');
const meta = require('./meta.service');

function phone(value) {
  const output = String(value || '').replace(/\D/g, '');
  if (output.length < 7 || output.length > 15)
    throw error('Contact phone number is invalid');
  return output;
}
function interactive(payload) {
  if (
    !payload ||
    typeof payload !== 'object' ||
    !payload.body
  )
    throw error('interactive_payload must include a type and body');
  // Saved quick replies use the frontend's durable `kind` shape
  // (`buttons` / `list`); older callers use Meta's `type` shape
  // (`button` / `list`). Support both at this API boundary.
  const type =
    payload.type || (payload.kind === 'buttons' ? 'button' : payload.kind);
  const shared = {
    ...(payload.header ? { header: { type: 'text', text: payload.header } } : {}),
    ...(payload.footer ? { footer: { text: payload.footer } } : {}),
  };
  if (type === 'button')
    return {
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: payload.body },
        ...shared,
        action: {
          buttons: Array.isArray(payload.buttons)
            ? payload.buttons.map((button) => ({
                type: 'reply',
                reply: { id: String(button.id), title: String(button.title) },
              }))
            : [],
        },
      },
    };
  if (type === 'list')
    return {
      type: 'interactive',
      interactive: {
        type: 'list',
        body: { text: payload.body },
        ...shared,
        action: {
          button: payload.button_text || payload.button_label || 'View options',
          sections: payload.sections || [],
        },
      },
    };
  throw error('Unsupported interactive message type');
}
function renderTemplate(template, params) {
  return String(template.body_text || '').replace(
    /{{\s*(\d+)\s*}}/g,
    (_match, index) =>
      String(
        params?.body?.[Number(index) - 1] ?? params?.[Number(index) - 1] ?? ''
      )
  );
}

function publicHttpsUrl(value, field) {
  const url = String(value || '').trim();
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') throw new Error('not https');
    return parsed.toString();
  } catch {
    throw error(`${field} must be a public HTTPS URL`);
  }
}

function templateComponents(input) {
  if (!Array.isArray(input)) return null;
  return input.map((component) => {
    if (!component || typeof component !== 'object')
      throw error('template.components entries must be objects');
    const type = String(component.type || '').toLowerCase();
    if (!['header', 'body', 'button'].includes(type))
      throw error('Unsupported template component type');
    if (type === 'button' && !Number.isInteger(component.index))
      throw error('template button components require an index');
    const parameters = Array.isArray(component.parameters)
      ? component.parameters.map((parameter) => {
          const parameterType = String(parameter?.type || '').toLowerCase();
          if (!['text', 'image', 'video', 'document', 'payload'].includes(parameterType))
            throw error('Unsupported template parameter type');
          if (type === 'button' && parameterType !== 'payload')
            throw error('Template button components currently support quick-reply payload parameters only');
          if (parameterType === 'text') {
            const text = String(parameter?.text || '').trim();
            if (!text) throw error('Template text parameters require text');
            return { type: 'text', text };
          }
          if (parameterType === 'payload') {
            const payload = String(parameter?.payload || '').trim();
            if (!payload) throw error('Template payload parameters require payload');
            return { type: 'payload', payload };
          }
          const link = publicHttpsUrl(parameter?.link, 'Template media link');
          return {
            type: parameterType,
            [parameterType]: {
              link,
              ...(parameterType === 'document' && parameter?.filename
                ? { filename: String(parameter.filename).slice(0, 255) }
                : {}),
            },
          };
        })
      : [];
    return {
      type,
      ...(type === 'button'
        ? { sub_type: 'quick_reply', index: String(component.index) }
        : {}),
      ...(parameters.length ? { parameters } : {}),
    };
  });
}

async function configFor(auth) {
  const config = await domain
    .model('whatsapp_config')
    .findOne({ account_id: domain.accountId(auth) })
    .lean();
  if (!config?.phone_number_id || !config?.access_token)
    throw error('WhatsApp is not configured.', 400);
  return { config, accessToken: decrypt(config.access_token) };
}
async function target(auth, { conversation_id, contact_id }) {
  let conversation = conversation_id
    ? await domain.one('conversations', auth, { id: conversation_id })
    : null;
  if (!conversation && contact_id) {
    const contact = await domain.one('contacts', auth, { id: contact_id });
    if (!contact) throw error('Contact not found', 404);
    conversation =
      (await domain.one('conversations', auth, { contact_id })) ||
      (await domain.insert('conversations', auth, {
        contact_id,
        user_id: domain.userId(auth),
        status: 'open',
      }));
  }
  if (!conversation) throw error('Conversation not found', 404);
  const contact = await domain.one('contacts', auth, {
    id: conversation.contact_id,
  });
  if (!contact) throw error('Contact not found', 404);
  return { conversation, contact };
}

async function send(auth, body) {
  const messageType = body?.message_type;
  if (
    ![
      'text',
      'image',
      'video',
      'audio',
      'document',
      'template',
      'interactive',
    ].includes(messageType)
  )
    throw error('Unsupported message_type');
  const { conversation, contact } = await target(auth, body || {});
  const { config, accessToken } = await configFor(auth);
  let outbound;
  let contentText = body.content_text || null;
  if (messageType === 'text') {
    if (!String(contentText || '').trim())
      throw error('content_text is required');
    outbound = { type: 'text', text: { body: String(contentText) } };
  } else if (messageType === 'template') {
    const template = await domain
      .model('message_templates')
      .findOne({
        account_id: domain.accountId(auth),
        name: body.template_name,
        language: body.template_language || 'en_US',
      })
      .lean();
    if (!template) throw error('Template not found', 404);
    const messageParams = body.template_message_params || {
      body: body.template_params || [],
    };
    const components = templateComponents(body.template_components) || [];
    if (!components.length && Array.isArray(messageParams.body) && messageParams.body.length)
      components.push({
        type: 'body',
        parameters: messageParams.body.map((value) => ({
          type: 'text',
          text: String(value),
        })),
      });
    outbound = {
      type: 'template',
      template: {
        name: template.name,
        language: { code: template.language || 'en_US' },
        ...(components.length ? { components } : {}),
      },
    };
    contentText = contentText || renderTemplate(template, messageParams);
  } else if (messageType === 'interactive') {
    outbound = interactive(body.interactive_payload);
    contentText = body.interactive_payload.body;
  } else {
    if (!body.media_url) throw error('media_url is required');
    if (body.content_text && messageType === 'audio')
      throw error('Audio messages do not support a caption');
    const media = { link: body.media_url };
    if (body.filename && messageType === 'document')
      media.filename = body.filename;
    if (body.content_text && messageType !== 'audio')
      media.caption = body.content_text;
    outbound = { type: messageType, [messageType]: media };
  }
  // Meta returning HTTP 200 means only that it accepted this message for
  // processing. Delivery/read/failure is recorded later by the status
  // webhook, and every immediate Meta rejection is persisted below too.
  const record = {
    conversation_id: conversation.id,
    user_id: domain.userId(auth),
    sender_type: 'agent',
    direction: 'outbound',
    content_type: messageType,
    content_text: contentText,
    media_url: body.media_url || null,
    filename: body.filename || null,
    template_name: body.template_name || null,
    template_language: body.template_language || null,
    template_params: body.template_params || null,
    template_components: body.template_components || null,
    client_reference: body.client_reference || null,
    interactive_payload: body.interactive_payload || null,
    reply_to_message_id: body.reply_to_message_id || null,
  };
  let result;
  try {
    result = await meta.sendMessage(config.phone_number_id, accessToken, {
      to: phone(contact.phone),
      ...outbound,
    });
  } catch (cause) {
    // Do not lose failed attempts: the operator needs the provider reason in
    // Message Logs to act on invalid numbers, an expired session, etc.
    try {
      await domain.insert('messages', auth, {
        ...record,
        message_id: null,
        status: 'failed',
        error_message: cause.message || 'Meta rejected the message.',
      });
    } catch (logCause) {
      console.error('[whatsapp] Unable to store failed send attempt:', logCause);
    }
    throw cause;
  }
  const metaId = result?.messages?.[0]?.id || null;
  const message = await domain.insert('messages', auth, {
    ...record,
    message_id: metaId,
    // "sent" means accepted by Meta, not yet confirmed as delivered.
    status: 'sent',
  });
  await domain
    .model('conversations')
    .updateOne(
      { id: conversation.id, account_id: domain.accountId(auth) },
      {
        $set: {
          last_message_at: domain.now(),
          last_message_text: contentText || '',
          updated_at: domain.now(),
        },
      }
    );
  return { message, whatsappMessageId: metaId };
}

function mediaType(input) {
  const explicit = String(input.mediaType || input.messageType || '').toLowerCase();
  if (['image', 'video', 'audio', 'document', 'sticker'].includes(explicit)) return explicit;
  const file = String(input.fileUrl || input.ftpFilePath || input.base64File?.name || '').toLowerCase();
  if (/\.(png|jpe?g|gif|webp)$/i.test(file)) return 'image';
  if (/\.(mp4|3gp)$/i.test(file)) return 'video';
  if (/\.(mp3|ogg|aac|m4a|wav)$/i.test(file)) return 'audio';
  return 'document';
}
function headerMediaType(input) {
  if (['image', 'video', 'document'].includes(input._templateHeaderType))
    return input._templateHeaderType;
  const file = String(input.fileUrl || input.base64File?.name || '').toLowerCase();
  return /\.(pdf|docx?|xlsx?|csv)$/i.test(file) ? 'document' : 'image';
}
function localUploadPath(value) {
  const root = path.resolve(process.env.UPLOAD_DIR || 'uploads');
  const target = path.resolve(root, String(value || ''));
  if (!target.startsWith(`${root}${path.sep}`)) throw error('ftpFilePath must be inside UPLOAD_DIR');
  return target;
}
async function inlineFile(input) {
  if (input.base64File?.body) {
    const body = String(input.base64File.body).replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(body, 'base64');
    if (!buffer.length) throw error('base64File.body is invalid');
    return {
      buffer,
      originalname: String(input.base64File.name || 'upload.bin'),
      mimetype: String(input.base64File.mimeType || 'application/octet-stream'),
    };
  }
  if (input.ftpFilePath) {
    const filename = path.basename(String(input.ftpFilePath));
    return { buffer: await fs.readFile(localUploadPath(input.ftpFilePath)), originalname: filename, mimetype: 'application/octet-stream' };
  }
  return null;
}
async function mediaReference(input, config, accessToken) {
  if (input.metaMediaId) return { id: String(input.metaMediaId) };
  const file = await inlineFile(input);
  if (file) {
    const uploaded = await meta.uploadMedia(config.phone_number_id, accessToken, file);
    if (!uploaded.id) throw error('Meta did not return a media id', 502);
    return { id: uploaded.id };
  }
  if (input.fileUrl) return { link: publicHttpsUrl(input.fileUrl, 'fileUrl') };
  return null;
}
function compact(value) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined && item !== null && item !== ''));
}
function paymentPayload(orderDetail) {
  const detail = orderDetail || {};
  const items = Array.isArray(detail.items) ? detail.items : [];
  if (!detail.configuration_name || !items.length) throw error('orderDetail.configuration_name and orderDetail.items are required');
  const currency = String(detail.currency || 'INR').toUpperCase();
  const offset = 100;
  const subtotal = Number(detail.subtotal ?? items.reduce((total, item) => total + Number(item.amount || 0) * Number(item.quantity || 1), 0));
  const total = Number(detail.total_amount ?? subtotal + Number(detail.tax || 0) + Number(detail.shipping || 0) - Number(detail.discount || 0));
  if (!Number.isFinite(total) || total < 0) throw error('orderDetail total is invalid');
  return {
    type: 'interactive',
    interactive: {
      type: 'order_details',
      body: { text: String(detail.body || 'Order details') },
      ...(detail.footer ? { footer: { text: String(detail.footer) } } : {}),
      action: {
        name: 'review_and_pay',
        parameters: {
          reference_id: String(detail.reference_id || randomUUID()),
          type: String(detail.goodsType || 'digital-goods'),
          payment_setting: [{ type: 'payment_gateway', payment_gateway: { type: 'razorpay', configuration_name: String(detail.configuration_name) } }],
          currency,
          total_amount: { value: Math.round(total * offset), offset },
          order: {
            status: 'pending',
            items: items.map((item) => ({ retailer_id: String(item.retailer_id || item.name), name: String(item.name), amount: { value: Math.round(Number(item.amount) * offset), offset }, quantity: Number(item.quantity || 1) })),
            subtotal: { value: Math.round(subtotal * offset), offset },
            ...(detail.tax ? { tax: { value: Math.round(Number(detail.tax) * offset), offset, description: String(detail.taxDescription || '') } } : {}),
            ...(detail.shipping ? { shipping: { value: Math.round(Number(detail.shipping) * offset), offset, description: String(detail.shippingDescription || '') } } : {}),
            ...(detail.discount ? { discount: { value: Math.round(Number(detail.discount) * offset), offset, description: String(detail.discountDescription || '') } } : {}),
          },
        },
      },
    },
  };
}
async function legacyOutbound(input, config, accessToken) {
  const to = phone(input.to);
  const content = {};
  let type = 'text';
  let text = input.text || input.caption || null;
  if (input.templateName) {
    type = 'template';
    const components = [];
    if (Array.isArray(input.templateVariables) && input.templateVariables.length)
      components.push({ type: 'body', parameters: input.templateVariables.map((value) => ({ type: 'text', text: String(value) })) });
    const reference = await mediaReference(input, config, accessToken);
    if (reference)
      components.unshift({ type: 'header', parameters: [{ type: headerMediaType(input), [headerMediaType(input)]: reference }] });
    if (input.location)
      components.unshift({ type: 'header', parameters: [{ type: 'location', location: input.location }] });
    if (input.flow)
      components.push({ type: 'button', sub_type: 'flow', index: '0', parameters: [{ type: 'action', action: input.flow }] });
    if (input.files !== undefined) {
      if (!Array.isArray(input.files) || input.files.length < 2 || input.files.length > 10)
        throw error('files must contain between 2 and 10 carousel media items');
      const cards = [];
      for (let index = 0; index < input.files.length; index++) {
        const file = input.files[index];
        const cardReference = await mediaReference(file, config, accessToken);
        if (!cardReference) throw error(`files[${index}] must include metaMediaId, fileUrl, base64File, or ftpFilePath`);
        const cardType = headerMediaType({ ...file, _templateHeaderType: input._templateHeaderType });
        cards.push({ card_index: index, components: [{ type: 'header', parameters: [{ type: cardType, [cardType]: cardReference }] }] });
      }
      components.push({ type: 'carousel', cards });
    }
    content.payload = { type: 'template', template: compact({ name: String(input.templateName), language: { code: String(input.language || 'en_US') }, components: components.length ? components : undefined }) };
  } else if (input.listButton) {
    type = 'interactive';
    const value = input.listButton;
    if (!value.body || !value.button || !Array.isArray(value.sections)) throw error('listButton.body, button, and sections are required');
    content.payload = { type: 'interactive', interactive: compact({ type: 'list', header: value.header ? { type: 'text', text: value.header } : undefined, body: { text: value.body }, footer: value.footer ? { text: value.footer } : undefined, action: { button: value.button, sections: value.sections.map((section) => ({ ...section, rows: (section.rows || []).map((row, index) => ({ id: String(row.id || `${section.title || 'option'}-${index + 1}`), title: row.title, ...(row.description ? { description: row.description } : {}) })) })) } }) };
    text = value.body;
  } else if (input.replyButton) {
    type = 'interactive';
    const value = input.replyButton;
    const reference = await mediaReference(input, config, accessToken);
    if (!value.body || !Array.isArray(value.buttons) || !value.buttons.length) throw error('replyButton.body and buttons are required');
    content.payload = { type: 'interactive', interactive: compact({ type: 'button', header: reference ? { type: headerMediaType(input), [headerMediaType(input)]: reference } : value.header ? { type: 'text', text: value.header } : undefined, body: { text: value.body }, footer: value.footer ? { text: value.footer } : undefined, action: { buttons: value.buttons.slice(0, 3).map((button, index) => ({ type: 'reply', reply: { id: String(button.id || `button-${index + 1}`), title: String(button.title) } })) } }) };
    text = value.body;
  } else if (input.ctaUrl) {
    type = 'interactive'; const value = input.ctaUrl;
    if (!value.body || !value.button || !value.url) throw error('ctaUrl.body, button, and url are required');
    content.payload = { type: 'interactive', interactive: compact({ type: 'cta_url', header: value.header ? { type: 'text', text: value.header } : undefined, body: { text: value.body }, footer: value.footer ? { text: value.footer } : undefined, action: { name: 'cta_url', parameters: { display_text: value.button, url: publicHttpsUrl(value.url, 'ctaUrl.url') } } }) }; text = value.body;
  } else if (input.catalog) {
    type = 'interactive'; const value = input.catalog;
    content.payload = { type: 'interactive', interactive: { type: 'catalog_message', body: { text: String(value.body || 'View our catalog') }, ...(value.footer ? { footer: { text: value.footer } } : {}), action: { name: 'catalog_message', parameters: compact({ thumbnail_product_retailer_id: value.thumbnailProductRetailerId }) } } }; text = value.body;
  } else if (input.product) {
    type = 'interactive'; const value = input.product;
    if (!value.catalogId || !Array.isArray(value.sections) || !value.sections.length) throw error('product.catalogId and product.sections are required');
    content.payload = { type: 'interactive', interactive: compact({ type: 'product_list', header: value.header ? { type: 'text', text: value.header } : undefined, body: { text: String(value.body || 'Products') }, footer: value.footer ? { text: value.footer } : undefined, action: { catalog_id: value.catalogId, sections: value.sections.map((section) => ({ title: section.title, product_items: (section.productItems || []).map((item) => ({ product_retailer_id: item.productRetailerId })) })) } }) }; text = value.body;
  } else if (input.location) {
    type = 'location'; content.payload = { type: 'location', location: input.location }; text = input.location.name || input.location.address || null;
  } else if (input.contacts) {
    type = 'contacts'; content.payload = { type: 'contacts', contacts: input.contacts }; text = null;
  } else if (input.locationRequest) {
    type = 'interactive'; if (!input.text) throw error('text is required for locationRequest'); content.payload = { type: 'interactive', interactive: { type: 'location_request_message', body: { text: input.text }, action: { name: 'send_location' } } }; text = input.text;
  } else if (input.address) {
    type = 'interactive'; const value = input.address; if (!value.body) throw error('address.body is required'); content.payload = { type: 'interactive', interactive: compact({ type: 'address_message', header: value.header ? { type: 'text', text: value.header } : undefined, body: { text: value.body }, footer: value.footer ? { text: value.footer } : undefined, action: { name: 'address_message' } }) }; text = value.body;
  } else if (input.orderDetail) {
    type = 'interactive'; content.payload = paymentPayload(input.orderDetail); text = input.orderDetail.body || 'Order details';
  } else {
    const reference = await mediaReference(input, config, accessToken);
    if (reference) {
      type = mediaType(input);
      if (type === 'audio' && input.caption) throw error('Audio messages do not support a caption');
      content.payload = { type, [type]: compact({ ...reference, caption: type === 'audio' ? undefined : input.caption, filename: type === 'document' ? input.filename || input.base64File?.name : undefined }) };
    } else {
      if (!String(input.text || '').trim()) throw error('A supported message payload is required');
      content.payload = { type: 'text', text: { body: String(input.text) } };
    }
  }
  return { to, type, text, ...content };
}
async function sendLegacy(auth, input) {
  const { config, accessToken } = await configFor(auth);
  const storedTemplate = input?.templateName
    ? await domain.model('message_templates').findOne({
        account_id: domain.accountId(auth),
        name: input.templateName,
        language: input.language || 'en_US',
      }).lean()
    : null;
  const outbound = await legacyOutbound(
    { ...(input || {}), _templateHeaderType: storedTemplate?.header_type || null },
    config,
    accessToken
  );
  let contact = await domain.one('contacts', auth, { phone: outbound.to });
  if (!contact) contact = await domain.insert('contacts', auth, { user_id: domain.userId(auth), phone: outbound.to, name: outbound.to });
  let conversation = await domain.one('conversations', auth, { contact_id: contact.id });
  if (!conversation) conversation = await domain.insert('conversations', auth, { user_id: domain.userId(auth), contact_id: contact.id, status: 'open' });
  let response;
  try {
    response = await meta.sendMessage(config.phone_number_id, accessToken, { to: outbound.to, ...outbound.payload });
  } catch (cause) {
    const failed = await domain.insert('messages', auth, { conversation_id: conversation.id, user_id: domain.userId(auth), sender_type: 'agent', direction: 'outbound', content_type: outbound.type, content_text: outbound.text, client_reference: input.userMessageId || null, outbound_payload: outbound.payload, status: 'failed', error_message: cause.message || 'Meta rejected the message.' });
    cause.message_record_id = failed.id;
    throw cause;
  }
  const waMessageId = response?.messages?.[0]?.id || null;
  const message = await domain.insert('messages', auth, { conversation_id: conversation.id, user_id: domain.userId(auth), sender_type: 'agent', direction: 'outbound', content_type: outbound.type, content_text: outbound.text, client_reference: input.userMessageId || null, outbound_payload: outbound.payload, message_id: waMessageId, status: 'sent', status_history: [{ status: 'accepted', timestamp: String(Math.floor(Date.now() / 1000)) }, { status: 'sent', timestamp: String(Math.floor(Date.now() / 1000)) }] });
  await domain.model('conversations').updateOne({ id: conversation.id, account_id: domain.accountId(auth) }, { $set: { last_message_at: domain.now(), last_message_text: outbound.text || '', updated_at: domain.now() } });
  return { message, waMessageId, outbound: outbound.payload, contact, conversation };
}
module.exports = { configFor, send, sendLegacy, phone, publicHttpsUrl };
