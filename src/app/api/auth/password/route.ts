import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import {
  attachSessionCookie,
  createSessionJwt,
  generateReferralCode,
} from '@/lib/auth'
import { computeFloorForInvites } from '@/lib/floors'
import { grantReferralSpinTx, migrateAnonSpin } from '@/lib/spin/service'
import { ANON_COOKIE, clearAnonCookie } from '@/lib/spin/anonCookie'

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

/**
 * Combined sign-up / sign-in via email + password (no email verification).
 * - If email exists with a passwordHash: bcrypt.compare → 200 or 401.
 * - If email exists WITHOUT a passwordHash (legacy magic-link account):
 *   set the password now (first-time bind).
 * - If email doesn't exist: create user, migrate trial state, save country.
 */
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
      return NextResponse.json({ error: `Password must be at least ${MIN_PASSWORD_LEN} characters` }, { status: 400 })
    }

    const ip = getClientIp(req)
    const country = getCountry(req)

    const existing = await prisma.user.findUnique({ where: { email } })

    // Login path
    if (existing) {
      if (existing.passwordHash) {
        const ok = await bcrypt.compare(password, existing.passwordHash)
        if (!ok) {
          return NextResponse.json({ error: 'Wrong password' }, { status: 401 })
        }
      } else {
        // Legacy account: bind a password on first password-based sign-in.
        const hash = await bcrypt.hash(password, BCRYPT_ROUNDS)
        await prisma.user.update({ where: { id: existing.id }, data: { passwordHash: hash } })
      }
      const jwt = await createSessionJwt(existing.id)
      const res = NextResponse.json({ success: true, mode: 'login' })
      attachSessionCookie(res, jwt)
      return res
    }

    // Signup path — create user with trial migration.
    const referralCode = await ensureUniqueReferralCode()
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS)

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
        firstEmail: email,
        passwordHash,
        ipAddress: ip,
        country: country ?? null,
        referralCode,
        referredByCode: inviterCode,
        teamName: trialTeamName || null,
        teamPurpose: trialTeamPurpose || null,
        emailVerified: null, // verify later (optional)
      },
    })

    // Floor-1 items are implicit (every user defaults to currentFloor=1
    // and items are derived from FloorItem at read time). No per-user
    // row needed.

    // Credit the inviter for this new sign-up (mirrors authVerify.processReferralIfAny).
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
          // Items cascade automatically via FloorItem when currentFloor
          // changes; nothing else to write here.
          const teammateCount = await tx.recruitedTeammate.count({ where: { userId: inviter.id } })
          await tx.recruitedTeammate.create({
            data: {
              userId: inviter.id,
              name: `Teammate #${teammateCount + 1}`,
              role: 'Operations Assistant',
            },
          })
          // +1 spin for the inviter, same transaction as the floor / invite
          // bump so the credit can't drift out of step with the invite.
          await grantReferralSpinTx(tx, inviter.id)
        })
      }
    }

    // Migrate this browser's anonymous teaser spin onto the freshly-
    // created account (best-effort; never blocks signup).
    const anonId = req.cookies.get(ANON_COOKIE)?.value
    let anonCookieFound = false
    if (anonId) {
      try {
        const r = await migrateAnonSpin(user.id, anonId)
        anonCookieFound = r.cookieFound
      } catch (e) {
        console.warn('[auth/password] anon spin migrate failed:', (e as Error).message)
      }
    }

    const jwt = await createSessionJwt(user.id)
    const res = NextResponse.json({ success: true, mode: 'signup' })
    attachSessionCookie(res, jwt)
    // Evict diaflow_anon_id post-migration so a later signup on the
    // same browser doesn't see a stale (already-claimed) cookie.
    if (anonCookieFound) clearAnonCookie(res)
    return res
  } catch (err) {
    console.error('[auth/password]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
