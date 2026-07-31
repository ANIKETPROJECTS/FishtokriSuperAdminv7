/**
 * Starts the API server with environment variables sourced from ecosystem.config.cjs.
 * This keeps credentials out of .replit while reusing the existing PM2 config.
 */
import { createRequire } from "module";
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const cfg = require(resolve(__dirname, "../ecosystem.config.cjs"));
const ecosystemEnv = cfg.apps[0].env ?? {};

// Merge ecosystem env into process env, but let existing process env (e.g.
// PORT set by Replit) take precedence over the ecosystem defaults.
const env = { ...ecosystemEnv, ...process.env };

const child = spawn(
  "node",
  ["--enable-source-maps", resolve(__dirname, "../artifacts/api-server/dist/index.mjs")],
  { env, stdio: "inherit" }
);

child.on("exit", (code) => process.exit(code ?? 0));
