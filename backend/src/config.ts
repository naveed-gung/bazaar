import path from "node:path";
import fs from "node:fs";
import dotenv from "dotenv";
import Joi from "joi";

const rootEnv = [
  path.resolve(process.cwd(), "atlas-credentials.env"),
  path.resolve(process.cwd(), "../atlas-credentials.env"),
].find((candidate) => fs.existsSync(candidate));

const dotenvPath = process.env["DOTENV_CONFIG_PATH"] || rootEnv;
dotenv.config(dotenvPath ? { path: dotenvPath, quiet: true } : { quiet: true });
const localEnv = [
  path.resolve(process.cwd(), ".env.local"),
  path.resolve(process.cwd(), "../.env.local"),
].find((candidate) => fs.existsSync(candidate));
if (localEnv) dotenv.config({ path: localEnv, quiet: true, override: false });

const schema = Joi.object({
  NODE_ENV: Joi.string().valid("development", "test", "production").default("development"),
  PORT: Joi.number().integer().min(1).max(65535).default(8787),
  MONGODB_URI: Joi.string().uri({ scheme: ["mongodb", "mongodb+srv"] }).required(),
  MONGODB_DB_NAME: Joi.string().pattern(/^[a-zA-Z0-9_-]+$/).default("bazaar"),
  MONGODB_DNS_SERVERS: Joi.string().allow("").default(""),
  WEB_ORIGIN: Joi.string().uri().default("http://localhost:3000"),
  FIREBASE_PROJECT_ID: Joi.string().allow("").default(""),
  FIREBASE_ADMIN_CREDENTIALS: Joi.string().allow("").default(""),
  FIREBASE_CLIENT_EMAIL: Joi.string().email().allow("").default(""),
  FIREBASE_PRIVATE_KEY: Joi.string().allow("").default(""),
  FIREBASE_PRIVATE_KEY_BASE64: Joi.string().base64().allow("").default(""),
  BOOTSTRAP_ADMIN_EMAIL: Joi.string().email().allow("").default(""),
  BOOTSTRAP_ADMIN_UID: Joi.string().allow("").default(""),
  BOOTSTRAP_CLIENT_EMAIL: Joi.string().email().allow("").default(""),
  BOOTSTRAP_CLIENT_UID: Joi.string().allow("").default(""),
  RESEND_API_KEY: Joi.string().allow("").default(""),
  TAX_RATE: Joi.number().min(0).max(1).default(0.08),
  LOG_LEVEL: Joi.string().valid("fatal", "error", "warn", "info", "debug", "trace").default("info"),
}).unknown(true);

const runtimeEnv = {
  ...process.env,
  ...(!process.env["NODE_ENV"] && process.env["CONTEXT"] === "production"
    ? { NODE_ENV: "production" }
    : {}),
};

const result = schema.validate(runtimeEnv, { abortEarly: false, stripUnknown: false });

if (result.error) {
  const fields = result.error.details.map((detail) => detail.path.join(".")).join(", ");
  throw new Error(`Invalid server configuration: ${fields}`);
}

const env = result.value as Record<string, string>;

export const config = Object.freeze({
  nodeEnv: env["NODE_ENV"] as "development" | "test" | "production",
  port: Number(env["PORT"]),
  mongoUri: env["MONGODB_URI"]!,
  mongoDbName: env["MONGODB_DB_NAME"]!,
  mongoDnsServers: env["MONGODB_DNS_SERVERS"]!.split(",").map((value) => value.trim()).filter(Boolean),
  webOrigin: env["WEB_ORIGIN"]!,
  webOrigins: [
    env["WEB_ORIGIN"]!,
    ...(env["NODE_ENV"] === "development"
      ? ["http://localhost:8080", "http://127.0.0.1:8080", "http://localhost:3000"]
      : []),
  ],
  firebaseProjectId: env["FIREBASE_PROJECT_ID"]!,
  firebaseAdminCredentials: env["FIREBASE_ADMIN_CREDENTIALS"]!,
  firebaseClientEmail: env["FIREBASE_CLIENT_EMAIL"]!,
  firebasePrivateKey: env["FIREBASE_PRIVATE_KEY"]!,
  firebasePrivateKeyBase64: env["FIREBASE_PRIVATE_KEY_BASE64"]!,
  bootstrapAdminEmail: env["BOOTSTRAP_ADMIN_EMAIL"]!,
  bootstrapAdminUid: env["BOOTSTRAP_ADMIN_UID"]!,
  bootstrapClientEmail: env["BOOTSTRAP_CLIENT_EMAIL"]!,
  bootstrapClientUid: env["BOOTSTRAP_CLIENT_UID"]!,
  resendApiKey: env["RESEND_API_KEY"]!,
  taxRate: Number(env["TAX_RATE"]),
  logLevel: env["LOG_LEVEL"]!,
  isProduction: env["NODE_ENV"] === "production",
});
