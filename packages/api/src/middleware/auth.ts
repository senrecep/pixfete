import { Elysia } from "elysia"
import { eq } from "drizzle-orm"
import { Err } from "tsentials/errors"
import { Result as R } from "tsentials/result"
import { db } from "../db"
import { adminSessions } from "../db/schema"
import { errorBody, statusForError } from "../http"
import { verifyAdminToken } from "../jwt"

const COOKIE_NAME = "pixfete_admin"

// 401 for any unauthenticated admin request (missing / invalid / expired token).
const unauthorized = () => Err.unauthorized("Auth.Unauthorized", "Authentication required")

function extractToken(authHeader: string | undefined, cookieHeader: string | undefined): string | null {
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7).trim()
    if (token) return token
  }
  if (cookieHeader) {
    for (const part of cookieHeader.split(";")) {
      const [name, ...rest] = part.trim().split("=")
      if (name === COOKIE_NAME) {
        const value = rest.join("=").trim()
        if (value) return decodeURIComponent(value)
      }
    }
  }
  return null
}

/**
 * Resolves the admin session id from request headers, or null if the request is
 * not an authenticated admin (missing / invalid / expired / revoked token).
 * Shared by the `requireAdmin` macro and ad-hoc checks (e.g. file serving).
 */
export async function resolveAdminSessionId(
  authHeader: string | undefined,
  cookieHeader: string | undefined,
): Promise<string | null> {
  const token = extractToken(authHeader, cookieHeader)
  if (!token) return null

  const verified = await verifyAdminToken(token)
  if (!R.isSuccess(verified)) return null

  const sessionId = verified.value.adminSessionId
  const rows = db
    .select()
    .from(adminSessions)
    .where(eq(adminSessions.id, sessionId))
    .limit(1)
    .all()
  const session = rows[0]
  if (!session || session.revoked || session.expiresAt <= Date.now()) return null
  return sessionId
}

/**
 * Elysia plugin exposing a `requireAdmin` macro. Routes opt in with
 * `{ requireAdmin: true }`; on success `adminSessionId` is available in context.
 */
export const adminAuth = new Elysia({ name: "admin-auth" }).macro({
  requireAdmin(enabled: boolean) {
    if (!enabled) return {}
    return {
      resolve: async ({ headers, set }) => {
        const sessionId = await resolveAdminSessionId(headers.authorization, headers.cookie)
        if (!sessionId) {
          const err = unauthorized()
          set.status = statusForError(err)
          return { adminSessionId: "" as const, authError: errorBody(err) }
        }
        return { adminSessionId: sessionId, authError: null as null }
      },
    }
  },
})

export { COOKIE_NAME as ADMIN_COOKIE_NAME }
