const mongoose = require('mongoose');
const { randomUUID } = require('crypto');

const base = {
  id: { type: String, default: () => randomUUID() },
  account_id: { type: String, index: true },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
};

const userSchema = new mongoose.Schema(
  {
    ...base,
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
  },
  { strict: false, versionKey: false, suppressReservedKeysWarning: true }
);
userSchema.index({ id: 1 }, { unique: true });

// Every former Supabase table is represented as a tenant-scoped collection
// document. `strict: false` deliberately preserves all fields introduced by
// the SQL migrations without dropping data when a new frontend ships.
const recordSchema = new mongoose.Schema(
  {
    ...base,
    collection: { type: String, required: true, index: true },
  },
  { strict: false, versionKey: false, suppressReservedKeysWarning: true }
);
recordSchema.index({ collection: 1, id: 1 }, { unique: true });
recordSchema.index({ collection: 1, account_id: 1, created_at: -1 });

module.exports = {
  User: mongoose.models.User || mongoose.model('User', userSchema),
  Record: mongoose.models.Record || mongoose.model('Record', recordSchema),
};
