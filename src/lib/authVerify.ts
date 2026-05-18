import { prisma } from '@/lib/prisma'
import { computeFloorForInvites, getFloorConfig } from '@/lib/floors'
import { hashOtpForEmail, hashToken } from '@/lib/auth'
import type { TokenType } from '@prisma/client'

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
    if (newFloor > inviter.currentFloor) {
      for (let f = inviter.currentFloor + 1; f <= newFloor; f++) {
        const cfg = getFloorConfig(f)
        if (!cfg) continue
        await tx.unlockedItem.upsert({
          where: { userId_itemKey: { userId: inviter.id, itemKey: cfg.unlockKey } },
          create: { userId: inviter.id, itemKey: cfg.unlockKey, floor: f },
          update: {},
        })
      }
    }
    // Each verified invite mints a new RecruitedTeammate for the inviter,
    // so total teammates = manual recruits + verified invites.
    const teammateCount = await tx.recruitedTeammate.count({ where: { userId: inviter.id } })
    await tx.recruitedTeammate.create({
      data: {
        userId: inviter.id,
        name: `Teammate #${teammateCount + 1}`,
        role: 'Operations Assistant',
      },
    })
  })
}

export async function consumeAuthToken(rawToken: string, type: TokenType, emailHint?: string): Promise<VerifyResult> {
  const tokenHash =
    type === 'OTP' && emailHint
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
    await ensureBaseUnlock(token.user.id)
  }

  await processReferralIfAny(token.user.id, token.user.email)

  return { userId: token.user.id, email: token.user.email }
}

async function ensureBaseUnlock(userId: string): Promise<void> {
  const cfg = getFloorConfig(1)
  if (!cfg) return
  await prisma.unlockedItem.upsert({
    where: { userId_itemKey: { userId, itemKey: cfg.unlockKey } },
    create: { userId, itemKey: cfg.unlockKey, floor: 1 },
    update: {},
  })
}
