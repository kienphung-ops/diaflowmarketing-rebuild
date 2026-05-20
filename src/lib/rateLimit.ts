/**
 * Redis-backed fixed-window rate limiter.
 *
 * Usage:
 *   const r = await checkRateLimit({ key: 'signin-ip:1.2.3.4', limit: 20, windowSec: 3600 })
 *   if (!r.allowed) return 429 with Retry-After: r.retryAfterSec
 *
 * Pattern is plain `INCR + EXPIRE` (set TTL only on the first hit
 * inside the window). Less fancy than a true sliding window, but the
 * extra precision isn't worth the latency for auth endpoints.
 *
 * Fail-open: if Redis is unreachable, every check returns `allowed:
 * true`. The alternative (fail closed) breaks login during a Redis
 * outage which is a strictly worse failure mode for an auth flow.
 */

import { getRedis } from './redis'

export interface RateLimitResult {
  allowed: boolean
  count: number
  limit: number
  /** Seconds remaining before the window resets — populated when
   *  `allowed === false`, used in the `Retry-After` header. */
  retryAfterSec: number
}

interface CheckArgs {
  key: string
  limit: number
  windowSec: number
}

export async function checkRateLimit({
  key,
  limit,
  windowSec,
}: CheckArgs): Promise<RateLimitResult> {
  const redis = getRedis()
  if (!redis) {
    return { allowed: true, count: 0, limit, retryAfterSec: 0 }
  }
  try {
    const fullKey = `rl:${key}`
    const count = await redis.incr(fullKey)
    // First hit inside the window: stamp the TTL so the counter
    // expires after `windowSec`. Subsequent hits reuse the same TTL.
    if (count === 1) {
      await redis.expire(fullKey, windowSec)
    }
    let retryAfterSec = 0
    if (count > limit) {
      const ttl = await redis.ttl(fullKey)
      retryAfterSec = Math.max(0, ttl)
    }
    return {
      allowed: count <= limit,
      count,
      limit,
      retryAfterSec,
    }
  } catch (err) {
    console.warn('[rateLimit] redis error:', (err as Error).message)
    return { allowed: true, count: 0, limit, retryAfterSec: 0 }
  }
}

/**
 * Wipe a rate-limit counter — used after a successful login to clear
 * the per-email lockout so a legit user who mistyped their password
 * a few times isn't blocked from their next session.
 */
export async function clearRateLimit(key: string): Promise<void> {
  const redis = getRedis()
  if (!redis) return
  try {
    await redis.del(`rl:${key}`)
  } catch (err) {
    console.warn('[rateLimit] redis del failed:', (err as Error).message)
  }
}
