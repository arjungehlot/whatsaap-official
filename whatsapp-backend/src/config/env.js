import dotenv from "dotenv";

dotenv.config();

function parseOrigins(value) {
  const origins = value
    .split(",")
    .map((origin) => origin.trim().replace(/^['\"]|['\"]$/g, ""))
    .filter(Boolean);

  const expanded = new Set(origins);
  for (const origin of origins) {
    try {
      const url = new URL(origin);
      if (url.hostname.startsWith("www.")) expanded.add(`${url.protocol}//${url.hostname.slice(4)}${url.port ? `:${url.port}` : ""}`);
      else expanded.add(`${url.protocol}//www.${url.hostname}${url.port ? `:${url.port}` : ""}`);
    } catch {
      // Invalid values remain excluded by the exact origin check in app.js.
    }
  }
  return [...expanded];
}

export const env = {
  port: Number(process.env.PORT || 5000),
  nodeEnv: process.env.NODE_ENV || "development",
  clientOrigins: parseOrigins(process.env.CLIENT_ORIGIN || "http://localhost:8080"),
  allowNullOrigin: process.env.ALLOW_NULL_ORIGIN === "true",
  jwtSecret: process.env.JWT_SECRET || "change-this-local-development-secret",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  maxWhatsappDevices: Number(process.env.MAX_WHATSAPP_DEVICES || 3),
  mongoUri: process.env.MONGO_URI || "",
  whatsappSendMinDelayMs: Number(process.env.WHATSAPP_SEND_MIN_DELAY_MS || 3000),
  whatsappSendMaxDelayMs: Number(process.env.WHATSAPP_SEND_MAX_DELAY_MS || 12000),
  whatsappTypingMinDelayMs: Number(process.env.WHATSAPP_TYPING_MIN_DELAY_MS || 800),
  whatsappTypingMaxDelayMs: Number(process.env.WHATSAPP_TYPING_MAX_DELAY_MS || 2500),
  whatsappHourlySendCap: Number(process.env.WHATSAPP_HOURLY_SEND_CAP || 120),
  whatsappDailySendCap: Number(process.env.WHATSAPP_DAILY_SEND_CAP || 1000),
  whatsappWarmupDays: Number(process.env.WHATSAPP_WARMUP_DAYS || 14),
  whatsappWarmupHourlySendCap: Number(process.env.WHATSAPP_WARMUP_HOURLY_SEND_CAP || 60),
  whatsappWarmupDailySendCap: Number(process.env.WHATSAPP_WARMUP_DAILY_SEND_CAP || 500),
  whatsappWarmupMinDelayMs: Number(process.env.WHATSAPP_WARMUP_MIN_DELAY_MS || 8000),
  whatsappWarmupMaxDelayMs: Number(process.env.WHATSAPP_WARMUP_MAX_DELAY_MS || 25000),
  whatsappMessageSendTimeoutMs: Number(process.env.WHATSAPP_MESSAGE_SEND_TIMEOUT_MS || 90000),
  whatsappGroupOperationTimeoutMs: Number(process.env.WHATSAPP_GROUP_OPERATION_TIMEOUT_MS || 15000),
  awsRegion: process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "us-east-1",
  awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
  awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  awsS3BucketName:
    process.env.AWS_S3_BUCKET ||
    process.env.AWS_S3_BUCKET_NAME ||
    process.env.AWS_BUCKET_NAME ||
    process.env.S3_BUCKET_NAME ||
    "nearmeteacher",
  awsS3UploadTimeoutMs: Number(process.env.AWS_S3_UPLOAD_TIMEOUT_MS || 30000),
  awsS3Endpoint: process.env.AWS_S3_ENDPOINT || "",
  awsS3ForcePathStyle: process.env.AWS_S3_FORCE_PATH_STYLE === "true",
  googleClientId: process.env.GOOGLE_CLIENT_ID || "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
  googleRedirectUri: process.env.GOOGLE_REDIRECT_URI || "http://localhost:5000/api/auth/google/callback",
  superAdminEmails: String(process.env.SUPER_ADMIN_EMAILS || "").split(",").map((email) => email.trim().toLowerCase()).filter(Boolean),
  superAdminPassword: process.env.SUPER_ADMIN_PASSWORD || "",
  razorpayKeyId: process.env.RAZORPAY_KEY_ID || "",
  razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET || "",
  razorpayWebhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || "",
  payuKey: process.env.PAYU_KEY || "",
  payuSalt: process.env.PAYU_SALT || "",
  payuBaseUrl: process.env.PAYU_BASE_URL || "https://test.payu.in/_payment",
  payuVerifyUrl: process.env.PAYU_VERIFY_URL || "https://test.payu.in/merchant/postservice.php?form=2",
  payuVerifyTimeoutMs: Number(process.env.PAYU_VERIFY_TIMEOUT_MS || 15000),
  payuCheckoutCooldownMs: Math.max(60_000, Number(process.env.PAYU_CHECKOUT_COOLDOWN_MS || 60_000)),
  payuSuccessUrl: process.env.PAYU_SUCCESS_URL || "",
  payuFailureUrl: process.env.PAYU_FAILURE_URL || "",
  payuFrontendSuccessUrl: process.env.PAYU_FRONTEND_SUCCESS_URL || "",
  payuFrontendFailureUrl: process.env.PAYU_FRONTEND_FAILURE_URL || "",
};
