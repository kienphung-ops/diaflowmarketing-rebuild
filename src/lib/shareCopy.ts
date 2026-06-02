/**
 * Build the clipboard payload for the Copy-invite-link button.
 *
 * Format (per product spec — note the em-dash has NO surrounding
 * spaces, the URL butts right up against it so it reads as one
 * compound clause):
 *   "built my AI office, <N> invites from the next level—<url>"
 *
 * `N` is the number of invites the user still needs to unlock the next
 * floor. Singular ("invite") / plural ("invites") is selected so the
 * "1 invite" case reads grammatically.
 *
 * Edge cases:
 *   - No inviteUrl → empty string. Callers no-op on falsy values.
 *   - No nextFloor (penthouse: user is at floor 20) → swap the floor-
 *     count clause for the "topped out" line that matches the X share
 *     copy elsewhere. Still ends with the URL so the link is shareable.
 *     Same no-space em-dash convention.
 *
 * Used by MySquadDrawer, IrisHireModal, HowItWorksModal and the
 * Header's ReferralCopyButton so every Copy button across the app
 * pastes the exact same enriched string. Keeping this in one place
 * means future copy tweaks land everywhere at once.
 */
export function buildShareCopyText(
  inviteUrl: string | null,
  invitesToNext: number,
  hasNextFloor: boolean,
): string {
  if (!inviteUrl) return ''
  if (!hasNextFloor) {
    return `just topped out my AI office at diaflow—${inviteUrl}`
  }
  const noun = invitesToNext === 1 ? 'invite' : 'invites'
  return `built my AI office, ${invitesToNext} ${noun} from the next level—${inviteUrl}`
}
