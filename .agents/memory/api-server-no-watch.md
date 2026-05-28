---
name: API server has no watch mode — requires restart after code changes
description: The api-server dev script is build+start, not watch mode. Code changes are not picked up without a workflow restart.
---

## Rule
After editing any TypeScript file in `artifacts/api-server/src/`, always restart the **Start API** workflow to rebuild and apply the change.

**Why:** The `dev` script in `artifacts/api-server/package.json` is:
```
"dev": "export NODE_ENV=development && pnpm run build && pnpm run start"
```
It runs a one-shot esbuild compile into `dist/` and then starts `dist/index.mjs`. There is no `--watch` flag or nodemon. The running process continues serving the old `dist/` bundle until a full restart+rebuild.

**How to apply:** Any time you edit backend source files in `api-server/src/`, immediately restart the `Start API` workflow via `restart_workflow("Start API")`. Failure to do so means changes appear in source but have zero effect on the running API.
