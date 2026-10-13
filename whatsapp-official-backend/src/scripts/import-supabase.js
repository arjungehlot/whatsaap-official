/* One-time, repeatable Supabase -> MongoDB import. See node backend/README.md. */
const fs = require('fs/promises');
const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { randomUUID } = require('crypto');
const { config } = require('dotenv');
const User = require('../models/User');
const { getCollectionModel } = require('../models/collection.factory');

config({ path: path.resolve(__dirname, '../../.env') });
// Kept separate from runtime configuration so source credentials exist only
// for this one-time importer and cannot accidentally be used by Express.
config({
  path: path.resolve(__dirname, '../../.env.migration'),
  override: true,
});
config({
  path: path.resolve(__dirname, '../../../.env.local'),
  override: false,
});
const execute = process.argv.includes('--execute');
const pageSize = 1000;
const tables = [
  'accounts',
  'profiles',
  'account_invitations',
  'contacts',
  'tags',
  'contact_tags',
  'custom_fields',
  'contact_custom_values',
  'contact_notes',
  'conversations',
  'messages',
  'whatsapp_config',
  'message_templates',
  'pipelines',
  'pipeline_stages',
  'deals',
  'broadcasts',
  'broadcast_recipients',
  'automations',
  'automation_steps',
  'automation_logs',
  'automation_pending_executions',
  'message_reactions',
  'flows',
  'flow_nodes',
  'flow_runs',
  'flow_run_events',
  'member_presence',
  'api_keys',
  'notifications',
  'webhook_endpoints',
  'ai_configs',
  'ai_knowledge_documents',
  'ai_knowledge_chunks',
  'ai_usage_log',
  'quick_replies',
];
const parentAccount = {
  contact_tags: ['contacts', 'contact_id'],
  contact_custom_values: ['contacts', 'contact_id'],
  contact_notes: ['contacts', 'contact_id'],
  messages: ['conversations', 'conversation_id'],
  pipeline_stages: ['pipelines', 'pipeline_id'],
  broadcast_recipients: ['broadcasts', 'broadcast_id'],
  automation_steps: ['automations', 'automation_id'],
  automation_logs: ['automations', 'automation_id'],
  automation_pending_executions: ['automations', 'automation_id'],
  flow_nodes: ['flows', 'flow_id'],
  flow_runs: ['flows', 'flow_id'],
  flow_run_events: ['flow_runs', 'flow_run_id'],
  message_reactions: ['messages', 'message_id'],
  ai_knowledge_chunks: ['ai_knowledge_documents', 'document_id'],
};

function required(name) {
  if (!process.env[name]) throw new Error(`${name} is required.`);
  return process.env[name];
}
function supabaseUrl() {
  return required('NEXT_PUBLIC_SUPABASE_URL').replace(/\/$/, '');
}
function headers(json = true) {
  const key = required('SUPABASE_SERVICE_ROLE_KEY');
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    ...(json ? { 'Content-Type': 'application/json' } : {}),
  };
}
async function api(url, init = {}) {
  let response;
  try {
    response = await fetch(url, {
      ...init,
      headers: {
        ...headers(!(init.headers && !init.headers['Content-Type'])),
        ...(init.headers || {}),
      },
    });
  } catch (error) {
    throw new Error(
      `Cannot reach ${new URL(url).host}: ${error.cause?.message || error.message}`
    );
  }
  if (!response.ok)
    throw new Error(
      `Supabase request failed (${response.status}): ${(await response.text()).slice(0, 500)}`
    );
  return response;
}
async function tableRows(table) {
  const rows = [];
  for (let offset = 0; ; offset += pageSize) {
    const page = await (
      await api(
        `${supabaseUrl()}/rest/v1/${table}?select=*&limit=${pageSize}&offset=${offset}`
      )
    ).json();
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}
async function authUsers() {
  const users = [];
  for (let page = 1; ; page += 1) {
    const result = await (
      await api(
        `${supabaseUrl()}/auth/v1/admin/users?page=${page}&per_page=${pageSize}`
      )
    ).json();
    const batch = result.users || [];
    users.push(...batch);
    if (batch.length < pageSize) return users;
  }
}
function safePath(input) {
  const clean = String(input).replaceAll('\\', '/').replace(/^\/+/, '');
  if (!clean || clean.split('/').some((p) => p === '..' || !p))
    throw new Error(`Unsafe storage path: ${input}`);
  return clean;
}
async function objects(bucket, prefix = '') {
  const result = await (
    await api(
      `${supabaseUrl()}/storage/v1/object/list/${encodeURIComponent(bucket)}`,
      {
        method: 'POST',
        body: JSON.stringify({
          prefix,
          limit: 1000,
          offset: 0,
          sortBy: { column: 'name', order: 'asc' },
        }),
      }
    )
  ).json();
  const found = [];
  for (const item of result) {
    const current = `${prefix}${item.name}`;
    if (item.id) found.push(current);
    else found.push(...(await objects(bucket, `${current}/`)));
  }
  return found;
}
async function copyStorage() {
  const buckets = await (
    await api(`${supabaseUrl()}/storage/v1/bucket`)
  ).json();
  const root = path.resolve(__dirname, '../../uploads');
  const mapping = new Map();
  let copied = 0;
  for (const bucket of buckets)
    for (const object of await objects(bucket.name)) {
      const relative = safePath(`${bucket.name}/${object}`);
      const destination = path.join(root, ...relative.split('/'));
      if (!destination.startsWith(root + path.sep))
        throw new Error('Unsafe storage destination');
      const remote = `${supabaseUrl()}/storage/v1/object/authenticated/${encodeURIComponent(bucket.name)}/${object.split('/').map(encodeURIComponent).join('/')}`;
      const binary = Buffer.from(
        await (await api(remote, { headers: headers(false) })).arrayBuffer()
      );
      if (execute) {
        await fs.mkdir(path.dirname(destination), { recursive: true });
        await fs.writeFile(destination, binary);
      }
      mapping.set(
        `${supabaseUrl()}/storage/v1/object/public/${bucket.name}/${object}`,
        `/uploads/${relative}`
      );
      mapping.set(
        `${supabaseUrl()}/storage/v1/object/authenticated/${bucket.name}/${object}`,
        `/uploads/${relative}`
      );
      copied += 1;
    }
  return { copied, mapping };
}
function remap(value, mapping, origin) {
  if (typeof value === 'string') {
    for (const [from, to] of mapping)
      if (value.startsWith(from))
        return `${origin}${to}${value.slice(from.length)}`;
    return value;
  }
  if (Array.isArray(value))
    return value.map((item) => remap(item, mapping, origin));
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        remap(item, mapping, origin),
      ])
    );
  return value;
}
async function main() {
  required('MONGODB_URI');
  required('NEXT_PUBLIC_SUPABASE_URL');
  required('SUPABASE_SERVICE_ROLE_KEY');
  if (execute && !process.env.MIGRATION_TEMP_PASSWORD)
    throw new Error('MIGRATION_TEMP_PASSWORD is required with --execute.');
  console.log(`Migration mode: ${execute ? 'EXECUTE' : 'DRY RUN'}`);
  const source = {};
  for (const table of tables) {
    source[table] = await tableRows(table);
    console.log(`${table}: ${source[table].length}`);
  }
  const users = await authUsers();
  const profiledUserIds = new Set(
    source.profiles.map((profile) => profile.user_id)
  );
  const orphanedUsers = users.filter(
    (user) => user.email && !profiledUserIds.has(user.id)
  );
  console.log(`auth users: ${users.length}`);
  if (orphanedUsers.length)
    console.log(
      `Auth users without a profile: ${orphanedUsers.length} (a private account/profile will be created for each during execute)`
    );
  if (!execute)
    return console.log(
      'Preview complete. Set MIGRATION_TEMP_PASSWORD and re-run with --execute after reviewing these counts.'
    );
  for (const user of orphanedUsers) {
    const accountId = randomUUID();
    const createdAt = user.created_at || new Date().toISOString();
    source.accounts.push({
      id: accountId,
      account_id: accountId,
      name: user.user_metadata?.full_name || user.email,
      owner_user_id: user.id,
      created_at: createdAt,
      updated_at: createdAt,
    });
    source.profiles.push({
      id: randomUUID(),
      account_id: accountId,
      user_id: user.id,
      full_name: user.user_metadata?.full_name || '',
      email: user.email,
      account_role: 'owner',
      created_at: createdAt,
      updated_at: createdAt,
    });
  }
  await mongoose.connect(required('MONGODB_URI'));
  const accountIndex = new Map();
  for (const [table, rows] of Object.entries(source))
    for (const row of rows) {
      if (table === 'accounts') row.account_id ||= row.id;
      if (row.account_id)
        accountIndex.set(`${table}:${row.id}`, row.account_id);
    }
  for (const [table, rows] of Object.entries(source))
    for (const row of rows) {
      const parent = parentAccount[table];
      if (!row.account_id && parent)
        row.account_id = accountIndex.get(`${parent[0]}:${row[parent[1]]}`);
      if (!row.account_id && table !== 'accounts')
        throw new Error(
          `${table}/${row.id} is missing account_id; no records were written.`
        );
    }
  const storage = await copyStorage();
  const origin = (
    process.env.BACKEND_PUBLIC_URL ||
    `http://localhost:${process.env.PORT || 4000}`
  ).replace(/\/$/, '');
  const documentWrites = new Map();
  for (const [table, rows] of Object.entries(source)) {
    const writes = [];
    for (const raw of rows) {
      const row = remap(raw, storage.mapping, origin);
      writes.push({
        updateOne: {
          filter: { id: row.id },
          update: {
            $set: { ...row, updated_at: row.updated_at || new Date() },
            $setOnInsert: { created_at: row.created_at || new Date() },
          },
          upsert: true,
        },
      });
    }
    documentWrites.set(table, writes);
  }
  for (const [table, writes] of documentWrites)
    if (writes.length)
      await getCollectionModel(table).bulkWrite(writes, { ordered: false });
  const hash = await bcrypt.hash(process.env.MIGRATION_TEMP_PASSWORD, 12);
  const userWrites = users
    .filter((user) => user.email)
    .map((user) => ({
      updateOne: {
        filter: { id: user.id },
        update: {
          $set: {
            id: user.id,
            email: user.email,
            full_name: user.user_metadata?.full_name || '',
            avatar_url: user.user_metadata?.avatar_url,
            password_hash: hash,
            password_migration_required: true,
            created_at: user.created_at || new Date(),
            updated_at: new Date(),
          },
        },
        upsert: true,
      },
    }));
  if (userWrites.length) await User.bulkWrite(userWrites, { ordered: false });
  const importedRecords = [...documentWrites.values()].reduce(
    (total, writes) => total + writes.length,
    0
  );
  console.log(
    JSON.stringify(
      {
        importedUsers: userWrites.length,
        importedRecords,
        copiedStorageFiles: storage.copied,
      },
      null,
      2
    )
  );
  await mongoose.disconnect();
}
main().catch(async (error) => {
  console.error(`Migration failed: ${error.message}`);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
