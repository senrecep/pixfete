interface Bucket {
  count: number
  resetAt: number
}

export interface RateLimitResult {
  allowed: boolean
  retryAfterSeconds: number
}

export interface RateLimiter {
  check(key: string): RateLimitResult
}

/**
 * Fixed-window in-memory rate limiter keyed by client IP.
 * No external store required — suitable for single-instance self-hosting.
 */
export function createRateLimiter(
  maxRequests: number | (() => number),
  windowMs: number,
): RateLimiter {
  const limit = () => (typeof maxRequests === "function" ? maxRequests() : maxRequests)
  const buckets = new Map<string, Bucket>()

  // Periodically evict expired buckets so the map does not grow unbounded.
  const sweep = setInterval(() => {
    const now = Date.now()
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(key)
    }
  }, windowMs)
  // Do not keep the process alive solely for the sweep timer.
  if (typeof sweep.unref === "function") sweep.unref()

  return {
    check(key: string): RateLimitResult {
      const now = Date.now()
      const bucket = buckets.get(key)

      if (!bucket || bucket.resetAt <= now) {
        buckets.set(key, { count: 1, resetAt: now + windowMs })
        return { allowed: true, retryAfterSeconds: 0 }
      }

      if (bucket.count >= limit()) {
        return {
          allowed: false,
          retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
        }
      }

      bucket.count += 1
      return { allowed: true, retryAfterSeconds: 0 }
    },
  }
}
