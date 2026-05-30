import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { attachSessionCookie, createSessionJwt } from '@/lib/auth'
import { checkRateLimit, clearRateLimit } from '@/lib/rateLimit'

const MIN_PASSWORD_LEN = 6

function getClientIp(req: NextRequest): string | undefined {
  const xff = req.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  return req.headers.get('x-real-ip') ?? undefined
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const password = typeof body.password === 'string' ? body.password : ''

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Valid email required' }, { status: 400 })
    }
    if (password.length < MIN_PASSWORD_LEN) {
      return NextResponse.json({ error: 'Wrong password' }, { status: 401 })
    }

    // ─── Rate limiting ────────────────────────────────────────────
    // Two layers protect against:
    //   - targeted brute-force on one account (per-email limit, 5
    //     attempts per 15 min)
    //   - distributed/automated guessing from one IP (per-IP limit,
    //     20 attempts per hour)
    // Per-email counter is reset on successful login below so a user
    // who mistypes 3 times then succeeds isn't locked out next time.
    const ip = getClientIp(req)
    const emailKey = `signin-email:${email}`

    const emailRL = await checkRateLimit({ key: emailKey, limit: 5, windowSec: 900 })
    if (!emailRL.allowed) {
      return NextResponse.json(
        { error: 'Too many sign-in attempts for this account. Try again in a few minutes.' },
        { status: 429, headers: { 'Retry-After': String(emailRL.retryAfterSec) } }
      )
    }
    if (ip) {
      const ipRL = await checkRateLimit({ key: `signin-ip:${ip}`, limit: 20, windowSec: 3600 })
      if (!ipRL.allowed) {
        return NextResponse.json(
          { error: 'Too many sign-in attempts from this connection. Try again later.' },
          { status: 429, headers: { 'Retry-After': String(ipRL.retryAfterSec) } }
        )
      }
    }

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      return NextResponse.json({ error: 'No account with that email' }, { status: 404 })
    }
    if (!user.passwordHash) {
      // Legacy magic-link account with no password — refuse login, ask to sign up
      // (which will bind a password if email matches existing). To keep behaviour
      // simple and predictable: explicit "set up password" message.
      return NextResponse.json(
        { error: 'This account has no password yet. Please sign up to set one.' },
        { status: 409 }
      )
    }
    const ok = await bcrypt.compare(password, user.passwordHash)
    if (!ok) {
      return NextResponse.json({ error: 'Wrong password' }, { status: 401 })
    }

    // Success — wipe the per-email rate limit so the user's next
    // session doesn't carry over their pre-success attempt count.
    await clearRateLimit(emailKey)

    const jwt = await createSessionJwt(user.id)
    const res = NextResponse.json({ success: true })
    attachSessionCookie(res, jwt)
    return res
  } catch (err) {
    console.error('[auth/login]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
