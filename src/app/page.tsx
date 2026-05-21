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
          select: { id: true, name: true, role: true, slug: true, isDefault: true, pokes: true },
          orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
        },
        referredBy: {
          select: { referralCode: true, teamName: true, country: true, email: true },
        },
      },
    })
    if (u) {
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
    }
  }

  return (
    <TowerLanding
      currentFloor={currentFloor}
      unlockedItemKeys={unlockedItemKeys}
      referralCode={referralCode}
      totalInvites={totalInvites}
      signedIn={!!session}
      serverRecruits={serverRecruits}
      serverTeamName={serverTeamName}
      serverTeamPurpose={serverTeamPurpose}
      inviter={inviter}
      emailVerified={emailVerified}
      userEmail={userEmail}
      publicVisible={publicVisible}
      serverRecommendedRole={serverRecommendedRole}
      serverReason={serverReason}
    />
  )
}
