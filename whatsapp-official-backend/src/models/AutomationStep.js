const { createTenantModel } = require('./base');
module.exports = createTenantModel('AutomationStep', 'automation_steps', {
  automation_id: { type: String, required: true, index: true },
  step_type: String,
  step_order: Number,
  step_config: { type: Object, default: {} },
});
