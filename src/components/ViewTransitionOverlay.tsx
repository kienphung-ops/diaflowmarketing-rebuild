'use client'

/**
 * Fullscreen blur + spinner shown during slow client-side navigations.
 *
 * Why this exists: Office (/) and Tower (/tower) are server-rendered
 * pages that hit Prisma + the floors config on every request. The
 * round-trip is noticeably slow (1-3s on cold serverless), and during
 * that window Next.js gives the user no feedback — the click registers
 * but the screen stays frozen on the previous view, which reads as
 * "nothing happened, click again."
 *
 * Each toggle-tower call site wraps its `router.push()` in a local
 * `isNavigating` state and mounts this overlay while the new RSC is
 * fetching. The overlay unmounts naturally when the destination page
 * mounts and replaces the current tree.
 *
 * The same primitive is reused by any future click-then-navigate flow
 * that suffers the same delay.
 */
export function ViewTransitionOverlay({ label }: { label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center gap-4 bg-night-deep/85 backdrop-blur-md pointer-events-auto"
    >
      <svg
        className="animate-spin text-tower-gold"
        width="44"
        height="44"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden
      >
        <circle
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeOpacity="0.25"
          strokeWidth="3"
        />
        <path
          d="M22 12a10 10 0 0 1-10 10"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
      {label && (
        <p className="text-sm text-tower-cream/70 tracking-wide">{label}</p>
      )}
    </div>
  )
}

/**
 * Inline button-sized spinner. Used by submit buttons (sign in / sign
 * up) that swap their label for a spinner+text combo while the request
 * is in flight. Inherits `currentColor` from the button text colour so
 * it visually integrates with whatever button style it's dropped into.
 */
export function InlineSpinner({ size = 14 }: { size?: number }) {
  return (
    <svg
      className="animate-spin shrink-0"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeOpacity="0.3"
        strokeWidth="3"
      />
      <path
        d="M22 12a10 10 0 0 1-10 10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  )
}
