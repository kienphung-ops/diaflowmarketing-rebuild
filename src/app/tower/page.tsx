import { readSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import TowerPageClient from './TowerPage.client'
import { maskEmail, type InviterInfo } from '@/lib/inviter'

/**
 * `/tower` — whole-building view.
 *
 * Anyone can visit. The YOU marker (and personal stats) only renders for
 * authenticated visitors with a valid JWT session — see TowerView.tsx for
 * the auth gate. Anonymous visitors see the tower image + a "Sign in" CTA.
 */
export default async function TowerRoute() {
  const session = await readSession()

  let currentFloor = 1
  let totalInvites = 0
  let teamName: string | null = null
  let referralCode: string | null = null
  let serverRecruits: { id: string; name: string; role: string; slug?: string | null; isDefault?: boolean; pokes?: number }[] = []
  let inviter: InviterInfo | null = null
  let userEmail: string | null = null
  let emailVerified = false
  // Treat a JWT-valid-but-user-missing token as anonymous so the
  // signed-in chrome (Sign-out link, etc.) doesn't leak. See
  // src/app/page.tsx for the same fix.
  let userResolved = false

  if (session) {
    const u = await prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        email: true,
        emailVerified: true,
        currentFloor: true,
        totalInvites: true,
        teamName: true,
        referralCode: true,
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
      userResolved = true
      userEmail = u.email
      emailVerified = !!u.emailVerified
      currentFloor = u.currentFloor
      totalInvites = u.totalInvites
      teamName = u.teamName
      referralCode = u.referralCode
      serverRecruits = u.recruitedTeams
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
    <TowerPageClient
      signedIn={userResolved}
      currentFloor={currentFloor}
      totalInvites={totalInvites}
      teamName={teamName}
      referralCode={referralCode}
      serverRecruits={serverRecruits}
      inviter={inviter}
      userEmail={userEmail}
      emailVerified={emailVerified}
    />
  )
}
