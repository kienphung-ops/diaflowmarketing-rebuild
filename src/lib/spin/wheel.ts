/**
 * Spin wheel RNG + cap math. Pure functions — no DB, no I/O — so they
 * can be unit-tested + simulated (the 10k-spin distribution check in
 * the acceptance criteria runs against `pickWedge`).
 *
 * The SERVER owns wedge selection. The client only animates the wheel
 * to the server-returned result, so a tampered client can't fake a win.
 */

import { WEDGE_DEFS, SPIN_CREDIT_CAP_CENTS, type Wedge } from './constants'

/**
 * Weighted-random wedge selection.
 *
 * @param excludeSpinAgain When true, the "spin_again" wedge is removed
 *   and the remaining weights renormalised. Used for the re-spin of a
 *   Spin-again chain so the chain (capped at depth 1) is GUARANTEED to
 *   resolve to a cash/jackpot outcome — keeping "100% of spins resolve
 *   to a win" true and the EV math intact.
 */
export function pickWedge(opts?: { excludeSpinAgain?: boolean }): Wedge {
  const defs = opts?.excludeSpinAgain
    ? WEDGE_DEFS.filter(d => d.key !== 'spin_again')
    : WEDGE_DEFS
  const total = defs.reduce((sum, d) => sum + d.weight, 0)
  let r = Math.random() * total
  for (const d of defs) {
    r -= d.weight
    if (r < 0) return d.key
  }
  // Floating-point safety net — return the last wedge.
  return defs[defs.length - 1].key
}

export interface CapResult {
  /** Cents actually added to the balance after the cap. */
  added: number
  /** True when the wedge's face value was reduced by the $50 cap
   *  (including the "already at cap → added 0" case). */
  capped: boolean
}

/**
 * Apply the $50 lifetime cap to a single cash win.
 *
 * @param currentCents The user's current credit balance.
 * @param wedgeCash    The wedge's face value (0 for spin_again).
 */
export function applyCap(currentCents: number, wedgeCash: number): CapResult {
  if (wedgeCash <= 0) return { added: 0, capped: false }
  const room = Math.max(0, SPIN_CREDIT_CAP_CENTS - currentCents)
  const added = Math.min(room, wedgeCash)
  return { added, capped: added < wedgeCash }
}
