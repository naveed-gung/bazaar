import pino from "pino";
import { config } from "./config.js";

export const logger = pino({
  level: config.logLevel,
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "res.headers.set-cookie",
      "password",
      "token",
      "refreshToken",
      "firebaseToken",
      "email",
      "phone",
      "address",
    ],
    censor: "[REDACTED]",
  },
});
