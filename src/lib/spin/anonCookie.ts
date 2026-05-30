/**
 * Anonymous-spin cookie — single source of truth for the cookie name
 * + the helper that clears it.
 *
 * Imported by:
 *   - /api/spin/anon  — writes the cookie when the user takes their
 *     free teaser spin.
 *   - /api/auth/signup, /api/auth/oauth/google/callback — clear the
 *     cookie after a successful migrateAnonSpin so the cookie can't
 *     present a (now-migrated) row to any later auth flow on the same
 *     browser, which used to let a fresh account "re-claim" the same
 *     anon spin.
 */

import type { NextResponse } from 'next/server'

export const ANON_COOKIE = 'diaflow_anon_id'

/** Set the cookie's max-age to 0 on the outgoing response. Same path /
 *  httpOnly / sameSite as the writer so the browser actually evicts
 *  the existing entry (browsers match on path + name + domain). */
export function clearAnonCookie(res: NextResponse): void {
  res.cookies.set(ANON_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })
}
