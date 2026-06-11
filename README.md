![pixfete](assets/logo.webp)

# pixfete

Self-hosted photo sharing for events. Guests scan a QR code, upload photos from their phones, and you decide what makes it into the public gallery. The files can live on local disk, Cloudflare R2, or Google Drive, all behind a single storage interface you can swap without touching the rest of the app.

## How it works

Someone scans the QR code on the home page and lands on the upload screen. Their photos go into a pending queue instead of straight to the gallery. You approve or reject each one from the admin panel, and only the approved ones become public. That is the whole loop.

Almost everything is configured at runtime from `/admin/settings`: the event details, the storage backend, upload limits, the theme. The environment only holds the things that have to be set before the app boots, like the admin password hash and the JWT secret.

## Packages

It is a Bun monorepo with four workspaces:

- `packages/shared` — Zod schemas, shared types, and the `tsentials` Result helpers
- `packages/storage` — the `StorageAdapter` interface and the Local, R2, and Google Drive backends
- `packages/api` — the Elysia API, Drizzle over SQLite, auth, and analytics
- `packages/web` — the Next.js 15 frontend on the App Router

## Stack

Bun for the runtime and the workspaces, so no npm or pnpm. Elysia and Drizzle on the API side, talking to SQLite through `bun:sqlite`. Next.js 15 on the web side, built in standalone mode for Docker. Biome handles lint and format. Errors flow through [`tsentials`](https://www.npmjs.com/package/tsentials) as `Result<T>` values, which is why you will not find a `try/catch` or a `throw` anywhere in here.

## Running it locally

```bash
bun install
bun run dev        # api on :3001, web on :3000
```

You can also run one side at a time with `bun run dev:api` or `bun run dev:web`. Other scripts worth knowing:

```bash
bun run db:migrate   # apply the SQLite migrations
bun run lint         # biome check
bun run typecheck    # tsc across every package
```

## Configuration

```bash
cp .env.example .env.local
```

Then generate the two secrets you actually need:

```bash
# admin password hash
bun -e "import b from 'bcryptjs'; console.log(await b.hash('yourpassword', 12))"

# jwt secret
openssl rand -hex 32
```

Drop both into `.env.local`. Everything else has a sensible default, and the optional `.env` keys (storage credentials, event copy, upload limits) only seed the database on the very first boot. After that, the admin panel is the source of truth.

## Deploying

For a single host, plain Docker Compose is enough:

```bash
docker compose up -d --build
```

For Dokploy, use `docker-compose.dokploy.yml` instead. Put the env vars in the Environment tab, set the two `NEXT_PUBLIC_*` URLs as Build Args (Next.js bakes those into the browser bundle at build time, so runtime env alone will not reach them), and point your domains at port 3000 for web and 3001 for the api. The header of that compose file walks through it step by step.

The API runs its migrations on startup, so a fresh deploy comes up with the schema already in place. Uploaded files and the SQLite database persist on named volumes.

## License

[LICENSE](LICENSE)
