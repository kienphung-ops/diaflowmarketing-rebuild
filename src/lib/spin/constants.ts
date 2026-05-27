/**
 * Spin wheel (GRO-5) — canonical constants shared by backend + UI.
 *
 * The DB stores `source` / `wedge` as plain TEXT (no Postgres enums),
 * so THIS file is the single source of truth for the valid value sets
 * + their economics. The backend validates against these before any
 * write; the UI reads the labels / cash values / weights for rendering.
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
/** Anti-stampede cap on anonymous teaser spins per IP per day. */
export const ANON_SPINS_PER_IP_PER_DAY = 100

// ── Spin token sources (SpinGrant.source) ───────────────────────────
export const SPIN_SOURCES = ['daily', 'referral', 'task', 'spin_again'] as const
export type SpinSource = (typeof SPIN_SOURCES)[number]
export function isSpinSource(v: string): v is SpinSource {
  return (SPIN_SOURCES as readonly string[]).includes(v)
}

// ── Wheel wedges (SpinResult.wedge / AnonymousSpin.wedge) ───────────
export const WEDGES = [
  'cash_50c',
  'cash_1',
  'cash_2',
  'cash_3',
  'cash_5',
  'spin_again',
  'jackpot',
] as const
export type Wedge = (typeof WEDGES)[number]
export function isWedge(v: string): v is Wedge {
  return (WEDGES as readonly string[]).includes(v)
}

export interface WedgeDef {
  key: Wedge
  /** Short label shown on the wheel segment. */
  label: string
  /** Cash value in cents (0 for spin_again). */
  cashCents: number
  /** Probability weight — the WEDGE_DEFS weights sum to 100. */
  weight: number
  /** Hex fill for the wheel segment (UI). */
  color: string
}

/**
 * The 7 wedges per the GRO-5 design table. Weights sum to 100.
 *   Direct cash EV: $1.14 · Cash hit rate: 70% · Spin again: 30% · Jackpot: 1%
 */
export const WEDGE_DEFS: readonly WedgeDef[] = [
  { key: 'cash_50c', label: '$0.50', cashCents: 50, weight: 20, color: '#3b2f6b' },
  { key: 'cash_1', label: '$1', cashCents: 100, weight: 30, color: '#4c3a8c' },
  { key: 'cash_2', label: '$2', cashCents: 200, weight: 12, color: '#6d4bd8' },
  { key: 'cash_3', label: '$3', cashCents: 300, weight: 5, color: '#8b5cf6' },
  { key: 'cash_5', label: '$5', cashCents: 500, weight: 2, color: '#a78bfa' },
  { key: 'spin_again', label: 'Spin again', cashCents: 0, weight: 30, color: '#1f2147' },
  { key: 'jackpot', label: 'JACKPOT $25', cashCents: 2500, weight: 1, color: '#fbbf24' },
]

export function wedgeDef(w: Wedge): WedgeDef {
  // Non-null: every Wedge has a def by construction.
  return WEDGE_DEFS.find(d => d.key === w) as WedgeDef
}
export function cashForWedge(w: Wedge): number {
  return wedgeDef(w).cashCents
}

// ── One-time tasks (V1) ─────────────────────────────────────────────
// V1 scope (confirmed): share-on-LinkedIn + share-on-X only. Each grants
// +1 spin, once per user (server-enforced by TaskCompletion unique).
// Adding a task later needs no schema change — just extend this list.
export const SPIN_TASKS = [
  {
    key: 'share_linkedin',
    label: 'Share on LinkedIn',
    platform: 'linkedin' as const,
    reward: 1,
  },
  {
    key: 'share_x',
    label: 'Share on X',
    platform: 'x' as const,
    reward: 1,
  },
] as const
export type SpinTaskKey = (typeof SPIN_TASKS)[number]['key']
export function isSpinTaskKey(v: string): v is SpinTaskKey {
  return SPIN_TASKS.some(t => t.key === v)
}

/** Seconds the share dialog must stay open before the task pays out
 *  (honor-system anti-fraud — enforced client-side). */
export const SHARE_DWELL_SECONDS = 3

// ── Formatting helper (shared) ──────────────────────────────────────
/** "$1", "$0.50", "$25" — drops the decimals on whole-dollar amounts. */
export function formatCents(cents: number): string {
  if (cents % 100 === 0) return `$${cents / 100}`
  return `$${(cents / 100).toFixed(2)}`
}
