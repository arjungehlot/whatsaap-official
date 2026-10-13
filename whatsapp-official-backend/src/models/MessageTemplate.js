const { createTenantModel } = require('./base');
module.exports = createTenantModel(
  'MessageTemplate',
  'message_templates',
  {
    user_id: String,
    name: { type: String, required: true },
    language: { type: String, required: true },
    category: String,
    body_text: String,
    status: String,
    meta_template_id: String,
  },
  [[{ account_id: 1, name: 1, language: 1 }, { unique: true }]]
);
