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
        <div className="flex flex-wrap gap-1.5">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-500/15 border border-purple-400/40 text-purple-200 text-[10.5px] font-bold">
            👑 Penthouse
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-500/15 border border-purple-400/40 text-purple-200 text-[10.5px] font-bold">
            3-mo Pro
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-400/15 border border-amber-400/40 text-amber-300 text-[10.5px] font-bold">
            ⭐ Featured
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
              className="px-4 py-3 rounded-xl bg-white/[0.04] border border-white/10 text-tower-cream/85 font-semibold text-[14px] transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ← Back
            </button>
            <button
              type="button"
              onClick={() => setStep((s) => (s < 4 ? ((s + 1) as 1 | 2 | 3 | 4) : 4))}
              className="px-4 py-3 rounded-xl bg-gradient-to-b from-purple-300 to-purple-400 text-night-deep font-extrabold text-[14px] shadow-[0_6px_16px_rgba(168,117,255,0.35)] hover:shadow-[0_10px_22px_rgba(168,117,255,0.45)] transition"
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
 * Lightweight tower illustration — 20 stacked orange "floor" bars in
 * a centered column. Highlights are layered overlays:
 *
 *   - Floor `currentFloor` always glows purple with a "📍 You" pill
 *   - Step 2 adds a gold ring around Floor 3 + "🎁 Free beta" tag
 *   - Step 3 adds gold ring around Floor 14 + purple ring around
 *     Floor 20 + "👑 Penthouse" pill
 *   - Step 4 returns to the Floor-1 focus from step 1
 *
 * Built from divs (not SVG) so the highlights can use Tailwind colours
 * + shadow utilities directly.
 */
function TowerIllustration({ step, currentFloor }: { step: 1 | 2 | 3 | 4; currentFloor: number }) {
  const totalFloors = 20
  // Render top-to-bottom (floor 20 on top, floor 1 on the bottom) so
  // the visual hierarchy matches a real building.
  const floors = Array.from({ length: totalFloors }, (_, i) => totalFloors - i)
  const showMilestone = step === 2 || step === 3
  const showPenthouse = step === 3
  return (
    <div
      className="absolute inset-0 flex items-end justify-center pb-6 pt-6"
      style={{
        background:
          'radial-gradient(circle at 50% 70%, rgba(168,117,255,0.18), transparent 65%)',
      }}
    >
      {/* Faint star backdrop — pure cosmetic, matches the mockup */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          backgroundImage:
            'radial-gradient(circle at 18% 22%, rgba(255,255,255,0.45) 0px, transparent 1.2px), radial-gradient(circle at 82% 14%, rgba(255,255,255,0.4) 0px, transparent 1px), radial-gradient(circle at 36% 60%, rgba(255,255,255,0.3) 0px, transparent 1px), radial-gradient(circle at 70% 75%, rgba(255,255,255,0.35) 0px, transparent 1px)',
        }}
      />

      <div className="relative flex flex-col items-center gap-[3px] w-[140px]">
        {floors.map((floorId) => {
          const isCurrent = floorId === currentFloor
          const isMilestone = showMilestone && floorId === 3
          const isMidMilestone = showPenthouse && floorId === 14
          const isPenthouse = showPenthouse && floorId === totalFloors

          // Per-floor ring colour. Multiple highlights stack at once
          // because each floor only ever matches one branch (3 / 14 /
          // 20 / currentFloor are distinct).
          let ringClass = ''
          if (isPenthouse) ringClass = 'ring-2 ring-purple-300 shadow-[0_0_24px_rgba(168,117,255,0.55)]'
          else if (isMidMilestone) ringClass = 'ring-2 ring-amber-300 shadow-[0_0_18px_rgba(251,191,36,0.4)]'
          else if (isMilestone) ringClass = 'ring-2 ring-amber-300 shadow-[0_0_18px_rgba(251,191,36,0.4)]'
          else if (isCurrent) ringClass = 'ring-2 ring-purple-400 shadow-[0_0_22px_rgba(168,117,255,0.55)]'

          return (
            <div key={floorId} className="relative w-full">
              <div
                className={
                  'h-[14px] w-full rounded-[3px] ' +
                  (isCurrent || isMilestone || isMidMilestone || isPenthouse
                    ? 'bg-gradient-to-b from-[#d28a45] to-[#b8702f] '
                    : 'bg-gradient-to-b from-[#c4793b] to-[#9d5c24] ') +
                  ringClass
                }
              />

              {/* Side labels — only appear when the relevant step
                  activates them. Positioned absolutely so they don't
                  push the tower column wider. */}
              {isCurrent && step !== 4 && step !== 3 && (
                <span className="absolute -right-[68px] top-1/2 -translate-y-1/2 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-night-mid border border-white/10 text-[10.5px] font-bold text-tower-cream">
                  📍 You
                </span>
              )}
              {isCurrent && (step === 4) && (
                <span className="absolute -right-[68px] top-1/2 -translate-y-1/2 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-night-mid border border-white/10 text-[10.5px] font-bold text-tower-cream">
                  📍 You
                </span>
              )}
              {isMilestone && (
                <span className="absolute -left-[80px] top-1/2 -translate-y-1/2 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-400/15 border border-amber-400/40 text-amber-300 text-[10.5px] font-extrabold whitespace-nowrap">
                  🎁 Free beta
                </span>
              )}
              {isPenthouse && (
                <span className="absolute -right-[88px] top-1/2 -translate-y-1/2 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-night-mid border border-white/10 text-[10.5px] font-bold text-tower-cream whitespace-nowrap">
                  👑 Penthouse
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
