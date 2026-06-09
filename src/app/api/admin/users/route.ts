/**
 * GET /api/admin/users
 *
 * Cron/admin-only export of every signed-up user. Auth is a single
 * shared API key (env `APP_API_KEY`) passed via the `x-api-key`
 * header — same convention as our Diaflow Builders calls. Compared
 * via `crypto.timingSafeEqual` so wrong-length / mismatched keys
 * can't be probed via response-time differences.
 *
 * Returns ALL users in one shot — no pagination. Caller's cron job
 * decides what to do with the array (process in chunks, stream to
 * BigQuery, etc.). If the user table grows to the point where a full
 * dump becomes too expensive, reintroduce cursor pagination here.
 *
 * Sensitive fields (`passwordHash`, `authTokens`, OAuth secrets) are
 * never returned — this endpoint is intended for analytics + reporting
 * use cases, not for re-creating sessions.
 */

import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Constant-time string compare. Returns false on length mismatch. */
function secureEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a)
  const bBuf = Buffer.from(b)
  if (aBuf.length !== bBuf.length) return false
  return timingSafeEqual(aBuf, bBuf)
}

export async function GET(req: NextRequest) {
  // ─── Auth ────────────────────────────────────────────────────────
  const expected = process.env.APP_API_KEY
  if (!expected) {
    // Misconfigured deploy — fail closed.
    return NextResponse.json({ error: 'APP_API_KEY not configured' }, { status: 500 })
  }
  const provided = req.headers.get('x-api-key') ?? ''
  if (!secureEqual(provided, expected)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ─── Fetch every user, ordered by signup time ──────────────────────
  const items = await prisma.user.findMany({
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      email: true,
      firstEmail: true,
      emailVerified: true,
      country: true,
      referralCode: true,
      referredByCode: true,
      referredAt: true,
      totalInvites: true,
      currentFloor: true,
      teamName: true,
      teamPurpose: true,
      publicVisible: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  return NextResponse.json(
    {
      items,
      count: items.length,
    },
    {
      headers: { 'cache-control': 'no-store' },
    }
  )
}
