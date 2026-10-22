# Deploy coDrive on Vercel (checklist)

Two Vercel projects from the same GitHub repo, plus MongoDB Atlas. No Railway or other API host.

**VERIFY:** NestJS zero-config on Vercel (docs: [NestJS on Vercel](https://vercel.com/docs/frameworks/backend/nestjs)) detects `backend/src/main.ts` when the API project Root Directory is `backend`, keeps `app.listen()`, and runs as one Fluid compute Function. Parent `lib/` imports need “Include source files outside of the Root Directory in the Build Step” enabled (default for projects created after Aug 2020).

---

## 1. MongoDB Atlas

1. Create a free **M0** cluster (any region close to your Vercel region).
2. Create a **database user** (username + password). Save the password.
3. **Network Access**: add `0.0.0.0/0` (or Vercel’s egress IPs if you use Secure Compute). Atlas free tier commonly allows `0.0.0.0/0` for student projects.
4. **Connect → Drivers** and copy the SRV URI. Prefer a string that includes a database name and replica-set-capable options, for example:

   ```text
   mongodb+srv://USER:PASSWORD@CLUSTER.mongodb.net/fleetpro?retryWrites=true&w=majority
   ```

   Atlas M0 is a replica set; transactions work with this URI. **VERIFY:** if a tool asks for `replicaSet=…`, use the value Atlas shows in “Connect”; SRV usually discovers it automatically.
5. URL-encode special characters in the password (`@`, `#`, etc.).

---

## 2. Vercel project A — API (`@codrive/api`)

1. Import the same GitHub repo at [vercel.com/new](https://vercel.com/new).
2. **Root Directory**: `backend` (Edit → select `backend`).
3. Confirm **Include source files outside of the Root Directory in the Build Step** is on (needed for `../../../lib/*`).
4. Framework: **NestJS** (auto-detect, or preset NestJS). Do **not** override Build Command / Output Directory — zero-config compiles from `src/main.ts` ([docs](https://vercel.com/docs/frameworks/backend/nestjs)).
5. Install: `backend/vercel.json` sets `installCommand` to `cd .. && npm install` (npm workspaces at repo root).
6. Deploy once (it may fail until env vars are set — that is OK).
7. Note the production URL, e.g. `https://codrive-api.vercel.app` (no trailing slash).

### Environment variables (API project)

Set for **Production** (and Preview if you use preview deploys):

| Variable | Value |
| --- | --- |
| `MONGODB_URI` | Atlas URI from step 1 |
| `CORS_ORIGINS` | Full origins of the frontend, e.g. `https://codrive.vercel.app` (comma-separated; add preview URLs if needed) |
| `ALLOWED_ORIGINS` | Frontend **hosts** only (no scheme), e.g. `codrive.vercel.app` — required so CSRF Origin checks pass when Next rewrites to the API host; add `*.vercel.app` preview hosts as comma-separated entries |
| `ADMIN_EMAIL` | First admin email (bootstrap only if no ADMIN with password hash exists) |
| `ADMIN_PASSWORD` | First admin password (8–128 chars). Never commit. Remove or rotate after first successful login if you prefer |
| `APP_URL` | Frontend public URL, e.g. `https://codrive.vercel.app` |
| `HOST` | Optional; omit on Vercel |
| `PORT` | Optional; Vercel sets it |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASSWORD` / `SMTP_FROM` | Optional; only for invitation emails |

Redeploy the API after setting env vars.

---

## 3. Vercel project B — Frontend (Next.js)

1. Import the **same** repo again as a second project.
2. **Root Directory**: repository root (`.`).
3. Framework: **Next.js**. `vercel.json` at root sets `buildCommand` to `npm run build` (uses `--webpack` via `package.json`).
4. Note the production URL, e.g. `https://codrive.vercel.app`.

### Environment variables (frontend project)

| Variable | Value | Notes |
| --- | --- | --- |
| `API_URL` | `https://codrive-api.vercel.app` | **Build-time** only (`next.config.ts` rewrites). No trailing slash. After any change: **Redeploy** the frontend |

No MongoDB or admin secrets on the frontend project.

---

## 4. Wire same-origin `/api`

1. Browser → `https://codrive.vercel.app/api/...`
2. Next rewrite → `${API_URL}/api/...` (Nest global prefix `api` unchanged).
3. Cookie `codrive_session` stays on the frontend host (HttpOnly, SameSite=Lax, Secure on HTTPS).
4. Update API `CORS_ORIGINS` / `ALLOWED_ORIGINS` / `APP_URL` if the frontend URL changed; redeploy API (and frontend if `API_URL` changed).

---

## 5. First admin and smoke checks

1. With `ADMIN_EMAIL` + `ADMIN_PASSWORD` set and an empty (or no-password-admin) database, open the frontend URL and log in.
2. Or: `curl -sS https://YOUR-API.vercel.app/api/health` → `{ "status": "ok", "database": "connected" }` (no session).
3. Swagger: `https://YOUR-API.vercel.app/api/docs`.
4. Login via the UI; confirm session cookie and access to Ressources.
5. After the admin exists with a hash, changing `ADMIN_PASSWORD` in Vercel does **not** overwrite the password (bootstrap is one-shot).

---

## 6. Preview deployments

1. Add each preview frontend host to API `ALLOWED_ORIGINS` (and matching origins to `CORS_ORIGINS`), **or** temporarily list known preview hosts.
2. Set frontend Preview `API_URL` to the API **preview** or production URL as you prefer; redeploy when it changes.
3. **VERIFY:** exact preview hostnames are deployment-specific; update env after first preview URL is known.

---

## Local parity (optional)

```sh
npm install
npm run db:start
# backend/.env with MONGODB_URI, ADMIN_EMAIL, ADMIN_PASSWORD as needed
npm run api:build && npm run api:start
# other terminal:
API_URL=http://127.0.0.1:4000 npm run build && npm start -- --port 3017
```

Then open `http://localhost:3017`, hit `/api/health`, and log in with the bootstrapped admin.
