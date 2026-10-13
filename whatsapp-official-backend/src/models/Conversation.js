const { createTenantModel } = require('./base');
module.exports = createTenantModel(
  'Conversation',
  'conversations',
  {
    user_id: String,
    contact_id: { type: String, required: true, index: true },
    status: { type: String, default: 'open' },
    unread_count: { type: Number, default: 0 },
    last_message_at: Date,
    last_message_text: String,
  },
  [[{ account_id: 1, contact_id: 1 }, { unique: true }]]
);
