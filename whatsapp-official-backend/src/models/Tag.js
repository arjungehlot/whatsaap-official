const { createTenantModel } = require('./base');
module.exports = createTenantModel(
  'Tag',
  'tags',
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    color: String,
  },
  [[{ account_id: 1, name: 1 }, { unique: true }]]
);
