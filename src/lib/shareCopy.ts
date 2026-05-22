/**
 * Build the clipboard payload for the Copy-invite-link button.
 *
 * Format (per product spec):
 *   "built my AI office, <N> invites from the next floor — <url>"
 *
 * `N` is the number of invites the user still needs to unlock the next
 * floor. Singular/plural is handled.
 *
 * Edge cases:
 *   - No inviteUrl → empty string. Callers no-op on falsy values.
 *   - No nextFloor (penthouse: user is at floor 20) → swap the floor-
 *     count clause for the "topped out" line that matches the X share
 *     copy elsewhere. Still ends with the URL so the link is shareable.
 *
 * Used by MySquadDrawer, IrisHireModal and HowItWorksModal so all three
 * Copy buttons paste the same enriched string. Keeping this in one
 * place means future copy tweaks land everywhere at once.
 */
export function buildShareCopyText(
  inviteUrl: string | null,
  invitesToNext: number,
  hasNextFloor: boolean,
): string {
  if (!inviteUrl) return ''
  if (!hasNextFloor) {
    return `just topped out my AI office at diaflow — ${inviteUrl}`
  }
  const noun = invitesToNext === 1 ? 'invite' : 'invites'
  return `built my AI office, ${invitesToNext} ${noun} from the next floor — ${inviteUrl}`
}
