'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

/**
 * 4-step "Tower Tour" onboarding for mobile.
 *
 * Fires the moment the user lands on `/tower` for the first time
 * after the post-Leo "Tap the Tower" nudge. A simplified illustration
 * of the 20-floor tower fills the upper half; a bottom sheet steps
 * through four beats:
 *
 *   1. "20 floors. You're on Floor 1." — current-floor highlight
 *   2. "Floor 3 unlocks free early beta access." — gold milestone
 *   3. "The penthouse: 3-mo Pro free + featured." — Floor 14 + 20
 *   4. "You climb by inviting friends." — conditional CTA
 *
 * Step 4's CTA branches on login state:
 *   - trial   → "Save my team to start climbing →"  (opens signup)
 *   - logged  → "Share to start climbing →"          (opens share)
 *
 * Mobile-only (md:hidden). Desktop has the existing HowItWorksModal
 * surface and doesn't need a tour.
 */

interface Props {
  open: boolean
  onClose: () => void
  /** Current floor of the user — drives the "You're on Floor N"
   *  highlight + the bottom-sheet copy in step 1. */
  currentFloor: number
  /** Login state — drives the step-4 CTA copy + handler. */
  signedIn: boolean
  /** Fired on step 4 when the trial user taps "Save my team to start
   *  climbing →". Parent opens the SignupModal. */
  onSave?: () => void
  /** Fired on step 4 when the signed-in user taps "Share to start
   *  climbing →". Parent opens the MobileShareSheet. */
  onShare?: () => void
}

export function TowerTourModal({
  open,
  onClose,
  currentFloor,
  signedIn,
  onSave,
  onShare,
}: Props) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)

  // ESC closes — mirrors the rest of the modal stack.
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // Reset to step 1 whenever the modal re-opens — replays from the top.
  useEffect(() => {
    if (open) setStep(1)
  }, [open])

  if (!open) return null
  if (typeof document === 'undefined') return null

  // ── Per-step content ──────────────────────────────────────────────
  const stepCopy: Record<number, React.ReactNode> = {
    1: (
      <>
        <h2 className="text-[18px] font-extrabold leading-tight tracking-tight mb-2">
          20 floors.{' '}
          <span className="bg-gradient-to-r from-purple-300 to-purple-400 bg-clip-text text-transparent">
            You&apos;re on Floor {currentFloor}.
          </span>
        </h2>
        <p className="text-[13px] text-tower-cream/70 leading-relaxed">
          Your office sits at Floor {currentFloor}, with{' '}
          <strong className="text-tower-cream font-semibold">Iris, Mia, Leo</strong> hired.
        </p>
      </>
    ),
    2: (
      <>
        <h2 className="text-[18px] font-extrabold leading-tight tracking-tight mb-2">
          Floor 3 unlocks{' '}
          <span className="text-amber-300">free early beta access.</span>
        </h2>
        <p className="text-[13px] text-tower-cream/70 leading-relaxed mb-3">
          Climb to Floor 3 and{' '}
          <strong className="text-tower-cream font-semibold">use Diaflow before the public launch</strong>{' '}
          — free.
        </p>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-400/15 border border-amber-400/40 text-amber-300 text-[11px] font-extrabold">
          🎁 Free early beta · 2 invites
        </span>
      </>
    ),
    3: (
      <>
        <h2 className="text-[18px] font-extrabold leading-tight tracking-tight mb-2">
          The penthouse:{' '}
          <span className="bg-gradient-to-r from-purple-300 to-purple-400 bg-clip-text text-transparent">
            3-mo Pro free + featured.
          </span>
        </h2>
        <p className="text-[13px] text-tower-cream/70 leading-relaxed mb-3">
          Reach Floor 20, get the{' '}
          <strong className="text-tower-cream font-semibold">
            full penthouse + 3 months of Pro free + featured at launch.
          </strong>
        </p>
        {/* Combined reward pill — single purple-tinted capsule listing
            all three rewards together. Per user feedback the previous
            three separate tags read as visual clutter; the unified
            pill keeps the same info but reads as one statement of the
            penthouse bundle. */}
        <div className="flex justify-center">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-purple-500/15 border border-purple-400/40 text-purple-200 text-[11.5px] font-bold whitespace-nowrap">
            <span aria-hidden>👑</span>
            <span>Penthouse</span>
            <span className="text-purple-300/50" aria-hidden>·</span>
            <span>3-mo Pro</span>
            <span className="text-purple-300/50" aria-hidden>·</span>
            <span className="text-amber-300" aria-hidden>⭐</span>
            <span>Featured</span>
          </span>
        </div>
      </>
    ),
    4: (
      <>
        <h2 className="text-[18px] font-extrabold leading-tight tracking-tight mb-2">
          You climb by{' '}
          <span className="bg-gradient-to-r from-purple-300 to-purple-400 bg-clip-text text-transparent">
            inviting friends.
          </span>
        </h2>
        <p className="text-[13px] text-tower-cream/70 leading-relaxed mb-2">
          Every invite gets you closer to the next floor. Each floor unlocks new teammates and rewards.
        </p>
        <p className="text-[13px] text-tower-cream font-semibold leading-relaxed">
          But only if you save your team first.
        </p>
      </>
    ),
  }

  const isLastStep = step === 4

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Tower tour"
      className="md:hidden fixed inset-0 z-40 flex flex-col bg-night-deep"
    >
      {/* Top header — logo + Skip */}
      <header className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-white/5">
        <div className="flex items-center gap-2 text-[14px] font-extrabold text-tower-cream">
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-white text-night-deep font-black text-[12px] font-serif">
            D
          </span>
          Tower Tour
        </div>
        <button
          type="button"
          onClick={onClose}
          className="px-3 py-1 rounded-lg bg-white/[0.04] border border-white/10 text-[11.5px] font-semibold text-tower-cream/70 hover:text-tower-cream transition"
        >
          Skip
        </button>
      </header>

      {/* Tower illustration — fills the upper half. Step drives which
          floor(s) get the highlight ring + label overlays. */}
      <div className="flex-1 min-h-0 relative overflow-hidden">
        <TowerIllustration step={step} currentFloor={currentFloor} />
      </div>

      {/* Bottom sheet — step copy + Back / Next nav. Anchored bottom
          with rounded top and safe-area padding. */}
      <div
        className="shrink-0 bg-night-mid border-t border-white/10 rounded-t-3xl px-5 pt-3"
        style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
      >
        <div className="flex justify-center pt-1 pb-3" aria-hidden>
          <div className="w-9 h-1 rounded-full bg-white/20" />
        </div>

        <div className="text-center text-[10.5px] font-bold uppercase tracking-[0.1em] text-purple-300 mb-2">
          Step {step} of 4
        </div>

        <div className="text-center mb-4">{stepCopy[step]}</div>

        {/* Step-4 hero CTA — branches on login state. Both flows close
            the tour first; parent opens the relevant sheet right after. */}
        {isLastStep ? (
          <>
            <button
              type="button"
              onClick={() => {
                onClose()
                if (signedIn) onShare?.()
                else onSave?.()
              }}
              className="w-full px-4 py-3.5 rounded-xl bg-gradient-to-b from-purple-300 to-purple-400 text-night-deep font-extrabold text-[14.5px] shadow-[0_8px_24px_rgba(168,117,255,0.4)] hover:shadow-[0_12px_28px_rgba(168,117,255,0.5)] transition mb-2"
            >
              {signedIn
                ? 'Share to start climbing →'
                : 'Save my team to start climbing →'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-full text-center text-[12px] text-tower-cream/55 underline-offset-2 hover:underline py-1"
            >
              Skip — I&apos;ll explore first
            </button>
          </>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setStep((s) => (s > 1 ? ((s - 1) as 1 | 2 | 3 | 4) : 1))}
              disabled={step === 1}
              className="px-4 py-3 rounded-xl bg-white/[0.04] border border-white/10 text-tower-cream/85 font-semibold text-[12px] transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ← Back
            </button>
            <button
              type="button"
              onClick={() => setStep((s) => (s < 4 ? ((s + 1) as 1 | 2 | 3 | 4) : 4))}
              className="px-4 py-3 rounded-xl bg-gradient-to-b from-purple-300 to-purple-400 text-night-deep font-extrabold text-[12px] shadow-[0_6px_16px_rgba(168,117,255,0.35)] hover:shadow-[0_10px_22px_rgba(168,117,255,0.45)] transition"
            >
              {step === 1 && 'Next: Floor 3 →'}
              {step === 2 && 'Next: penthouse →'}
              {step === 3 && 'Next: how to climb →'}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}

/**
 * Tower illustration — renders the canonical `/public/tower.png`
 * bitmap (same asset used by /tower) and overlays per-step highlight
 * markers on top.
 *
 * Per-step markers:
 *   - Step 1: 📍 You at currentFloor.
 *   - Step 2: gold ring + "🎁 Free beta" tag at Floor 3, plus the
 *             current-floor You marker.
 *   - Step 3: gold ring at Floor 14, purple ring + "👑 Penthouse"
 *             tag at Floor 20, plus the current-floor You marker.
 *   - Step 4: 📍 You at currentFloor (Floor 3 milestone still glows
 *             so the user keeps their bearings).
 *
 * Floor positions are computed from the same linear interpolation
 * TowerView uses, so the markers land on the exact same bitmap rows
 * as the YOU pin on /tower.
 */
export function TowerIllustration({ step, currentFloor }: { step: 1 | 2 | 3 | 4; currentFloor: number }) {
  // Same calibration constants as components/TowerView.tsx — the
  // /tower.png bitmap has Floor 1's label at ~90% from the top and
  // Floor 20's at ~12%. The tower also tilts very slightly to the
  // right as it climbs, so left% slides from 50 → 54.
  const BOTTOM_TOP_PCT = 90
  const TOP_TOP_PCT = 12
  const BOTTOM_LEFT_PCT = 50
  const TOP_LEFT_PCT = 54
  const TOTAL = 20
  const floorPos = (f: number) => {
    const t = (Math.max(1, Math.min(TOTAL, f)) - 1) / (TOTAL - 1)
    return {
      top: BOTTOM_TOP_PCT - t * (BOTTOM_TOP_PCT - TOP_TOP_PCT),
      left: BOTTOM_LEFT_PCT + t * (TOP_LEFT_PCT - BOTTOM_LEFT_PCT),
    }
  }

  // Decide which markers to render based on the current step.
  //   Step 2 — Floor 3 "Free beta" highlight (focal point of the beat)
  //   Step 3 — Floor 20 "Penthouse" highlight ONLY (no Floor 3 / 14
  //            distractions — the bottom-sheet copy already lists
  //            penthouse + 3-mo Pro + featured, so extra rings on
  //            mid-floors just added visual noise)
  const showMilestone = step === 2
  const showPenthouse = step === 3

  const youPos = floorPos(currentFloor)
  const milestonePos = floorPos(3)
  const penthousePos = floorPos(TOTAL)

  return (
    <div
      className="absolute inset-0 flex items-center justify-center overflow-hidden"
      style={{
        background:
          'radial-gradient(ellipse 80% 60% at 50% 40%, #1d1b46 0%, #0a0a22 55%, #04040d 100%)',
      }}
    >
      {/* Faint star backdrop — same cosmetic treatment the /tower
          page uses so the tour reads as a continuation of that view. */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          backgroundImage:
            'radial-gradient(circle at 18% 22%, rgba(255,255,255,0.5) 0px, transparent 1.4px), radial-gradient(circle at 82% 14%, rgba(255,255,255,0.45) 0px, transparent 1.2px), radial-gradient(circle at 36% 60%, rgba(255,255,255,0.35) 0px, transparent 1px), radial-gradient(circle at 70% 75%, rgba(255,255,255,0.4) 0px, transparent 1px), radial-gradient(circle at 12% 80%, rgba(255,255,255,0.3) 0px, transparent 1px)',
        }}
      />

      {/* Tower bitmap wrapper. inline-block so the wrapper rect
          matches the image's intrinsic bounds → per-floor markers
          positioned in % land on the right pixels regardless of how
          the image scales to fit the viewport. */}
      <div className="relative inline-block h-full max-h-full">
        {/* Soft golden halo behind the tower (same as TowerView). */}
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse 40% 50% at 50% 38%, rgba(251, 191, 36, 0.18) 0%, transparent 65%)',
          }}
        />

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/tower.png"
          alt="Diaflow Tower"
          className="block select-none drop-shadow-[0_20px_40px_rgba(0,0,0,0.5)]"
          draggable={false}
          style={{
            maxHeight: '100%',
            maxWidth: '100%',
            height: 'auto',
            width: 'auto',
          }}
        />

        {/* Penthouse marker (step 3) — purple ring + "👑 Penthouse"
            tag on the right of the floor row. Step 3 deliberately
            shows ONLY this + the You marker so the user's attention
            is funnelled to the top reward. */}
        {showPenthouse && (
          <FloorMarker
            pos={penthousePos}
            ringClass="ring-2 ring-purple-300 shadow-[0_0_24px_rgba(168,117,255,0.55)]"
            label="👑 Penthouse"
            labelSide="right"
            labelTone="purple"
          />
        )}

        {/* Milestone marker (step 2 only) — gold ring around Floor 3
            with "🎁 Free beta" tag on the left. Step 3 drops it so
            the penthouse beat reads clean. */}
        {showMilestone && (
          <FloorMarker
            pos={milestonePos}
            ringClass="ring-2 ring-amber-300 shadow-[0_0_18px_rgba(251,191,36,0.4)]"
            label="🎁 Free beta"
            labelSide="left"
            labelTone="gold"
          />
        )}

        {/* "📍 You" marker — always shows the user's current floor
            so they keep their bearings as the tour scrolls through
            future milestones. */}
        <FloorMarker
          pos={youPos}
          ringClass="ring-2 ring-purple-400 shadow-[0_0_22px_rgba(168,117,255,0.55)]"
          label="📍 You"
          labelSide="right"
          labelTone="neutral"
        />
      </div>
    </div>
  )
}

/**
 * One floor highlight overlay — a ringed pill positioned absolutely
 * over the tower bitmap at the given (top%, left%) using TowerView's
 * calibration. The ring's width is fixed at ~38% of the bitmap so it
 * spans the floor visually; the label floats to the configured side.
 */
function FloorMarker({
  pos,
  ringClass,
  label,
  labelSide = 'right',
  labelTone = 'neutral',
}: {
  pos: { top: number; left: number }
  ringClass: string
  label?: string
  labelSide?: 'left' | 'right'
  labelTone?: 'neutral' | 'purple' | 'gold'
}) {
  const labelClasses =
    labelTone === 'purple'
      ? 'bg-purple-500/20 border-purple-400/50 text-purple-200'
      : labelTone === 'gold'
      ? 'bg-amber-400/15 border-amber-400/40 text-amber-300'
      : 'bg-night-mid/95 border-white/15 text-tower-cream'
  return (
    <div
      className="absolute pointer-events-none"
      style={{
        top: `${pos.top}%`,
        left: `${pos.left}%`,
        transform: 'translate(-50%, -50%)',
      }}
    >
      {/* Ring — sized to ~38% of the bitmap width so it spans the
          floor row at the typical aspect ratio. h-[14px] keeps the
          ring crisp at any image scale. */}
      <div
        className={`rounded-[3px] ${ringClass}`}
        style={{ width: '40px', height: '14px' }}
      />

      {label && (
        <span
          className={
            'absolute top-1/2 -translate-y-1/2 inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10.5px] font-bold whitespace-nowrap ' +
            labelClasses +
            (labelSide === 'right' ? ' left-full ml-2' : ' right-full mr-2')
          }
        >
          {label}
        </span>
      )}
    </div>
  )
}
