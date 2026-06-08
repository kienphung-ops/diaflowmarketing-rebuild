import { NextResponse } from 'next/server'
import { readSession } from '@/lib/auth'
import { getWallLeaderboard, getWallViewerEntry } from '@/lib/wall'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/wall/leaderboard
 *
 * Top 50 offices for /wall — each entry carries level + role so the
 * board can render "Lv N" + the role sub-line. The top-50 list is cached
 * ~2 min in Redis (shared across everyone).
 *
 * `you` is the signed-in viewer's own office row (null for guests). The
 * client uses its `referralCode` to either HIGHLIGHT the matching row
 * when the viewer is in the top 50, or render a pinned "50+" footer line
 * when they're below the cut. It's computed per-request (not from the
 * shared cache), so the response is marked `private`.
 */
export async function GET() {
  const top50 = await getWallLeaderboard()

  let you = null
  const session = await readSession()
  if (session) {
    // Always return the viewer's row when signed in — the client decides
    // highlight (in top 50) vs "50+" footer (out) by matching referralCode.
    you = await getWallViewerEntry(session.userId)
  }

  return NextResponse.json(
    { top50, you },
    // Per-user (`you`) → must not be shared-cached. Brief private cache
    // is fine for the viewer's own tab.
    { headers: { 'cache-control': 'private, max-age=30' } },
  )
}
