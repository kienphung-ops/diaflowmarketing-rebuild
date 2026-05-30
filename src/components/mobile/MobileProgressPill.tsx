'use client'

import { useFloor } from '@/lib/floorsConfigClient'

/**
 * Floating "Next reward" pill anchored just above the MobileBottomNav.
 * Single-glance answer to "why am I here?" — shows the upcoming
 * floor's reward + the exact invite count remaining.
 *
 * Layout matches the mockup:
 *
 *   ┌─────────────────────────────────────────┐
 *   │ NEXT REWARD                          2  │
 *   │ 🎁 Floor 3 — Free beta access           │
 *   └─────────────────────────────────────────┘
 *
 * Hidden on md+ (desktop has the MySquadDrawer / How-it-works modal
 * surface for this) and at the penthouse (no next floor to climb).
 */

interface Props {
  currentFloor: number
  totalInvites: number
  /** Hide the pill — used while modals are open / arrange-mode is
   *  active so the floating chrome doesn't fight with the sheet. */
  hidden?: boolean
  /** Offset above the bottom nav. Defaults to the nav's nominal
   *  height (60px + safe-area). Tower view passes a custom value
   *  when an extra anchor card sits between the canvas and the nav. */
  bottomOffsetClass?: string
}

export function MobileProgressPill({
  currentFloor,
  totalInvites,
  hidden,
  bottomOffsetClass = 'bottom-[calc(72px+env(safe-area-inset-bottom))]',
}: Props) {
  const nextFloor = useFloor(currentFloor + 1)
  if (hidden) return null

  // Penthouse branch — when there's no nextFloor we'd previously
  // unmount the pill entirely, which left an awkward empty band
  // between the office canvas and the bottom nav. The user has
  // earned this status, so we surface it instead.
  if (!nextFloor) {
    return (
      <div
        className={`md:hidden fixed inset-x-3 ${bottomOffsetClass} z-20 pointer-events-none`}
        aria-live="polite"
      >
        <div className="pointer-events-auto bg-tower-gold/15 border border-tower-gold/40 backdrop-blur-md rounded-2xl px-3.5 py-2.5 flex items-center gap-3 shadow-[0_10px_30px_rgba(0,0,0,0.45)]">
          <div className="flex-1 min-w-0">
            <div className="text-[9px] tracking-[0.08em] uppercase text-tower-gold/70 font-bold">
              Top floor reached
            </div>
            <div className="text-[12px] text-tower-cream font-semibold leading-tight truncate">
              👑 Penthouse unlocked — keep sharing to grow the tower
            </div>
          </div>
        </div>
      </div>
    )
  }

  const invitesToNext = Math.max(0, nextFloor.invitesRequired - totalInvites)
  // First non-empty unlock-item string, falls back to the floor label.
  const reward =
    nextFloor.unlockItems?.find(s => s && s.trim().length > 0) ??
    nextFloor.label

  // Layout (Section 2 mockup, screen 6):
  //
  //   [🎁 in gold circle]   1 month of Pro free          [3]
  //                         Floor 7 · 3 invites away
  //
  // Reward headline is the primary content (text-tower-cream + bold);
  // the floor + invite-count subtitle reads faint. The gold circle on
  // the left anchors the icon visually and matches the gold accent
  // used by the Save/Invite hero CTA below.
  return (
    <div
      className={`md:hidden fixed inset-x-3 ${bottomOffsetClass} z-20 pointer-events-none`}
      aria-live="polite"
    >
      <div className="pointer-events-auto bg-night-mid/95 border border-white/10 backdrop-blur-md rounded-2xl px-3 py-2.5 flex items-center gap-3 shadow-[0_10px_30px_rgba(0,0,0,0.45)]">
        {/* Gold gift circle — replaces the all-caps "NEXT REWARD"
            label, since the iconography says the same thing in less
            space. */}
        <div
          className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-base bg-tower-gold/15 border border-tower-gold/30"
          aria-hidden
        >
          🎁
        </div>

        <div className="flex-1 min-w-0">
          <div className="text-[12px] text-tower-cream font-bold leading-tight truncate">
            {reward}
          </div>
          <div className="text-[10.5px] text-tower-cream/55 mt-0.5 truncate">
            Floor {nextFloor.id} · {invitesToNext}{' '}
            {invitesToNext === 1 ? 'invite' : 'invites'} away
          </div>
        </div>

        {/* Invite count badge — purple-tinted pill on the right
            matching the mockup. Mirrors the share-sheet's invite
            counter colour. */}
        <div className="shrink-0 rounded-md bg-purple-500/15 px-2 py-1 text-[11px] font-extrabold text-purple-200 leading-none">
          {invitesToNext}
        </div>
      </div>
    </div>
  )
}
