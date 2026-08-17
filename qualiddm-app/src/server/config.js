const REQUIRED_PRODUCTION_ENV = [
  "MYSQL_HOST",
  "MYSQL_DATABASE",
  "MYSQL_USER",
  "MYSQL_PASSWORD",
  "SESSION_SECRET",
];

function readInt(name, fallback) {
  const raw = process.env[name];
  if (raw == null || raw === "") return fallback;
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value)) {
    throw new Error(`Invalid integer env var: ${name}`);
  }
  return value;
}

function readBool(name, fallback = false) {
  const raw = process.env[name];
  if (raw == null || raw === "") return fallback;
  return ["1", "true", "yes", "on"].includes(String(raw).toLowerCase());
}

export function assertProductionConfig() {
  const missing = REQUIRED_PRODUCTION_ENV.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(`Missing production configuration: ${missing.join(", ")}`);
  }
}

export const config = {
  appName: process.env.APP_NAME || "QualiDDM",
  nodeEnv: process.env.NODE_ENV || "development",
  baseUrl: process.env.APP_URL || "http://localhost:3000",
  mysql: {
    host: process.env.MYSQL_HOST || "localhost",
    port: readInt("MYSQL_PORT", 3306),
    database: process.env.MYSQL_DATABASE || "qualiddm",
    user: process.env.MYSQL_USER || "root",
    password: process.env.MYSQL_PASSWORD || "",
    connectionLimit: readInt("MYSQL_CONNECTION_LIMIT", 8),
    ssl: readBool("MYSQL_SSL", false),
  },
  auth: {
    sessionCookie: process.env.SESSION_COOKIE_NAME || "qualiddm_session",
    sessionDays: readInt("SESSION_DAYS", 7),
    sessionSecret: process.env.SESSION_SECRET || "dev-only-change-me",
    devBypass: readBool("QUALITALK_DEV_AUTH_BYPASS", true),
  },
  upload: {
    maxFileBytes: readInt("UPLOAD_MAX_FILE_BYTES", 50 * 1024 * 1024),
    storageDir: process.env.UPLOAD_STORAGE_DIR || "storage/uploads",
    allowedMimeTypes: (
      process.env.UPLOAD_ALLOWED_MIME_TYPES ||
      "audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/mp4,audio/m4a,application/pdf"
    )
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
    allowedExtensions: (
      process.env.UPLOAD_ALLOWED_EXTENSIONS || ".mp3,.mpeg,.wav,.m4a,.mp4,.pdf"
    )
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean),
  },
  ai: {
    provider: process.env.AI_PROVIDER || "gemini",
    geminiApiKey: process.env.GEMINI_API_KEY || "",
    geminiModel: process.env.GEMINI_MODEL || "gemini-2.5-flash",
    requestTimeoutMs: readInt("AI_REQUEST_TIMEOUT_MS", 120000),
    maxTranscriptChars: readInt("AI_MAX_TRANSCRIPT_CHARS", 120000),
  },
  cors: {
    allowedOrigins: (process.env.CORS_ALLOWED_ORIGINS || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
  },
};

export function isProduction() {
  return config.nodeEnv === "production";
}
