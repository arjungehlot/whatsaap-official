const mongoose = require('mongoose');
const { randomUUID } = require('crypto');

function createTenantModel(modelName, collection, fields = {}, indexes = []) {
  const schema = new mongoose.Schema(
    {
      id: { type: String, required: true, default: () => randomUUID() },
      account_id: { type: String, required: true },
      created_at: { type: Date, default: Date.now },
      updated_at: { type: Date, default: Date.now },
      ...fields,
    },
    { strict: false, versionKey: false, collection }
  );
  schema.index({ id: 1 }, { unique: true });
  schema.index({ account_id: 1, created_at: -1 });
  for (const [definition, options] of indexes)
    schema.index(definition, options);
  return mongoose.models[modelName] || mongoose.model(modelName, schema);
}
module.exports = { createTenantModel };
