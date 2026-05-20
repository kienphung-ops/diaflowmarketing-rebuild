/**
 * POST /api/auth/send-verification
 *
 * For the currently-signed-in user: generate a 6-digit OTP, store its
 * hash in AuthToken with type=EMAIL_VERIFY, and email it via Diaflow.
 * No-ops (200 success) if the user is already verified, so the client
 * can call this idempotently without leaking verification state to
 * unauthenticated probes.
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  generateOtpCode,
  hashOtpForEmail,
  readSession,
  TOKEN_TTL_MINUTES,
} from '@/lib/auth'
import { buildVerifyEmailHtml, sendDiaflowEmail } from '@/lib/diaflowEmail'

export const runtime = 'nodejs'

export async function POST() {
  const session = await readSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { email: true, emailVerified: true },
  })
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (user.emailVerified) {
    // Already verified — return 200 so the client doesn't expose this
    // as a probe signal but does nothing further.
    return NextResponse.json({ success: true, alreadyVerified: true })
  }

  // Generate fresh OTP. The hash is salted with the user's email so
  // two users with the same 6-digit code don't collide on AuthToken.tokenHash.
  const otp = generateOtpCode()
  const tokenHash = hashOtpForEmail(user.email, otp)
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MINUTES * 60 * 1000)

  // Invalidate any previous unused EMAIL_VERIFY tokens for this user
  // (so an old code can't compete with the new one).
  await prisma.authToken.updateMany({
    where: { userId: session.userId, type: 'EMAIL_VERIFY', usedAt: null },
    data: { usedAt: new Date() },
  })

  await prisma.authToken.create({
    data: {
      userId: session.userId,
      type: 'EMAIL_VERIFY',
      tokenHash,
      expiresAt,
    },
  })

  await sendDiaflowEmail({
    to: user.email,
    subject: 'Verify your Diaflow email',
    html: buildVerifyEmailHtml({ otp }),
    devPreview: `OTP: ${otp}`,
  })

  // Dev helper — surface the OTP in the response when Diaflow API
  // isn't configured, so local testing works.
  const expose =
    process.env.NODE_ENV !== 'production' || !process.env.DIAFLOW_API_KEY
  return NextResponse.json({
    success: true,
    ...(expose ? { devOtp: otp } : {}),
  })
}
