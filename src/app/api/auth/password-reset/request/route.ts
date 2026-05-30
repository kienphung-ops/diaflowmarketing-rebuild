/**
 * POST /api/auth/password-reset/request
 *
 * Body: { email: string }
 *
 * Generates a one-time reset link backed by an AuthToken row with
 * type=PASSWORD_RESET, then fires the `diaflow-tower` event in
 * Klaviyo (with `type: forgot_password`) so the configured Flow
 * delivers the reset-link email. Always returns 200 (whether the
 * email exists or not) to prevent account enumeration via the
 * public endpoint.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateMagicLinkToken } from '@/lib/auth'
import { trackKlaviyoEvent, KlaviyoEvent, KlaviyoEventType } from '@/lib/klaviyo'
import { TOKEN_TYPES } from '@/lib/authToken'

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
      where: { userId: user.id, type: TOKEN_TYPES.PASSWORD_RESET, usedAt: null },
      data: { usedAt: new Date() },
    })

    const link = generateMagicLinkToken()
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MINUTES * 60 * 1000)
    await prisma.authToken.create({
      data: {
        userId: user.id,
        type: TOKEN_TYPES.PASSWORD_RESET,
        tokenHash: link.hash,
        expiresAt,
      },
    })

    const origin = getOrigin(req)
    const resetUrl = `${origin}/reset-password?token=${encodeURIComponent(link.raw)}`

    // Fire the Klaviyo event — the actual email is templated + sent
    // by the Flow configured in Klaviyo against the `diaflow-tower`
    // metric with a filter on `event.type == "forgot_password"`. The
    // Flow's email template references `{{ event.resetUrl }}` and
    // `{{ event.expiresInMinutes }}`. `trackKlaviyoEvent` is best-
    // effort (never throws), so a Klaviyo outage doesn't change the
    // response — we still return success to avoid leaking whether
    // the request was actually mailed.
    await trackKlaviyoEvent({
      metricName: KlaviyoEvent.METRIC,
      profile: { email: user.email },
      properties: {
        type: KlaviyoEventType.FORGOT_PASSWORD,
        resetUrl,
        expiresInMinutes: TOKEN_TTL_MINUTES,
      },
      // Dedupe key — Klaviyo treats retries of the same reset link as
      // the same event, so a flaky network can't double-mail one user.
      uniqueId: `forgot_password:${user.id}:${link.hash}`,
    })

    // Dev helper — surface the reset URL in the response when Klaviyo
    // isn't configured, so local testing works without a real inbox.
    const expose =
      process.env.NODE_ENV !== 'production' || !process.env.KLAVIYO_PRIVATE_API_KEY
    return NextResponse.json({
      success: true,
      ...(expose ? { devResetUrl: resetUrl } : {}),
    })
  } catch (err) {
    console.error('[auth/password-reset/request]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
