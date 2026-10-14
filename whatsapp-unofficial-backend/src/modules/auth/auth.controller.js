import { getGoogleAuthorizationUrl, loginUser, loginWithGoogleCallback, registerUser, serializeUser } from "./auth.service.js";
import { env } from "../../config/env.js";
import { getCurrentSubscription } from "../billing/billing.service.js";
import { getEntitlements } from "../billing/entitlements.service.js";

export function googleStart(_req, res) {
  try {
    res.redirect(getGoogleAuthorizationUrl());
  } catch (error) {
    const frontendUrl = env.clientOrigins[0] || "http://localhost:5173";
    const message = error instanceof Error ? error.message : "Google sign-in is unavailable";
    res.redirect(`${frontendUrl}/login#google_error=${encodeURIComponent(message)}`);
  }
}

export async function googleCallback(req, res) {
  const frontendUrl = env.clientOrigins[0] || "http://localhost:5173";
  try {
    const result = await loginWithGoogleCallback(req.query.code, req.query.state);
    res.redirect(`${result.redirect}/login#google_token=${encodeURIComponent(result.token)}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Google sign-in failed";
    res.redirect(`${frontendUrl}/login#google_error=${encodeURIComponent(message)}`);
  }
}

export async function register(req, res, next) {
  try {
    const result = await registerUser(req.validated.body);
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function login(req, res, next) {
  try {
    const result = await loginUser(req.validated.body);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function me(req, res) {
  const [subscription, entitlements] = await Promise.all([
    getCurrentSubscription(req.user._id),
    getEntitlements(req.user._id),
  ]);

  res.json({
    success: true,
    data: {
      user: serializeUser(req.user),
      subscription,
      features: entitlements.features,
    },
  });
}
