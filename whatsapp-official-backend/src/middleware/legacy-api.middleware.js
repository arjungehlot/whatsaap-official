const bcrypt = require('bcryptjs');
const { readKey } = require('./api-key.middleware');
const { error } = require('../services/data.service');
const domain = require('../services/domain.service');
const User = require('../models/User');
const { hashSecret } = require('../utils/crypto');

function basicCredentials(req) {
  const value = req.get('authorization') || '';
  if (!/^Basic\s+/i.test(value)) return null;
  try {
    const decoded = Buffer.from(value.replace(/^Basic\s+/i, ''), 'base64').toString('utf8');
    const marker = decoded.indexOf(':');
    if (marker < 1) return null;
    return { username: decoded.slice(0, marker), password: decoded.slice(marker + 1) };
  } catch {
    return null;
  }
}

async function authenticateBasic(req) {
  const credentials = basicCredentials(req);
  if (!credentials) return null;
  const username = credentials.username.trim().toLowerCase();
  const user = await User.findOne({
    $or: [{ email: username }, { username }],
    disabled_at: null,
  });
  if (!user || !(await bcrypt.compare(credentials.password, user.password_hash)))
    throw error('Unauthorized', 401);
  const profile = await domain
    .model('profiles')
    .findOne({ user_id: user.id })
    .lean();
  if (!profile) throw error('Unauthorized', 401);
  return {
    account_id: profile.account_id,
    sub: user.id,
    role: profile.account_role || 'viewer',
    authentication: 'basic',
  };
}

async function authenticateApiKey(req, scope) {
  const raw = readKey(req);
  if (!raw) return null;
  if (!raw.startsWith('wacrm_')) throw error('Unauthorized', 401);
  const key = await domain
    .model('api_keys')
    .findOne({ key_hash: hashSecret(raw), revoked_at: null })
    .lean();
  if (!key || (key.expires_at && new Date(key.expires_at) <= new Date()))
    throw error('Unauthorized', 401);
  const scopes = Array.isArray(key.scopes) ? key.scopes : [];
  if (scope && !scopes.includes(scope) && !scopes.includes('*'))
    throw error('This API key does not have the required scope', 403);
  await domain.model('api_keys').updateOne(
    { id: key.id },
    { $set: { last_used_at: domain.now(), updated_at: domain.now() } }
  );
  return {
    account_id: key.account_id,
    sub: key.created_by,
    role: 'owner',
    key,
    authentication: 'api_key',
  };
}

function requireLegacyAccess(scope, minimumRole = 'viewer') {
  const ranks = { viewer: 0, agent: 1, admin: 2, owner: 3 };
  return async (req, _res, next) => {
    try {
      const auth = (await authenticateBasic(req)) || (await authenticateApiKey(req, scope));
      if (!auth) throw error('Unauthorized', 401);
      if ((ranks[auth.role] || 0) < (ranks[minimumRole] || 0))
        throw error('Insufficient role', 403);
      req.legacyAuth = auth;
      next();
    } catch (cause) {
      next(cause);
    }
  };
}

module.exports = { requireLegacyAccess };
