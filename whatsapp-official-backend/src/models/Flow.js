const { createTenantModel } = require('./base');
module.exports = createTenantModel('Flow', 'flows', {
  user_id: String,
  name: { type: String, required: true },
  description: String,
  status: { type: String, default: 'draft' },
  trigger_type: String,
  trigger_config: { type: Object, default: {} },
  entry_node_id: String,
});
