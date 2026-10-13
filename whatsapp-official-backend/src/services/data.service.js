const { randomUUID } = require('crypto');
const { COLLECTIONS, PARENT_ACCOUNT } = require('../config/constants');
const { getCollectionModel } = require('../models/collection.factory');
function ensureCollection(name) {
  if (!COLLECTIONS.includes(name))
    throw Object.assign(new Error('Unknown collection'), { status: 404 });
  return name;
}
function error(message, status = 400) {
  return Object.assign(new Error(message), { status });
}

function likePattern(value) {
  return `^${String(value)
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replaceAll('%', '.*')
    .replaceAll('_', '.')}$`;
}

function addOperator(query, key, operator, value) {
  const existing = query[key];
  if (existing !== undefined && (existing === null || typeof existing !== 'object' || Array.isArray(existing)))
    throw error(`Conflicting filters for ${key}`);
  query[key] = { ...(existing || {}), [operator]: value };
}

function filtersToQuery(filters = []) {
  const query = {};
  for (const filter of filters) {
    const key = filter.column;
    if (!key || ['__proto__', 'constructor', '$where'].includes(key))
      throw error('Invalid filter');
    if (filter.op === 'eq') query[key] = filter.value;
    else if (filter.op === 'neq' || filter.op === 'not')
      addOperator(query, key, '$ne', filter.value);
    else if (filter.op === 'in')
      addOperator(query, key, '$in', Array.isArray(filter.value) ? filter.value : []);
    else if (filter.op === 'is')
      query[key] =
        filter.value === null ? null : { $exists: Boolean(filter.value) };
    else if (filter.op === 'ilike' || filter.op === 'like') {
      query[key] = { $regex: likePattern(filter.value) };
      if (filter.op === 'ilike') query[key].$options = 'i';
    }
    else if (filter.op === 'contains')
      addOperator(
        query,
        key,
        '$all',
        Array.isArray(filter.value) ? filter.value : [filter.value]
      );
    else if (filter.op === 'gte') addOperator(query, key, '$gte', filter.value);
    else if (filter.op === 'lte') addOperator(query, key, '$lte', filter.value);
    else if (filter.op === 'gt') addOperator(query, key, '$gt', filter.value);
    else if (filter.op === 'lt') addOperator(query, key, '$lt', filter.value);
    else throw error(`Unsupported filter operator: ${filter.op}`);
  }
  return query;
}
function plain(document) {
  const value = document?.toObject ? document.toObject() : { ...document };
  delete value._id;
  delete value.__v;
  return value;
}
function select(document, fields) {
  const value = plain(document);
  if (!fields || fields.trim() === '' || fields.trim() === '*') return value;
  const keys = fields
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item && !item.includes('(') && item !== '*');
  return keys.length
    ? Object.fromEntries(
        keys.filter((key) => key in value).map((key) => [key, value[key]])
      )
    : value;
}
async function resolveAccount(collection, record, fallback) {
  if (record.account_id) return record.account_id;
  const parent = PARENT_ACCOUNT[collection];
  if (!parent || !record[parent[1]]) return fallback;
  const owner = await getCollectionModel(parent[0])
    .findOne({ id: record[parent[1]] })
    .select('account_id')
    .lean();
  return owner?.account_id || fallback;
}
async function join(rows, selection, accountId) {
  if (!selection?.includes('(')) return rows;
  for (const [, alias, target, fields] of selection.matchAll(
    /([\w]+)\s*:\s*([\w]+)\s*\(([^()]*)\)/g
  )) {
    const ids = rows.map((row) => row[`${alias}_id`]).filter(Boolean);
    const docs = await getCollectionModel(target)
      .find({ account_id: accountId, id: { $in: ids } })
      .lean();
    const map = new Map(docs.map((doc) => [doc.id, select(doc, fields)]));
    rows.forEach((row) => {
      row[alias] = map.get(row[`${alias}_id`]) || null;
    });
  }
  return rows;
}
async function query(collection, options, auth) {
  const Model = getCollectionModel(ensureCollection(collection));
  const scope = auth.service ? {} : { account_id: auth.account_id };
  const condition = { ...scope, ...filtersToQuery(options.filters) };
  let cursor = Model.find(condition);
  if (options.order?.column)
    cursor = cursor.sort({
      [options.order.column]: options.order.ascending === false ? -1 : 1,
    });
  if (options.range)
    cursor = cursor
      .skip(Math.max(0, options.range.from || 0))
      .limit(
        Math.max(
          0,
          (options.range.to ?? 999999) - (options.range.from || 0) + 1
        )
      );
  const count = options.count ? await Model.countDocuments(condition) : null;
  if (options.head) return { data: null, count };
  let data = await cursor.lean();
  data = await join(
    data.map((doc) => select(doc, options.select)),
    options.select,
    auth.account_id
  );
  return { data: options.single ? data[0] || null : data, count };
}
async function create(collection, records, options, auth) {
  const Model = getCollectionModel(ensureCollection(collection));
  const many = Array.isArray(records);
  const values = many ? records : [records];
  if (!values[0]) throw error('No records supplied');
  const output = [];
  for (const input of values) {
    const account_id = await resolveAccount(collection, input, auth.account_id);
    if (!auth.service && account_id !== auth.account_id)
      throw error('Cross-account write denied', 403);
    const document = {
      ...input,
      id: input.id || randomUUID(),
      account_id,
      created_at: input.created_at || new Date(),
      updated_at: new Date(),
    };
    const saved = options.upsert
      ? await Model.findOneAndUpdate(
          { id: document.id },
          { $set: document },
          { upsert: true, new: true }
        )
      : await Model.create(document);
    output.push(select(saved, options.select));
  }
  return many ? output : output[0];
}
async function update(collection, options, auth) {
  const Model = getCollectionModel(ensureCollection(collection));
  const condition = {
    ...(auth.service ? {} : { account_id: auth.account_id }),
    ...filtersToQuery(options.filters),
  };
  const before = await Model.find(condition).lean();
  const values = { ...(options.values || {}), updated_at: new Date() };
  await Model.updateMany(condition, { $set: values });
  return options.select
    ? before.map((doc) => select({ ...doc, ...values }, options.select))
    : null;
}
async function remove(collection, options, auth) {
  const Model = getCollectionModel(ensureCollection(collection));
  const condition = {
    ...(auth.service ? {} : { account_id: auth.account_id }),
    ...filtersToQuery(options.filters),
  };
  const before = await Model.find(condition).lean();
  await Model.deleteMany(condition);
  return options.select
    ? before.map((doc) => select(doc, options.select))
    : null;
}
module.exports = {
  error,
  ensureCollection,
  filtersToQuery,
  plain,
  select,
  query,
  create,
  update,
  remove,
  resolveAccount,
};
