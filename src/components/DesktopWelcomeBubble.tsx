'use client'

/**
 * Desktop post-onboarding welcome bubble.
 *
 * Shown the moment the user finishes Leo's step (onboarding → done) on
 * DESKTOP. Replaces the old "pulse the Tower view button" nudge — now
 * Mia greets the user with a speech bubble over the office and the
 * MySquadDrawer opens alongside so the user can pick their next move
 * (tour / rewards / save). Mobile keeps its own MiaWelcomeBubble +
 * bottom-nav Tower pulse, so this is `hidden md:block`.
 *
 * Fixed position over the LEFT scene area (not anchored to a character)
 * so it never drifts behind the open MySquadDrawer once the office's
 * auto-wander starts moving the figures around. Persistent — clicking
 * the bubble (or its ×) dismisses it.
 */

interface Props {
  visible: boolean
  onDismiss: () => void
  /** Mia's role label for the eyebrow (e.g. "Chief of Staff"). Falls
   *  back to "Chief of Staff" when null. */
  miaRole?: string | null
}

export function DesktopWelcomeBubble({ visible, onDismiss, miaRole }: Props) {
  if (!visible) return null

  const labelRole =
    (miaRole ?? '').trim().replace(/^(an?|the)\s+/i, '').toUpperCase() ||
    'CHIEF OF STAFF'

  return (
    <div
      className="hidden md:block fixed z-30 pointer-events-none"
      style={{ left: '30%', top: '40%', transform: 'translateX(-50%)' }}
    >
      <div
        onClick={onDismiss}
        className="pointer-events-auto relative bg-white text-night-deep rounded-2xl px-5 py-4 w-[300px] shadow-[0_16px_44px_rgba(0,0,0,0.45)] cursor-pointer"
        style={{ animation: 'desktop-welcome-pop 300ms cubic-bezier(0.16, 1, 0.3, 1)' }}
      >
        {/* Close × */}
        <button
          type="button"
          onClick={e => {
            e.stopPropagation()
            onDismiss()
          }}
          aria-label="Dismiss"
          className="absolute top-2.5 right-2.5 w-6 h-6 inline-flex items-center justify-center rounded-full text-night-deep/40 hover:text-night-deep hover:bg-black/5 text-base leading-none transition"
        >
          ×
        </button>

        <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-purple-500 mb-2 pr-5">
          <span aria-hidden>💁</span> MIA · YOUR {labelRole}
        </div>

        <div className="text-[15px] leading-snug font-medium mb-2.5">
          Welcome to your office. Pick where to go next — or{' '}
          <span className="text-purple-600 font-semibold">save us before you leave.</span>
        </div>

        <div className="text-[12.5px] text-night-deep/50 font-medium">
          Three options over there →
        </div>

        {/* Downward tail anchoring the bubble to the characters below. */}
        <div
          aria-hidden
          className="absolute -bottom-2 left-1/2 -translate-x-1/2"
          style={{
            width: 0,
            height: 0,
            borderLeft: '9px solid transparent',
            borderRight: '9px solid transparent',
            borderTop: '9px solid #ffffff',
          }}
        />
      </div>

      <style jsx>{`
        @keyframes desktop-welcome-pop {
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
