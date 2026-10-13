const { randomUUID } = require('crypto');
const { getCollectionModel } = require('../models/collection.factory');
const { error, plain } = require('./data.service');

function model(name) {
  return getCollectionModel(name);
}
function now() {
  return new Date();
}

function accountId(auth) {
  if (!auth?.account_id)
    throw error('Your account profile is unavailable', 403);
  return auth.account_id;
}

function userId(auth) {
  if (!auth?.sub) throw error('A user session is required', 401);
  return auth.sub;
}

async function one(name, auth, criteria = {}) {
  const row = await model(name)
    .findOne({ account_id: accountId(auth), ...criteria })
    .lean();
  return row ? plain(row) : null;
}

async function many(name, auth, criteria = {}, sort = { created_at: -1 }) {
  const rows = await model(name)
    .find({ account_id: accountId(auth), ...criteria })
    .sort(sort)
    .lean();
  return rows.map(plain);
}

async function insert(name, auth, values) {
  const row = await model(name).create({
    ...values,
    id: values.id || randomUUID(),
    account_id: values.account_id || accountId(auth),
    created_at: values.created_at || now(),
    updated_at: now(),
  });
  return plain(row);
}

async function updateOne(name, auth, id, values) {
  const row = await model(name).findOneAndUpdate(
    { id, account_id: accountId(auth) },
    { $set: { ...values, updated_at: now() } },
    { new: true }
  );
  return row ? plain(row) : null;
}

async function removeOne(name, auth, id) {
  const row = await model(name).findOneAndDelete({
    id,
    account_id: accountId(auth),
  });
  return row ? plain(row) : null;
}

function assertString(value, field, max = 0) {
  const output = typeof value === 'string' ? value.trim() : '';
  if (!output) throw error(`${field} is required`);
  if (max && output.length > max)
    throw error(`${field} must be ${max} characters or fewer`);
  return output;
}

module.exports = {
  model,
  now,
  accountId,
  userId,
  one,
  many,
  insert,
  updateOne,
  removeOne,
  assertString,
};
