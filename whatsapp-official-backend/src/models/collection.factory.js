const mongoose = require('mongoose');
const { randomUUID } = require('crypto');
const { COLLECTIONS } = require('../config/constants');
const explicit = {
  accounts: require('./Account'),
  profiles: require('./Profile'),
  contacts: require('./Contact'),
  conversations: require('./Conversation'),
  messages: require('./Message'),
  whatsapp_config: require('./WhatsAppConfig'),
  message_templates: require('./MessageTemplate'),
  automations: require('./Automation'),
  automation_steps: require('./AutomationStep'),
  flows: require('./Flow'),
  flow_nodes: require('./FlowNode'),
  broadcasts: require('./Broadcast'),
  tags: require('./Tag'),
  quick_replies: require('./QuickReply'),
  api_keys: require('./ApiKey'),
};
const cache = new Map();
function getCollectionModel(name) {
  if (!COLLECTIONS.includes(name))
    throw Object.assign(new Error('Unknown collection'), { status: 404 });
  if (explicit[name]) return explicit[name];
  if (cache.has(name)) return cache.get(name);
  const schema = new mongoose.Schema(
    {
      id: { type: String, default: () => randomUUID(), required: true },
      account_id: { type: String, index: true },
      created_at: { type: Date, default: Date.now },
      updated_at: { type: Date, default: Date.now },
    },
    { strict: false, versionKey: false, collection: name }
  );
  schema.index({ id: 1 }, { unique: true });
  schema.index({ account_id: 1, created_at: -1 });
  const model =
    mongoose.models[`Wacrm_${name}`] || mongoose.model(`Wacrm_${name}`, schema);
  cache.set(name, model);
  return model;
}
module.exports = { getCollectionModel };
