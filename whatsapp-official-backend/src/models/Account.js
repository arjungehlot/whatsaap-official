const { createTenantModel } = require('./base');
module.exports = createTenantModel('Account', 'accounts', {
  name: { type: String, required: true, trim: true, maxlength: 80 },
  owner_user_id: { type: String, required: true, index: true },
});
