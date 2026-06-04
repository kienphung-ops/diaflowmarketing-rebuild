/**
 * GET /api/auth/oauth/google/callback
 *
 * Google redirects the browser here after the user grants consent.
 * Query string carries `code` + `state`; we:
 *
 *   1. Verify the state cookie matches `state` (CSRF protection).
 *   2. Exchange the code for an id_token via Google's token endpoint.
 *   3. Decode the id_token to read `sub` (Google's stable user ID)
 *      and `email`.
 *   4. Find-or-create the User. Two paths:
 *      - existing googleId → log them in (set session, redirect /).
 *      - existing email but no googleId → link Google to that
 *        account (write googleId + googleEmail, set session, redirect).
 *      - no match → create a new User, carrying over the trial state
 *        and referral attribution the start route stashed in the
 *        state cookie. Same shape as the email signup handler so
 *        downstream code doesn't care which path created the row.
 *   5. Clear the state cookie + set the session cookie + redirect /.
 *
 * Any error path redirects to /login?oauth_error=... so the user
 * sees a clean failure instead of a JSON blob.
 */

import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import {
  attachSessionCookie,
  createSessionJwt,
  generateReferralCode,
} from '@/lib/auth'
import { recomputeAndPersistFloor } from '@/lib/floorProgress'
import { invalidateLeaderboard } from '@/lib/leaderboard'
import { grantReferralSpinTx, migrateAnonSpin } from '@/lib/spin/service'
import { ANON_COOKIE, clearAnonCookie } from '@/lib/spin/anonCookie'
import { DEFAULT_TEAMMATES } from '@/lib/defaultTeammates'
import { getCountry } from '@/lib/requestGeo'
import {
  buildRedirectUri,
  exchangeCodeForGoogleProfile,
  GOOGLE_OAUTH_STATE_COOKIE,
  verifyOAuthStateJwt,
  type GoogleProfile,
  type OAuthStatePayload,
} from '@/lib/googleOAuth'

export const runtime = 'nodejs'

/**
 * Authoritative origin for redirects originated by this route.
 *
 * `req.nextUrl.origin` is what Next.js INFERS from the incoming
 * request. Behind reverse proxies (nginx, Caddy, Traefik) it only
 * resolves to the public hostname when the proxy is forwarding
 * `X-Forwarded-Host` + `X-Forwarded-Proto` AND Next.js's request
 * handler is configured to trust them. When either is missing, the
 * inferred origin is the internal bind address (often
 * `http://localhost:3000`), which then gets shipped to the browser
 * as a Location header on the post-OAuth redirect — exactly the
 * "Google sign-up succeeded but redirected to localhost" symptom.
 *
 * `NEXT_PUBLIC_SITE_URL` is the manual override and SHOULD always
 * win when set: it's read fresh at runtime (this is server code),
 * so a single env update + restart fixes the redirect without
 * touching nginx or rebuilding. Only fall back to `req.nextUrl.origin`
 * when the env is empty — useful for local dev where the env isn't
 * configured but `localhost:3000` IS the correct origin.
 */
function originOf(req: NextRequest): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (fromEnv) return fromEnv
  return req.nextUrl.origin
}

/** Helper — small wrapper that returns the user back to /login with
 *  an `oauth_error` query param so the page can render a toast. */
function fail(req: NextRequest, code: string): NextResponse {
  // Use `originOf()` (NOT `req.nextUrl.origin`) so error redirects
  // land on the canonical site URL too — `req.nextUrl.origin` is
  // unreliable behind reverse proxies, see the writeup on
  // `originOf` above.
  const url = new URL('/login', originOf(req))
  url.searchParams.set('oauth_error', code)
  const res = NextResponse.redirect(url)
  // Always blow away the state cookie on error so the next attempt
  // starts clean.
  res.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, '', {
    path: '/',
    maxAge: 0,
  })
  return res
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const errorParam = url.searchParams.get('error')

  // User clicked "cancel" on Google's consent screen.
  if (errorParam === 'access_denied') {
    return fail(req, 'cancelled')
  }
  if (!code || !state) {
    return fail(req, 'missing_params')
  }

  // ── Verify state cookie ───────────────────────────────────────────
  const stateJwt = req.cookies.get(GOOGLE_OAUTH_STATE_COOKIE)?.value
  if (!stateJwt) return fail(req, 'no_state_cookie')
  const decoded = await verifyOAuthStateJwt(stateJwt)
  if (!decoded) return fail(req, 'bad_state_cookie')
  if (decoded.state !== state) return fail(req, 'state_mismatch')

  // ── Exchange code → Google profile ────────────────────────────────
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim()
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim()
  if (!clientId || !clientSecret) return fail(req, 'not_configured')

  const redirectUri = buildRedirectUri(originOf(req))
  let profile: GoogleProfile
  try {
    profile = await exchangeCodeForGoogleProfile({
      code,
      clientId,
      clientSecret,
      redirectUri,
    })
  } catch (err) {
    console.error('[oauth/google/callback] token exchange failed', err)
    return fail(req, 'token_exchange')
  }

  // ── Find or create the user ───────────────────────────────────────
  try {
    const { id: userId, isNew } = await findOrCreateUserFromGoogle({
      profile,
      carryover: decoded,
      country: getCountry(req),
    })

    // Carry the anonymous teaser spin onto BRAND-NEW accounts only — a
    // returning user logging in via Google shouldn't absorb a fresh
    // anon spin from this browser. Best-effort; never blocks login.
    let anonCookieFound = false
    if (isNew) {
      const anonId = req.cookies.get(ANON_COOKIE)?.value
      if (anonId) {
        try {
          const r = await migrateAnonSpin(userId, anonId)
          anonCookieFound = r.cookieFound
        } catch (e) {
          console.warn('[oauth/google/callback] anon spin migrate failed:', (e as Error).message)
        }
      }
    }

    const jwt = await createSessionJwt(userId)
    // New accounts land back home with `?just_signed_up=1` so the
    // SaveSuccessModal pops up. Existing-user logins skip the param so
    // they don't see a congrats popup every sign-in.
    // Use `originOf(req)` so this redirect lands on the canonical
    // domain (from NEXT_PUBLIC_SITE_URL) — without it, deployments
    // behind a reverse proxy that doesn't forward X-Forwarded-Host
    // bounce the user back to http://localhost:3000 instead of the
    // public URL. Same fix applied to the `fail()` helper above.
    const redirectUrl = new URL(isNew ? '/?just_signed_up=1' : '/', originOf(req))
    const res = NextResponse.redirect(redirectUrl)
    attachSessionCookie(res, jwt)
    // Burn the state cookie now that we've consumed it.
    res.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, '', { path: '/', maxAge: 0 })
    // Evict diaflow_anon_id post-migration so a subsequent signup on
    // the same browser doesn't see a stale (already-claimed) cookie.
    if (anonCookieFound) clearAnonCookie(res)
    return res
  } catch (err) {
    console.error('[oauth/google/callback] user upsert failed', err)
    return fail(req, 'upsert_failed')
  }
}

/**
 * Three-branch user resolver:
 *
 *   1. `googleId` already on file → return that User's id (login).
 *   2. `email` already on file but `googleId` is null → link Google
 *      to the existing account (this lets a user who originally
 *      signed up with email + password switch to Google later).
 *   3. No match → create a new account with the trial carryover.
 *
 * Branches 1 and 2 ignore the trial carryover — the user already has
 * a live account, so re-writing their teamName / teamPurpose would
 * trample any progress they've made.
 */
async function findOrCreateUserFromGoogle({
  profile,
  carryover,
  country,
}: {
  profile: GoogleProfile
  carryover: OAuthStatePayload
  country?: string
}): Promise<{ id: string; isNew: boolean }> {
  const normalisedEmail = profile.email.trim().toLowerCase()

  // Branch 1: googleId already linked.
  const byGoogleId = await prisma.user.findUnique({
    where: { googleId: profile.sub },
    select: { id: true },
  })
  if (byGoogleId) return { id: byGoogleId.id, isNew: false }

  // Branch 2: email exists, link Google to it.
  const byEmail = await prisma.user.findUnique({
    where: { email: normalisedEmail },
    select: { id: true, googleId: true, emailVerified: true },
  })
  if (byEmail) {
    if (byEmail.googleId && byEmail.googleId !== profile.sub) {
      // Edge case: someone else's Google account already claimed this
      // email. Refuse to overwrite — the existing link wins.
      throw new Error(
        `Email ${normalisedEmail} is already linked to a different Google account`,
      )
    }
    await prisma.user.update({
      where: { id: byEmail.id },
      data: {
        googleId: profile.sub,
        googleEmail: normalisedEmail,
        // Bring the email-verified flag along — if Google says the
        // email is verified, we trust that, and the previously
        // unverified account becomes verified.
        emailVerified:
          byEmail.emailVerified ?? (profile.email_verified ? new Date() : null),
      },
    })
    return { id: byEmail.id, isNew: false }
  }

  // Branch 3: brand-new account. Mirror the email signup handler.
  const inviter = carryover.ref
    ? await prisma.user.findUnique({
        where: { referralCode: carryover.ref },
        select: { id: true, referralCode: true, totalInvites: true, currentFloor: true },
      })
    : null

  const now = new Date()

  const createOnce = async (): Promise<string> => {
    const referralCode = generateReferralCode()
    const inviterCode = inviter?.referralCode ?? null

    const u = await prisma.$transaction(async tx => {
      const created = await tx.user.create({
        data: {
          email: normalisedEmail,
          firstEmail: normalisedEmail,
          // No passwordHash — Google account, password sign-in is
          // disabled until the user goes through the password-reset
          // flow to set one explicitly.
          passwordHash: null,
          googleId: profile.sub,
          googleEmail: normalisedEmail,
          emailVerified: profile.email_verified ? now : null,
          country: country ?? null,
          referralCode,
          referredByCode: inviterCode,
          referredAt: inviterCode ? now : null,
          teamName: carryover.teamName?.trim().slice(0, 60) || null,
          teamPurpose: carryover.teamPurpose?.trim().slice(0, 240) || null,
          recommendedRole: carryover.recommendedRole?.trim().slice(0, 200) || null,
          reason: carryover.reason?.trim().slice(0, 500) || null,
          recruitedTeams: {
            create: DEFAULT_TEAMMATES.map(d => ({
              slug: d.slug,
              name: d.name,
              role:
                d.slug === 'mia' && carryover.recommendedRole
                  ? carryover.recommendedRole
                  : d.role,
              isDefault: true,
            })),
          },
        },
        select: { id: true },
      })

      // Marketing-list capture — same shape as email signup.
      await tx.emailCapture.create({
        data: { email: normalisedEmail, source: 'oauth_google' },
      })

      // Inviter credit — same chain as email signup.
      if (inviter && inviter.id !== created.id) {
        const newTotal = inviter.totalInvites + 1
        await tx.inviteEvent.create({
          data: {
            inviterUserId: inviter.id,
            invitedEmail: normalisedEmail,
            invitedUserId: created.id,
            userAgent: undefined,
            verified: true,
          },
        })
        await tx.user.update({
          where: { id: inviter.id },
          data: { totalInvites: newTotal },
        })
        // Floor 2 is share-gated — recompute from fresh progress.
        await recomputeAndPersistFloor(tx, inviter.id)
        // Spin economy: +1 spin to the inviter for the referral signup.
        await grantReferralSpinTx(tx, inviter.id)
      }

      return created.id
    })

    return u
  }

  let userId: string
  try {
    userId = await createOnce()
  } catch (err) {
    // P2002 on `referralCode` — 1-in-30^8 collision, retry once.
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2002' &&
      Array.isArray(err.meta?.target) &&
      (err.meta?.target as string[]).includes('referralCode')
    ) {
      userId = await createOnce()
    } else {
      throw err
    }
  }

  void invalidateLeaderboard(inviter?.id ?? null, userId)
  return { id: userId, isNew: true }
}

