import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import {
  attachSessionCookie,
  createSessionJwt,
  generateReferralCode,
} from '@/lib/auth'
import { computeFloorForInvites, getFloorConfig } from '@/lib/floors'
import { invalidateLeaderboard } from '@/lib/leaderboard'
import { seedDefaultTeammates } from '@/lib/defaultTeammates'

const BCRYPT_ROUNDS = 10
const MIN_PASSWORD_LEN = 6

function getClientIp(req: NextRequest): string | undefined {
  const xff = req.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  return req.headers.get('x-real-ip') ?? undefined
}

function getCountry(req: NextRequest): string | undefined {
  return req.headers.get('x-vercel-ip-country') ?? undefined
}

async function ensureUniqueReferralCode(): Promise<string> {
  for (let i = 0; i < 8; i++) {
    const code = generateReferralCode()
    const existing = await prisma.user.findUnique({ where: { referralCode: code }, select: { id: true } })
    if (!existing) return code
  }
  throw new Error('Failed to allocate unique referral code')
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const password = typeof body.password === 'string' ? body.password : ''
    const ref = typeof body.ref === 'string' ? body.ref.trim().toUpperCase() : ''
    const trialTeamName = typeof body.trialTeamName === 'string' ? body.trialTeamName.trim().slice(0, 60) : ''
    const trialTeamPurpose = typeof body.trialTeamPurpose === 'string' ? body.trialTeamPurpose.trim().slice(0, 240) : ''

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Valid email required' }, { status: 400 })
    }
    if (password.length < MIN_PASSWORD_LEN) {
      return NextResponse.json(
        { error: `Password must be at least ${MIN_PASSWORD_LEN} characters` },
        { status: 400 }
      )
    }

    const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } })
    if (existing) {
      return NextResponse.json(
        { error: 'An account with that email already exists. Sign in instead.' },
        { status: 409 }
      )
    }

    const ip = getClientIp(req)
    const country = getCountry(req)
    const referralCode = await ensureUniqueReferralCode()
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS)

    // Resolve inviter from the ?ref= code, if any. The 409 guard above
    // already ensures we never reach this branch for an existing user, so
    // `referredByCode` + `referredAt` are sealed exactly once — at create
    // time — and can never be overwritten by a later sign-up attempt.
    let inviterId: string | null = null
    let inviterCode: string | null = null
    if (ref) {
      const inviter = await prisma.user.findUnique({
        where: { referralCode: ref },
        select: { id: true, referralCode: true },
      })
      if (inviter) {
        inviterId = inviter.id
        inviterCode = inviter.referralCode
      }
    }

    const user = await prisma.user.create({
      data: {
        email,
        first_email : email,
        passwordHash,
        ipAddress: ip,
        country: country ?? null,
        referralCode,
        referredByCode: inviterCode,
        referredAt: inviterCode ? new Date() : null,
        teamName: trialTeamName || null,
        teamPurpose: trialTeamPurpose || null,
        emailVerified: null,
      },
    })

    // Seed Floor-1 base unlock.
    const baseCfg = getFloorConfig(1)
    if (baseCfg) {
      await prisma.unlockedItem.upsert({
        where: { userId_itemKey: { userId: user.id, itemKey: baseCfg.unlockKey } },
        create: { userId: user.id, itemKey: baseCfg.unlockKey, floor: 1 },
        update: {},
      })
    }

    // Seed the 3 default NPCs (Iris/Mia/Leo) as DB-backed teammates
    // so their poke counters persist and the share-floor view shows
    // a consistent line-up for every user.
    await seedDefaultTeammates(user.id)

    // Credit inviter for this signup.
    if (inviterId && inviterId !== user.id) {
      const inviter = await prisma.user.findUnique({
        where: { id: inviterId },
        select: { id: true, totalInvites: true, currentFloor: true },
      })
      if (inviter) {
        const newTotal = inviter.totalInvites + 1
        const newFloor = computeFloorForInvites(newTotal)
        await prisma.$transaction(async tx => {
          await tx.inviteEvent.create({
            data: {
              inviterUserId: inviter.id,
              invitedEmail: email,
              invitedUserId: user.id,
              ipAddress: ip,
              userAgent: req.headers.get('user-agent') ?? undefined,
              verified: true,
            },
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
          // Note: inviter must add teammates manually via bulk-add modal —
          // no auto-recruit row here.
        })
        // Leaderboard ranking changed for inviter — bust the cache so
        // the next /api/leaderboard call returns the updated row.
        await invalidateLeaderboard(inviter.id, user.id)
      }
    } else {
      // Fresh signup with no referral — still drop top50 (a new bottom
      // entry might matter when the leaderboard is sparse).
      await invalidateLeaderboard(user.id)
    }

    const jwt = await createSessionJwt(user.id)
    const res = NextResponse.json({ success: true })
    attachSessionCookie(res, jwt)
    return res
  } catch (err) {
    console.error('[auth/signup]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
