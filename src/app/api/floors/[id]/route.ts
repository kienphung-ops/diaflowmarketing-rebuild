/**
 * GET /api/floors/[id] — single floor detail.
 *
 * Backed by the same cache as /api/floors (one fetch warms both routes).
 * Returns 404 when the id is out of range (1..20 in the current seed).
 */

import { NextResponse } from 'next/server'
import { getFloorConfigById } from '@/lib/floorsApi'

export const runtime = 'nodejs'
// See /api/floors for the rationale — same pattern: force-dynamic +
// internal 3-tier cache, so each request reads fresh Redis state
// instead of a stale build-time prerender.
export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const id = parseInt(params.id, 10)
  if (!Number.isFinite(id) || id < 1) {
    return NextResponse.json({ error: 'Invalid floor id' }, { status: 400 })
  }
  try {
    const floor = await getFloorConfigById(id)
    if (!floor) {
      return NextResponse.json({ error: 'Floor not found' }, { status: 404 })
    }
    return NextResponse.json(
      { floor },
      {
        headers: {
          'cache-control':
            'public, max-age=60, s-maxage=300, stale-while-revalidate=86400',
        },
      },
    )
  } catch (err) {
    console.error('[api/floors/:id]', err)
    return NextResponse.json({ error: 'Failed to load floor' }, { status: 500 })
  }
}
