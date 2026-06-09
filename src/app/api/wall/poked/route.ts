import { NextResponse } from 'next/server'
import { getWallMostPoked } from '@/lib/wall'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/wall/poked
 *
 * Top 5 offices by total pokes received (just-for-fun section on the
 * wall). Cached ~2 min in Redis.
 */
export async function GET() {
  const items = await getWallMostPoked()
  return NextResponse.json(
    { items },
    { headers: { 'cache-control': 'public, max-age=60' } },
  )
}
