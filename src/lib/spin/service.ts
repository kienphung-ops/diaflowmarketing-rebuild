/**
 * Spin wheel service layer — all DB reads/writes for GRO-5 live here so
 * the API routes stay thin. Token-mutating operations run inside a
 * Prisma `$transaction` so the balance, the ledger row, and any task /
 * daily bookkeeping commit atomically (no phantom grants).
 *
 * Wedge definitions (label / amount / weight / color) come from the
 * `spin_wedges` table via wedgesApi.ts. The picker is a pure function
 * that takes the array; this service loads it once per call.
 *
 * Money is integer cents; the $50 cap is enforced here (server-side),
 * never trusted from the client.
 */

import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import {
  DAILY_COOLDOWN_MS,
  SPIN_CREDIT_CAP_CENTS,
  SPIN_TASKS,
  isSpinTaskKey,
  type SharePlatform,
  type SpinTaskKey,
  type Wedge,
} from './constants'
import { applyCap, pickWedge } from './wheel'
import {
  creditCentsForWedge,
  getSpinWedges,
  isRespinWedge,
  wedgeByKey,
  type SpinWedgeConfig,
} from './wedgesApi'

// ── Shared shapes ───────────────────────────────────────────────────
export interface SpinOutcome {
  wedge: Wedge
  /** Cents actually credited (0 for spin-type / capped). */
  cashCents: number
  /** True for the free re-spin granted by a spin-type wedge. */
  isRespin: boolean
  /** True when the cap reduced this win. */
  capped: boolean
}

export interface TaskState {
  key: SpinTaskKey
  label: string
  platform: SharePlatform
  completed: boolean
}

export interface SpinState {
  tokens: number
  creditCents: number
  capReached: boolean
  daily: {
    /** Whether a daily spin can be claimed right now. */
    available: boolean
    /** ISO timestamp the next daily claim unlocks (null when available now). */
    nextClaimAt: string | null
  }
  tasks: TaskState[]
  /** Wedge catalogue — the client renders the wheel + result panel
   *  from this list, so reward/odds tweaks in the DB take effect
   *  immediately without redeploys. */
  wedges: SpinWedgeConfig[]
}

// ── State read ──────────────────────────────────────────────────────
export async function getSpinState(userId: string): Promise<SpinState | null> {
  const [user, completions, wedges] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { spinTokens: true, spinCreditCents: true, lastDailySpinAt: true },
    }),
    prisma.taskCompletion.findMany({
      where: { userId },
      select: { taskKey: true },
    }),
    getSpinWedges(),
  ])
  if (!user) return null

  const done = new Set(completions.map(c => c.taskKey))
  const daily = dailyStatus(user.lastDailySpinAt)

  return {
    tokens: user.spinTokens,
    creditCents: user.spinCreditCents,
    capReached: user.spinCreditCents >= SPIN_CREDIT_CAP_CENTS,
    daily,
    tasks: SPIN_TASKS.map(t => ({
      key: t.key,
      label: t.label,
      platform: t.platform,
      completed: done.has(t.key),
    })),
    wedges,
  }
}

function dailyStatus(lastDailySpinAt: Date | null): SpinState['daily'] {
  if (!lastDailySpinAt) return { available: true, nextClaimAt: null }
  const next = lastDailySpinAt.getTime() + DAILY_COOLDOWN_MS
  if (Date.now() >= next) return { available: true, nextClaimAt: null }
  return { available: false, nextClaimAt: new Date(next).toISOString() }
}

// ── Daily claim ─────────────────────────────────────────────────────
export type DailyClaimResult =
  | { ok: true; tokens: number }
  | { ok: false; reason: 'cooldown'; nextClaimAt: string }
  | { ok: false; reason: 'not_found' }

export async function claimDailySpin(userId: string): Promise<DailyClaimResult> {
  return prisma.$transaction(async tx => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { lastDailySpinAt: true, spinTokens: true },
    })
    if (!user) return { ok: false, reason: 'not_found' } as const

    const status = dailyStatus(user.lastDailySpinAt)
    if (!status.available) {
      return { ok: false, reason: 'cooldown', nextClaimAt: status.nextClaimAt! } as const
    }

    const updated = await tx.user.update({
      where: { id: userId },
      data: { spinTokens: { increment: 1 }, lastDailySpinAt: new Date() },
      select: { spinTokens: true },
    })
    await tx.spinGrant.create({ data: { userId, source: 'daily', amount: 1 } })
    return { ok: true, tokens: updated.spinTokens } as const
  })
}

// ── Task completion ─────────────────────────────────────────────────
export type TaskResult =
  | { ok: true; tokens: number }
  | { ok: false; reason: 'already_done' }
  | { ok: false; reason: 'invalid_task' }

export async function completeSpinTask(userId: string, taskKey: string): Promise<TaskResult> {
  if (!isSpinTaskKey(taskKey)) return { ok: false, reason: 'invalid_task' }
  try {
    return await prisma.$transaction(async tx => {
      // The unique (userId, taskKey) constraint is the real guard; the
      // create throws P2002 on a duplicate, which we map to already_done.
      await tx.taskCompletion.create({ data: { userId, taskKey } })
      const updated = await tx.user.update({
        where: { id: userId },
        data: { spinTokens: { increment: 1 } },
        select: { spinTokens: true },
      })
      await tx.spinGrant.create({ data: { userId, source: 'task', amount: 1, taskKey } })
      return { ok: true, tokens: updated.spinTokens } as const
    })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return { ok: false, reason: 'already_done' }
    }
    throw err
  }
}

// ── Spin (authenticated) ────────────────────────────────────────────
export type SpinPlayResult =
  | {
      ok: true
      results: SpinOutcome[]
      tokens: number
      creditCents: number
      capReached: boolean
    }
  | { ok: false; reason: 'no_tokens' }
  | { ok: false; reason: 'not_found' }

/**
 * Consume one banked token and resolve a spin (plus the free re-spin if
 * the first wedge is a spin-type, chain depth capped at 1). Persists
 * SpinResult rows + the spin_again SpinGrant attribution and updates the
 * user's token balance + capped credit, all in one transaction.
 */
export async function playSpin(userId: string): Promise<SpinPlayResult> {
  // Wedges are loaded outside the tx — they're a global config read,
  // not user state, and the loader already has its own cache layer.
  const wedges = await getSpinWedges()

  return prisma.$transaction(async tx => {
    // PARALLEL READS — `findUnique` (user state) and `count` (first-spin
    // check) are independent, so we issue them concurrently inside the
    // transaction. On a remote DB each query is one RTT; running them
    // serially used to add ~100-200 ms of perceived "click → wheel
    // starts" lag for every spin.
    const [user, priorSpinCount] = await Promise.all([
      tx.user.findUnique({
        where: { id: userId },
        select: { spinTokens: true, spinCreditCents: true },
      }),
      tx.spinResult.count({ where: { userId } }),
    ])
    if (!user) return { ok: false, reason: 'not_found' } as const
    if (user.spinTokens < 1) return { ok: false, reason: 'no_tokens' } as const

    // "First spin" = zero prior SpinResult rows. Anonymous teasers
    // migrate onto the user as a SpinResult on signup, so once that
    // migration has run the count is already 1 and subsequent
    // authenticated spins go back to default weights — which matches
    // the product intent ("favourable odds for the user's very first
    // taste of the wheel, anon or auth").
    const isFirstSpin = priorSpinCount === 0

    const results: SpinOutcome[] = []
    let running = user.spinCreditCents
    let landedRespin = false

    // First spin (full wheel, may land a spin-type wedge).
    const k1 = pickWedge(wedges, { firstSpin: isFirstSpin })
    const w1 = wedgeByKey(wedges, k1)
    if (isRespinWedge(w1)) {
      landedRespin = true
      results.push({ wedge: k1, cashCents: 0, isRespin: false, capped: false })
      // Free re-spin — exclude spin-type wedges so the chain (depth 1)
      // always resolves to a non-respin result. Still part of the
      // first-spin experience, so keep using firstWeight for parity.
      const k2 = pickWedge(wedges, { excludeRespin: true, firstSpin: isFirstSpin })
      const w2 = wedgeByKey(wedges, k2)
      const face = creditCentsForWedge(w2)
      const { added, capped } = applyCap(running, face)
      running += added
      results.push({ wedge: k2, cashCents: added, isRespin: true, capped })
    } else {
      const face = creditCentsForWedge(w1)
      const { added, capped } = applyCap(running, face)
      running += added
      results.push({ wedge: k1, cashCents: added, isRespin: false, capped })
    }

    // PARALLEL WRITES — the user update + ledger inserts touch different
    // tables and don't depend on each other's results, so we fan them
    // out concurrently. Saves another 1-2 RTTs vs. the previous
    // serial-await chain (felt especially when the DB is remote).
    const writes: Promise<unknown>[] = [
      tx.user.update({
        where: { id: userId },
        data: {
          spinTokens: { decrement: 1 },
          spinCreditCents: running > user.spinCreditCents ? running : undefined,
        },
        select: { spinTokens: true, spinCreditCents: true },
      }),
      tx.spinResult.createMany({
        data: results.map(o => ({
          userId,
          wedge: o.wedge,
          cashCents: o.cashCents,
          isRespin: o.isRespin,
          capped: o.capped,
        })),
      }),
    ]
    if (landedRespin) {
      writes.push(
        tx.spinGrant.create({ data: { userId, source: 'spin_again', amount: 1 } }),
      )
    }
    const [updated] = (await Promise.all(writes)) as [
      { spinTokens: number; spinCreditCents: number },
      ...unknown[],
    ]

    return {
      ok: true,
      results,
      tokens: updated.spinTokens,
      creditCents: updated.spinCreditCents,
      capReached: updated.spinCreditCents >= SPIN_CREDIT_CAP_CENTS,
    } as const
  })
}

// ── Referral spin grant (called from the signup transaction) ────────
/**
 * Grant the inviter +1 spin for a successful referral signup. Designed
 * to be called INSIDE an existing Prisma transaction (the signup route's
 * `$transaction`) so the grant is atomic with the invite credit.
 *
 * Per product decision: granted immediately on signup (no email-verify
 * gate), matching the existing floor-climb invite credit.
 */
export async function grantReferralSpinTx(
  tx: Prisma.TransactionClient,
  inviterUserId: string,
): Promise<void> {
  await tx.user.update({
    where: { id: inviterUserId },
    data: { spinTokens: { increment: 1 } },
  })
  await tx.spinGrant.create({ data: { userId: inviterUserId, source: 'referral', amount: 1 } })
}

// ── Anonymous teaser spin ───────────────────────────────────────────
export interface AnonSpinOutcome {
  wedge: Wedge
  /** Face-value cents won (cap is applied only after signup migration). */
  cashCents: number
}

/**
 * Resolve a single anonymous teaser spin (chain depth 1, same wheel).
 * No cap applied pre-signup — the full face value is recorded and the
 * cap is enforced when the result migrates onto a real account.
 * Returns the headline outcome (the cash-bearing wedge when chained).
 */
export async function resolveAnonSpin(): Promise<{
  headline: AnonSpinOutcome
  landedSpinAgain: boolean
}> {
  const wedges = await getSpinWedges()
  // Every anon spin is by definition the user's very first encounter
  // with the wheel, so we always use the firstWeight column (falling
  // back to weight when null).
  const k1 = pickWedge(wedges, { firstSpin: true })
  const w1 = wedgeByKey(wedges, k1)
  if (!isRespinWedge(w1)) {
    return {
      headline: { wedge: k1, cashCents: creditCentsForWedge(w1) },
      landedSpinAgain: false,
    }
  }
  const k2 = pickWedge(wedges, { excludeRespin: true, firstSpin: true })
  const w2 = wedgeByKey(wedges, k2)
  return {
    headline: { wedge: k2, cashCents: creditCentsForWedge(w2) },
    landedSpinAgain: true,
  }
}

/** What `migrateAnonSpin` did. The auth routes use `cookieFound` to
 *  decide whether to clear `diaflow_anon_id` on the response — `true`
 *  means the cookie pointed at a real row (whether or not THIS call
 *  claimed it), so the browser should evict it either way. */
export interface MigrateAnonSpinResult {
  /** The cookie pointed at an existing AnonymousSpin row. The auth
   *  route should clear the cookie when this is true so the row can't
   *  be presented to any future signup on the same browser. */
  cookieFound: boolean
  /** This call atomically claimed the row (granted the spin). False
   *  when the row was already migrated by an earlier call — covers
   *  the legitimate double-call case (e.g. retried signup) AND the
   *  malicious case (reused cookie on a second signup). */
  claimed: boolean
}

/**
 * Migrate a not-yet-claimed anonymous spin onto a freshly-created user.
 * Adds the (capped) cash to the user's credit, records a SpinResult, and
 * marks the AnonymousSpin row migrated. Safe to call when no anon row
 * exists (no-op). Call AFTER the user row exists.
 *
 * The claim is ATOMIC — we update `anonymous_spins` with a
 * `migratedToUserId IS NULL` guard before granting any credit, so two
 * concurrent migrate calls (or a race between two signups on the same
 * cookie) can grant the spin at most once.
 */
export async function migrateAnonSpin(
  userId: string,
  cookieId: string,
): Promise<MigrateAnonSpinResult> {
  if (!cookieId) return { cookieFound: false, claimed: false }
  const anon = await prisma.anonymousSpin.findUnique({
    where: { cookieId },
    select: { id: true, wedge: true, cashCents: true, migratedToUserId: true },
  })
  if (!anon) return { cookieFound: false, claimed: false }
  // Cookie pointed at a real row — caller should evict the cookie
  // regardless of whether we claim or skip.
  if (anon.migratedToUserId) return { cookieFound: true, claimed: false }

  let claimed = false
  await prisma.$transaction(async tx => {
    // Atomic claim: only proceeds if the row is still unmigrated.
    // count === 0 means another concurrent migrate took it first, so
    // we bail without granting any credit.
    const result = await tx.anonymousSpin.updateMany({
      where: { id: anon.id, migratedToUserId: null },
      data: { migratedToUserId: userId, migratedAt: new Date() },
    })
    if (result.count === 0) return

    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { spinCreditCents: true },
    })
    if (!user) return
    const { added, capped } = applyCap(user.spinCreditCents, anon.cashCents)
    // Start the daily-spin cooldown at the moment of migration. The
    // anon teaser IS the user's first spin of the day — without this
    // they could sign up, claim the daily on top, and effectively
    // double-spin every brand-new account. The 20 h `DAILY_COOLDOWN_MS`
    // window on `lastDailySpinAt` is the same gate `claimDailySpin`
    // checks, so a fresh user gets their next daily 20 h after
    // signup-with-teaser instead of immediately.
    //
    // Always run the user.update even when `added === 0` (cap hit OR
    // anon won spin_again only) so the cooldown lands regardless.
    await tx.user.update({
      where: { id: userId },
      data: {
        ...(added > 0 ? { spinCreditCents: { increment: added } } : {}),
        lastDailySpinAt: new Date(),
      },
    })
    await tx.spinResult.create({
      data: { userId, wedge: anon.wedge, cashCents: added, capped, isRespin: false },
    })
    claimed = true
  })
  return { cookieFound: true, claimed }
}
