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
import { computeFloorForInvites } from '@/lib/floors'
import { invalidateLeaderboard } from '@/lib/leaderboard'
import { grantReferralSpinTx, migrateAnonSpin } from '@/lib/spin/service'
import { DEFAULT_TEAMMATES } from '@/lib/defaultTeammates'
import {
  buildRedirectUri,
  exchangeCodeForGoogleProfile,
  GOOGLE_OAUTH_STATE_COOKIE,
  verifyOAuthStateJwt,
  type GoogleProfile,
  type OAuthStatePayload,
} from '@/lib/googleOAuth'

export const runtime = 'nodejs'

function originOf(req: NextRequest): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (fromEnv) return fromEnv
  return req.nextUrl.origin
}

/** Helper — small wrapper that returns the user back to /login with
 *  an `oauth_error` query param so the page can render a toast. */
function fail(req: NextRequest, code: string): NextResponse {
  const url = new URL('/login', req.nextUrl.origin)
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
      ip: getClientIp(req),
      country: getCountry(req),
    })

    // Carry the anonymous teaser spin onto BRAND-NEW accounts only — a
    // returning user logging in via Google shouldn't absorb a fresh
    // anon spin from this browser. Best-effort; never blocks login.
    if (isNew) {
      const anonId = req.cookies.get('diaflow_anon_id')?.value
      if (anonId) {
        try {
          await migrateAnonSpin(userId, anonId)
        } catch (e) {
          console.warn('[oauth/google/callback] anon spin migrate failed:', (e as Error).message)
        }
      }
    }

    const jwt = await createSessionJwt(userId)
    // New accounts land back home with `?just_signed_up=1` so the
    // SaveSuccessModal pops up. Existing-user logins skip the param so
    // they don't see a congrats popup every sign-in.
    const redirectUrl = new URL(isNew ? '/?just_signed_up=1' : '/', req.nextUrl.origin)
    const res = NextResponse.redirect(redirectUrl)
    attachSessionCookie(res, jwt)
    // Burn the state cookie now that we've consumed it.
    res.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, '', { path: '/', maxAge: 0 })
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
  ip,
  country,
}: {
  profile: GoogleProfile
  carryover: OAuthStatePayload
  ip?: string
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
          first_email: normalisedEmail,
          // No passwordHash — Google account, password sign-in is
          // disabled until the user goes through the password-reset
          // flow to set one explicitly.
          passwordHash: null,
          googleId: profile.sub,
          googleEmail: normalisedEmail,
          emailVerified: profile.email_verified ? now : null,
          ipAddress: ip,
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
        const newFloor = computeFloorForInvites(newTotal)
        await tx.inviteEvent.create({
          data: {
            inviterUserId: inviter.id,
            invitedEmail: normalisedEmail,
            invitedUserId: created.id,
            ipAddress: ip,
            userAgent: undefined,
            verified: true,
          },
        })
        await tx.user.update({
          where: { id: inviter.id },
          data: { totalInvites: newTotal, currentFloor: newFloor },
        })
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

function getClientIp(req: NextRequest): string | undefined {
  const xff = req.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  return req.headers.get('x-real-ip') ?? undefined
}

function getCountry(req: NextRequest): string | undefined {
  return req.headers.get('x-vercel-ip-country') ?? undefined
}
