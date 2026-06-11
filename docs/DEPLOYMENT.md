# Pixfete — Setup & Deployment Guide

> Self-hosted event photo sharing platform. Two services (**api** on `:3001`, **web** on `:3000`), a single-file **SQLite** database, and pluggable storage (local disk / Cloudflare R2 / Google Drive).

## 0. Architecture Overview

```
packages/shared   → Zod schemas, error types, constants
packages/storage  → StorageAdapter interface (local/R2/GDrive)
packages/api      → Elysia REST API + SQLite (Drizzle) + auth
packages/web      → Next.js 15 frontend
```

No external database to provision — the DB is a single SQLite file. Storage backend is chosen via the `STORAGE_PROVIDER` env var.

---

## 1. Running Locally

### Step 1 — Dependencies & env

```bash
cd pixfete
bun install
cp .env.example .env.local
```

### Step 2 — Generate required secrets

```bash
# Admin password hash (for the admin panel login)
bun -e "import b from 'bcryptjs'; console.log(await b.hash('your-password', 12))"

# JWT secret (64-char hex)
openssl rand -hex 32
```

Write them into `.env.local`:

```bash
ADMIN_PASSWORD_HASH=$2b$12$...   # the hash above
JWT_SECRET=...                    # the openssl output
```

### Step 3 — Migrations

You do **not** need to run migrations manually. `packages/api/src/index.ts` calls `runMigrations()` on every API startup, and migrations are idempotent (`CREATE TABLE IF NOT EXISTS`), so they run safely on every boot. Starting the dev server creates the tables automatically.

Manual commands, if you want them:

```bash
bun run db:migrate          # apply migrations
bun run db:studio           # browse the DB in the browser (drizzle-kit studio)
```

To generate a **new** migration after changing the schema:

```bash
cd packages/api && bun x drizzle-kit generate
# → writes a new .sql file into src/db/migrations/, applied automatically on next startup
```

### Step 4 — Run

```bash
bun run dev          # api + web together
# or separately:
bun run dev:api      # api only  → http://localhost:3001
bun run dev:web      # web only  → http://localhost:3000
```

Health check: `http://localhost:3001/api/health` → `{"status":"ok"}`. API docs: `http://localhost:3001/api/docs`.

---

## 2. Storage Options

The single deciding variable is **`STORAGE_PROVIDER`** = `local` | `r2` | `gdrive`. In every provider, the optional **`STORAGE_BASE_PATH`** collects files under a subfolder/prefix (e.g. `dugunum` → `dugunum/{uploader}/{photoId}/...`).

### 2a. Local (default — zero setup)

```bash
STORAGE_PROVIDER=local
UPLOADS_DIR=./uploads        # files are written here
STORAGE_BASE_PATH=           # empty = straight to the root
```

Files are served via `GET /api/uploads/*` (which sends `X-Robots-Tag: noindex, noimageindex` so images are not indexed).

### 2b. Cloudflare R2

In the Cloudflare dashboard: create a **bucket**, generate an **R2 API token** (Access Key + Secret), and attach a **public domain** to the bucket.

```bash
STORAGE_PROVIDER=r2
CLOUDFLARE_R2_ENDPOINT=https://<account_id>.r2.cloudflarestorage.com
CLOUDFLARE_R2_ACCESS_KEY=...
CLOUDFLARE_R2_SECRET_KEY=...
CLOUDFLARE_R2_BUCKET=pixfete-uploads
CLOUDFLARE_R2_PUBLIC_URL=https://cdn.your-domain.com
STORAGE_BASE_PATH=dugunum     # optional; can be empty if the bucket is already dedicated
```

On R2, the client uploads directly via **presigned URLs** (the file does not pass through the API) — fast and low server load.

### 2c. Google Drive

In Google Cloud Console: create a **service account** → download its JSON key → **share** the target Drive folder with the service account's email (Editor) → grab the folder ID from the URL.

```bash
STORAGE_PROVIDER=gdrive
GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}   # JSON as a single-line string
GOOGLE_DRIVE_FOLDER_ID=1AbC...                                     # the shared folder ID
STORAGE_BASE_PATH=dugunum     # creates a "dugunum/{slug}/" hierarchy under the root folder
```

With `STORAGE_BASE_PATH=dugunum`: a `dugunum` folder is created under the Drive root, and a `{slug}` subfolder is created per uploader — keeping the main Drive tidy.

---

## 3. Running with Docker (local)

### Migration behavior (important)

`docker-compose.yml` has **no separate migration step, and needs none**, because:

1. The API container starts with `bun run packages/api/src/index.ts`.
2. That entrypoint calls `runMigrations()` on startup.
3. Migrations are idempotent → safe on every restart.

The DB file lives in a **named volume** (`db` → `/app/data/pixfete.db`) and persists across container recreation. So "how do migrations run in Docker?" → they run automatically when the container boots.

### Run

```bash
# Prepare .env (compose reads ${VAR} from it)
cp .env.example .env
# Fill in ADMIN_PASSWORD_HASH, JWT_SECRET, STORAGE_PROVIDER + (R2/GDrive set)

docker compose build
docker compose up -d
docker compose logs -f api      # expect "Migrations applied." + "pixfete-api listening"
```

The `web` service **waits** for the `api` healthcheck (`/api/health`) to pass via `depends_on: condition: service_healthy` — so the web app never starts before the DB is ready. This already guarantees the desired migration ordering.

### Optional: explicit migration service

If you want to split migrations out of app startup into a one-shot job (not required today — the automatic setup is sufficient for most cases), add this to compose:

```yaml
  migrate:
    build: { context: ., dockerfile: docker/Dockerfile.api }
    command: ["bun", "run", "packages/api/src/db/migrate.ts"]
    volumes: [ "db:/app/data" ]
    environment: [ "DATABASE_URL=/app/data/pixfete.db" ]
    restart: "no"
  # api: depends_on: { migrate: { condition: service_completed_successfully } }
```

---

## 4. Deploying to Dokploy

Dokploy is a self-hosted PaaS that can use `docker-compose.yml` as-is. Two common approaches:

### Approach A — Compose (recommended, closest to this setup)

1. **Dokploy → Create → Docker Compose** project.
2. **Source**: connect the Git repo (or repo URL + branch).
3. **Compose path**: `docker-compose.yml`.
4. In the **Environment** tab, enter production values:
   ```
   ADMIN_PASSWORD_HASH=...
   JWT_SECRET=...
   CORS_ORIGIN=https://photos.your-domain.com
   SITE_URL=https://photos.your-domain.com
   API_URL=https://api.your-domain.com
   STORAGE_PROVIDER=r2            # or gdrive
   CLOUDFLARE_R2_...=...          # storage set
   STORAGE_BASE_PATH=dugunum
   ```
5. **Domains** (via Dokploy's Traefik):
   - `web` service → `photos.your-domain.com` (port 3000)
   - `api` service → `api.your-domain.com` (port 3001)
   - Enable **Let's Encrypt SSL** on both.
6. **Deploy**. Dokploy builds the images; the `uploads` and `db` volumes persist.

> **Critical**: `NEXT_PUBLIC_*` variables are baked into the Next.js bundle at **build time**. Set `API_URL`/`SITE_URL` to the correct production domains **before** deploying, otherwise the frontend will call `localhost`. Changing the domain requires a **rebuild**.

### Approach B — Two separate Applications

You can also deploy `api` and `web` as two separate Dokploy "Applications", each with its own Dockerfile (`docker/Dockerfile.api`, `docker/Dockerfile.web`). This allows more granular scaling but splits volume and env management across two places. The Compose approach is simpler for this project.

### Post-deploy checks

```
https://api.your-domain.com/api/health   → {"status":"ok"}
https://photos.your-domain.com            → home page
https://photos.your-domain.com/robots.txt → should show /api/ and /admin/ disallow
```

### Persistence notes by storage backend

- **local**: the `uploads` volume lives on the Dokploy host — disk can fill up and backups are your responsibility. For a one-off event with many photos, prefer **R2 or GDrive**.
- **R2/GDrive**: files live in the external service; losing a container/volume does not affect the photos. Only the SQLite `db` volume holds metadata — back that up and you're covered.

---

## 5. SEO / Image Privacy

The site is discoverable, but uploaded images are kept out of search engines via complementary layers:

- `app/robots.ts` — allows `/`, disallows `/api/` and `/admin/`.
- `app/sitemap.ts` — lists indexable pages (home, gallery, upload, qr).
- `app/gallery/layout.tsx`, `app/qr/layout.tsx` — `noimageindex` (page visible, images not indexed by Google Images).
- `app/my/[token]/layout.tsx` — `noindex, nofollow` (personal token pages fully hidden).
- `api` `GET /api/uploads/*` — responds with `X-Robots-Tag: noindex, noimageindex` so served files are not indexed even if a URL leaks.

---

## Summary

| Topic | Status |
|------|--------|
| Migration | Automatic on every API startup (idempotent) — no extra setup |
| Local storage | Zero setup, `STORAGE_PROVIDER=local` |
| R2 | Bucket + API token + public domain → 5 env vars |
| GDrive | Service account JSON + shared folder ID → 2 env vars |
| `STORAGE_BASE_PATH` | Subfolder/prefix across all providers (`dugunum/...`) |
| Web Docker build | Requires `output: "standalone"` in `next.config.ts` (configured) |
| Dokploy | Compose project + env + 2 domains (web/api) + SSL |
