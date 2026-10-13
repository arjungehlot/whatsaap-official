const { createTenantModel } = require('./base');
module.exports = createTenantModel('Broadcast', 'broadcasts', {
  user_id: String,
  name: String,
  template_id: String,
  status: String,
  scheduled_at: Date,
  sent_count: { type: Number, default: 0 },
  failed_count: { type: Number, default: 0 },
});
