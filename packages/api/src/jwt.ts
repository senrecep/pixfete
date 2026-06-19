import { PixfeteErr } from "@pixfete/shared"
import { SignJWT, jwtVerify } from "jose"
import type { Result } from "tsentials/result"
import { Result as R } from "tsentials/result"
import { config } from "./config"

const ALG = "HS256"

function secretKey(): Uint8Array {
  return new TextEncoder().encode(config.jwtSecret)
}

export interface AdminClaims {
  adminSessionId: string
}

export async function signAdminToken(
  adminSessionId: string,
  expiresInSeconds: number,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  return new SignJWT({ adminSessionId })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt(now)
    .setExpirationTime(now + expiresInSeconds)
    .sign(secretKey())
}

export async function verifyAdminToken(token: string): Promise<Result<AdminClaims>> {
  return R.tryCatchAsync(
    R.success(token),
    async (t) => {
      const { payload } = await jwtVerify(t, secretKey(), { algorithms: [ALG] })
      const adminSessionId = payload.adminSessionId
      if (typeof adminSessionId !== "string" || adminSessionId.length === 0) {
        throw new Error("missing adminSessionId claim")
      }
      return { adminSessionId }
    },
    () => PixfeteErr.sessionInvalid(),
  )
}
