import { NextResponse } from 'next/server'
import { readSession } from '@/lib/auth'
import { getTop50, getUserRank } from '@/lib/leaderboard'

// Force Node runtime (ioredis uses Node TCP sockets, not Edge fetch).
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/leaderboard
 *
 * Returns top 50 users by invite count + the requesting user's rank
 * (when signed in). Backed by Redis with a 60-second TTL — see
 * lib/leaderboard.ts for cache details and graceful Postgres fallback.
 *
 * Response shape:
 *   {
 *     top50: LeaderboardEntry[],
 *     currentUserRank: number | null,  // null when anonymous
 *     isInTop50: boolean,
 *   }
 */
export async function GET() {
  const session = await readSession()
  const top50 = await getTop50()

  let currentUserRank: number | null = null
  if (session) {
    currentUserRank = await getUserRank(session.userId)
  }

  const isInTop50 = currentUserRank !== null && currentUserRank <= 50

  return NextResponse.json(
    { top50, currentUserRank, isInTop50 },
    {
      headers: {
        // Browser may also cache for 30s — half the server TTL — so a
        // tab open during a leaderboard update still refreshes within
        // a reasonable window.
        'cache-control': 'private, max-age=30',
      },
    }
  )
}
