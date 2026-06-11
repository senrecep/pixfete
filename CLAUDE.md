# pixfete — Claude Code Reference

> Self-hosted event photo sharing platform with moderation, QR codes, and multi-storage support.

## Commands

| Task | Command |
|---|---|
| Dev (all) | `bun run dev` |
| Dev API only | `bun run dev:api` |
| Dev Web only | `bun run dev:web` |
| Install deps | `bun install` |
| DB migrate | `bun run db:migrate` |
| Lint | `bun run lint` |
| Typecheck | `bun run typecheck` |
| Docker up | `docker compose up -d` |
| Docker build | `docker compose build` |

## Architecture

```
packages/shared  → Zod schemas + tsentials PixfeteErr + types + constants
packages/storage → StorageAdapter interface + Local/R2/GDrive adapters
packages/api     → Elysia REST API + Drizzle SQLite + auth + analytics
packages/web     → Next.js 15 App Router frontend
```

## Non-negotiable Rules

1. **tsentials always** — `Result<T>` / `ResultAsync<T>`, never `try/catch`, never throw
2. **Biome** for lint/format — no ESLint, no Prettier
3. **Bun** runtime — no Node-only APIs
4. **No pnpm/npm** — Bun workspaces only
5. **No console.log** — use pino logger (api) or remove entirely (web)
6. **No any type** — use `unknown` + type guard
7. **No stub implementations** — no `return null`, no TODO placeholders in code
8. **Storage adapter pattern** — all storage goes through `StorageAdapter` interface

## Upload Flow

```
Client → POST /api/upload/session (identity)
       → POST /api/upload/prepare (file metadata → presigned URLs or local slot)
       → Direct upload to R2/GDrive (presigned URL) OR chunked POST to API (local)
       → POST /api/upload/complete (notify API)
       → Photos enter 'pending' moderation queue
```

## Security

- Admin: bcrypt hash from `ADMIN_PASSWORD_HASH` env var — never plain text
- JWT: HS256, 8h expiry, HTTPOnly cookie `pixfete_admin`
- Rate limiting: in-memory per-IP, no Redis needed
- File validation: magic bytes check on server (not just MIME type)
- Presigned URLs: 15min expiry, client uploads directly to R2

## Environment Quick Setup

```bash
# 1. Copy env
cp .env.example .env.local

# 2. Generate admin password hash
bun -e "import b from 'bcryptjs'; console.log(await b.hash('yourpassword', 12))"

# 3. Generate JWT secret
openssl rand -hex 32

# 4. Set in .env.local
ADMIN_PASSWORD_HASH=<hash>
JWT_SECRET=<secret>
```

## Don't

- ❌ `try/catch` — use `Result.try()` or `fromAsync()`
- ❌ `console.log` — use pino
- ❌ `any` type
- ❌ Prisma — Drizzle only
- ❌ Express/Hono/Fastify — Elysia only
- ❌ pnpm/npm — Bun workspaces only
- ❌ ESLint/Prettier — Biome only
- ❌ Storing raw files in DB — always use storage adapter
- ❌ Committing `.env.local`, `data/`, `uploads/`
