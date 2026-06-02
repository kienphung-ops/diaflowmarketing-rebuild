'use client'

import { useFloor } from '@/lib/floorsConfigClient'

/**
 * Mobile-only horizontally-scrolling chip strip. Sits directly under
 * the Header and replaces the cramped "Floor X · N invites · N/N
 * teammates" pill that was overflowing the 390px-wide header row.
 *
 * Order — left to right, all in one scrollable row:
 *   1. Floor N                  — current position
 *   2. N invites                — running total
 *   3. 👥 N/N teammates         — squad cap
 *   4. Next: 🎁 <reward>        — what the user's working toward
 *                                 (or 👑 "Top floor reached" at the
 *                                 penthouse, see the JSX below)
 *
 * Overflow scrolls horizontally — if a future addition or a long
 * floor label pushes the row past the viewport width, the strip
 * stays usable via touch-drag without ever wrapping or truncating
 * the trailing chips.
 *
 * Hidden on md+ where the desktop header pill already carries this
 * information.
 */

interface Props {
  currentFloor: number
  totalInvites: number
  /** Number of teammates the user has locked in (defaults + recruited).
   *  Paired with `maxTeammates` to render the "5/14 teammates" chip. */
  teammateCount: number
  /** Slot cap for the user's current floor — drives the denominator
   *  on the teammates chip. */
  maxTeammates: number
  /** Server-computed leaderboard rank. `null` for anonymous or
   *  while loading; `51` represents "outside top 50". Drives the
   *  optional "🏆 #rank" gold chip per the Section 2 mockup (Floor
   *  6 example). Suppressed when null. */
  rank?: number | null
}

export function MobileCounterChips({
  currentFloor,
  totalInvites,
  teammateCount,
  maxTeammates,
  rank,
}: Props) {
  // Live floor config for the "Next reward" copy. `useFloor` returns
  // the static fallback until /api/floors hydrates so we render
  // synchronously.
  const nextFloor = useFloor(currentFloor + 1)
  // First non-empty unlock-item entry becomes the "Next: …" label.
  // Falls back to the bare label if no unlock-item copy is set.
  const nextReward =
    nextFloor?.unlockItems?.find(s => s && s.trim().length > 0) ??
    nextFloor?.label ??
    null

  return (
    <div
      className="md:hidden flex gap-1.5 px-3 pb-2 overflow-x-auto"
      // `scrollbar-width: none` / `::-webkit-scrollbar` hide via the
      // global utility — inline style avoids adding a Tailwind plugin
      // just for one component.
      style={{ scrollbarWidth: 'none' }}
    >
      <Chip>
        Level <strong className="text-tower-gold">{currentFloor}</strong>
      </Chip>
      <Chip>
        <strong className="text-tower-gold">{totalInvites}</strong>{' '}
        {totalInvites === 1 ? 'invite' : 'invites'}
      </Chip>
      <Chip>
        👥{' '}
        <strong className="text-tower-gold">
          {teammateCount}/{maxTeammates}
        </strong>{' '}
        teammates
      </Chip>
      {/* Leaderboard rank chip — only when we have a value. "51"
          means outside top 50; render as "50+" per the existing
          leaderboard convention. */}
      {typeof rank === 'number' && (
        <Chip tone="gold">🏆 #{rank >= 51 ? '50+' : rank}</Chip>
      )}
      {nextReward ? (
        <Chip tone="purple">
          Next: <strong className="text-tower-cream">{nextReward}</strong>
        </Chip>
      ) : (
        // Penthouse case — `useFloor(currentFloor + 1)` returns null
        // when the user has already reached the top floor. Instead of
        // dropping the chip and leaving an awkward gap at the end of
        // the strip, surface a "you've topped out" status so the row
        // stays balanced and the milestone is acknowledged.
        <Chip tone="gold">👑 You&apos;ve reached the top!</Chip>
      )}
    </div>
  )
}

function Chip({
  children,
  tone,
}: {
  children: React.ReactNode
  tone?: 'purple' | 'gold'
}) {
  const base =
    'shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-medium whitespace-nowrap'
  const palette =
    tone === 'purple'
      ? 'bg-purple-500/10 border-purple-500/30 text-purple-200'
      : tone === 'gold'
      ? // Gold tint reserved for the penthouse-reached pill so it
        // pops as a milestone rather than a generic counter.
        'bg-tower-gold/15 border-tower-gold/40 text-tower-gold font-semibold'
      : 'bg-night-mid/60 border-white/10 text-tower-cream/80'
  return <div className={`${base} ${palette}`}>{children}</div>
}
