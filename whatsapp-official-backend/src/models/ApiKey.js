const { createTenantModel } = require('./base');
module.exports = createTenantModel(
  'ApiKey',
  'api_keys',
  {
    created_by: String,
    name: String,
    key_prefix: String,
    key_hash: { type: String, required: true },
    scopes: [String],
    expires_at: Date,
    revoked_at: Date,
    last_used_at: Date,
  },
  [[{ key_hash: 1 }, { unique: true }]]
);
