const { error } = require('../services/data.service');
const domain = require('../services/domain.service');
const { hashSecret } = require('../utils/crypto');

function readKey(req) {
  const bearer = (req.get('authorization') || '').replace(/^Bearer\s+/i, '');
  return bearer || req.get('x-api-key') || req.query?.apiKey || '';
}
function requireApiKey(scope) {
  return async (req, _res, next) => {
    try {
      const raw = readKey(req);
      if (!raw.startsWith('wacrm_')) throw error('Unauthorized', 401);
      const key = await domain
        .model('api_keys')
        .findOne({ key_hash: hashSecret(raw), revoked_at: null })
        .lean();
      if (!key || (key.expires_at && new Date(key.expires_at) <= new Date()))
        throw error('Unauthorized', 401);
      if (scope && (!Array.isArray(key.scopes) || !key.scopes.includes(scope)))
        throw error('This API key does not have the required scope', 403);
      req.apiAuth = {
        key,
        account_id: key.account_id,
        sub: key.created_by,
        role: 'owner',
      };
      await domain
        .model('api_keys')
        .updateOne(
          { id: key.id },
          { $set: { last_used_at: domain.now(), updated_at: domain.now() } }
        );
      return next();
    } catch (cause) {
      return next(cause);
    }
  };
}
module.exports = { requireApiKey, readKey };
