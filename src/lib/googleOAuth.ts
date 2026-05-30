/**
 * Google OAuth2 helpers — minimal, dependency-free implementation of
 * the Authorization Code flow used by the "Continue with Google"
 * button in SignupModal + the /login page.
 *
 * We intentionally don't pull in NextAuth / Auth.js or any other
 * provider library: the existing session is a single HS256 JWT in a
 * cookie (see lib/auth.ts), and we want the OAuth path to land in the
 * exact same session shape so the rest of the app stays unchanged.
 *
 * Flow:
 *   1. /api/auth/oauth/google
 *      └─ Generates a random `state` + (optional) PKCE verifier,
 *         signs them + the trial-state carryover into a short-lived
 *         JWT cookie, then 302-redirects the browser to Google's
 *         consent URL.
 *
 *   2. /api/auth/oauth/google/callback
 *      └─ Verifies the state cookie matches the `state` Google
 *         echoed back, exchanges the auth code for an id_token,
 *         decodes the id_token's `sub` / `email`, then either logs
 *         the user in (if `googleId` already on file) or creates a
 *         new account with the trial state carried over.
 *
 * Env vars required:
 *   GOOGLE_CLIENT_ID     — OAuth2 client ID from the Google Cloud
 *                          credentials console.
 *   GOOGLE_CLIENT_SECRET — Paired secret.
 *   NEXT_PUBLIC_SITE_URL — Base URL used to build the redirect URI.
 *                          (Falls back to `req.nextUrl.origin` if not
 *                          set, so local dev works without setting it.)
 */

import { SignJWT, jwtVerify } from 'jose'

const STATE_COOKIE = 'diaflow_oauth_state'
const STATE_TTL_SECONDS = 60 * 10 // 10 minutes — Google says ~10m max

/** Public so the route handlers can reference it for cookie deletes. */
export const GOOGLE_OAUTH_STATE_COOKIE = STATE_COOKIE

export interface OAuthStatePayload {
  /** Random nonce — must match the `state` Google echoes back. */
  state: string
  /** Trial-state carryover collected by the start route. Mirrors the
   *  `trial*` body fields the email signup handler accepts. */
  ref?: string
  teamName?: string
  teamPurpose?: string
  recommendedRole?: string
  reason?: string
}

function getSecretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET
  if (!secret || secret.length < 16) {
    throw new Error('AUTH_SECRET is not set (must be at least 16 chars)')
  }
  return new TextEncoder().encode(secret)
}

/** Builds the Google authorization URL the start route redirects to. */
export function buildGoogleAuthUrl({
  clientId,
  redirectUri,
  state,
}: {
  clientId: string
  redirectUri: string
  state: string
}): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    // openid → return an id_token in the token-exchange response so we
    // can read `sub` + `email` without a separate userinfo call.
    scope: 'openid email profile',
    state,
    // `select_account` instead of `consent` so returning users don't
    // have to re-approve every time.
    prompt: 'select_account',
    access_type: 'online',
    // Force ID token issuance even if we don't ask for offline access.
    include_granted_scopes: 'true',
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
}

/** Signs the OAuth state payload into a short-lived JWT cookie. */
export async function signOAuthStateJwt(payload: OAuthStatePayload): Promise<string> {
  return await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${STATE_TTL_SECONDS}s`)
    .sign(getSecretKey())
}

/** Verifies + decodes the state JWT. Returns null on any failure. */
export async function verifyOAuthStateJwt(
  token: string,
): Promise<OAuthStatePayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey())
    if (typeof payload.state !== 'string') return null
    return {
      state: payload.state,
      ref: typeof payload.ref === 'string' ? payload.ref : undefined,
      teamName: typeof payload.teamName === 'string' ? payload.teamName : undefined,
      teamPurpose:
        typeof payload.teamPurpose === 'string' ? payload.teamPurpose : undefined,
      recommendedRole:
        typeof payload.recommendedRole === 'string' ? payload.recommendedRole : undefined,
      reason: typeof payload.reason === 'string' ? payload.reason : undefined,
    }
  } catch {
    return null
  }
}

/**
 * Exchanges the auth code Google sent in the callback URL for an
 * id_token, then decodes the id_token's payload. We don't bother
 * verifying the id_token's RS256 signature because the token was just
 * fetched directly from Google's HTTPS token endpoint — the transport
 * is the trust anchor here.
 */
export async function exchangeCodeForGoogleProfile({
  code,
  clientId,
  clientSecret,
  redirectUri,
}: {
  code: string
  clientId: string
  clientSecret: string
  redirectUri: string
}): Promise<GoogleProfile> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Google token exchange failed: ${res.status} ${text.slice(0, 200)}`)
  }
  const json = (await res.json()) as { id_token?: string; access_token?: string }
  if (!json.id_token) {
    throw new Error('Google token response missing id_token')
  }
  return decodeIdToken(json.id_token)
}

export interface GoogleProfile {
  /** Stable Google account ID — written to User.googleId. */
  sub: string
  /** Email on the Google account. May differ from the user's eventual
   *  Diaflow address if they ever change it — store separately. */
  email: string
  /** True if Google has verified the email. Used to set our own
   *  `emailVerified` timestamp on first sign-in. */
  email_verified?: boolean
  name?: string
  picture?: string
}

/**
 * Decodes a JWT's payload without verifying the signature. Safe to use
 * for id_tokens fetched directly from Google's token endpoint (the
 * HTTPS connection is the trust boundary).
 */
function decodeIdToken(idToken: string): GoogleProfile {
  const parts = idToken.split('.')
  if (parts.length !== 3) throw new Error('Malformed id_token')
  const payloadJson = Buffer.from(
    // Standard base64url → base64 conversion.
    parts[1].replace(/-/g, '+').replace(/_/g, '/'),
    'base64',
  ).toString('utf8')
  const payload = JSON.parse(payloadJson)
  if (typeof payload.sub !== 'string' || typeof payload.email !== 'string') {
    throw new Error('id_token payload missing sub or email')
  }
  return {
    sub: payload.sub,
    email: payload.email,
    email_verified: !!payload.email_verified,
    name: typeof payload.name === 'string' ? payload.name : undefined,
    picture: typeof payload.picture === 'string' ? payload.picture : undefined,
  }
}

/** Builds the absolute redirect URI Google needs registered in its
 *  console. Pure string concat so it's identical between the start
 *  route + the callback (token exchange would fail if they drift). */
export function buildRedirectUri(origin: string): string {
  return `${origin.replace(/\/$/, '')}/api/auth/oauth/google/callback`
}
