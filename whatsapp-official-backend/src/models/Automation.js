const { createTenantModel } = require('./base');
module.exports = createTenantModel('Automation', 'automations', {
  user_id: String,
  name: { type: String, required: true },
  trigger_type: { type: String, required: true },
  trigger_config: { type: Object, default: {} },
  is_active: { type: Boolean, default: false },
});
