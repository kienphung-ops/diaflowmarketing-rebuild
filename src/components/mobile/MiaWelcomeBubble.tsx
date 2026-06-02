'use client'

import { useEffect, useState } from 'react'
import { useAnchorPosition } from '@/lib/anchorPositions'

/**
 * Mia's "Welcome — save us before you leave" speech bubble.
 *
 * Shown for ~3 seconds at the top of the office canvas the moment
 * the user clicks "Let's climb" on the Leo step (onboarding -> done).
 * Mobile only — desktop uses the inline MySquadDrawer surface for
 * the same nudge, so a floating bubble would be redundant there.
 *
 * Auto-dismisses after `durationMs` (default 3000) so it doesn't
 * compete with the actual office once the user starts interacting.
 *
 * Layout (mockup):
 *
 *   ┌──────────────────────────────────────────────┐
 *   │     💁 MIA · CHIEF OF STAFF                  │
 *   │  Welcome! Save us before you leave —         │
 *   │  N invite to Floor M ↓                       │
 *   └──────────────────────────────────────────────┘
 *                       ▽                     ← downward tail
 *                  ( office canvas below )
 */

interface Props {
  /** Drives mount/unmount with a small fade. */
  visible: boolean
  /** Fired when the auto-dismiss timer fires OR the bubble is
   *  tap-dismissed. Parent should set `visible=false` in response. */
  onDismiss: () => void
  /** Role label shown in the eyebrow (e.g. "CHIEF OF STAFF" or the
   *  Diaflow-derived recommendedRole). Falls back to "AI TEAMMATE"
   *  when null. */
  miaRole?: string | null
  /** Invites required to reach the next floor — drives the
   *  "N invite to Floor M ↓" call-to-action. Set null at penthouse. */
  invitesToNext?: number | null
  /** Floor id of the user's next milestone, used in the same line. */
  nextFloorId?: number | null
  /** Override the auto-dismiss timeout — defaults to 3000ms. */
  durationMs?: number
}

export function MiaWelcomeBubble({
  visible,
  onDismiss,
  miaRole,
  // invitesToNext,
  // nextFloorId,
  durationMs = 10000,
}: Props) {
  // Subscribe to Mia's live screen pixel so the bubble floats above
  // her head wherever she walks (auto-wander) or is dragged. Mobile2DScene
  // writes anchor positions for each character every render, so the
  // module-scoped store has a fresh pixel by the time we mount.
  // We always subscribe to keep hook order stable across visibility flips.
  const anchorRef = useAnchorPosition(visible ? 'mia' : null)

  // Local fade-in/out state — driven by `visible` from the parent so
  // the parent owns the lifecycle but the bubble still gets a smooth
  // opacity transition (instead of popping in/out).
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    if (!visible) {
      setMounted(false)
      return
    }
    // Defer a tick so the initial opacity-0 paints before flipping to
    // opacity-100 — otherwise the bubble appears with no transition.
    const t = setTimeout(() => setMounted(true), 20)
    return () => clearTimeout(t)
  }, [visible])

  // Auto-dismiss timer — resets whenever `visible` flips from false to
  // true. Cleared on unmount so we don't fire dismiss on a stale bubble.
  useEffect(() => {
    if (!visible) return
    const t = setTimeout(onDismiss, durationMs)
    return () => clearTimeout(t)
  }, [visible, durationMs, onDismiss])

  if (!visible) return null

  // `miaRole` is no longer rendered (eyebrow removed per the new
  // mockup) but the prop stays on the interface for backwards-compat
  // with the parent's call site.
  void miaRole

  return (
    <div
      ref={anchorRef}
      className={
        // md:hidden so desktop doesn't see the floating bubble (the
        // DesktopWelcomeBubble covers the same nudge there).
        // Anchored to Mia — the rAF loop writes `translate3d(...)` onto
        // this wrapper every frame, placing it at her feet pixel. The
        // inner bubble then offsets ABOVE her head with the tail
        // pointing down at her.
        'md:hidden fixed top-0 left-0 z-30 pointer-events-none ' +
        'transition-opacity duration-300 ' +
        (mounted ? 'opacity-100' : 'opacity-0')
      }
      role="status"
      aria-live="polite"
      style={{ willChange: 'transform' }}
    >
      <div
        onClick={onDismiss}
        className="pointer-events-auto absolute bg-night-mid border border-white/10 text-tower-cream rounded-2xl px-4 py-3 pr-9 w-[260px] shadow-[0_16px_40px_rgba(0,0,0,0.45)]"
        style={{
          // Horizontally centred on Mia, lifted ABOVE her head so the
          // downward tail points at the figure. ~95px clears the head
          // + name tag with a touch of breathing room.
          transform: 'translate(-50%, calc(-100% - 95px))',
          animation: 'mia-welcome-pop 280ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* × close — top right (matches the desktop welcome bubble's
            dismiss affordance). */}
        <button
          type="button"
          onClick={e => {
            e.stopPropagation()
            onDismiss()
          }}
          aria-label="Dismiss"
          className="absolute top-1.5 right-1.5 w-6 h-6 inline-flex items-center justify-center rounded-md text-tower-cream/55 hover:text-tower-cream hover:bg-white/5 text-base leading-none transition"
        >
          ×
        </button>

        {/* Main message — second clause highlighted in purple. */}
        <div className="text-[13.5px] leading-snug font-medium text-center">
          Welcome to your office.{' '}
          <span className="text-purple-300 font-semibold">
            Invite friends to level up!
          </span>
        </div>

        {/* Downward tail — colour matches `bg-night-mid` (#1a1a2e) so
            the bubble visually anchors to the office canvas below. */}
        <div
          aria-hidden
          className="absolute -bottom-2 left-1/2 -translate-x-1/2"
          style={{
            width: 0,
            height: 0,
            borderLeft: '8px solid transparent',
            borderRight: '8px solid transparent',
            borderTop: '8px solid #1a1a2e',
          }}
        />
      </div>

      {/* Inline keyframes so we don't need to touch tailwind.config for
          a one-off pop animation. Mirrors `onboarding-pop` but slightly
          larger overshoot for visual presence. */}
      <style jsx>{`
        @keyframes mia-welcome-pop {
          0% {
            opacity: 0;
            transform: translateY(-8px) scale(0.92);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>
    </div>
  )
}
