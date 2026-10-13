const { createTenantModel } = require('./base');
module.exports = createTenantModel(
  'Message',
  'messages',
  {
    conversation_id: { type: String, required: true, index: true },
    user_id: String,
    message_id: { type: String, sparse: true },
    direction: String,
    sender_type: String,
    content_type: String,
    content_text: String,
    status: String,
  },
  [
    [
      { account_id: 1, message_id: 1 },
      // A compound sparse index still includes a row when account_id exists,
      // which made every `message_id: null` failed/pending send collide.
      // Only Meta-provided message ids need to be unique per account.
      {
        unique: true,
        partialFilterExpression: { message_id: { $type: 'string' } },
      },
    ],
  ]
);
