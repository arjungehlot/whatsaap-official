import { ApiError } from "../utils/apiError.js";
import { env } from "../config/env.js";

export function notFoundHandler(req, _res, next) {
  next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`));
}

export function errorHandler(error, _req, res, next) {
  if (res.headersSent) return next(error);
  const statusCode = error.statusCode || 500;

  if (statusCode >= 500) {
    console.error(error);
  }

  res.status(statusCode).json({
    success: false,
    message: statusCode === 500 ? "Internal server error" : error.message,
    details: error.details || (env.nodeEnv === "development" && statusCode === 500 ? error.stack : undefined),
  });
}
