
/**
 * MiaInfoCard — opens when the user clicks Mia in the office scene.
 *
 * Render gate is the `reason` prop (User.reason on the DB row /
 * trial.reason for anonymous users):
 *
 *   - `reason` SET   → show the Diaflow-derived role + the reason
 *                      verbatim. The upstream returns a bullet list
 *                      separated by `\n`, so the paragraph uses
 *                      `whitespace-pre-line` to preserve those
 *                      newlines as real line breaks. The hard-coded
 *                      `SKILLS` list is hidden — the personalised
 *                      reason is meant to replace it.
 *
 *   - `reason` NULL  → fall back to the generic "What I do" intro
 *                      + the static `SKILLS` checklist so the modal
 *                      isn't blank for users who skipped Mia
 *                      onboarding or pre-date the feature.
 *
 * Both modes share the same chrome (close button, role label, "Got
 * it" dismiss button) so the switch is purely content.
 */

import { useEffect } from 'react'
import { useAnchorPosition } from '@/lib/anchorPositions'
import { useIsDesktop } from '@/hooks/useIsDesktop'
import { useBackdropDismissGuard } from '@/hooks/useBackdropDismissGuard'
import { TeammatePortrait } from './TeammatePortrait'

interface Props {
  open: boolean
  onClose: () => void
  /** When set, the card floats next to this character in the 3D
   *  scene (using lib/anchorPositions). When null/undefined the
   *  card falls back to its legacy centered-modal layout. */
  anchorSlug?: string | null
  /** Diaflow-derived role title (e.g. "Executive Strategy Chief of
   *  Staff"). Pass from `trial.recommendedRole` for anonymous users or
   *  from the User-row column for signed-in users. Shown as the
   *  modal heading whenever set; falls back to "Hi, I'm Mia 👋" when
   *  null. Independent from `reason` — a role without a reason still
   *  swaps the heading. */
  recommendedRole?: string | null
  /** Diaflow-derived rationale. May include `\n` characters (the
   *  upstream returns bullet-style lists separated by newlines). When
   *  set, this REPLACES the default skills checklist. */
  reason?: string | null
  /** When true AND `reason` is null, the modal renders a spinner +
   *  "matching…" message instead of the default skills list. Used
   *  while a backfill `POST /api/job-summary` is in flight — the
   *  parent (TowerLanding) knows when it kicked off the call. */
  loading?: boolean
}

const SKILLS = [
  { icon: '📅', label: 'Schedule meetings + send follow-ups' },
  { icon: '📨', label: 'Triage your inbox + escalate what matters' },
  { icon: '🧾', label: 'Chase invoices, vendor renewals, contracts' },
  { icon: '🗂️', label: 'Keep your team docs and folders tidy' },
  { icon: '🧭', label: 'Onboard new teammates with the right links' },
]

export function MiaInfoCard({ open, onClose, recommendedRole, reason, loading, anchorSlug }: Props) {
  // Subscribe to the character's screen position. When `anchorSlug`
  // is null we pass null to opt out, and the modal falls back to
  // the legacy centered layout. See lib/anchorPositions.ts.
  // Only follow the live character position on desktop. On mobile
  // we render as a bottom sheet — the rAF transform loop would just
  // fight the sheet anchor, so we skip it entirely there.
  const isDesktop = useIsDesktop()
  const anchorRef = useAnchorPosition(
    open && isDesktop ? anchorSlug ?? null : null,
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
  // `if (!open)` early return so the hook order stays stable across
  // renders. See useBackdropDismissGuard for the full writeup.
  const backdropDismissHandlers = useBackdropDismissGuard(open, onClose)

  if (!open) return null

  // Render priority — same gate as MiaInfoBubble in the onboarding
  // flow so the two surfaces stay in sync:
  //   1. loading && !reason → spinner + "matching…"
  //   2. reason             → personalised text (whitespace-pre-line)
  //   3. neither            → default skills checklist
  const hasReason = !!(reason && reason.trim())
  const showLoading = !!loading && !hasReason

  return (
    <div
      role="dialog"
      aria-modal="true"
      // Mobile: bottom-sheet flex container with a dim backdrop.
      // Desktop split:
      //   anchored=true  → transparent overlay; the card is absolutely
      //                    positioned via the anchor ref so the office
      //                    scene behind stays interactive.
      //   anchored=false → centered modal with a dim backdrop (legacy
      //                    fallback when the character slug isn't set).
      className={
        // Sheet's z-40 already paints over the z-30 MobileBottomNav
        // while open. The previous +72px bottom lift was just leaving
        // a dead backdrop band between the sheet's content and the
        // nav — drop it so the sheet sits flush with the viewport
        // bottom edge (its own env(safe-area-inset-bottom) padding
        // still respects the iOS home indicator).
        'fixed inset-0 z-40 flex items-end md:items-center justify-center backdrop-blur-sm bg-black/60 ' +
        (anchored ? 'md:bg-transparent md:backdrop-blur-0' : '')
      }
      {...backdropDismissHandlers}
    >
      <div
        ref={anchored ? anchorRef : undefined}
        onClick={e => e.stopPropagation()}
        className={
          // Wrapper: bottom-sheet on mobile, anchored-or-centered on
          // desktop. When `anchored=true` on desktop we leave the flex
          // and become absolutely positioned at (0,0) so the rAF
          // transform from the anchor ref takes effect.
          'w-full md:w-auto ' +
          (anchored ? 'md:absolute md:top-0 md:left-0 md:pointer-events-none' : '')
        }
        style={anchored ? { willChange: 'transform' } : undefined}
      >
        <div
          className={
            // Card shell — bottom sheet on mobile, normal card on
            // desktop. Mobile flat-tops + sheet grip + safe-area
            // bottom; desktop keeps the existing 2xl rounded card.
            'bg-night-mid border-t border-tower-gold/30 text-tower-cream shadow-2xl ' +
            'rounded-t-3xl md:rounded-2xl md:border md:border-tower-gold/30 ' +
            'pt-3 px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] md:p-6 ' +
            (anchored
              ? 'md:pointer-events-auto md:w-[min(420px,calc(100vw-32px))] md:max-w-md'
              : 'md:max-w-md md:mx-auto')
          }
          style={
            anchored
              ? // Same offset trick used by the other anchored pop-ups:
                // shift the card's left edge to sit beside the
                // character + lift the vertical centre to head height.
                { transform: 'translate(28px, -50%)' }
              : undefined
          }
        >
        {/* Mobile sheet grip — hidden on desktop. */}
        <div className="md:hidden flex justify-center -mt-1 mb-3" aria-hidden>
          <div className="w-9 h-1 rounded-full bg-white/20" />
        </div>

        {/* Close × — absolute top-right so the portrait below can sit
            centered in the full width without competing for layout
            slots with the dismiss control. */}
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-3 text-tower-cream/50 hover:text-tower-cream text-xl leading-none px-2 py-1"
        >
          ×
        </button>

        {/* Mia pixel portrait — matches the 2D minifigure on the floor
            so the modal reads as "Mia speaking". Same shared component
            the other character-tap modals use. */}
        <div className="flex justify-center mb-3">
          <TeammatePortrait slug="mia" />
        </div>

        <div className="mb-4 text-center">
          <h2 className="text-xl">
            {recommendedRole ? `Hi, I'm Mia — your ${recommendedRole}. When AI Teammate launches, I will:` : `Hi, I'm Mia 👋. When AI Teammate launches, I will:`}
          </h2>
        </div>

        {showLoading ? (
          // LOADING — a backfill /api/job-summary call is in flight.
          // Show a spinner instead of the default skills list so the
          // user knows the personalised content is on its way. The
          // "Got it" button below stays enabled — closing the modal
          // doesn't cancel the backfill, the next session picks up
          // the populated DB columns.
          <div className="flex items-start gap-3 py-4 mb-5 rounded-lg border border-purple-500/25 bg-purple-500/5 px-4">
            <CardSpinner />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-purple-200">
                Matching you with the right teammate…
              </p>
              <p className="text-xs text-tower-cream/60 mt-0.5 leading-relaxed">
                Analyzing your role to find your perfect AI teammate.
              </p>
            </div>
          </div>
        ) : hasReason ? (
          // PERSONALISED — Diaflow returned a real rationale. Its
          // upstream returns bullet-style text separated by `\n`, so
          // we split on newlines and render each non-empty line as a
          // styled list item inside the same "What Mia will do for
          // you" card the default branch uses. Leading bullet
          // characters (`-`, `•`, `·`, `*`) are stripped because we
          // supply our own purple bullet glyph for visual consistency.
          <div className="rounded-lg border border-purple-500/25 bg-purple-500/5 px-4 py-3 mb-5">
            <ul className="space-y-2">
              {reason!
                .split('\n')
                .map(line => line.replace(/^[-•·*]\s*/, '').trim())
                .filter(line => line.length > 0)
                .map((line, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className="text-purple-300 mt-0.5 leading-none" aria-hidden>•</span>
                    <span className="text-tower-cream/85">{line}</span>
                  </li>
                ))}
            </ul>
          </div>
        ) : (
          // DEFAULT — `reason` is null. Show the generic "What I do"
          // intro + the static skills checklist so the modal isn't
          // blank for users who skipped onboarding.
          <>
            <p className="text-sm text-tower-cream/80 mb-4">
              I quietly remove friction from your week. Tell me what&apos;s on your plate and
              I&apos;ll handle the next step — so you stay focused on the work that only you
              can do.
            </p>

            <div className="text-[11px] uppercase tracking-widest text-tower-cream/40 mb-2">
              What I do
            </div>
            <ul className="space-y-2 mb-5">
              {SKILLS.map(s => (
                <li key={s.label} className="flex items-start gap-2 text-sm">
                  <span>{s.icon}</span>
                  <span className="text-tower-cream/85">{s.label}</span>
                </li>
              ))}
            </ul>
          </>
        )}

        <button
          onClick={onClose}
          className="w-full px-4 py-2.5 rounded-md bg-tower-gold text-night-deep font-semibold text-sm hover:bg-tower-gold/90"
        >
          Got it
        </button>
        </div>
      </div>
    </div>
  )
}

/** Purple loading spinner. Mirrors MiaInfoBubble's `MiaSpinner` so
 *  the loading affordance feels identical in both Mia surfaces. */
function CardSpinner() {
  return (
    <svg
      className="animate-spin text-purple-300 shrink-0"
      width="22"
      height="22"
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
  )
}
