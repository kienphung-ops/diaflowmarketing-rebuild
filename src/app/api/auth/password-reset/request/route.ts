/**
 * POST /api/auth/password-reset/request
 *
 * Body: { email: string }
 *
 * Generates a one-time reset link backed by an AuthToken row with
 * type=PASSWORD_RESET. Sends the link via Diaflow email. Always
 * returns 200 (whether the email exists or not) to prevent account
 * enumeration via the public endpoint.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateMagicLinkToken } from '@/lib/auth'
import { buildPasswordResetHtml, sendDiaflowEmail } from '@/lib/diaflowEmail'

export const runtime = 'nodejs'

const TOKEN_TTL_MINUTES = 30

function getOrigin(req: NextRequest): string {
  const origin = req.headers.get('origin')
  if (origin) return origin
  const host = req.headers.get('host')
  if (host) {
    const proto = req.headers.get('x-forwarded-proto') ?? 'https'
    return `${proto}://${host}`
  }
  return new URL(req.url).origin
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Valid email required' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true },
    })

    // Always return success — don't leak whether the email exists.
    if (!user) {
      return NextResponse.json({ success: true })
    }

    // Invalidate older PASSWORD_RESET tokens for this user — only one
    // active reset link at a time.
    await prisma.authToken.updateMany({
      where: { userId: user.id, type: 'PASSWORD_RESET', usedAt: null },
      data: { usedAt: new Date() },
    })

    const link = generateMagicLinkToken()
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MINUTES * 60 * 1000)
    await prisma.authToken.create({
      data: {
        userId: user.id,
        type: 'PASSWORD_RESET',
        tokenHash: link.hash,
        expiresAt,
      },
    })

    const origin = getOrigin(req)
    const resetUrl = `${origin}/reset-password?token=${encodeURIComponent(link.raw)}`

    await sendDiaflowEmail({
      to: user.email,
      subject: 'Reset your Diaflow password',
      html: buildPasswordResetHtml({ resetUrl }),
      devPreview: resetUrl,
    })

    const expose =
      process.env.NODE_ENV !== 'production' || !process.env.DIAFLOW_API_KEY
    return NextResponse.json({
      success: true,
      ...(expose ? { devResetUrl: resetUrl } : {}),
    })
  } catch (err) {
    console.error('[auth/password-reset/request]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
