import bcrypt from "bcryptjs";
import { env } from "../../config/env.js";
import { UserModel } from "../../models/User.js";
import { provisionTrial } from "../billing/billing.service.js";

export async function ensureSuperAdmin() {
  const adminEmails = env.superAdminEmails;
  if (!adminEmails || adminEmails.length === 0) return;

  const password = env.superAdminPassword || "Admin@123";
  const passwordHash = await bcrypt.hash(password, 10);

  for (const email of adminEmails) {
    let user = await UserModel.findOne({ email: email.toLowerCase() });
    if (!user) {
      user = await UserModel.create({
        name: "Super Admin",
        email: email.toLowerCase(),
        passwordHash,
        company: "Near Me Teacher",
        role: "super_admin",
        accountStatus: "active",
        authProvider: "local",
        plan: "business",
        timezone: "Asia/Kolkata",
      });
      await provisionTrial(user._id);
      console.log(`[SuperAdmin] Successfully created super admin user: ${email}`);
    } else {
      let modified = false;
      if (user.role !== "super_admin") {
        user.role = "super_admin";
        modified = true;
      }
      if (user.accountStatus !== "active") {
        user.accountStatus = "active";
        modified = true;
      }
      if (env.superAdminPassword) {
        user.passwordHash = passwordHash;
        user.authProvider = "local";
        modified = true;
      }
      if (modified) {
        await user.save();
        console.log(`[SuperAdmin] Successfully updated super admin credentials: ${email}`);
      }
    }
  }
}
