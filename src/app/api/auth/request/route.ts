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

function getClientIp(req: NextRequest): string | undefined {
  const xff = req.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  return req.headers.get('x-real-ip') ?? undefined
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

    const ip = getClientIp(req)
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
      user = await prisma.user.create({
        data: {
          email,
          first_email: email,
          referralCode,
          referredByCode: inviter && inviter.referralCode !== referralCode ? inviter.referralCode : null,
          ipAddress: ip,
          teamName: trialTeamName || null,
          teamPurpose: trialTeamPurpose || null,
        },
      })
      isNew = true
    }

    if (isNew && inviter && inviter.id !== user.id) {
      await prisma.inviteEvent.create({
        data: {
          inviterUserId: inviter.id,
          invitedEmail: email,
          invitedUserId: user.id,
          ipAddress: ip,
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
        { userId: user.id, type: 'MAGIC_LINK', tokenHash: magic.hash, expiresAt, ipAddress: ip },
        { userId: user.id, type: 'OTP', tokenHash: otpHash, expiresAt, ipAddress: ip },
      ],
    })

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin
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
