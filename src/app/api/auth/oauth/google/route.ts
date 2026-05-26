/**
 * GET /api/auth/oauth/google
 *
 * Entry point for the Google OAuth2 flow ("Continue with Google"
 * button in SignupModal + /login page). Generates a random state
 * nonce, signs it (alongside any trial-state carryover the client
 * passed as query params) into a short-lived JWT cookie, and 302s
 * the browser to Google's consent screen.
 *
 * The carryover query params mirror the body fields the email signup
 * handler accepts:
 *   ?ref=...                 — pending referral code
 *   ?teamName=...
 *   ?teamPurpose=...
 *   ?recommendedRole=...
 *   ?reason=...
 *
 * The callback route at /api/auth/oauth/google/callback reads the
 * state cookie back, verifies it matches `state` in Google's
 * response, and then carries the trial fields onto the User row it
 * creates.
 */

import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import {
  buildGoogleAuthUrl,
  buildRedirectUri,
  GOOGLE_OAUTH_STATE_COOKIE,
  signOAuthStateJwt,
} from '@/lib/googleOAuth'

// Force the Node runtime — the `crypto.randomBytes` import requires
// Node, and the jose JWT library is also more reliable here than in
// the edge runtime.
export const runtime = 'nodejs'

function originOf(req: NextRequest): string {
  // Prefer the configured public site URL so that local dev (where
  // the request might come in via `0.0.0.0` or a Docker hostname)
  // still builds the redirect URI Google has registered. Falls back to
  // the request's own origin if the env var isn't set.
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (fromEnv) return fromEnv
  return req.nextUrl.origin
}

export async function GET(req: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim()
  if (!clientId) {
    // Friendly error — surface to the user with a redirect to /login
    // carrying an `oauth_error` query param the page can pick up.
    return NextResponse.redirect(
      new URL('/login?oauth_error=not_configured', req.nextUrl.origin),
    )
  }

  // ── Trial carryover ───────────────────────────────────────────────
  // The SignupModal forwards its trial state via query params; the
  // /login page sends nothing. Either way is fine — the callback only
  // uses these when it has to CREATE a new user.
  const url = req.nextUrl
  const ref = url.searchParams.get('ref')?.trim().toUpperCase() || undefined
  const teamName = url.searchParams.get('teamName')?.trim().slice(0, 60) || undefined
  const teamPurpose = url.searchParams.get('teamPurpose')?.trim().slice(0, 240) || undefined
  const recommendedRole =
    url.searchParams.get('recommendedRole')?.trim().slice(0, 200) || undefined
  const reason = url.searchParams.get('reason')?.trim().slice(0, 500) || undefined

  // Random 32-byte URL-safe state. Goes both in the redirect URL and
  // inside the signed cookie — the callback compares the two so an
  // attacker can't forge a callback URL without our cookie secret.
  const state = randomBytes(32).toString('base64url')

  const redirectUri = buildRedirectUri(originOf(req))
  const jwt = await signOAuthStateJwt({
    state,
    ref,
    teamName,
    teamPurpose,
    recommendedRole,
    reason,
  })

  const authUrl = buildGoogleAuthUrl({ clientId, redirectUri, state })

  const res = NextResponse.redirect(authUrl)
  res.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, jwt, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    // Match the JWT's exp — there's no point keeping the cookie alive
    // longer than the state it carries.
    maxAge: 60 * 10,
  })
  return res
}
