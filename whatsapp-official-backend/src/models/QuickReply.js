const { createTenantModel } = require('./base');
module.exports = createTenantModel('QuickReply', 'quick_replies', {
  user_id: String,
  title: { type: String, required: true },
  kind: { type: String, enum: ['text', 'interactive'], default: 'text' },
  content_text: String,
  interactive_payload: Object,
});
