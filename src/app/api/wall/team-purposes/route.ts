import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireApiKey } from '@/lib/apiKey'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/wall/team-purposes  (x-api-key protected)
 *
 * Raw export of every user's `teamPurpose` — the input for the daily
 * "Who's building" refresh. Run these through AI to bucket + tally into
 * percentages, then PUT the result to /api/wall/roles.
 *
 * Returns the non-empty purposes only (duplicates kept, so a naive
 * count gives the true distribution):
 *   { teamPurposes: string[], count: number }
 */
export async function GET(req: NextRequest) {
  const denied = requireApiKey(req)
  if (denied) return denied

  const rows = await prisma.user.findMany({
    where: { teamPurpose: { not: null } },
    select: { teamPurpose: true },
  })

  const teamPurposes = rows
    .map(r => r.teamPurpose?.trim())
    .filter((p): p is string => !!p && p.length > 0)

  return NextResponse.json(
    { teamPurposes, count: teamPurposes.length },
    { headers: { 'cache-control': 'no-store' } },
  )
}
