import { cors } from "@elysiajs/cors"
import { swagger } from "@elysiajs/swagger"
import { Elysia } from "elysia"
import { config } from "./config"
import { runMigrations } from "./db/migrate"
import { logger } from "./logger"
import { adminRoutes } from "./routes/admin"
import { photoRoutes } from "./routes/photos"
import { uploadRoutes, uploadsServeRoutes } from "./routes/upload"
import { getSettings } from "./services/settings"
import { getStorageAdapter } from "./storage"

runMigrations()

const app = new Elysia()
  .onError(({ code, error, set }) => {
    // Map framework-level errors to the { code, message } envelope the web client expects.
    if (code === "NOT_FOUND") {
      set.status = 404
      return { code: "NotFound", message: "Resource not found" }
    }
    if (code === "VALIDATION") {
      set.status = 400
      return { code: "Validation", message: error.message }
    }
    logger.error({ err: error, code }, "unhandled request error")
    set.status = 500
    return { code: "Unexpected", message: "Internal server error" }
  })
  .use(
    cors({
      origin: config.corsOrigin,
      credentials: true,
      methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "X-Chunk-Index", "X-Total-Chunks"],
    }),
  )
  .use(
    swagger({
      path: "/api/docs",
      documentation: {
        info: { title: "Pixfete API", version: "1.0.0" },
      },
    }),
  )
  .get("/api/health", () => ({ status: "ok", timestamp: Date.now() }))
  .use(uploadRoutes)
  .use(uploadsServeRoutes)
  .use(photoRoutes)
  .use(adminRoutes)
  .listen(config.port)

logger.info(
  {
    port: config.port,
    storageProvider: getSettings().storage.provider,
    corsOrigin: config.corsOrigin,
  },
  "pixfete-api listening",
)

// Build + pre-warm the storage adapter at boot so the first upload skips
// provider cold-start (SDK import, auth, base folder lookup).
getStorageAdapter()

export type App = typeof app
export { app }
