import { prisma } from '@/lib/prisma'
import { computeFloorForInvites } from '@/lib/floors'
import { hashOtpForEmail, hashToken } from '@/lib/auth'
import { invalidateLeaderboard } from '@/lib/leaderboard'
import { TOKEN_TYPES } from '@/lib/authToken'

export interface VerifyResult {
  userId: string
  email: string
}

export class AuthVerifyError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AuthVerifyError'
  }
}

async function processReferralIfAny(userId: string, email: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { referredByCode: true },
  })
  if (!user || !user.referredByCode) return

  const inviter = await prisma.user.findUnique({
    where: { referralCode: user.referredByCode },
    select: { id: true, totalInvites: true, currentFloor: true },
  })
  if (!inviter || inviter.id === userId) return

  const pending = await prisma.inviteEvent.findFirst({
    where: { inviterUserId: inviter.id, invitedEmail: email, verified: false },
    orderBy: { createdAt: 'desc' },
  })
  if (!pending) return

  const newTotal = inviter.totalInvites + 1
  const newFloor = computeFloorForInvites(newTotal)

  await prisma.$transaction(async tx => {
    await tx.inviteEvent.update({
      where: { id: pending.id },
      data: { verified: true, invitedUserId: userId },
    })
    await tx.user.update({
      where: { id: inviter.id },
      data: { totalInvites: newTotal, currentFloor: newFloor },
    })
    // No per-user item rows anymore — items cascade from FloorItem
    // automatically when `currentFloor` changes. Teammates are also
    // user-managed via the bulk-add modal (slots open up based on
    // Floor.maxTeammates).
  })

  // Inviter's totalInvites just went up — invalidate cached top50 +
  // their rank so /api/leaderboard reflects the change immediately.
  await invalidateLeaderboard(inviter.id, userId)
}

export async function consumeAuthToken(rawToken: string, type: TOKEN_TYPES, emailHint?: string): Promise<VerifyResult> {
  const tokenHash =
    type === TOKEN_TYPES.OTP && emailHint
      ? hashOtpForEmail(emailHint, rawToken)
      : hashToken(rawToken)

  const token = await prisma.authToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  })

  if (!token) throw new AuthVerifyError('Invalid token')
  if (token.type !== type) throw new AuthVerifyError('Invalid token type')
  if (token.usedAt) throw new AuthVerifyError('Token already used')
  if (token.expiresAt < new Date()) throw new AuthVerifyError('Token expired')

  if (emailHint && token.user.email !== emailHint) {
    throw new AuthVerifyError('Invalid token')
  }

  await prisma.authToken.update({
    where: { id: token.id },
    data: { usedAt: new Date() },
  })

  if (!token.user.emailVerified) {
    await prisma.user.update({
      where: { id: token.user.id },
      data: { emailVerified: new Date() },
    })
    // Floor-1 base unlock used to seed an UnlockedItem row here. Items
    // are now derived from FloorItem, so this is implicit — every user
    // is on floor ≥ 1 by default and sees floor-1 items automatically.
  }

  await processReferralIfAny(token.user.id, token.user.email)

  return { userId: token.user.id, email: token.user.email }
}
