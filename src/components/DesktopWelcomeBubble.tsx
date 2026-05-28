'use client'

/**
 * Desktop post-onboarding welcome bubble.
 *
 * Shown the moment the user finishes Leo's step (onboarding → done) on
 * DESKTOP. Rendered as an anchored "bubblewrap" — same dark night-mid /
 * tower-cream chrome the other onboarding bubbles (Iris / Mia / Leo)
 * use, floating next to Mia in the 3D scene via the rAF anchor loop.
 * The MySquadDrawer opens alongside so the user can pick their next
 * move (tour / rewards / save). Mobile keeps its own MiaWelcomeBubble +
 * bottom-nav Tower pulse, so this is `hidden md:block`.
 *
 * Persistent — clicking the bubble (or its ×) dismisses it.
 */

import { useAnchorPosition } from '@/lib/anchorPositions'

interface Props {
  visible: boolean
  onDismiss: () => void
  /** Mia's role label for the eyebrow (e.g. "Chief of Staff"). Falls
   *  back to "Chief of Staff" when null. */
  miaRole?: string | null
}

export function DesktopWelcomeBubble({ visible, onDismiss, miaRole }: Props) {
  // Always subscribe to keep hook order stable across visibility flips.
  // Hook returns a ref that the rAF loop writes `translate3d(...)` onto
  // every frame, and an edge-aware flip parks the card on the LEFT of
  // Mia when the right side would clip off-screen. `gap: 28` matches
  // the onboarding bubbles' spacing.
  const anchorRef = useAnchorPosition(visible ? 'mia' : null, {
    flipEdge: true,
    vCenter: true,
    gap: 28,
  })

  if (!visible) return null

  const labelRole =
    (miaRole ?? '').trim().replace(/^(an?|the)\s+/i, '').toUpperCase() ||
    'CHIEF OF STAFF'

  return (
    <div className="hidden md:block fixed inset-0 z-30 pointer-events-none">
      {/* Anchor wrapper — origin 0,0; rAF loop transforms it to Mia's
          screen pixel. The inner card re-enables pointer events. */}
      <div
        ref={anchorRef}
        className="absolute top-0 left-0"
        style={{ willChange: 'transform' }}
      >
        <div
          onClick={onDismiss}
          role="button"
          tabIndex={0}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ' ') onDismiss()
          }}
          className="pointer-events-auto relative w-[320px] rounded-2xl bg-night-mid border border-white/10 text-tower-cream shadow-2xl px-5 py-4 cursor-pointer animate-onboarding-pop"
          style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.6)' }}
        >
          {/* Close × — match the OnboardingBubble icon style. */}
          <button
            type="button"
            onClick={e => {
              e.stopPropagation()
              onDismiss()
            }}
            aria-label="Dismiss"
            className="absolute top-3 right-3 p-1.5 rounded-md text-tower-cream/60 hover:text-tower-cream hover:bg-white/5 transition"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>

          {/* Eyebrow — purple accent matches the onboarding bubbles'
              status/role pill colour. */}
          <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-purple-300 mb-2 pr-6">
            <span aria-hidden>💁</span> MIA · YOUR {labelRole}
          </div>

          <div className="text-[15px] leading-snug font-semibold mb-2.5">
          👋Welcome to your office. Pick where — to go next  or{' '}
            <span className="text-purple-300">save us before you leave.</span>
          </div>

          <div className="text-[12.5px] text-tower-cream/55">
            Three options over there →
          </div>
        </div>
      </div>
    </div>
  )
}
