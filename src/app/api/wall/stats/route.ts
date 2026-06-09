import { NextResponse } from 'next/server'
import { getWallStats } from '@/lib/wall'

// Node runtime (Redis uses Node TCP sockets). Dynamic so the cache-control
// header below — not Next's full-route cache — governs freshness.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/wall/stats
 *
 * Hero numbers for /wall:
 *   { teamsBuilding, teammatesHired, joinedThisWeek, reachedLevel3 }
 *
 * Backed by a ~2-minute Redis cache (see lib/wall.ts). The browser may
 * also hold it for 60s so a tab left open still refreshes within a
 * reasonable window.
 */
export async function GET() {
  const stats = await getWallStats()
  return NextResponse.json(stats, {
    headers: { 'cache-control': 'public, max-age=60' },
  })
}
