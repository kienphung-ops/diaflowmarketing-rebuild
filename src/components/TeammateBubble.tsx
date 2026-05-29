'use client'

import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useAnchorPosition } from '@/lib/anchorPositions'
import { useIsDesktop } from '@/hooks/useIsDesktop'
import { useBackdropDismissGuard } from '@/hooks/useBackdropDismissGuard'
import { TeammatePortrait } from './TeammatePortrait'

interface Teammate {
  id: string
  name: string
  role: string
  /** Diaflow-API-generated "launch-day promise" — what this teammate
   *  will do once Diaflow launches. May be null while the bulk-add
   *  background fetch is still resolving; the bubble falls back to a
   *  generic line in that case. */
  description?: string | null
}

interface Props {
  open: boolean
  teammate: Teammate | null
  /** Scene slug for live anchoring next to the character. Typically
   *  `recruited-{index}`. When null the bubble renders centered. */
  anchorSlug?: string | null
  /** Custom recruit palette — same colours used by the 2D minifigure
   *  on the office floor so the portrait at the top of the modal
   *  reads as the same identity. Resolved by the parent from the
   *  recruit's index. */
  bodyColor?: string
  hairColor?: string
  skinColor?: string
  onClose: () => void
  /** Opens the edit modal (Step 3 in the design — Name + Role +
   *  Save / Remove / Cancel). The bubble closes itself first so the
   *  modal doesn't overlap. */
  onEdit: () => void
}

/**
 * Floating "speech bubble" anchored next to a recruited teammate
 * (Step 2 of the design).
 *
 * Layout:
 *   • Header row: "Name · Role" with a small pencil-edit button on
 *     the right that opens the edit modal.
 *   • Body:       one sentence of identity ("Hi, I'm {Name}!") +
 *                 the Diaflow-generated launch-day promise.
 *
 * Click anywhere OUTSIDE the bubble (the overlay catches it) → close.
 * Esc → close. No backdrop blur — the scene stays visible behind
 * since this is more a tooltip than a modal.
 *
 * For Iris/Mia/Leo we keep their existing dedicated modals (IrisHireModal,
 * MiaInfoCard) — those are richer than a one-liner promise and were
 * built before this design. This bubble is strictly for the user-
 * recruited teammates.
 */
export function TeammateBubble({ open, teammate, anchorSlug, bodyColor, hairColor, skinColor, onClose, onEdit }: Props) {
  // Anchor to the live character position ONLY on desktop. On
  // mobile we render as a bottom sheet, where a per-frame transform
  // would just fight the sheet's bottom-anchored position.
  // `flipEdge` makes the hook flip the card to the character's
  // LEFT when the right side would clip the viewport (common when
  // a teammate stands near the right wall) and vertically clamp on
  // overflow. The hook OWNS the placement here — the inner card
  // must not add its own static `translate(...)` offset.
  const isDesktop = useIsDesktop()
  const anchorRef = useAnchorPosition(
    open && isDesktop ? anchorSlug ?? null : null,
    { flipEdge: true, vCenter: true, gap: 28 },
  )
  const anchored = !!anchorSlug && isDesktop

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Press-origin + time-gated backdrop dismiss. Must run BEFORE the
  // early return so the hook order stays stable across renders.
  // This was the source of the flash-and-close bug on custom recruits
  // dragged onto the wall — same root cause as the default-NPC modals
  // (see useBackdropDismissGuard for the writeup).
  const backdropDismissHandlers = useBackdropDismissGuard(open, onClose)

  if (!open || !teammate) return null
  if (typeof document === 'undefined') return null

  // Fallback line used when the Diaflow API call hasn't landed yet
  // (bulk add → description still null on the row). Keeps the bubble
  // populated so it doesn't look broken; the next snapshot will swap
  // in the real text.
  const promise =
    teammate.description?.trim() ||
    `I'll help out with whatever ${teammate.role.trim() || 'the team'} work needs doing.`

  // Card body extracted so the SAME markup renders inside both the
  // mobile bottom-sheet and the desktop anchored card without
  // duplicating JSX. Header row carries the pencil; body carries the
  // launch-day promise.
  const cardBody = (
    <>
      {/* Recruit pixel portrait — same shared component as the
          default-NPC modals. Colours come from the parent (cycled
          RECRUIT_BODY/HAIR/SKIN palettes) so the portrait matches the
          on-floor 2D minifigure exactly.

          MOBILE ONLY (`md:hidden`): on desktop the bubble already
          floats right next to the live 3D minifigure, so repeating the
          portrait inside the card is redundant — drop it there and let
          the card lead with the name. */}
      <div className="md:hidden flex justify-center pt-3 pb-1">
        <TeammatePortrait
          bodyColor={bodyColor}
          hairColor={hairColor}
          skinColor={skinColor}
          width={48}
          height={62}
        />
      </div>
      <div className="flex items-start gap-2 px-4 pt-1 md:pt-4 pb-1.5">
        <div className="flex-1 min-w-0">
          <span className="text-sm font-bold truncate">{teammate.name}</span>
          <span className="mx-1.5 text-tower-cream/40">·</span>
          <span className="text-xs text-tower-cream/70 truncate">{teammate.role}</span>
        </div>
        <button
          type="button"
          onClick={() => {
            onClose()
            onEdit()
          }}
          aria-label="Edit teammate"
          title="Edit teammate"
          className="shrink-0 -mt-1 -mr-1 p-1.5 rounded-md hover:bg-night-deep/60 transition"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/pencil.svg"
            alt=""
            aria-hidden
            width={18}
            height={18}
            className="block"
          />
        </button>
      </div>
      <div className="px-4 pb-4 text-sm text-tower-cream/90 leading-relaxed">
        <span>👋Hi, I&apos;m {teammate.name}! </span>
        <span className="font-semibold">When Diaflow launches,</span>{' '}
        <span>{promise}</span>
      </div>
    </>
  )

  return createPortal(
    <div
      role="dialog"
      aria-modal="false"
      aria-label={`${teammate.name} — ${teammate.role}`}
      // Outer div carries the mobile dim backdrop directly (instead of
      // a child div) so a tap on the dim area lands with
      // `e.target === e.currentTarget` — required by the press-origin
      // dismiss guard. Flex anchors the mobile sheet to the bottom
      // edge of the viewport. z-40 paints over the MobileBottomNav
      // (z-30) and the MobileCounterChips (z-10).
      className="fixed inset-0 z-40 flex items-end justify-center md:bg-transparent md:backdrop-blur-0 md:items-stretch md:justify-start bg-black/55"
      {...backdropDismissHandlers}
    >
      {/* MOBILE: bottom sheet flush with the viewport bottom edge.
          The sheet's own padding handles the iOS home indicator;
          z-40 puts it above the MobileBottomNav (z-30) so the user
          can dismiss by tapping anywhere above the sheet. */}
      <div
        onClick={e => e.stopPropagation()}
        onPointerDown={e => e.stopPropagation()}
        className="md:hidden w-full bg-night-mid border-t border-white/10 rounded-t-3xl shadow-[0_-16px_40px_rgba(0,0,0,0.5)] text-tower-cream"
        style={{
          paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))',
        }}
      >
        <div className="flex justify-center pt-2.5 pb-1" aria-hidden>
          <div className="w-9 h-1 rounded-full bg-white/20" />
        </div>
        {cardBody}
      </div>

      {/* DESKTOP: character-anchored card. Same anchorRef + transform
          convention used by MiaInfoCard / IrisHireModal / Teammate-
          EditModal so all four pop-ups float identically next to the
          character. Hidden under md so the bottom sheet above is the
          only one visible on phones. */}
      <div
        ref={anchored ? anchorRef : undefined}
        className={
          'hidden md:block absolute top-0 left-0 pointer-events-none ' +
          // When no anchor slug is supplied we fall back to centred
          // (legacy modal layout). Tailwind's md:flex won't kick in
          // because the parent isn't a flex container — instead we
          // override the position to fixed-centered via inline style
          // below for that edge case.
          (anchored ? '' : 'md:inset-0 md:left-0 md:top-0 md:flex md:items-center md:justify-center')
        }
        style={anchored ? { willChange: 'transform' } : undefined}
      >
        <div
          onClick={e => e.stopPropagation()}
          className="pointer-events-auto w-[min(280px,calc(100vw-32px))] bg-night-mid border border-white/10 rounded-2xl shadow-2xl text-tower-cream"
          // No static transform here — the anchor hook's `flipEdge`
          // mode owns the full placement (gap + vertical centre +
          // edge flip on tight viewports).
        >
          {cardBody}
        </div>
      </div>
    </div>,
    document.body,
  )
}
