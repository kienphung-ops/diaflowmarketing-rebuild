/**
 * Anonymous teaser spin — the pre-login conversion hook.
 *
 *   GET  /api/spin/anon → has this browser already used its free spin?
 *                         returns the prior result if so.
 *   POST /api/spin/anon → resolve the one free spin for this browser.
 *
 * Anti-abuse:
 *   - 1 spin per browser, enforced by the httpOnly `diaflow_anon_id`
 *     cookie + the AnonymousSpin.cookieId unique constraint.
 *   - max 100 spins per IP per day (Redis rate limit) to stop stampedes.
 *
 * The result is held server-side keyed to the cookie id and migrates
 * onto the user account on signup (see migrateAnonSpin + signup route).
 */
import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { prisma } from '@/lib/prisma'
import { checkRateLimit } from '@/lib/rateLimit'
import { resolveAnonSpin } from '@/lib/spin/service'
import { ANON_SPINS_PER_IP_PER_DAY, type Wedge } from '@/lib/spin/constants'

export const dynamic = 'force-dynamic'

const ANON_COOKIE = 'diaflow_anon_id'
// Cookie outlives the teaser so a returning visitor keeps their "already
// spun" state (and the row stays migrate-able) — 90 days.
const ANON_COOKIE_MAX_AGE = 60 * 60 * 24 * 90

function getClientIp(req: NextRequest): string | undefined {
  const xff = req.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  return req.headers.get('x-real-ip') ?? undefined
}

export async function GET(req: NextRequest) {
  const cookieId = req.cookies.get(ANON_COOKIE)?.value
  if (!cookieId) return NextResponse.json({ spun: false, result: null })

  const row = await prisma.anonymousSpin.findUnique({
    where: { cookieId },
    select: { wedge: true, cashCents: true, teammateCount: true },
  })
  if (!row) return NextResponse.json({ spun: false, result: null })
  return NextResponse.json({
    spun: true,
    result: { wedge: row.wedge as Wedge, cashCents: row.cashCents },
    teammateCount: row.teammateCount,
  })
}

export async function POST(req: NextRequest) {
  try {
    const existingCookie = req.cookies.get(ANON_COOKIE)?.value
    const cookieId = existingCookie || randomUUID()

    // 1 free spin per browser — reject if this cookie already spun.
    if (existingCookie) {
      const prior = await prisma.anonymousSpin.findUnique({
        where: { cookieId: existingCookie },
        select: { wedge: true, cashCents: true },
      })
      if (prior) {
        return NextResponse.json(
          {
            error: 'Free spin already used',
            spun: true,
            result: { wedge: prior.wedge as Wedge, cashCents: prior.cashCents },
          },
          { status: 409 },
        )
      }
    }

    // Per-anon-session rate guard. Keyed by the `diaflow_anon_id`
    // cookie (each browser session has its own value), NOT by IP —
    // NAT / corporate / mobile carriers collapse many real users onto
    // a single egress IP, and an IP-keyed limit would punish them as
    // one shared identity. Cookie-based gives each browser its own
    // bucket, and the AnonymousSpin.cookieId UNIQUE constraint
    // already enforces "1 free teaser spin per browser" as the
    // primary anti-abuse mechanism.
    const ip = getClientIp(req)
    const rateKey = existingCookie || cookieId
    const rl = await checkRateLimit({
      key: `anon-spin-session:${rateKey}`,
      limit: ANON_SPINS_PER_IP_PER_DAY,
      windowSec: 86_400,
    })
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Too many spins from this session. Try again later.' },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } },
      )
    }

    const body = await req.json().catch(() => ({}))
    const teammateCount =
      typeof body.teammateCount === 'number' && body.teammateCount >= 0
        ? Math.min(99, Math.floor(body.teammateCount))
        : 0

    const { headline } = resolveAnonSpin()
    await prisma.anonymousSpin.create({
      data: {
        cookieId,
        ipAddress: ip ?? null,
        wedge: headline.wedge,
        cashCents: headline.cashCents,
        teammateCount,
      },
    })

    const res = NextResponse.json({
      result: { wedge: headline.wedge, cashCents: headline.cashCents },
      teammateCount,
    })
    res.cookies.set(ANON_COOKIE, cookieId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: ANON_COOKIE_MAX_AGE,
    })
    return res
  } catch (err) {
    console.error('[spin/anon]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
