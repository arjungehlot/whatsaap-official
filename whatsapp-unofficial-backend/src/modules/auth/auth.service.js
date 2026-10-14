import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { env } from "../../config/env.js";
import { UserModel } from "../../models/User.js";
import { ApiError } from "../../utils/apiError.js";
import { provisionTrial } from "../billing/billing.service.js";

export function serializeUser(user) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    phone: user.phone || "",
    company: user.company,
    role: user.role,
    accountStatus: user.accountStatus,
    timezone: user.timezone,
    plan: user.plan,
  };
}

function signToken(user) {
  return jwt.sign({ email: user.email }, env.jwtSecret, {
    subject: user._id.toString(),
    expiresIn: env.jwtExpiresIn,
  });
}

function googleOrigin() {
  return env.clientOrigins[0] || "http://localhost:5173";
}

function requireGoogleConfig() {
  if (!env.googleClientId || !env.googleClientSecret || !env.googleRedirectUri) {
    throw new ApiError(503, "Google sign-in is not configured on this server");
  }
}

export function getGoogleAuthorizationUrl() {
  requireGoogleConfig();
  const state = jwt.sign({ purpose: "google-oauth" }, env.jwtSecret, { expiresIn: "10m" });

  const params = new URLSearchParams({
    client_id: env.googleClientId,
    redirect_uri: env.googleRedirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
    access_type: "online",
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

function isValidGoogleState(state) {
  try {
    const payload = jwt.verify(state, env.jwtSecret);
    return payload?.purpose === "google-oauth";
  } catch (_error) {
    return false;
  }
}

async function exchangeGoogleCode(code) {
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env.googleClientId,
      client_secret: env.googleClientSecret,
      redirect_uri: env.googleRedirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenResponse.ok) throw new ApiError(401, "Google authorization could not be completed");
  const tokens = await tokenResponse.json();
  if (!tokens.access_token) throw new ApiError(401, "Google did not return an access token");

  const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  if (!profileResponse.ok) throw new ApiError(401, "Unable to read the Google profile");
  const profile = await profileResponse.json();

  if (!profile.sub || !profile.email || profile.email_verified === false) {
    throw new ApiError(401, "A verified Google email is required");
  }

  return profile;
}

export async function loginWithGoogleCallback(code, state) {
  requireGoogleConfig();
  if (!code || !state || !isValidGoogleState(state)) {
    throw new ApiError(400, "Invalid or expired Google sign-in request");
  }

  const profile = await exchangeGoogleCode(code);
  let user = await UserModel.findOne({ $or: [{ googleId: profile.sub }, { email: profile.email.toLowerCase() }] });

  if (!user) {
    user = await UserModel.create({
      name: profile.name || profile.email.split("@")[0],
      email: profile.email.toLowerCase(),
      googleId: profile.sub,
      authProvider: "google",
      company: "My Company",
      role: roleForEmail(profile.email),
      timezone: "Asia/Kolkata",
      plan: "professional",
    });
    await provisionTrial(user._id);
  } else {
    if (!user.googleId) user.googleId = profile.sub;
    user.authProvider = "google";
    if (profile.name && user.name !== profile.name) user.name = profile.name;
    if (env.superAdminEmails.includes(user.email.toLowerCase())) user.role = "super_admin";
    await user.save();
  }

  return { user: serializeUser(user), token: signToken(user), redirect: googleOrigin() };
}

export async function registerUser(payload) {
  const exists = await UserModel.exists({ email: payload.email });

  if (exists) {
    throw new ApiError(409, "An account with this email already exists");
  }

  const passwordHash = await bcrypt.hash(payload.password, 10);
  const user = await UserModel.create({
    name: payload.name,
    email: payload.email,
    passwordHash,
    company: payload.company || "My Company",
    role: roleForEmail(payload.email),
    timezone: "Asia/Kolkata",
    plan: "professional",
  });
  await provisionTrial(user._id);

  return {
    user: serializeUser(user),
    token: signToken(user),
  };
}

export async function loginUser(payload) {
  const user = await UserModel.findOne({ email: payload.email });

  if (!user) {
    throw new ApiError(401, "Invalid email or password");
  }

  if ((user.accountStatus || "active") !== "active") throw new ApiError(403, "This account is not active");

  const isValid = Boolean(user.passwordHash) && (await bcrypt.compare(payload.password, user.passwordHash));

  if (!isValid) {
    throw new ApiError(401, "Invalid email or password");
  }

  return {
    user: serializeUser(user),
    token: signToken(user),
  };
}
function roleForEmail(email) { return env.superAdminEmails.includes(String(email).toLowerCase()) ? "super_admin" : "owner"; }
