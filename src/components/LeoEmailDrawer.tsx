'use client'

/**
 * LeoEmailDrawer — the modal that opens when the user clicks Leo in
 * the office scene (post-onboarding).
 *
 * Used to capture a waitlist email; that flow was retired because the
 * signup route already records every signed-up email into both
 * `User` and `EmailCapture`, making Leo's manual form redundant.
 * Leo now just plays the Diaflow intro video — same content the
 * onboarding-time `LeoBubble` shows. Export name and props are kept
 * minimal so any existing callers don't break.
 */

import { useEffect } from 'react'
import { youtubeEmbedUrl } from '@/lib/youtubeUrl'
import { useAnchorPosition } from '@/lib/anchorPositions'
import { useIsDesktop } from '@/hooks/useIsDesktop'
import { useBackdropDismissGuard } from '@/hooks/useBackdropDismissGuard'
import { TeammatePortrait } from './TeammatePortrait'

interface Props {
  open: boolean
  onClose: () => void
  /** When set, the card floats next to this character in the 3D
   *  scene. Null/undefined falls back to the legacy centered modal. */
  anchorSlug?: string | null
}

export function LeoEmailDrawer({ open, onClose, anchorSlug }: Props) {
  // Anchor follows the character ONLY on desktop. On mobile we
  // render as a bottom sheet — the per-frame transform loop would
  // just fight the sheet's bottom-edge position.
  const isDesktop = useIsDesktop()
  const anchorRef = useAnchorPosition(
    open && isDesktop ? anchorSlug ?? null : null,
  )
  const anchored = !!anchorSlug && isDesktop
  // Same env-driven helper LeoBubble uses — keeps the two Leo modals
  // in sync. Falls back to the canonical Diaflow intro when
  // NEXT_PUBLIC_YOUTUBE_URL isn't set (see lib/youtubeUrl).
  const video = youtubeEmbedUrl(process.env.NEXT_PUBLIC_YOUTUBE_URL)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Press-origin + time-gated backdrop dismiss. The synthetic click
  // that follows the opening tap never produces a matching
  // pointerdown on the backdrop, so it harmlessly no-ops here. ESC +
  // the × button call `onClose` directly so explicit dismissal stays
  // instant. See useBackdropDismissGuard for the full root-cause writeup.
  const backdropDismissHandlers = useBackdropDismissGuard(open, onClose)

  if (!open) return null
  return (
    <div
      role="dialog"
      aria-modal="true"
      // Mobile: bottom-sheet flex container with backdrop. Desktop:
      // either character-anchored (transparent overlay) or centered
      // modal (legacy fallback). Same pattern as the other Teammate-
      // related pop-ups so the suite presents consistently.
      className={
        // The sheet's z-40 already paints over the z-30 bottom nav
        // while open, so we no longer lift it ~72px above the
        // viewport edge — that lift was producing a dead band of
        // backdrop between the sheet's last line and the nav. Now
        // the sheet sits flush with the viewport bottom (its own
        // env(safe-area-inset-bottom) padding handles the iOS home
        // indicator).
        'fixed inset-0 z-40 flex items-end md:items-center justify-center backdrop-blur-sm bg-black/60 ' +
        (anchored ? 'md:bg-transparent md:backdrop-blur-0' : '')
      }
      {...backdropDismissHandlers}
    >
      <div
        ref={anchored ? anchorRef : undefined}
        onClick={e => e.stopPropagation()}
        className={
          'w-full md:w-auto ' +
          (anchored ? 'md:absolute md:top-0 md:left-0 md:pointer-events-none' : '')
        }
        style={anchored ? { willChange: 'transform' } : undefined}
      >
        <div
          className={
            // `relative` so the absolute × close button anchors to the
            // card's top-right rather than escaping to the fixed
            // backdrop (which put it up in the office area).
            'relative bg-night-mid border-t border-tower-gold/30 text-tower-cream shadow-2xl ' +
            'rounded-t-3xl md:rounded-2xl md:border md:border-tower-gold/30 ' +
            'pt-3 px-6 pb-[max(1.25rem,env(safe-area-inset-bottom))] md:p-6 ' +
            (anchored
              ? 'md:pointer-events-auto md:w-[min(520px,calc(100vw-32px))] md:max-w-xl'
              : 'md:max-w-xl md:mx-auto')
          }
          style={anchored ? { transform: 'translate(28px, -50%)' } : undefined}
        >
        {/* Mobile sheet grip — hidden on desktop. */}
        <div className="md:hidden flex justify-center -mt-1 mb-3" aria-hidden>
          <div className="w-9 h-1 rounded-full bg-white/20" />
        </div>

        {/* Close × — absolute top-right so the portrait below can sit
            centered in the full width. */}
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-3 text-tower-cream/50 hover:text-tower-cream text-xl leading-none px-2 py-1"
        >
          ×
        </button>

        {/* Leo pixel portrait — matches the 2D minifigure on the floor
            so the modal reads as "Leo speaking". */}
        <div className="flex justify-center mb-3">
          <TeammatePortrait slug="leo" />
        </div>

        <div className="mb-4 text-center">
          <div className="text-[10px] uppercase tracking-widest text-tower-gold/80">
            Demo Specialist
          </div>
          <h2 className="text-2xl font-bold mt-1">Hi, I&apos;m Leo 👋</h2>
        </div>

        <div className="mb-4 rounded-md overflow-hidden border border-white/10 aspect-video bg-black">
          <iframe
            src={video.embed}
            title="Diaflow Tower intro"
            allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            className="w-full h-full"
          />
        </div>

        <div className="flex items-center justify-between gap-3 mb-4">
          <p className="text-sm text-tower-cream/80">
            When we launch, your AI teammates will handle the work. This is what that looks like.
          </p>
          {/* <a
            href={video.watch}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-night-deep/80 border border-white/10 text-xs text-tower-cream/80 hover:bg-night-deep hover:text-tower-cream transition whitespace-nowrap"
          >
            ▶ Watch on YouTube
          </a> */}
        </div>
        </div>
      </div>
    </div>
  )
}
