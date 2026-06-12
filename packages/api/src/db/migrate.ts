import { readFileSync, readdirSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { sqlite } from "./index"

const here = dirname(fileURLToPath(import.meta.url))
const migrationsDir = join(here, "migrations")

/**
 * Applies every `.sql` file in the migrations directory in lexical order,
 * exactly once. A `_migrations` ledger tracks which files have already run, so
 * non-idempotent statements (e.g. `ALTER TABLE ... ADD COLUMN`, which SQLite
 * cannot guard with `IF NOT EXISTS`) are safe across restarts. The pre-existing
 * `CREATE TABLE IF NOT EXISTS` migrations remain harmless if re-applied once on
 * databases created before this ledger existed.
 */
export function runMigrations(): void {
  sqlite.exec(
    "CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at INTEGER NOT NULL)",
  )

  const applied = new Set(
    (sqlite.query("SELECT name FROM _migrations").all() as Array<{ name: string }>).map(
      (r) => r.name,
    ),
  )

  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort()

  for (const file of files) {
    if (applied.has(file)) continue
    const sql = readFileSync(join(migrationsDir, file), "utf8")
    sqlite.exec(sql)
    sqlite.query("INSERT INTO _migrations (name, applied_at) VALUES (?, ?)").run(file, Date.now())
  }
}

// Allow running directly: `bun run src/db/migrate.ts`
if (import.meta.main) {
  runMigrations()
  // eslint-disable-next-line no-console
  console.log("Migrations applied.")
}
