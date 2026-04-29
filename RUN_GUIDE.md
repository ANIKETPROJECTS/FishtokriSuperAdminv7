# FishTokri Admin — Run Guide

Follow these steps exactly when importing this project into a fresh Replit environment.

---

## 1. Set the Required Secret

Before anything else, add the MongoDB connection string as a secret:

| Secret Name   | Value                                      |
|---------------|--------------------------------------------|
| `MONGODB_URI` | Your MongoDB Atlas connection URI          |

The URI must point to a cluster where Replit's IP is allowed. The app will use database `fishtokri_admin` automatically (the API server overrides the DB name in the URI). Without this secret the API server will crash on startup.

To add the secret in Replit: open the **Secrets** panel (lock icon in the sidebar) → click **+ New Secret** → enter `MONGODB_URI` and the value.

---

## 2. Install Dependencies

Open the **Shell** tab and run:

```bash
pnpm install
```

This installs all 500+ packages across the monorepo. It only needs to run once after import. Subsequent runs are fast.

---

## 3. Start the App

The app starts via the **`artifacts/fishtokri-admin: web`** workflow. Replit creates this workflow automatically from the artifact config on import.

Click the **Run** button, or start the workflow from the workflow panel. The startup sequence inside `scripts/dev.sh` is:

1. API server starts on **port 8080** (Express 5 + MongoDB)
2. Script waits until `GET /api/healthz` returns 200
3. Vite frontend starts on **port 5000** (React 19 + TailwindCSS 4)

**Allow 15–20 seconds for the first cold start.** The Vite build step takes a moment. You will see `API server ready.` in the workflow logs when the API is up, and `VITE v7.x  ready` when the frontend is up.

---

## 4. Open the App

Once both servers are running, open the preview pane. You should see the **FishTokri Admin** login screen with a seafood market background and four role cards.

If the preview pane shows blank on first load, wait a few more seconds and refresh — Vite is still compiling.

---

## 5. Log In

| Field    | Value                    |
|----------|--------------------------|
| Email    | `admin@fishtokri.com`    |
| Password | `FishTokri@Admin2024`    |
| Role     | Master Admin             |

Select **Master Admin** on the role screen, then enter the credentials above.

---

## Architecture Reference

```
pnpm monorepo
├── artifacts/
│   ├── api-server/          Express 5 API  →  port 8080
│   └── fishtokri-admin/     React + Vite   →  port 5000 (preview)
├── lib/
│   ├── api-client-react/    React Query hooks used by frontend
│   ├── api-zod/             Zod schemas used by API server
│   └── db/                  (unused template package — safe to ignore)
└── scripts/
    └── dev.sh               Unified startup script
```

**Vite** proxies all `/api/*` requests to `localhost:8080`, so the browser only talks to port 5000.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Blank preview after 30+ seconds | API server failed to start | Check workflow logs for `MONGODB_URI` errors |
| `MongoServerError: bad auth` | Wrong `MONGODB_URI` value | Re-check Secrets panel |
| `EADDRINUSE :8080` | Previous dev.sh still running | Restart the `artifacts/fishtokri-admin: web` workflow |
| Login fails with 401 | Database not seeded | Confirm Atlas cluster has `fishtokri_admin` DB with `hub_users` collection |
| Vite shows `Module not found` | Dependencies not installed | Run `pnpm install` in shell |
