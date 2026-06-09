import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  generateMagicLinkToken,
  generateOtpCode,
  generateReferralCode,
  hashOtpForEmail,
  TOKEN_TTL_MINUTES,
} from '@/lib/auth'
import { sendAuthEmail } from '@/lib/email'
import { TOKEN_TYPES } from '@/lib/authToken'
import { checkRateLimit } from '@/lib/rateLimit'

// IP is used ONLY as a transient rate-limit key (Redis), never stored.
function getClientIp(req: NextRequest): string | undefined {
  const xff = req.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  return req.headers.get('x-real-ip') ?? undefined
}

/**
 * Derive the public URL the browser is currently on. We prefer the
 * `Origin` header (browsers set it automatically on POST per the Fetch
 * spec) so the magic link always points back to the same domain the user
 * is visiting — `diaflow.io`, a preview deploy, or `localhost:3000` —
 * without needing a `NEXT_PUBLIC_APP_URL` env variable to be kept in sync.
 *
 * Falls back to `x-forwarded-proto` + `host` (works behind reverse
 * proxies) and finally to the request URL itself.
 */
function getBrowserOrigin(req: NextRequest): string {
  // `NEXT_PUBLIC_SITE_URL` is the authoritative override — magic
  // link URLs get baked into outbound emails, so a localhost
  // fallback here lands an unclickable link in the user's inbox.
  // Same rationale + chain as the password-reset request route.
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (fromEnv) return fromEnv
  const origin = req.headers.get('origin')
  if (origin) return origin
  const host = req.headers.get('host')
  if (host) {
    const proto = req.headers.get('x-forwarded-proto') ?? 'https'
    return `${proto}://${host}`
  }
  return new URL(req.url).origin
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
    const ref = typeof body.ref === 'string' ? body.ref.trim().toUpperCase() : ''
    const trialTeamName = typeof body.trialTeamName === 'string' ? body.trialTeamName.trim().slice(0, 60) : ''
    const trialTeamPurpose = typeof body.trialTeamPurpose === 'string' ? body.trialTeamPurpose.trim().slice(0, 240) : ''

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Valid email required' }, { status: 400 })
    }

    // Anti-abuse: this endpoint sends an email (magic link + OTP) on every
    // call, so throttle BEFORE doing any work. Per-email stops flooding one
    // inbox; per-IP stops one client blasting many addresses.
    const ip = getClientIp(req)
    const emailRL = await checkRateLimit({ key: `magiclink-email:${email}`, limit: 3, windowSec: 900 })
    if (!emailRL.allowed) {
      return NextResponse.json(
        { error: 'Too many sign-in emails for this address. Try again in a few minutes.' },
        { status: 429, headers: { 'Retry-After': String(emailRL.retryAfterSec) } },
      )
    }
    if (ip) {
      const ipRL = await checkRateLimit({ key: `magiclink-ip:${ip}`, limit: 15, windowSec: 3600 })
      if (!ipRL.allowed) {
        return NextResponse.json(
          { error: 'Too many requests from this connection. Try again later.' },
          { status: 429, headers: { 'Retry-After': String(ipRL.retryAfterSec) } },
        )
      }
    }

    const userAgent = req.headers.get('user-agent') ?? undefined

    let inviter = null as { id: string; referralCode: string } | null
    if (ref) {
      const found = await prisma.user.findUnique({
        where: { referralCode: ref },
        select: { id: true, referralCode: true },
      })
      if (found) inviter = found
    }

    const existingUser = await prisma.user.findUnique({ where: { email } })
    let user = existingUser
    let isNew = false

    if (!user) {
      const referralCode = await ensureUniqueReferralCode()
      const inviterCode = inviter && inviter.referralCode !== referralCode ? inviter.referralCode : null
      user = await prisma.user.create({
        data: {
          email,
          firstEmail: email,
          referralCode,
          // Inviter lock — referredByCode + referredAt are sealed exactly
          // once, here at user-creation time. Below, we deliberately skip
          // setting them on the existing-user branch so a later invite
          // link can never overwrite the original inviter.
          referredByCode: inviterCode,
          referredAt: inviterCode ? new Date() : null,
          teamName: trialTeamName || null,
          teamPurpose: trialTeamPurpose || null,
        },
      })
      isNew = true
    }

    // Defensive guard — for an existing user, never create a fresh
    // InviteEvent under a new inviter. The user's `referredByCode` is the
    // source of truth; once set it is immutable. Also skip event creation
    // when the visitor is trying to invite themselves.
    if (isNew && inviter && inviter.id !== user.id) {
      await prisma.inviteEvent.create({
        data: {
          inviterUserId: inviter.id,
          invitedEmail: email,
          invitedUserId: user.id,
          userAgent,
          verified: false,
        },
      })
    }

    const magic = generateMagicLinkToken()
    const otpCode = generateOtpCode()
    const otpHash = hashOtpForEmail(email, otpCode)
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MINUTES * 60 * 1000)

    await prisma.authToken.createMany({
      data: [
        { userId: user.id, type: TOKEN_TYPES.MAGIC_LINK, tokenHash: magic.hash, expiresAt },
        { userId: user.id, type: TOKEN_TYPES.OTP, tokenHash: otpHash, expiresAt},
      ],
    })

    const appUrl = getBrowserOrigin(req)
    const magicLinkUrl = `${appUrl}/api/auth/verify?token=${encodeURIComponent(magic.raw)}`

    await sendAuthEmail({ to: email, magicLinkUrl, otp: otpCode })

    // Dev helper: when email service isn't configured (no RESEND_API_KEY) or
    // when running in development, surface the magic-link URL + OTP code in
    // the JSON response so the client can show them in the UI for testing.
    const expose =
      process.env.NODE_ENV !== 'production' || !process.env.RESEND_API_KEY
    return NextResponse.json({
      success: true,
      ...(expose ? { devMagicLinkUrl: magicLinkUrl, devOtp: otpCode } : {}),
    })
  } catch (err) {
    console.error('[auth/request]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
