const { createTenantModel } = require('./base');
module.exports = createTenantModel(
  'Profile',
  'profiles',
  {
    user_id: { type: String, required: true },
    email: { type: String, trim: true, lowercase: true },
    full_name: String,
    account_role: {
      type: String,
      enum: ['owner', 'admin', 'agent', 'viewer'],
      default: 'viewer',
    },
  },
  [[{ user_id: 1 }, { unique: true }]]
);
