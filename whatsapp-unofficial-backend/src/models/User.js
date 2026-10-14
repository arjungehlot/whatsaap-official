import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String },
    googleId: { type: String, trim: true, sparse: true, unique: true },
    authProvider: { type: String, enum: ["local", "google"], default: "local" },
    company: { type: String, required: true, trim: true, default: "My Company" },
    role: {
      type: String,
      enum: ["super_admin", "owner", "admin", "agent", "viewer"],
      default: "owner",
    },
    phone: { type: String, trim: true },
    payuCheckoutLockedUntil: { type: Date, select: false },
    payuCheckoutLockToken: { type: String, select: false },
    accountStatus: { type: String, enum: ["active", "suspended", "deactivated"], default: "active", index: true },
    lastActiveAt: { type: Date },
    timezone: { type: String, default: "Asia/Kolkata" },
    plan: {
      type: String,
      enum: ["free", "starter", "professional", "business"],
      default: "professional",
    },
  },
  { timestamps: true },
);

export const UserModel = mongoose.model("User", userSchema);
