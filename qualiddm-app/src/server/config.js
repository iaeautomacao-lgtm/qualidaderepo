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
    /* Senha com que todo acesso novo nasce, e a que o reset devolve.
       Uma senha padrao para todos so e aceitavel porque a troca no primeiro
       acesso e OBRIGATORIA: `users.trocar_senha` fica em 1 e `requireSession`
       recusa qualquer rota de dados enquanto estiver assim. Sem essa trava,
       quem descobrisse a senha entraria como qualquer pessoa que ainda nao
       tivesse acessado. */
    senhaPadrao: process.env.AUTH_SENHA_PADRAO || "QualiDDM@2026",
    senhaMinima: readInt("AUTH_SENHA_MINIMA", 8),
  },
  upload: {
    maxFileBytes: readInt("UPLOAD_MAX_FILE_BYTES", 50 * 1024 * 1024),
    storageDir: process.env.UPLOAD_STORAGE_DIR || "storage/uploads",
    allowedMimeTypes: (
      process.env.UPLOAD_ALLOWED_MIME_TYPES ||
      // `video/mpeg` e `video/mp4` estão aqui porque é o que o Windows e o
      // Chrome declaram para `.mpeg`, `.mpg` e `.mp4` de ÁUDIO. Recusar por esse
      // rótulo barraria gravação de ligação legítima; o mime enviado à IA é
      // corrigido pela extensão em `mimeParaAnalise`.
      "audio/mpeg,audio/mp3,audio/x-mpeg,audio/mpeg3,audio/x-mpeg-3,audio/wav,audio/x-wav,audio/wave,audio/mp4,audio/m4a,audio/x-m4a,audio/aac,audio/ogg,audio/opus,audio/webm,audio/flac,video/mpeg,video/mp4,application/pdf,text/plain,text/csv,application/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
    allowedExtensions: (
      process.env.UPLOAD_ALLOWED_EXTENSIONS ||
      ".mp3,.mpeg,.mpg,.mpga,.wav,.m4a,.mp4,.aac,.ogg,.opus,.webm,.flac,.pdf,.txt,.csv,.xls,.xlsx"
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
