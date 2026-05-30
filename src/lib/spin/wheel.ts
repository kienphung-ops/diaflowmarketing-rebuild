/**
 * Spin wheel RNG + cap math. Pure functions — no DB, no I/O — so they
 * can be unit-tested + simulated (the 10k-spin distribution check in the
 * acceptance criteria runs against `pickWedge`).
 *
 * The SERVER owns wedge selection. The client only animates the wheel
 * to the server-returned result, so a tampered client can't fake a win.
 *
 * Wedge data is now loaded from `spin_wedges` via wedgesApi.ts — the
 * caller passes the array in. These helpers stay pure so unit tests
 * can hand them a fixture without touching Prisma.
 */

import { SPIN_CREDIT_CAP_CENTS } from './constants'
import { isRespinWedge, type SpinWedgeConfig } from './wedgesApi'

/**
 * Weighted-random wedge selection.
 *
 * @param wedges  The full enabled wedge list (already sorted; order
 *                doesn't matter for the math).
 * @param opts.excludeRespin  When true, "spin"-type wedges are removed
 *   and the remaining weights renormalised. Used for the re-spin of a
 *   Spin-again chain so the chain (capped at depth 1) is GUARANTEED to
 *   resolve to a non-respin outcome — keeping "100 % of spins resolve
 *   to a terminal reward" true and the EV math intact.
 * @param opts.firstSpin     When true, each wedge's `firstWeight` is
 *   used (falling back to `weight` when null) so the user's very first
 *   spin can be tuned independently of subsequent ones. The caller
 *   decides "first spin" — `playSpin` checks for zero prior SpinResult
 *   rows, `resolveAnonSpin` always passes true.
 */
export function pickWedge(
  wedges: SpinWedgeConfig[],
  opts?: { excludeRespin?: boolean; firstSpin?: boolean },
): string {
  const defs = opts?.excludeRespin ? wedges.filter(d => !isRespinWedge(d)) : wedges
  if (defs.length === 0) {
    throw new Error('[pickWedge] no wedges available (check seed / enabled flags)')
  }
  // Read the right weight column. For first spins, fall through to the
  // default weight when the admin hasn't set a per-wedge override.
  const weightOf = (d: SpinWedgeConfig): number =>
    opts?.firstSpin && typeof d.firstWeight === 'number' ? d.firstWeight : d.weight
  const total = defs.reduce((sum, d) => sum + weightOf(d), 0)
  let r = Math.random() * total
  for (const d of defs) {
    r -= weightOf(d)
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
 * @param wedgeCash    The wedge's face value (0 for spin-type wedges).
 */
export function applyCap(currentCents: number, wedgeCash: number): CapResult {
  if (wedgeCash <= 0) return { added: 0, capped: false }
  const room = Math.max(0, SPIN_CREDIT_CAP_CENTS - currentCents)
  const added = Math.min(room, wedgeCash)
  return { added, capped: added < wedgeCash }
}
