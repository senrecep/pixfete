import { readdirSync, readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { sqlite } from "./index"

const here = dirname(fileURLToPath(import.meta.url))
const migrationsDir = join(here, "migrations")

/**
 * Applies every `.sql` file in the migrations directory in lexical order.
 * Each file is expected to be idempotent (CREATE TABLE IF NOT EXISTS etc.),
 * so running this on every startup is safe.
 */
export function runMigrations(): void {
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort()

  for (const file of files) {
    const sql = readFileSync(join(migrationsDir, file), "utf8")
    sqlite.exec(sql)
  }
}

// Allow running directly: `bun run src/db/migrate.ts`
if (import.meta.main) {
  runMigrations()
  // eslint-disable-next-line no-console
  console.log("Migrations applied.")
}
