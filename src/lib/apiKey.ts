/**
 * Shared `x-api-key` gate for cron/admin endpoints.
 *
 * Same convention as /api/admin/users: a single shared secret in env
 * `APP_API_KEY`, compared in constant time so a wrong key can't be
 * probed via response-time differences. Returns an error `NextResponse`
 * to short-circuit with, or `null` when the caller is authorised.
 *
 *   const denied = requireApiKey(req)
 *   if (denied) return denied
 */

import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'

function secureEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a)
  const bBuf = Buffer.from(b)
  if (aBuf.length !== bBuf.length) return false
  return timingSafeEqual(aBuf, bBuf)
}

export function requireApiKey(req: NextRequest): NextResponse | null {
  const expected = process.env.APP_API_KEY
  if (!expected) {
    // Misconfigured deploy — fail closed rather than open.
    return NextResponse.json({ error: 'APP_API_KEY not configured' }, { status: 500 })
  }
  const provided = req.headers.get('x-api-key') ?? ''
  if (!secureEqual(provided, expected)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return null
}
