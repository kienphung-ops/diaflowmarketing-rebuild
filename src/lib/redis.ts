/**
 * Redis client singleton — lazy-connect, error-tolerant.
 *
 * The leaderboard module (lib/leaderboard.ts) is the only caller right
 * now: it uses Redis as a 60-second cache in front of Postgres so the
 * /api/leaderboard endpoint can serve top-50 + per-user rank without
 * hammering the database on every page load.
 *
 * Connection model:
 *   - One TCP connection per Node process, reused via `globalThis`
 *     so HMR in dev doesn't leak sockets.
 *   - `lazyConnect: true` — we don't open the socket until the first
 *     `.get()` / `.set()` call. Saves a connection during cold start.
 *   - `maxRetriesPerRequest: 2` — fail fast on a dead Redis so the
 *     caller can fall back to Postgres without long stalls.
 *   - All errors are caught and logged at the call site; Redis being
 *     down should NEVER crash an API route.
 */

import Redis from 'ioredis'

declare global {
  // eslint-disable-next-line no-var
  var __diaflowRedis: Redis | null | undefined
}

export function getRedis(): Redis | null {
  if (!process.env.REDIS_DB) return null
  if (globalThis.__diaflowRedis !== undefined) return globalThis.__diaflowRedis

  try {
    const client = new Redis(process.env.REDIS_DB, {
      maxRetriesPerRequest: 1,
      connectTimeout: 2000,
      enableOfflineQueue: true,
      // After ~3 failed reconnect attempts, give up so we don't burn
      // request latency on a dead Redis. The leaderboard library
      // already falls back to Postgres on null returns.
      retryStrategy: times => (times > 3 ? null : Math.min(times * 200, 1000)),
      reconnectOnError: () => false,
    })
    client.on('error', err => {
      if (!(client as unknown as { __warned?: boolean }).__warned) {
        ;(client as unknown as { __warned?: boolean }).__warned = true
        console.warn('[redis] client error:', err.message)
      }
    })
    client.on('end', () => {
      // Connection permanently closed — disable further attempts this process.
      globalThis.__diaflowRedis = null
    })
    globalThis.__diaflowRedis = client
    return client
  } catch (err) {
    console.warn('[redis] failed to create client:', err)
    globalThis.__diaflowRedis = null
    return null
  }
}
