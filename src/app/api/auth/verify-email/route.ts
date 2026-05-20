/**
 * POST /api/auth/verify-email
 *
 * Body: { otp: string }
 *
 * Validates the 6-digit OTP against an unused EMAIL_VERIFY token for
 * the signed-in user. On success: marks the token used + sets
 * User.emailVerified = now().
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hashOtpForEmail, readSession } from '@/lib/auth'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const session = await readSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const otp = typeof body.otp === 'string' ? body.otp.trim() : ''
  if (!/^\d{6}$/.test(otp)) {
    return NextResponse.json({ error: 'Enter the 6-digit code' }, { status: 400 })
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { email: true, emailVerified: true },
  })
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (user.emailVerified) {
    return NextResponse.json({ success: true, alreadyVerified: true })
  }

  const tokenHash = hashOtpForEmail(user.email, otp)
  const token = await prisma.authToken.findFirst({
    where: {
      userId: session.userId,
      type: 'EMAIL_VERIFY',
      tokenHash,
      usedAt: null,
    },
  })

  if (!token) {
    return NextResponse.json({ error: 'Invalid or expired code' }, { status: 400 })
  }
  if (token.expiresAt < new Date()) {
    return NextResponse.json({ error: 'Code expired — request a new one' }, { status: 400 })
  }

  await prisma.$transaction([
    prisma.authToken.update({
      where: { id: token.id },
      data: { usedAt: new Date() },
    }),
    prisma.user.update({
      where: { id: session.userId },
      data: { emailVerified: new Date() },
    }),
  ])

  return NextResponse.json({ success: true })
}
