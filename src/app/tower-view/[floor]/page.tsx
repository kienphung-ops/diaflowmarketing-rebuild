import { readSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getFloorPreview } from '@/lib/towerFloorPreview'
import TowerFloorViewClient from './TowerFloorView.client'

interface Params {
  params: { floor: string }
}

export default async function TowerFloorPage({ params }: Params) {
  // Floor content is public + deterministic; the VIEWER state (signed
  // in? which floor are they on?) is what splits the preview into its
  // climbed / here / locked / pre-login states. Both reads are cheap
  // (catalogue is Redis-cached) and independent, so run them together.
  const [preview, session] = await Promise.all([
    getFloorPreview(params.floor),
    readSession(),
  ])

  let viewerSignedIn = false
  let viewerCurrentFloor = 1
  let viewerTotalInvites = 0
  let viewerReferralCode: string | null = null

  if (session) {
    const me = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { currentFloor: true, totalInvites: true, referralCode: true },
    })
    // A valid-but-stale JWT (user deleted / DB wiped) stays anonymous
    // so we never render signed-in chrome we can't back up.
    if (me) {
      viewerSignedIn = true
      viewerCurrentFloor = me.currentFloor
      viewerTotalInvites = me.totalInvites
      viewerReferralCode = me.referralCode
    }
  }

  return (
    <TowerFloorViewClient
      preview={preview}
      viewerSignedIn={viewerSignedIn}
      viewerCurrentFloor={viewerCurrentFloor}
      viewerTotalInvites={viewerTotalInvites}
      viewerReferralCode={viewerReferralCode}
    />
  )
}

export async function generateMetadata({ params }: Params) {
  const preview = await getFloorPreview(params.floor)
  return {
    title: `Floor ${preview.floor} — ${preview.floorLabel} | Diaflow AI Teammates`,
    description: `Preview Floor ${preview.floor} of the Diaflow AI Teammates. Unlock at ${preview.invitesRequired} invites.`,
  }
}

// Per-viewer state (session, current floor) is resolved at request time,
// so the page can't be statically generated anymore.
export const dynamic = 'force-dynamic'
