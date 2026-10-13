const { createTenantModel } = require('./base');
module.exports = createTenantModel(
  'Contact',
  'contacts',
  {
    user_id: String,
    name: { type: String, trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    company: String,
  },
  [[{ account_id: 1, phone: 1 }, { unique: true }]]
);
