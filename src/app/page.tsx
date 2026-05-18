import { readSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import TowerLanding from './TowerLanding.client'

export default async function Home() {
  const session = await readSession()

  let currentFloor = 1
  let unlockedItemKeys: string[] = ['company_picture_frame']
  let referralCode: string | null = null
  let totalInvites = 0
  let serverRecruits: { id: string; name: string; role: string }[] = []

  let serverTeamName: string | null = null
  let serverTeamPurpose: string | null = null

  if (session) {
    const u = await prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        currentFloor: true,
        referralCode: true,
        totalInvites: true,
        teamName: true,
        teamPurpose: true,
        unlockedItems: { select: { itemKey: true } },
        recruitedTeams: { select: { id: true, name: true, role: true }, orderBy: { createdAt: 'asc' } },
      },
    })
    if (u) {
      currentFloor = u.currentFloor
      referralCode = u.referralCode
      totalInvites = u.totalInvites
      unlockedItemKeys = u.unlockedItems.map(i => i.itemKey)
      if (unlockedItemKeys.length === 0) unlockedItemKeys = ['company_picture_frame']
      serverRecruits = u.recruitedTeams
      serverTeamName = u.teamName
      serverTeamPurpose = u.teamPurpose
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
    />
  )
}
