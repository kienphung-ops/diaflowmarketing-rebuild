/**
 * POST /api/auth/signup
 *
 * Email + password signup. Optimised for Vercel ↔ Supabase latency:
 *
 *   - Independent reads (`existingUser`, `inviter`) + the bcrypt hash
 *     run in parallel via `Promise.all` — bcrypt is CPU work that
 *     doesn't block the DB round-trip.
 *   - `prisma.$transaction` batches the create user (+ 3 default
 *     teammates) and the inviter credit (event + user update) into a
 *     single round-trip.
 *   - `invalidateLeaderboard` is fired and-forgotten (`void`) so cache
 *     bust doesn't add latency to the response.
 *   - Rate limit is per-IP (5/hour) so a spammer can't bulk-create
 *     accounts.
 *
 * Items are NOT seeded per-user — they're derived on every read from
 * `FloorItem WHERE floorId <= User.currentFloor` (see lib/floorsDb.ts).
 */

import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import {
  attachSessionCookie,
  createSessionJwt,
  generateReferralCode,
} from '@/lib/auth'
import { grantReferralSpinTx, migrateAnonSpin } from '@/lib/spin/service'
import { ANON_COOKIE, clearAnonCookie } from '@/lib/spin/anonCookie'
import { recomputeAndPersistFloor } from '@/lib/floorProgress'
import { invalidateLeaderboard } from '@/lib/leaderboard'
import { DEFAULT_TEAMMATES } from '@/lib/defaultTeammates'
import { checkRateLimit } from '@/lib/rateLimit'
import { getCountry } from '@/lib/requestGeo'

const BCRYPT_ROUNDS = 10
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
    const ref = typeof body.ref === 'string' ? body.ref.trim().toUpperCase() : ''
    const trialTeamName = typeof body.trialTeamName === 'string' ? body.trialTeamName.trim().slice(0, 60) : ''
    const trialTeamPurpose = typeof body.trialTeamPurpose === 'string' ? body.trialTeamPurpose.trim().slice(0, 240) : ''
    // Diaflow-derived role recommendation captured during Mia
    // onboarding. Migrated into User as-is so the assistant-match
    // copy on subsequent sessions doesn't require a re-fetch.
    const trialRecommendedRole = typeof body.trialRecommendedRole === 'string'
      ? body.trialRecommendedRole.trim().slice(0, 200)
      : ''
    const trialReason = typeof body.trialReason === 'string'
      ? body.trialReason.trim().slice(0, 500)
      : ''

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Valid email required' }, { status: 400 })
    }
    if (password.length < MIN_PASSWORD_LEN) {
      return NextResponse.json(
        { error: `Password must be at least ${MIN_PASSWORD_LEN} characters` },
        { status: 400 }
      )
    }

    // Rate-limit by IP: 5 signups / hour.
    const ip = getClientIp(req)
    if (ip) {
      const rl = await checkRateLimit({ key: `signup-ip:${ip}`, limit: 5, windowSec: 3600 })
      if (!rl.allowed) {
        return NextResponse.json(
          { error: 'Too many signups from this connection. Try again later.' },
          { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } }
        )
      }
    }

    // ─── Parallel reads + bcrypt ─────────────────────────────────────
    // Existing-user check, inviter lookup, and the bcrypt hash are
    // independent — running them concurrently shaves ~200-400ms off
    // the typical Vercel ↔ Supabase round-trip latency.
    const [existing, inviter, passwordHash] = await Promise.all([
      prisma.user.findUnique({ where: { email }, select: { id: true } }),
      ref
        ? prisma.user.findUnique({
            where: { referralCode: ref },
            // Fetch all fields we'll need for the credit-inviter step,
            // so we don't need to re-query later.
            select: { id: true, referralCode: true, totalInvites: true, currentFloor: true },
          })
        : Promise.resolve(null),
      bcrypt.hash(password, BCRYPT_ROUNDS),
    ])

    if (existing) {
      return NextResponse.json(
        { error: 'An account with that email already exists. Sign in instead.' },
        { status: 409 }
      )
    }

    const country = getCountry(req)
    const userAgent = req.headers.get('user-agent') ?? undefined
    const now = new Date()

    // Generate a referral code without a SELECT round-trip. The
    // global @unique constraint on `referralCode` will reject any
    // collision at INSERT time; we retry once with a fresh code in
    // that case (collision odds ≈ 1 in 30^8 per attempt).
    const createUserOnce = async (): Promise<{ user: { id: string } }> => {
      const referralCode = generateReferralCode()
      const inviterCode = inviter?.referralCode ?? null

      // Single $transaction batches: user create (+ 3 default teammates)
      // AND the inviter credit chain if applicable. One round-trip to
      // Supabase instead of 4-5 sequential ones. No per-user item rows
      // anymore — unlocked items are derived from FloorItem at read time.

      const user = await prisma.$transaction(async tx => {
        const u = await tx.user.create({
          data: {
            email,
            firstEmail: email,
            passwordHash,
            //ipAddress: ip,
            country: country ?? null,
            referralCode,
            referredByCode: inviterCode,
            referredAt: inviterCode ? now : null,
            teamName: trialTeamName || null,
            teamPurpose: trialTeamPurpose || null,
            recommendedRole: trialRecommendedRole || null,
            reason: trialReason || null,
            emailVerified: null,
            recruitedTeams: {
              // Seed the 3 default NPCs. Mia's role is overridden by
              // `trialRecommendedRole` when present, so the new
              // account starts with Mia's role already synced to the
              // Diaflow recommendation collected during onboarding.
              // Iris + Leo keep their static defaults.
              create: DEFAULT_TEAMMATES.map(d => ({
                slug: d.slug,
                name: d.name,
                role: d.slug === 'mia' && trialRecommendedRole
                  ? trialRecommendedRole
                  : d.role,
                isDefault: true,
              })),
            },
          },
          select: { id: true },
        })

        // EmailCapture — Leo no longer prompts for a waitlist email,
        // so every signup writes into the marketing-list table here
        // instead. Same transaction as the User insert so the two
        // can't drift. `source: 'signup'` makes the origin obvious
        // when scanning the table for analytics.
        await tx.emailCapture.create({
          data: { email, source: 'signup' },
        })

        // Inviter credit in the same transaction — atomic with the
        // signup so a partial failure can't leave a phantom invite
        // event behind. Floor bumps are reflected by updating
        // `currentFloor`; downstream item reads cascade automatically
        // through FloorItem.
        if (inviter && inviter.id !== u.id) {
          const newTotal = inviter.totalInvites + 1
          await tx.inviteEvent.create({
            data: {
              inviterUserId: inviter.id,
              invitedEmail: email,
              invitedUserId: u.id,
              ipAddress: ip,
              userAgent,
              verified: true,
            },
          })
          await tx.user.update({
            where: { id: inviter.id },
            data: { totalInvites: newTotal },
          })
          // Floor 2 is share-gated, so recompute from fresh progress
          // (invites + share status) rather than invites alone.
          await recomputeAndPersistFloor(tx, inviter.id)
          // Spin economy: a successful referral signup grants the
          // inviter +1 spin token. Granted immediately (no email-verify
          // gate) to match the floor-climb invite credit above.
          await grantReferralSpinTx(tx, inviter.id)
        }

        return u
      })

      return { user }
    }

    let createdUser: { id: string }
    try {
      const r = await createUserOnce()
      createdUser = r.user
    } catch (err) {
      // P2002 on `referralCode`: 1-in-30^8 collision. Retry once with a
      // fresh code. Any other error bubbles up to the 500 handler.
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002' &&
        Array.isArray(err.meta?.target) &&
        (err.meta?.target as string[]).includes('referralCode')
      ) {
        const r = await createUserOnce()
        createdUser = r.user
      } else {
        throw err
      }
    }

    // ─── Fire-and-forget cache bust ──────────────────────────────────
    // Don't block the response on Redis — invalidation completing a
    // few ms after the user gets their session cookie is fine; the
    // 60s TTL is the backstop anyway.
    void invalidateLeaderboard(inviter?.id ?? null, createdUser.id)

    // Carry over the anonymous teaser spin (if this browser used its
    // free spin pre-signup): adds the capped cash to the new account
    // and marks the AnonymousSpin row migrated. Best-effort — never
    // blocks signup if it fails.
    const anonId = req.cookies.get(ANON_COOKIE)?.value
    let anonCookieFound = false
    if (anonId) {
      try {
        const r = await migrateAnonSpin(createdUser.id, anonId)
        anonCookieFound = r.cookieFound
      } catch (e) {
        console.warn('[auth/signup] anon spin migrate failed:', (e as Error).message)
      }
    }

    const jwt = await createSessionJwt(createdUser.id)
    const res = NextResponse.json({ success: true })
    attachSessionCookie(res, jwt)
    // Evict diaflow_anon_id once the row has been resolved (claimed
    // OR already-migrated). Without this the browser keeps presenting
    // the same cookie to every future signup, which is how "user can
    // migrate one more time" surfaced — the row's idempotent guard
    // saved us from double-credit, but the cookie itself was leaking
    // identity information across accounts.
    if (anonCookieFound) clearAnonCookie(res)
    return res
  } catch (err) {
    console.error('[auth/signup]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
