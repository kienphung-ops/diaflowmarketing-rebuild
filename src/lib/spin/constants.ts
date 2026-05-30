/**
 * Spin wheel (GRO-5) — non-wedge constants shared by backend + UI.
 *
 * Wedge definitions (label / amount / weight / color) live in the
 * `spin_wedges` Postgres table and are loaded via lib/spin/wedgesApi.ts
 * (server) or threaded through the spin API response (client) — see
 * SpinWedgeConfig there. Anything in THIS file is static enough that
 * baking it into code is the right call.
 *
 * Money is always integer CENTS to avoid float drift.
 */

// ── Caps & cooldowns ────────────────────────────────────────────────
/** Lifetime cash-credit cap per user, in cents ($50). Past this, cash
 *  wedges resolve to 0 added (the spin is still recorded for history). */
export const SPIN_CREDIT_CAP_CENTS = 5000
/** Daily-spin cooldown — a 20h ROLLING window from the last claim
 *  (not midnight) so timezone resets can't be exploited. */
export const DAILY_COOLDOWN_MS = 20 * 60 * 60 * 1000
/** Anti-stampede cap on anonymous teaser spins per browser per day. */
export const ANON_SPINS_PER_IP_PER_DAY = 100

// ── Spin token sources (SpinGrant.source) ───────────────────────────
export const SPIN_SOURCES = ['daily', 'referral', 'task', 'spin_again'] as const
export type SpinSource = (typeof SPIN_SOURCES)[number]
export function isSpinSource(v: string): v is SpinSource {
  return (SPIN_SOURCES as readonly string[]).includes(v)
}

// ── Wedge typing ────────────────────────────────────────────────────
/** Wedge key — free-form string, validated server-side against the
 *  spin_wedges table. Used as the discriminator in SpinResult.wedge,
 *  AnonymousSpin.wedge, and the client-side wheel target. */
export type Wedge = string

// ── One-time tasks (V1) ─────────────────────────────────────────────
// V1 scope (confirmed): share-on-LinkedIn + share-on-X only. Each grants
// +1 spin, once per user (server-enforced by TaskCompletion unique).
// Adding a task later needs no schema change — just extend this list.
//
// The same task keys are CLAIMED from outside the SpinModal as well:
// the X / LinkedIn buttons in MySquadDrawer + ShareModal + the mobile
// share sheet all funnel through `useFirstShareSpin` (see
// src/lib/spin/useFirstShareSpin.ts), which fires the same POST
// /api/spin/task so the user's very first share — anywhere in the app
// — pays out the spin. The server's unique constraint makes this
// idempotent: any subsequent share gets a 409 and the user keeps a
// single +1 per platform.
export type SharePlatform = 'linkedin' | 'x'

export const SPIN_TASKS = [
  {
    key: 'share_linkedin',
    label: 'Share on LinkedIn',
    platform: 'linkedin' as SharePlatform,
    reward: 1,
  },
  {
    key: 'share_x',
    label: 'Share on X',
    platform: 'x' as SharePlatform,
    reward: 1,
  },
] as const
export type SpinTaskKey = (typeof SPIN_TASKS)[number]['key']
export function isSpinTaskKey(v: string): v is SpinTaskKey {
  return SPIN_TASKS.some(t => t.key === v)
}

export function taskKeyForPlatform(platform: SharePlatform): SpinTaskKey {
  return platform === 'linkedin' ? 'share_linkedin' : 'share_x'
}

export const SHARE_DWELL_SECONDS = 3

export function formatCents(cents: number): string {
  if (cents % 100 === 0) return `$${cents / 100}`
  return `$${(cents / 100).toFixed(2)}`
}
