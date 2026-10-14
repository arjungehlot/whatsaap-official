import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { UserModel } from "../models/User.js";
import { authenticateApiKey } from "../modules/api-keys/api-keys.service.js";
import { ApiError } from "../utils/apiError.js";

async function authenticateSession(req) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";

  if (!token) return null;

  try {
    const payload = jwt.verify(token, env.jwtSecret);
    const user = await UserModel.findById(payload.sub);

    if (!user) throw new ApiError(401, "User session is no longer valid");
    if ((user.accountStatus || "active") !== "active") throw new ApiError(403, "This account is not active");

    req.user = user;
    req.authType = "session";
    return user;
  } catch (_error) {
    throw new ApiError(401, "Invalid or expired token");
  }
}

async function authenticateIntegrationKey(req) {
  const apiKey = req.headers["x-api-key"] || req.query?.api_key;
  const rawKey = Array.isArray(apiKey) ? apiKey[0] : apiKey;
  if (!rawKey) return null;

  const result = await authenticateApiKey(String(rawKey).trim());
  if (!result) throw new ApiError(401, "Invalid or revoked API key");

  req.user = result.user;
  if ((result.user.accountStatus || "active") !== "active") throw new ApiError(403, "This account is not active");
  req.authType = "api-key";
  req.apiKey = result.apiKey;
  req.apiKeyScopes = result.scopes;
  return result.user;
}

export async function requireSessionAuth(req, _res, next) {
  try {
    const user = await authenticateSession(req);
    if (!user) return next(new ApiError(401, "Authentication required"));
    return next();
  } catch (error) {
    return next(error);
  }
}

export async function requireAuth(req, _res, next) {
  try {
    const user = await authenticateSession(req);
    if (user) return next();

    const apiUser = await authenticateIntegrationKey(req);
    if (apiUser) return next();

    return next(new ApiError(401, "Authentication required"));
  } catch (error) {
    return next(error);
  }
}

export function requireScope(scope) {
  return (req, _res, next) => {
    if (req.authType !== "api-key") return next();
    if (req.apiKeyScopes?.includes(scope)) return next();
    return next(new ApiError(403, `API key is missing required scope: ${scope}`));
  };
}

export function requireSuperAdmin(req, _res, next) {
  const email = String(req.user?.email || "").toLowerCase();
  if (req.authType === "session" && (req.user?.role === "super_admin" || env.superAdminEmails.includes(email))) return next();
  return next(new ApiError(403, "Super Admin access required"));
}
