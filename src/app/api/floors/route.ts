/**
 * GET /api/floors — full floor catalogue.
 *
 * Cached server-side for 1h (Redis + in-process memo, see lib/floorsApi).
 * The `Cache-Control` headers also let Vercel's edge cache serve hits
 * without ever hitting the function, since floor config is essentially
 * static between admin edits.
 *
 * Returns `{ floors: FloorConfigEntry[] }`. Each entry includes the
 * floor's items with their per-floor quantities so the renderer can
 * size things correctly (e.g. `basic_chair_desk × 3` → render 3 desks).
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAllFloorsConfig, invalidateFloorsConfig } from '@/lib/floorsApi'

export const runtime = 'nodejs'
// `force-dynamic` skips Next.js's static-route prerender + fetch cache.
// Every request hits this function — which is fine because the function
// itself sits on top of a 3-tier cache (in-process memo → Redis → DB),
// so the hot path is still a single Redis GET (~1 ms). The previous
// setup pre-rendered the response at build time and never invalidated,
// so admin DB edits showed up only after the next deploy.
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    // `?refresh=1` busts the Redis + in-process cache before reading,
    // so a manual DB edit (Prisma Studio, SQL, etc.) propagates to the
    // UI immediately on the next page load. Without this query param
    // the natural 60 s cache TTL covers most cases automatically.
    if (req.nextUrl.searchParams.get('refresh') === '1') {
      await invalidateFloorsConfig()
    }
    const floors = await getAllFloorsConfig()
    return NextResponse.json(
      { floors },
      {
        headers: {
          // Browser cache 60 s, CDN 5 min, stale-while-revalidate for
          // a day so the next request is always instant. Short enough
          // that admin edits propagate quickly; long enough that the
          // typical page-load doesn't re-fetch.
          'cache-control':
            'public, max-age=60, s-maxage=300, stale-while-revalidate=86400',
        },
      },
    )
  } catch (err) {
    console.error('[api/floors]', err)
    return NextResponse.json({ error: 'Failed to load floors' }, { status: 500 })
  }
}
