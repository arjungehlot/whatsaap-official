const { createTenantModel } = require('./base');
module.exports = createTenantModel(
  'WhatsAppConfig',
  'whatsapp_config',
  {
    user_id: String,
    phone_number_id: { type: String, required: true },
    waba_id: String,
    access_token: { type: String, required: true },
    verify_token: String,
    status: String,
    mirror_inbound_media: { type: Boolean, default: true },
    registered_at: Date,
    subscribed_apps_at: Date,
    last_registration_error: String,
  },
  [
    [{ account_id: 1 }, { unique: true }],
    [{ phone_number_id: 1 }, { unique: true }],
  ]
);
