/**
 * GET /api/floor/[code]
 *
 * Public snapshot of a shared floor, keyed by the owner's referral
 * code (which is already public). The client polls this every couple
 * of seconds for "real-time" poke updates without needing a websocket.
 *
 * Returns 404 when the floor is private — same status as an unknown
 * code, so existence isn't probeable.
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUnlockedItemsForFloor } from '@/lib/floorsDb'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: { code: string } }) {
  const code = params.code?.toUpperCase()
  if (!code) return NextResponse.json({ error: 'Missing code' }, { status: 400 })

  const user = await prisma.user.findUnique({
    where: { referralCode: code },
    select: {
      id: true,
      teamName: true,
      currentFloor: true,
      totalInvites: true,
      recruitedTeams: {
        select: { id: true, slug: true, name: true, role: true, pokes: true, isDefault: true },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
      },
    },
  })

  // Privacy gate was removed when invite + share URLs were unified —
  // every valid referral code resolves now. Only 404 on truly
  // unknown codes.
  if (!user) {
    return NextResponse.json({ error: 'Floor not found' }, { status: 404 })
  }

  const unlocked = await getUnlockedItemsForFloor(user.currentFloor)
  let unlockedItemKeys = unlocked.map(i => i.itemKey)
  if (unlockedItemKeys.length === 0) unlockedItemKeys = ['company_picture_frame']

  return NextResponse.json(
    {
      ownerId: user.id,
      teamName: user.teamName,
      currentFloor: user.currentFloor,
      totalInvites: user.totalInvites,
      unlockedItemKeys,
      teammates: user.recruitedTeams,
    },
    {
      headers: {
        // Quick stale-while-revalidate hint — clients refetch every 2s
        // anyway; this just guards against the dev server caching too
        // aggressively.
        'cache-control': 'no-store',
      },
    }
  )
}
