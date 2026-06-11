import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto"
import { Result as R } from "tsentials/result"
import { config } from "../config"

// Secrets stored in the DB are encrypted at rest with AES-256-GCM. The key is
// derived from SETTINGS_ENCRYPTION_KEY (or JWT_SECRET as a fallback) so the
// ciphertext is useless without the deployment's environment secret.
const PREFIX = "enc.v1:"

function key(): Buffer {
  const material = config.settingsEncryptionKey || config.jwtSecret || "pixfete-insecure-dev-key"
  return createHash("sha256").update(material).digest() // 32 bytes
}

/** Encrypts a plaintext secret. Empty input stays empty (nothing to protect). */
export function encryptSecret(plain: string): string {
  if (!plain) return ""
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", key(), iv)
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${PREFIX}${iv.toString("base64")}:${tag.toString("base64")}:${ct.toString("base64")}`
}

/**
 * Decrypts a stored secret. Values without the prefix are returned unchanged so
 * pre-existing plaintext (e.g. seeded from env) keeps working.
 */
export function decryptSecret(stored: string): string {
  if (!stored || !stored.startsWith(PREFIX)) return stored
  const [ivB64, tagB64, ctB64] = stored.slice(PREFIX.length).split(":")
  if (!ivB64 || !tagB64 || !ctB64) return ""
  const decoded = R.try(() => {
    const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(ivB64, "base64"))
    decipher.setAuthTag(Buffer.from(tagB64, "base64"))
    return Buffer.concat([
      decipher.update(Buffer.from(ctB64, "base64")),
      decipher.final(),
    ]).toString("utf8")
  })
  // Wrong key / corrupted value — treat as unset rather than crashing.
  return R.isSuccess(decoded) ? decoded.value : ""
}

export function isEncrypted(stored: string): boolean {
  return stored.startsWith(PREFIX)
}
