# FishTokri Admin

Operations console for the FishTokri seafood distribution network.

## Stack
- **Frontend:** React 19, Vite 7, TailwindCSS 4, TanStack Query v5, Wouter routing, shadcn/ui (Radix UI)
- **Backend:** Express 5, MongoDB (Mongoose), Zod validation, Pino logging
- **Monorepo:** pnpm workspaces (`pnpm-workspace.yaml`)
- **Shared packages:** `lib/api-client-react`, `lib/api-zod`, `lib/db`

## How to run on Replit

Two workflows must both be running:

| Workflow | Command | Port |
|---|---|---|
| **Start API** | `pnpm install && cd artifacts/api-server && pnpm run build && PORT=8080 node --enable-source-maps ./dist/index.mjs` | 8080 |
| **Start Frontend** | `pnpm install && cd artifacts/fishtokri-admin && PORT=5000 BASE_PATH=/ pnpm run dev` | 5000 |

The frontend proxies `/api` requests to the API at port 8080 (configured in `vite.config.ts`).

## Required secrets
| Secret | Purpose |
|---|---|
| `MONGODB_URI` | MongoDB Atlas connection string |
| `SESSION_SECRET` | Express session signing |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary image uploads |
| `CLOUDINARY_API_KEY` | Cloudinary image uploads |
| `CLOUDINARY_API_SECRET` | Cloudinary image uploads |
| `QZ_CERTIFICATE` | QZ Tray print certificate |
| `QZ_PRIVATE_KEY` | QZ Tray print signing key |

## Project structure
```
artifacts/
  api-server/       # Express API (build → dist/index.mjs)
  fishtokri-admin/  # React + Vite admin dashboard
  mockup-sandbox/   # Component prototyping (design only)
lib/
  api-client-react/ # Shared React Query hooks
  api-zod/          # Shared Zod schemas
  db/               # DB utilities
scripts/
  dev.sh            # Waits for API health before starting frontend
```

## Notes
- The API has **no watch mode** — after editing `api-server/src/`, restart the `Start API` workflow to rebuild and reload.
- Login requires user accounts seeded in MongoDB (`hub_users` collection).

## User preferences
