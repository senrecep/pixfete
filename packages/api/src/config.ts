/**
 * Infrastructure / security configuration — the only values read from the
 * environment. Everything else (event, storage, upload limits, features) is
 * managed from the admin panel and persisted in the database. See
 * `services/settings.ts`.
 */
export const config = {
  port: Number(process.env.PORT ?? 3001),
  jwtSecret: process.env.JWT_SECRET ?? "",
  adminPasswordHash: process.env.ADMIN_PASSWORD_HASH ?? "",
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:3000",
  databaseUrl: process.env.DATABASE_URL ?? "./data/pixfete.db",
  // Master key used to encrypt stored secrets at rest. Falls back to JWT_SECRET.
  settingsEncryptionKey: process.env.SETTINGS_ENCRYPTION_KEY ?? "",
} as const
