const mongoose = require('mongoose');
const { randomUUID } = require('crypto');
const schema = new mongoose.Schema(
  {
    id: { type: String, default: () => randomUUID(), unique: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password_hash: { type: String, required: true },
    full_name: { type: String, default: '' },
    avatar_url: String,
    disabled_at: Date,
    password_migration_required: { type: Boolean, default: false },
  },
  {
    strict: false,
    versionKey: false,
    collection: 'users',
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);
module.exports = mongoose.models.User || mongoose.model('User', schema);
