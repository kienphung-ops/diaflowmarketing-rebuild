import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { readSession } from '@/lib/auth'
import { maskEmail } from '@/lib/inviter'
import { getUnlockedItemsForFloor } from '@/lib/floorsDb'

export async function GET() {
  const session = await readSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      email: true,
      emailVerified: true,
      referralCode: true,
      referredByCode: true,
      referredAt: true,
      totalInvites: true,
      currentFloor: true,
      teamName: true,
      teamPurpose: true,
      // Diaflow-derived role recommendation — surfaced to the client so
      // MiaInfoBubble / future personalisation panels can render the
      // role + reason without a separate fetch. Null when the user
      // hasn't gone through onboarding (or upstream call failed); the
      // TowerLanding backfill effect retries when these are missing.
      recommendedRole: true,
      reason: true,
      // Inviter info via self-relation. `referredBy` is null when the user
      // signed up without a referral link.
      referredBy: {
        select: {
          referralCode: true,
          teamName: true,
          country: true,
          email: true,
        },
      },
    },
  })

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Items derived from FloorItem cumulative join — replaces the dropped
  // UnlockedItem per-user table. Same `{ itemKey, floor }[]` shape as
  // before so clients (useFloorPolling, MySquadDrawer) don't notice.
  const unlockedItems = await getUnlockedItemsForFloor(user.currentFloor)

  // Sanitize inviter for client — never expose the full email address,
  // only a masked preview so the recipient knows roughly who invited them.
  const inviter = user.referredBy
    ? {
        referralCode: user.referredBy.referralCode,
        teamName: user.referredBy.teamName,
        country: user.referredBy.country,
        emailMasked: maskEmail(user.referredBy.email),
        invitedAt: user.referredAt,
      }
    : null

  // Drop the raw `referredBy` blob from the response so the inviter's
  // full email never leaks to the client.
  const { referredBy: _drop, ...safe } = user
  void _drop
  return NextResponse.json({ ...safe, unlockedItems, inviter })
}
