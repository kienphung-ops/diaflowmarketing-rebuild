/**
 * Spin wheel service layer — all DB reads/writes for GRO-5 live here so
 * the API routes stay thin. Token-mutating operations run inside a
 * Prisma `$transaction` so the balance, the ledger row, and any task /
 * daily bookkeeping commit atomically (no phantom grants).
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
  cashForWedge,
  isSpinTaskKey,
  type SpinTaskKey,
  type Wedge,
} from './constants'
import { applyCap, pickWedge } from './wheel'

// ── Shared shapes ───────────────────────────────────────────────────
export interface SpinOutcome {
  wedge: Wedge
  /** Cents actually credited (0 for spin_again / capped). */
  cashCents: number
  /** True for the free re-spin granted by a spin_again wedge. */
  isRespin: boolean
  /** True when the cap reduced this win. */
  capped: boolean
}

export interface TaskState {
  key: SpinTaskKey
  label: string
  platform: 'linkedin' | 'x'
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
}

// ── State read ──────────────────────────────────────────────────────
export async function getSpinState(userId: string): Promise<SpinState | null> {
  const [user, completions] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { spinTokens: true, spinCreditCents: true, lastDailySpinAt: true },
    }),
    prisma.taskCompletion.findMany({
      where: { userId },
      select: { taskKey: true },
    }),
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
 * the first wedge is "spin_again", chain depth capped at 1). Persists
 * SpinResult rows + the spin_again SpinGrant attribution and updates the
 * user's token balance + capped credit, all in one transaction.
 */
export async function playSpin(userId: string): Promise<SpinPlayResult> {
  return prisma.$transaction(async tx => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { spinTokens: true, spinCreditCents: true },
    })
    if (!user) return { ok: false, reason: 'not_found' } as const
    if (user.spinTokens < 1) return { ok: false, reason: 'no_tokens' } as const

    const results: SpinOutcome[] = []
    let running = user.spinCreditCents

    // First spin (full wheel, may land spin_again).
    const w1 = pickWedge()
    if (w1 === 'spin_again') {
      results.push({ wedge: 'spin_again', cashCents: 0, isRespin: false, capped: false })
      // Free re-spin — exclude spin_again so the chain (depth 1) always
      // resolves to a cash/jackpot result.
      const w2 = pickWedge({ excludeSpinAgain: true })
      const { added, capped } = applyCap(running, cashForWedge(w2))
      running += added
      results.push({ wedge: w2, cashCents: added, isRespin: true, capped })
    } else {
      const { added, capped } = applyCap(running, cashForWedge(w1))
      running += added
      results.push({ wedge: w1, cashCents: added, isRespin: false, capped })
    }

    // Persist: token spend + credit gain.
    const updated = await tx.user.update({
      where: { id: userId },
      data: {
        spinTokens: { decrement: 1 },
        spinCreditCents: running > user.spinCreditCents ? running : undefined,
      },
      select: { spinTokens: true, spinCreditCents: true },
    })

    // Ledger: one SpinResult per outcome; a spin_again SpinGrant for the
    // free re-spin attribution (does NOT touch the banked balance).
    await tx.spinResult.createMany({
      data: results.map(o => ({
        userId,
        wedge: o.wedge,
        cashCents: o.cashCents,
        isRespin: o.isRespin,
        capped: o.capped,
      })),
    })
    if (results.some(o => o.wedge === 'spin_again')) {
      await tx.spinGrant.create({ data: { userId, source: 'spin_again', amount: 1 } })
    }

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
export function resolveAnonSpin(): { headline: AnonSpinOutcome; landedSpinAgain: boolean } {
  const w1 = pickWedge()
  if (w1 !== 'spin_again') {
    return { headline: { wedge: w1, cashCents: cashForWedge(w1) }, landedSpinAgain: false }
  }
  const w2 = pickWedge({ excludeSpinAgain: true })
  return { headline: { wedge: w2, cashCents: cashForWedge(w2) }, landedSpinAgain: true }
}

/**
 * Migrate a not-yet-claimed anonymous spin onto a freshly-created user.
 * Adds the (capped) cash to the user's credit, records a SpinResult, and
 * marks the AnonymousSpin row migrated. Safe to call when no anon row
 * exists (no-op). Call AFTER the user row exists.
 */
export async function migrateAnonSpin(userId: string, cookieId: string): Promise<void> {
  if (!cookieId) return
  const anon = await prisma.anonymousSpin.findUnique({
    where: { cookieId },
    select: { id: true, wedge: true, cashCents: true, migratedToUserId: true },
  })
  if (!anon || anon.migratedToUserId) return

  await prisma.$transaction(async tx => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { spinCreditCents: true },
    })
    if (!user) return
    const { added, capped } = applyCap(user.spinCreditCents, anon.cashCents)
    if (added > 0) {
      await tx.user.update({
        where: { id: userId },
        data: { spinCreditCents: { increment: added } },
      })
    }
    await tx.spinResult.create({
      data: { userId, wedge: anon.wedge, cashCents: added, capped, isRespin: false },
    })
    await tx.anonymousSpin.update({
      where: { id: anon.id },
      data: { migratedToUserId: userId, migratedAt: new Date() },
    })
  })
}
