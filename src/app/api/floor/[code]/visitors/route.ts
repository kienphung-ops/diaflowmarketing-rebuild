/**
 * GET /api/floor/[code]/visitors?v=<uuid>
 *
 * Presence tracking for the shared-floor view. Each visitor pings this
 * endpoint every ~5 seconds with their persistent localStorage UUID.
 *
 * Backed by a Redis sorted-set keyed `floor:visitors:<code>`:
 *   - score = last-seen timestamp (ms)
 *   - member = visitor UUID
 *
 * A visitor is "active" if their score is within the last 30 seconds.
 * We trim older entries on every call (lazy GC) and set a key TTL of
 * 60s so empty floors disappear automatically.
 *
 * No-ops gracefully (returns count: 0) when Redis is unreachable.
 * Doesn't require the floor to be public — owners can fetch their own
 * count from the home page even with sharing turned off.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getRedis } from '@/lib/redis'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const PRESENCE_WINDOW_MS = 30_000

export async function GET(req: NextRequest, { params }: { params: { code: string } }) {
  const code = params.code?.toUpperCase()
  if (!code) return NextResponse.json({ error: 'Missing code' }, { status: 400 })

  const url = new URL(req.url)
  const visitorId = url.searchParams.get('v')?.trim() ?? ''

  const redis = getRedis()
  if (!redis) {
    return NextResponse.json({ count: 0 }, { headers: { 'cache-control': 'no-store' } })
  }

  const key = `floor:visitors:${code}`
  const now = Date.now()
  const cutoff = now - PRESENCE_WINDOW_MS

  try {
    if (visitorId) {
      // Heartbeat: bump or insert this visitor's last-seen timestamp.
      await redis.zadd(key, now, visitorId)
    }
    // Lazy cleanup of stale entries (visitors offline for > 30s).
    await redis.zremrangebyscore(key, '-inf', cutoff)
    const count = await redis.zcard(key)
    // Auto-expire the key after 60s of inactivity so empty floors
    // don't linger in Redis forever.
    await redis.expire(key, 60)
    return NextResponse.json({ count }, { headers: { 'cache-control': 'no-store' } })
  } catch (err) {
    console.warn('[presence] redis op failed:', (err as Error).message)
    return NextResponse.json({ count: 0 }, { headers: { 'cache-control': 'no-store' } })
  }
}
