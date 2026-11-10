import pino from "pino";

const isProduction = process.env.NODE_ENV === "production";

// The VPS deployment requires a silent PM2 process. Suppress direct console
// writes as well as structured Pino logs; those bypass the shared logger.
if (isProduction) {
  console.log = () => {};
  console.info = () => {};
  console.warn = () => {};
  console.error = () => {};
  console.debug = () => {};
  console.trace = () => {};
  console.dir = () => {};
  console.table = () => {};
}

export const logger = pino({
  level: isProduction ? "silent" : process.env.LOG_LEVEL ?? "info",
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
