import { readSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import TowerLanding from './TowerLanding.client'
import { maskEmail, type InviterInfo } from '@/lib/inviter'
import { getUnlockedItemsForFloor } from '@/lib/floorsDb'

export default async function Home() {
  const session = await readSession()

  let currentFloor = 1
  let unlockedItemKeys: string[] = ['company_picture_frame']
  let referralCode: string | null = null
  let totalInvites = 0
  let serverRecruits: { id: string; name: string; role: string }[] = []

  let serverTeamName: string | null = null
  let serverTeamPurpose: string | null = null
  let serverRecommendedRole: string | null = null
  let serverReason: string | null = null
  let inviter: InviterInfo | null = null
  let emailVerified = false
  let userEmail: string | null = null
  let publicVisible = false
  // Per-user item position overrides (Arrange-your-room feature).
  // Empty `{}` falls through to the canonical defaults in FloorItems.
  let serverItemPositions: Record<string, [number, number, number]> = {}
  // Separate per-user layout for the mobile 2D scene.
  let serverItemPositions2D: Record<string, [number, number, number]> = {}

  // Track whether the session JWT actually resolves to an existing
  // user row. A valid JWT can still point to a deleted / wiped user
  // (stale token after a DB reset, manually-deleted account). When
  // that happens we treat the request as anonymous so the UI doesn't
  // leak signed-in chrome — most notably the Sign-out link in the
  // MySquadDrawer — for someone who can't actually do anything with
  // it. (`session` alone isn't enough; we need `u` too.)
  let userResolved = false

  if (session) {
    const u = await prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        email: true,
        emailVerified: true,
        publicVisible: true,
        currentFloor: true,
        referralCode: true,
        totalInvites: true,
        teamName: true,
        teamPurpose: true,
        recommendedRole: true,
        reason: true,
        referredAt: true,
        recruitedTeams: {
          select: { id: true, name: true, role: true, slug: true, isDefault: true, pokes: true, description: true },
          orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
        },
        referredBy: {
          select: { referralCode: true, teamName: true, country: true, email: true },
        },
        // Per-user "Arrange your room" overrides — see User.itemPositions
        // comment in schema.prisma for the shape.
        itemPositions: true,
        itemPositions2D: true,
      },
    })
    if (u) {
      userResolved = true
      userEmail = u.email
      emailVerified = !!u.emailVerified
      publicVisible = u.publicVisible
      currentFloor = u.currentFloor
      referralCode = u.referralCode
      totalInvites = u.totalInvites
      const unlocked = await getUnlockedItemsForFloor(u.currentFloor)
      unlockedItemKeys = unlocked.map(i => i.itemKey)
      if (unlockedItemKeys.length === 0) unlockedItemKeys = ['company_picture_frame']
      serverRecruits = u.recruitedTeams
      serverTeamName = u.teamName
      serverTeamPurpose = u.teamPurpose
      serverRecommendedRole = u.recommendedRole
      serverReason = u.reason
      if (u.referredBy) {
        inviter = {
          referralCode: u.referredBy.referralCode,
          teamName: u.referredBy.teamName,
          country: u.referredBy.country,
          emailMasked: maskEmail(u.referredBy.email),
          invitedAt: u.referredAt ? u.referredAt.toISOString() : null,
        }
      }
      // Coerce Prisma's `JsonValue` into our expected shape. Anything
      // weird becomes an empty map (renderer falls back to defaults).
      if (u.itemPositions && typeof u.itemPositions === 'object' && !Array.isArray(u.itemPositions)) {
        serverItemPositions = u.itemPositions as Record<string, [number, number, number]>
      }
      if (u.itemPositions2D && typeof u.itemPositions2D === 'object' && !Array.isArray(u.itemPositions2D)) {
        serverItemPositions2D = u.itemPositions2D as Record<string, [number, number, number]>
      }
    }
  }

  return (
    <TowerLanding
      currentFloor={currentFloor}
      unlockedItemKeys={unlockedItemKeys}
      referralCode={referralCode}
      totalInvites={totalInvites}
      signedIn={userResolved}
      serverRecruits={serverRecruits}
      serverTeamName={serverTeamName}
      serverTeamPurpose={serverTeamPurpose}
      inviter={inviter}
      emailVerified={emailVerified}
      userEmail={userEmail}
      publicVisible={publicVisible}
      serverRecommendedRole={serverRecommendedRole}
      serverReason={serverReason}
      serverItemPositions={serverItemPositions}
      serverItemPositions2D={serverItemPositions2D}
    />
  )
}
