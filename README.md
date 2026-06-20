![pixfete](assets/logo.webp)

# pixfete

Self-hosted photo sharing for events. Guests scan a QR code, upload from their phones, and you decide what ends up in the public gallery. Files can live on local disk, Cloudflare R2, or Google Drive — one storage interface, no code changes to switch.

## How it works

Someone scans the QR code and lands on the upload screen. They enter a name (phone and a note are optional), pick their photos and videos, and send them. Nothing goes straight to the gallery. Everything lands in a pending queue, and you approve or reject from the admin panel. Only approved files become public.

Before uploading, guests can edit each file. Photos open an inline crop tool. Videos open a trim tool with a visual timeline — and if the video is HEVC or MOV, it re-encodes to H.264 in the browser so it plays everywhere without a server round-trip. Each file in the list shows its resolution (photos) or duration (videos) alongside the size, and a pencil icon opens the relevant editor.

The screen stays awake during uploads so a long video does not get cut off by the phone locking. If the tab loses focus mid-upload, it picks up where it left off when the tab comes back. If someone still cannot get a file through, a WhatsApp fallback shows the organizer's number.

The admin panel at `/admin` handles everything else: moderation queue, event details, storage backend, upload limits, and the theme color. Only the admin password hash and the JWT secret need to be in the environment file. Everything else is configured at runtime and stored in the database.

## Packages

Bun monorepo, four workspaces:

- `packages/shared` — Zod schemas, shared types, `tsentials` Result helpers
- `packages/storage` — `StorageAdapter` interface with Local, R2, and Google Drive backends
- `packages/api` — Elysia API, Drizzle over SQLite, auth, analytics
- `packages/web` — Next.js 15 frontend, App Router

## Stack

Bun for runtime and workspaces. Elysia and Drizzle on the API side, SQLite through `bun:sqlite`. Next.js 15 on the web side, built in standalone mode for Docker. Biome handles lint and format. Errors flow through [`tsentials`](https://www.npmjs.com/package/tsentials) as `Result<T>` — no `try/catch`, no `throw`. In-browser video processing runs via FFmpeg WASM.

## Running it locally

```bash
bun install
bun run dev        # api on :3001, web on :3000
```

One side at a time: `bun run dev:api` or `bun run dev:web`. Other commands:

```bash
bun run db:migrate   # apply SQLite migrations
bun run lint         # biome check
bun run typecheck    # tsc across every package
```

## Configuration

```bash
cp .env.example .env.local
```

Generate the two secrets you need:

```bash
# admin password hash
bun -e "import b from 'bcryptjs'; console.log(await b.hash('yourpassword', 12))"

# jwt secret
openssl rand -hex 32
```

Drop both into `.env.local`. Everything else has a default. Optional env keys (storage credentials, event copy, upload limits) seed the database on first boot only. After that, the admin panel is the source of truth.

## Deploying

Single host:

```bash
docker compose up -d --build
```

For Dokploy, use `docker-compose.dokploy.yml`. Put the env vars in the Environment tab, set the two `NEXT_PUBLIC_*` URLs as Build Args (Next.js bakes these into the browser bundle at build time — runtime env alone will not reach them), and point your domains at port 3000 for web and 3001 for the API. The header of that compose file walks through it step by step.

The API runs migrations on startup. Files and the SQLite database persist on named volumes.

## License

[LICENSE](LICENSE)
