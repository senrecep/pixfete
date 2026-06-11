import { mkdirSync } from "node:fs"
import { dirname } from "node:path"
import { Database } from "bun:sqlite"
import { drizzle } from "drizzle-orm/bun-sqlite"
import * as schema from "./schema"

const dbPath = process.env.DATABASE_URL ?? "./data/pixfete.db"

// Ensure the parent directory exists before opening the database file.
mkdirSync(dirname(dbPath), { recursive: true })

// `bun:sqlite` is the Bun-native SQLite binding; the native `better-sqlite3`
// addon is not loadable under Bun. The Drizzle `bun-sqlite` driver exposes the
// same query API, so the schema and migrations are unchanged.
const sqlite = new Database(dbPath, { create: true })
sqlite.exec("PRAGMA journal_mode = WAL;")
sqlite.exec("PRAGMA foreign_keys = ON;")

export const db = drizzle(sqlite, { schema })
export type DB = typeof db
export { sqlite }
