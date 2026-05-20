import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import FloorVisitorClient from './FloorVisitor.client'

/**
 * /floor/[code] — public shared floor.
 *
 * `code` is the owner's referral code (already a public identifier).
 * If the user isn't public the page 404s — matching the API behaviour
 * so existence isn't probeable.
 */
export default async function FloorPage({ params }: { params: { code: string } }) {
  const code = params.code?.toUpperCase()
  if (!code) notFound()

  const owner = await prisma.user.findUnique({
    where: { referralCode: code },
    select: {
      id: true,
      teamName: true,
      currentFloor: true,
      totalInvites: true,
      publicVisible: true,
      unlockedItems: { select: { itemKey: true } },
      recruitedTeams: {
        select: { id: true, slug: true, name: true, role: true, pokes: true, isDefault: true },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
      },
    },
  })

  if (!owner || !owner.publicVisible) notFound()

  let unlockedItemKeys = owner.unlockedItems.map(i => i.itemKey)
  if (unlockedItemKeys.length === 0) unlockedItemKeys = ['company_picture_frame']

  return (
    <FloorVisitorClient
      code={code}
      teamName={owner.teamName}
      currentFloor={owner.currentFloor}
      totalInvites={owner.totalInvites}
      unlockedItemKeys={unlockedItemKeys}
      teammates={owner.recruitedTeams}
    />
  )
}

export const dynamic = 'force-dynamic'
