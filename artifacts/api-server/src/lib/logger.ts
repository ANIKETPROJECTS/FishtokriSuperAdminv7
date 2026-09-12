import pino from "pino";

const isProduction = process.env.NODE_ENV === "production";

export const logger = pino({
  // Production keeps only failures. Normal activity, successful requests,
  // startup messages, and warnings must not continuously reach PM2 stdout.
  // Keep the default quiet in every runtime. Set LOG_LEVEL=info explicitly
  // when verbose local diagnostics are needed.
  level: process.env.LOG_LEVEL ?? "error",
  redact: [
    "req.headers.authorization",
    "req.headers.cookie",
    "res.headers['set-cookie']",
  ],
  ...(isProduction
    ? {}
    : {
        transport: {
          target: "pino-pretty",
          options: { colorize: true },
        },
      }),
});
