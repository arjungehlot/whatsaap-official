const router = require('express').Router();
const multer = require('multer');
const bcrypt = require('bcryptjs');
const { randomUUID } = require('crypto');
const { requireLegacyAccess } = require('../middleware/legacy-api.middleware');
const { error, plain } = require('../services/data.service');
const domain = require('../services/domain.service');
const messages = require('../services/message.service');
const meta = require('../services/meta.service');
const User = require('../models/User');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: Number(process.env.MAX_INBOUND_MEDIA_BYTES || 16 * 1024 * 1024), files: 1 },
});
const sendAccess = requireLegacyAccess('messages:send', 'agent');
const contactRead = requireLegacyAccess('contacts:read');
const contactWrite = requireLegacyAccess('contacts:write', 'agent');
const accountRead = requireLegacyAccess('account:read');
const accountWrite = requireLegacyAccess('account:write', 'admin');

function epoch(value) {
  return value ? new Date(value).getTime() : null;
}
function pageRequest(body) {
  const current = Math.max(1, Number(body?.pagination?.current) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(body?.pagination?.pageSize) || 50));
  const sort = body?.order?.[0] || { fieldName: 'creationTime', dir: 'desc' };
  const permitted = new Set(['created_at', 'updated_at', 'name', 'phone', 'status']);
  const field = { creationTime: 'created_at', lastUpdateTime: 'updated_at', receiverNumber: 'phone' }[sort.fieldName] || sort.fieldName;
  return { current, pageSize, sort: { [permitted.has(field) ? field : 'created_at']: String(sort.dir).toLowerCase() === 'asc' ? 1 : -1 } };
}
function dateCriteria(search = []) {
  const filters = Array.isArray(search) ? search : [];
  const item = filters.find((entry) => ['creationTime', 'lastUpdateTime'].includes(entry?.fieldName));
  const values = Array.isArray(item?.value) ? item.value : [];
  if (!item || !values.length) return {};
  const low = Number(values[0]); const high = Number(values[1] || values[0]);
  if (!Number.isFinite(low)) return {};
  return { [item.fieldName === 'lastUpdateTime' ? 'updated_at' : 'created_at']: { $gte: new Date(low), ...(Number.isFinite(high) ? { $lte: new Date(high) } : {}) } };
}
function matchesSearch(row, search = []) {
  for (const entry of Array.isArray(search) ? search : []) {
    if (['creationTime', 'lastUpdateTime'].includes(entry?.fieldName)) continue;
    const terms = (Array.isArray(entry?.value) ? entry.value : [entry?.value]).filter(Boolean).map((term) => String(term).toLowerCase());
    if (!terms.length) continue;
    const field = String(entry.fieldName || '');
    const actual = String(row[field] ?? row[field === 'receiverNumber' ? 'phone' : field] ?? '').toLowerCase();
    if (!terms.some((term) => actual.includes(term))) return false;
  }
  return true;
}
function report(row, contact) {
  const history = Array.isArray(row.status_history) ? row.status_history : [];
  const statusTime = Object.fromEntries(history.map((value) => [value.status, String(value.timestamp)]));
  return {
    id: row.id,
    to: contact?.phone || null,
    ...(row.client_reference ? { userMessageId: row.client_reference } : {}),
    message: row.outbound_payload || null,
    creationTime: epoch(row.created_at),
    waId: row.message_id || null,
    lastStatus: row.status || null,
    statuses: history,
    statusTime,
    ...(row.error_message ? { error: { message: row.error_message } } : {}),
    retry: row.status === 'failed',
  };
}
function contactResult(row) {
  return {
    id: row.id,
    receiverNumber: row.phone,
    name: row.name || null,
    email: row.email || null,
    attributes: row.attributes || {},
    labels: row.labels || [],
    creationTime: epoch(row.created_at),
    lastUpdateTime: epoch(row.updated_at),
  };
}
function agentResult(profile, user) {
  return {
    id: user.id,
    customerId: profile.account_id,
    phoneNumberIds: user.phone_number_ids || [],
    name: user.full_name || profile.full_name || '',
    username: user.username || user.email,
    email: user.email,
    mobileNumber: user.mobile_number || '',
    role: String(profile.account_role || 'agent').toUpperCase(),
    active: !user.disabled_at,
    twoFactor: user.two_factor || null,
    creationTime: epoch(user.created_at),
    lastUpdateTime: epoch(user.updated_at),
  };
}
function parseCsv(value) {
  const rows = []; let row = []; let cell = ''; let quoted = false;
  for (let i = 0; i < value.length; i++) {
    const char = value[i];
    if (char === '"' && quoted && value[i + 1] === '"') { cell += '"'; i++; }
    else if (char === '"') quoted = !quoted;
    else if (char === ',' && !quoted) { row.push(cell.trim()); cell = ''; }
    else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && value[i + 1] === '\n') i++;
      row.push(cell.trim()); if (row.some(Boolean)) rows.push(row); row = []; cell = '';
    } else cell += char;
  }
  row.push(cell.trim()); if (row.some(Boolean)) rows.push(row);
  if (rows.length < 2) throw error('CSV must contain a header and at least one row');
  const headers = rows.shift().map((header) => header.replace(/^\uFEFF/, '').trim());
  return rows.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] || ''])));
}
async function upsertContact(auth, body) {
  const phone = messages.phone(body.receiverNumber || body.to || body.phone);
  const attributes = body.attributes && typeof body.attributes === 'object' ? body.attributes : {};
  const labels = Array.isArray(body.labels) ? [...new Set(body.labels.filter((value) => typeof value === 'string'))] : [];
  const name = attributes.name || body.name || phone;
  const values = { phone, name, email: attributes.email || body.email || null, attributes, labels, user_id: domain.userId(auth) };
  const existing = await domain.one('contacts', auth, { phone });
  if (existing) return { contact: await domain.updateOne('contacts', auth, existing.id, values), created: false };
  return { contact: await domain.insert('contacts', auth, values), created: true };
}
async function messageContacts(auth, rows) {
  const conversationIds = [...new Set(rows.map((row) => row.conversation_id).filter(Boolean))];
  const conversations = conversationIds.length ? await domain.model('conversations').find({ account_id: domain.accountId(auth), id: { $in: conversationIds } }).lean() : [];
  const contactIds = conversations.map((row) => row.contact_id).filter(Boolean);
  const contacts = contactIds.length ? await domain.model('contacts').find({ account_id: domain.accountId(auth), id: { $in: contactIds } }).lean() : [];
  const byConversation = new Map(conversations.map((row) => [row.id, contacts.find((contact) => contact.id === row.contact_id)]));
  return rows.map((row) => [row, byConversation.get(row.conversation_id)]);
}

router.get('/whatsapp/metaPayment/configs/active', sendAccess, async (req, res, next) => {
  try {
    const rows = await domain.many('payment_configurations', req.legacyAuth, { status: 'Active' });
    res.json(rows.map(plain));
  } catch (cause) { next(cause); }
});

router.post('/whatsapp/sendMessage', sendAccess, upload.single('uploadFile'), async (req, res, next) => {
  try {
    const input = { ...(req.body || {}), ...(req.file ? { base64File: { name: req.file.originalname, body: req.file.buffer.toString('base64'), mimeType: req.file.mimetype } } : {}) };
    const result = await messages.sendLegacy(req.legacyAuth, input);
    res.json({ id: result.message.id, ...(input.userMessageId ? { userMessageId: input.userMessageId } : {}), waMessageId: result.waMessageId });
  } catch (cause) { next(cause); }
});

async function executeCampaign(auth, campaign) {
  const now = domain.now();
  const claims = await domain.model('scheduled_campaigns').findOneAndUpdate(
    { id: campaign.id, account_id: domain.accountId(auth), status: { $in: ['queued', 'scheduled'] } },
    { $set: { status: 'processing', started_at: now, updated_at: now } }, { new: true }
  ).lean();
  if (!claims) return null;
  let accepted = 0; let failed = 0; const results = [];
  for (const recipient of claims.recipients || []) {
    try {
      const result = await messages.sendLegacy(auth, { to: recipient.receiverNumber, templateName: claims.template_name, language: claims.language, templateVariables: recipient.variables });
      accepted++; results.push({ to: recipient.receiverNumber, id: result.message.id, waMessageId: result.waMessageId, status: 'sent' });
    } catch (cause) { failed++; results.push({ to: recipient.receiverNumber, status: 'failed', error: cause.message }); }
  }
  await domain.model('scheduled_campaigns').updateOne({ id: claims.id, account_id: domain.accountId(auth) }, { $set: { status: failed ? 'completed_with_failures' : 'completed', accepted, failed, results, completed_at: domain.now(), updated_at: domain.now() } });
  return { accepted, failed, results };
}
function campaignAuth(campaign) { return { account_id: campaign.account_id, sub: campaign.created_by, role: 'owner' }; }
async function runDueCampaigns() {
  const due = await domain.model('scheduled_campaigns').find({ status: 'scheduled', scheduled_for: { $lte: domain.now() } }).lean();
  await Promise.allSettled(due.map((campaign) => executeCampaign(campaignAuth(campaign), campaign)));
  return due.length;
}
router.post('/whatsapp/sendMessageByCampaign1', sendAccess, upload.single('csvFile'), async (req, res, next) => {
  try {
    if (!req.file) throw error('csvFile is required');
    let data; try { data = JSON.parse(String(req.body?.jsonData || '')); } catch { throw error('jsonData must be valid JSON'); }
    if (data.campaignType !== 'CSV' || !data.campaignName || !data.message?.templateName || !data.message?.language) throw error('campaignType, campaignName, message.templateName, and message.language are required');
    const records = parseCsv(req.file.buffer.toString('utf8'));
    if (records.length > Number(process.env.MAX_BROADCAST_RECIPIENTS || 1000)) throw error('Campaign exceeds the configured recipient limit');
    const recipients = records.map((record) => ({ receiverNumber: messages.phone(record.receiverNumber || record.to || record.phone), variables: Object.entries(record).filter(([key]) => !['receiverNumber', 'to', 'phone'].includes(key)).map(([, value]) => value) }));
    const schedule = data.schedule || {}; let scheduledFor = null;
    if (schedule.exactDateTime !== undefined) { const value = Number(schedule.exactDateTime); if (!Number.isFinite(value)) throw error('schedule.exactDateTime must be epoch milliseconds'); scheduledFor = new Date(value); }
    else if (schedule.delayInMinutes !== undefined) { const delay = Number(schedule.delayInMinutes); if (!Number.isFinite(delay) || delay <= 0) throw error('schedule.delayInMinutes must be greater than 0'); scheduledFor = new Date(Date.now() + delay * 60000); }
    const campaign = await domain.insert('scheduled_campaigns', req.legacyAuth, { created_by: domain.userId(req.legacyAuth), name: String(data.campaignName), campaign_type: 'CSV', template_name: String(data.message.templateName), language: String(data.message.language), recipients, total: recipients.length, status: scheduledFor && scheduledFor > new Date() ? 'scheduled' : 'queued', scheduled_for: scheduledFor, original_filename: req.file.originalname });
    if (campaign.status === 'queued') setImmediate(() => executeCampaign(req.legacyAuth, campaign).catch((cause) => console.error('[legacy-api] campaign failed', cause)));
    res.json({ id: campaign.id, name: campaign.name, status: campaign.status, total: campaign.total, ...(scheduledFor ? { exactDateTime: epoch(scheduledFor) } : {}) });
  } catch (cause) { next(cause); }
});
router.get('/whatsapp/schedule/campaign/list', sendAccess, async (req, res, next) => {
  try {
    const rows = await domain.many('scheduled_campaigns', req.legacyAuth, { status: 'scheduled' });
    res.json(rows.map((row) => ({ id: row.id, name: row.name, campaignType: row.campaign_type, triggerType: 'simple', exactDateTime: epoch(row.scheduled_for), fileUploadId: row.id, lastUpdateTime: epoch(row.updated_at), jobNameSuffix: '_campaign' })));
  } catch (cause) { next(cause); }
});
router.delete('/whatsapp/schedule/campaign/:campaignId', sendAccess, async (req, res, next) => {
  try {
    const row = await domain.model('scheduled_campaigns').findOneAndUpdate({ id: req.params.campaignId, account_id: domain.accountId(req.legacyAuth), status: 'scheduled' }, { $set: { status: 'cancelled', cancelled_at: domain.now(), updated_at: domain.now() } }, { new: true }).lean();
    if (!row) throw error('Scheduled campaign not found or is no longer cancellable', 404);
    res.json({ success: true, message: 'Campaign schedule cancelled' });
  } catch (cause) { next(cause); }
});

router.post('/whatsapp/meta/media/upload', sendAccess, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) throw error('file is required');
    const { config, accessToken } = await messages.configFor(req.legacyAuth);
    const response = await meta.uploadMedia(config.phone_number_id, accessToken, req.file);
    if (!response.id) throw error('Meta did not return a media id', 502);
    await domain.insert('meta_media', req.legacyAuth, { meta_media_id: response.id, filename: req.file.originalname, mime_type: req.file.mimetype, file_size: req.file.size, uploaded_by: domain.userId(req.legacyAuth) });
    res.json({ id: response.id, metaMediaId: response.id, messaging_product: req.body?.messaging_product || 'whatsapp' });
  } catch (cause) { next(cause); }
});
router.get('/whatsapp/media/mediaDetail/:metaMediaId', sendAccess, async (req, res, next) => {
  try {
    const { config, accessToken } = await messages.configFor(req.legacyAuth);
    const media = await meta.getMedia(req.params.metaMediaId, accessToken);
    if (!media?.id) throw error('Media not found', 404);
    const existing = await domain.one('meta_media', req.legacyAuth, { meta_media_id: media.id });
    const values = { meta_media_id: media.id, url: media.url || null, mime_type: media.mime_type || null, sha256: media.sha256 || null, file_size: media.file_size || null };
    if (existing) await domain.updateOne('meta_media', req.legacyAuth, existing.id, values); else await domain.insert('meta_media', req.legacyAuth, values);
    res.json({ id: media.id, url: media.url, mimeType: media.mime_type, sha256: media.sha256, fileSize: media.file_size, messaging_product: media.messaging_product || 'whatsapp' });
  } catch (cause) { next(cause); }
});

function localTemplate(auth, body, response) {
  const components = body.components || [];
  const part = (type) => components.find((item) => String(item.type).toUpperCase() === type);
  const header = part('HEADER'); const main = part('BODY'); const footer = part('FOOTER'); const buttons = part('BUTTONS');
  return { user_id: domain.userId(auth), name: body.name, language: body.language, category: body.category, header_type: header?.format?.toLowerCase() || null, header_content: header?.text || null, body_text: main?.text || '', footer_text: footer?.text || null, buttons: buttons?.buttons || null, components, status: response?.status || 'PENDING', meta_template_id: response?.id || null };
}
router.post('/messageTemplate/create', accountWrite, async (req, res, next) => {
  try {
    const body = req.body || {};
    if (!/^[a-z0-9_]+$/.test(String(body.name || ''))) throw error('name must use lowercase letters, numbers, and underscores only');
    if (!['MARKETING', 'UTILITY', 'AUTHENTICATION'].includes(String(body.category || '').toUpperCase()) || !Array.isArray(body.components) || !body.components.length || !body.language) throw error('name, language, category, and components are required');
    const { config, accessToken } = await messages.configFor(req.legacyAuth);
    if (!config.waba_id) throw error('WABA ID is missing. Re-connect your account.', 400);
    const response = await meta.request(`/${encodeURIComponent(config.waba_id)}/message_templates`, accessToken, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: body.name, language: body.language, category: String(body.category).toUpperCase(), components: body.components }) });
    const values = localTemplate(req.legacyAuth, body, response);
    const existing = await domain.model('message_templates').findOne({ account_id: domain.accountId(req.legacyAuth), name: body.name, language: body.language }).lean();
    const template = existing ? await domain.updateOne('message_templates', req.legacyAuth, existing.id, values) : await domain.insert('message_templates', req.legacyAuth, values);
    res.json({ success: true, template, metaTemplateId: response.id || null, status: response.status || template.status });
  } catch (cause) { next(cause); }
});
router.post('/messageTemplate/getTemplates', accountRead, async (req, res, next) => {
  try {
    const config = pageRequest(req.body); const criteria = { account_id: domain.accountId(req.legacyAuth), ...dateCriteria(req.body?.search) };
    let rows = await domain.model('message_templates').find(criteria).sort(config.sort).lean(); rows = rows.filter((row) => matchesSearch(row, req.body?.search));
    const total = rows.length; rows = rows.slice((config.current - 1) * config.pageSize, config.current * config.pageSize);
    res.json({ ...(rows.length ? { results: rows.map(plain) } : {}), total, metadata: { totalRecords: total } });
  } catch (cause) { next(cause); }
});
async function syncTemplates(auth) {
  const { config, accessToken } = await messages.configFor(auth);
  if (!config.waba_id) throw error('WABA ID is missing. Re-connect your account.', 400);
  const remote = await meta.request(`/${encodeURIComponent(config.waba_id)}/message_templates?limit=100&fields=id,name,language,status,category,components,quality_score`, accessToken);
  let inserted = 0; let updated = 0;
  for (const item of remote.data || []) {
    const values = localTemplate(auth, { name: item.name, language: item.language, category: item.category, components: item.components || [] }, item);
    const existing = await domain.model('message_templates').findOne({ account_id: domain.accountId(auth), name: item.name, language: item.language }).lean();
    if (existing) { await domain.updateOne('message_templates', auth, existing.id, values); updated++; } else { await domain.insert('message_templates', auth, values); inserted++; }
  }
  return { success: true, total: (remote.data || []).length, inserted, updated, errors: [], truncated: false };
}
router.get('/messageTemplate/syncTemplatesFromMeta', accountWrite, async (req, res, next) => { try { res.json(await syncTemplates(req.legacyAuth)); } catch (cause) { next(cause); } });
router.get('/whatsapp/syncTemplatesFromMeta', accountWrite, async (req, res, next) => { try { res.json(await syncTemplates(req.legacyAuth)); } catch (cause) { next(cause); } });

router.get('/whatsapp/report/userMessageId/:id', sendAccess, async (req, res, next) => {
  try {
    const row = await domain.model('messages').findOne({ account_id: domain.accountId(req.legacyAuth), client_reference: req.params.id }).lean();
    if (!row) throw error('Message report not found', 404);
    const [[message, contact]] = await messageContacts(req.legacyAuth, [row]); res.json(report(message, contact));
  } catch (cause) { next(cause); }
});
router.post('/whatsapp/report/messageSentReport', sendAccess, async (req, res, next) => {
  try {
    const config = pageRequest(req.body); const criteria = { account_id: domain.accountId(req.legacyAuth), direction: 'outbound', ...dateCriteria(req.body?.search) };
    let rows = await domain.model('messages').find(criteria).sort(config.sort).lean(); rows = rows.filter((row) => matchesSearch(row, req.body?.search)); const total = rows.length; rows = rows.slice((config.current - 1) * config.pageSize, config.current * config.pageSize);
    const paired = await messageContacts(req.legacyAuth, rows); res.json({ ...(paired.length ? { results: paired.map(([message, contact]) => report(message, contact)) } : {}), total, metadata: { totalRecords: total } });
  } catch (cause) { next(cause); }
});

router.post('/contact/list', contactRead, async (req, res, next) => {
  try {
    const config = pageRequest(req.body); const criteria = { account_id: domain.accountId(req.legacyAuth), ...dateCriteria(req.body?.search) };
    let rows = await domain.model('contacts').find(criteria).sort(config.sort).lean(); rows = rows.filter((row) => matchesSearch(row, req.body?.search)); const total = rows.length; rows = rows.slice((config.current - 1) * config.pageSize, config.current * config.pageSize);
    res.json({ ...(rows.length ? { results: rows.map(contactResult) } : {}), total, metadata: { totalRecords: total } });
  } catch (cause) { next(cause); }
});
router.post('/contact/save', contactWrite, async (req, res, next) => { try { const result = await upsertContact(req.legacyAuth, req.body || {}); res.json({ success: true, created: result.created, contact: contactResult(result.contact) }); } catch (cause) { next(cause); } });
router.post('/contact/upload', contactWrite, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) throw error('file is required'); const started = Date.now(); const records = parseCsv(req.file.buffer.toString('utf8'));
    const validRecords = records.map((record, index) => {
      const receiverNumber = record.receiverNumber || record.to || record.phone;
      if (!receiverNumber) throw error(`CSV row ${index + 2} requires receiverNumber`);
      const attributes = { ...record }; delete attributes.receiverNumber; delete attributes.to; delete attributes.phone;
      return { receiverNumber: messages.phone(receiverNumber), attributes };
    });
    let created = 0; let updated = 0;
    for (const record of validRecords) { const result = await upsertContact(req.legacyAuth, record); result.created ? created++ : updated++; }
    res.json({ mode: 'SYNC', affectedCount: created + updated, created, updated, durationMs: Date.now() - started });
  } catch (cause) { next(cause); }
});

router.post('/user/agent', accountWrite, async (req, res, next) => {
  try {
    const body = req.body || {}; const username = domain.assertString(body.username, 'username', 100).toLowerCase(); const email = domain.assertString(body.email, 'email', 254).toLowerCase();
    if (!/^[a-z0-9_.-]+$/.test(username)) throw error('username may only contain letters, numbers, dot, underscore, and hyphen');
    if (!body.name || !body.password || String(body.password).length < 8 || !body.mobileNumber || !body.role || !Array.isArray(body.phoneNumberIds)) throw error('username, name, password, email, mobileNumber, role, and phoneNumberIds are required');
    if (await User.exists({ $or: [{ email }, { username }] })) throw error('An agent with this email or username already exists', 409);
    const role = String(body.role).toLowerCase(); if (!['admin', 'agent', 'viewer'].includes(role)) throw error('role must be ADMIN, AGENT, or VIEWER');
    const user = await User.create({ id: randomUUID(), email, username, full_name: String(body.name), password_hash: await bcrypt.hash(String(body.password), 12), mobile_number: String(body.mobileNumber), phone_number_ids: body.phoneNumberIds, disabled_at: body.active === false ? domain.now() : null });
    const profile = await domain.insert('profiles', req.legacyAuth, { user_id: user.id, email, full_name: user.full_name, account_role: role });
    res.status(201).json(agentResult(profile, plain(user)));
  } catch (cause) { next(cause); }
});
async function agents(auth) {
  const profiles = await domain.model('profiles').find({ account_id: domain.accountId(auth), account_role: 'agent' }).lean(); const users = await User.find({ id: { $in: profiles.map((row) => row.user_id) }, disabled_at: null }).lean();
  return profiles.map((profile) => [profile, users.find((user) => user.id === profile.user_id)]).filter(([, user]) => user);
}
router.get('/user/agent-list', accountRead, async (req, res, next) => { try { const rows = await agents(req.legacyAuth); res.json(rows.map(([profile, user]) => ({ id: user.id, name: user.full_name || profile.full_name || '', username: user.username || user.email }))); } catch (cause) { next(cause); } });
router.get('/user/team-list', accountRead, async (req, res, next) => { try { const rows = await domain.many('teams', req.legacyAuth); res.json(rows.map((row) => ({ id: row.id, name: row.name }))); } catch (cause) { next(cause); } });
router.get('/user/teams', accountRead, async (req, res, next) => { try { const rows = await domain.many('teams', req.legacyAuth); res.json(rows.map((row) => ({ id: row.id, customerId: row.account_id, name: row.name, defaultTeam: Boolean(row.default_team), memberUsernames: row.member_usernames || [], createdBy: row.created_by || null, creationTime: epoch(row.created_at), lastModifiedBy: row.last_modified_by || null, lastUpdateTime: epoch(row.updated_at) }))); } catch (cause) { next(cause); } });

router.post('/whatsapp/chat/assignment', accountWrite, async (req, res, next) => {
  try {
    const body = req.body || {}; const target = String(body.target || '').toUpperCase(); if (!['TEAM', 'USER', 'ROUND_ROBIN'].includes(target)) throw error('target must be TEAM, USER, or ROUND_ROBIN');
    const phone = messages.phone(body.receiverNumber); const contact = await domain.one('contacts', req.legacyAuth, { phone }); if (!contact) throw error('Contact not found', 404);
    let conversation = await domain.one('conversations', req.legacyAuth, { contact_id: contact.id }); if (!conversation) conversation = await domain.insert('conversations', req.legacyAuth, { contact_id: contact.id, user_id: domain.userId(req.legacyAuth), status: 'open' });
    let team = null; let user = null;
    if (body.teamId) { team = await domain.one('teams', req.legacyAuth, { id: body.teamId }); if (!team) throw error('Team not found', 404); }
    if (target === 'TEAM' && !team) throw error('teamId is required when target is TEAM');
    if (target === 'USER') { if (!body.username) throw error('username is required when target is USER'); user = await User.findOne({ username: String(body.username).toLowerCase(), disabled_at: null }).lean(); if (!user) throw error('Agent not found', 404); const profile = await domain.model('profiles').findOne({ account_id: domain.accountId(req.legacyAuth), user_id: user.id }).lean(); if (!profile) throw error('Agent does not belong to this account', 403); }
    if (target === 'ROUND_ROBIN') { const candidates = await agents(req.legacyAuth); const allowed = team?.member_usernames?.length ? candidates.filter(([, candidate]) => team.member_usernames.includes(candidate.username)) : candidates; if (!allowed.length) throw error('No active agents are available for round robin assignment', 409); const last = team?.last_assigned_index || 0; const selected = allowed[last % allowed.length]; user = selected[1]; if (team) await domain.updateOne('teams', req.legacyAuth, team.id, { last_assigned_index: (last + 1) % allowed.length }); }
    const patch = { assigned_team_id: team?.id || (target === 'TEAM' ? body.teamId : body.assignTeam ? team?.id || null : null), assigned_user_id: user?.id || null, assignment_source: body.source || 'MANUAL' }; const updated = await domain.updateOne('conversations', req.legacyAuth, conversation.id, patch);
    res.json({ success: true, conversationId: updated.id, receiverNumber: phone, target, teamId: updated.assigned_team_id || null, username: user?.username || null });
  } catch (cause) { next(cause); }
});

module.exports = { router, runDueCampaigns };
