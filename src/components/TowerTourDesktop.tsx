'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { TowerIllustration } from './mobile/TowerTourModal'

/**
 * Desktop 4-step "Tower Tour" — the md+ counterpart to the mobile
 * TowerTourModal. Same four beats + the same `/tower.png` illustration
 * (reused via the exported `TowerIllustration`), but laid out as a
 * centered modal: tower on the LEFT, copy panel on the RIGHT, with the
 * floor highlights shifting per step to direct the eye (mockup
 * "Tower tour" desktop section).
 *
 *   1. Welcome — "20 floors. You're on Floor N."
 *   2. First reward — "Floor 3 unlocks free early beta access."
 *   3. The penthouse — "3 months of Pro free + featured at launch."
 *   4. How you climb — conditional CTA (save / share).
 *
 * Step 4's CTA branches on login state, matching the mobile tour:
 *   - trial   → "Save my team to start climbing →" (opens signup)
 *   - logged  → "Share to start climbing →"          (opens share)
 *
 * Rendered with `hidden md:flex` so it only shows on desktop; mobile
 * keeps the full-screen bottom-sheet TowerTourModal.
 */

interface Props {
  open: boolean
  onClose: () => void
  currentFloor: number
  signedIn: boolean
  onSave?: () => void
  onShare?: () => void
}

const EYEBROWS: Record<number, string> = {
  1: 'Welcome to your tower',
  2: 'Your first real reward',
  3: 'The top of the tower',
  4: 'How you climb',
}

export function TowerTourDesktop({
  open,
  onClose,
  currentFloor,
  signedIn,
  onSave,
  onShare,
}: Props) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // Replay from the top each time the modal re-opens.
  useEffect(() => {
    if (open) setStep(1)
  }, [open])

  if (!open) return null
  if (typeof document === 'undefined') return null

  const body: Record<number, React.ReactNode> = {
    1: (
      <>
        <h2 className="text-[27px] font-extrabold leading-[1.15] tracking-tight mb-4">
          20 floors.{' '}
          <span className="bg-gradient-to-r from-purple-300 to-purple-400 bg-clip-text text-transparent">
            You&apos;re on Floor {currentFloor}.
          </span>
        </h2>
        <p className="text-[14.5px] text-tower-cream/75 leading-relaxed mb-3">
          Your office sits at Floor {currentFloor}, with{' '}
          <strong className="text-tower-cream font-semibold">Mia, Iris, and Leo</strong>{' '}
          already hired.
        </p>
        <p className="text-[14.5px] text-tower-cream/75 leading-relaxed">
          Every floor above adds more AI teammates to your launch-day team — and some
          floors unlock real rewards when AI Teammate ships this summer.
        </p>
      </>
    ),
    2: (
      <>
        <h2 className="text-[27px] font-extrabold leading-[1.15] tracking-tight mb-4">
          Floor 3 unlocks{' '}
          <span className="text-amber-300">free early beta access.</span>
        </h2>
        <p className="text-[14.5px] text-tower-cream/75 leading-relaxed mb-5">
          Climb to Floor 3 and you get to{' '}
          <strong className="text-tower-cream font-semibold">use Diaflow before the public launch</strong>{' '}
          — for free.
        </p>
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-amber-400/10 border border-amber-400/40 text-amber-300 text-[13.5px] font-bold">
          <span aria-hidden>🎁</span>
          Free early beta access — Floor 3 · 2 invites
        </div>
      </>
    ),
    3: (
      <>
        <h2 className="text-[27px] font-extrabold leading-[1.15] tracking-tight mb-4">
          The penthouse:{' '}
          <span className="bg-gradient-to-r from-purple-300 to-purple-400 bg-clip-text text-transparent">
            4 months of Pro free + featured at launch.
          </span>
        </h2>
        <p className="text-[14.5px] text-tower-cream/75 leading-relaxed mb-5">
          Reach Floor 20 and you unlock the{' '}
          <strong className="text-tower-cream font-semibold">full penthouse, 4 months of Diaflow Pro free</strong>,
          plus your team is <strong className="text-tower-cream font-semibold">featured on launch day.</strong>
        </p>
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-purple-500/12 border border-purple-400/40 text-purple-200 text-[13px] font-bold mb-5">
          <span aria-hidden>👑</span>
          <span>Full penthouse</span>
          <span className="text-purple-300/40" aria-hidden>·</span>
          <span>🎁 4 months Pro free</span>
          <span className="text-purple-300/40" aria-hidden>·</span>
          <span className="text-amber-300" aria-hidden>⭐</span>
          <span>Featured</span>
        </div>
        <p className="text-[13.5px] text-tower-cream/55 leading-relaxed">
          It&apos;s the biggest unlock. Most users won&apos;t hit it — but the ones who do
          bring their entire team along.
        </p>
      </>
    ),
    4: (
      <>
        <h2 className="text-[27px] font-extrabold leading-[1.15] tracking-tight mb-4">
          You climb by{' '}
          <span className="bg-gradient-to-r from-purple-300 to-purple-400 bg-clip-text text-transparent">
            inviting friends.
          </span>
        </h2>
        <p className="text-[14.5px] text-tower-cream/75 leading-relaxed mb-3">
          Every invite gets you closer to the next level. Each level unlocks new
          teammates and rewards.
        </p>
        <p className="text-[14.5px] text-tower-cream/80 leading-relaxed">
          Your AI team and your rank are locked in for launch day —{' '}
          <strong className="text-tower-cream font-semibold">but only if you save your team first.</strong>
        </p>
      </>
    ),
  }

  const nextLabel =
    step === 1 ? 'Next: Floor 3 →' : step === 2 ? 'Next: the penthouse →' : 'Next: how to climb →'
  const isLastStep = step === 4

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Tower tour"
      className="hidden md:flex fixed inset-0 z-40 items-center justify-center bg-black/70 backdrop-blur-sm px-6"
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="relative w-[min(1080px,calc(100vw-48px))] h-[min(600px,calc(100vh-64px))] flex rounded-2xl overflow-hidden border border-white/10 bg-night-deep shadow-2xl"
        style={{ boxShadow: '0 30px 90px rgba(0,0,0,0.7)' }}
      >
        {/* Left — tower illustration. The exported TowerIllustration fills
            its relative parent (absolute inset-0) and renders the floor
            highlight markers for the active step. */}
        <div className="relative flex-1 min-w-0">
          <TowerIllustration step={step} currentFloor={currentFloor} />
        </div>

        {/* Right — copy panel. */}
        <div className="relative w-[400px] shrink-0 flex flex-col bg-night-mid border-l border-white/10 px-8 py-7">
          {/* Top row — step counter + dots, × close. */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2.5">
              <span className="text-[11px] font-extrabold uppercase tracking-[0.1em] text-purple-300">
                Step {step} of 4
              </span>
              <div className="flex items-center gap-1.5">
                {[1, 2, 3, 4].map(i => (
                  <span
                    key={i}
                    className={
                      'rounded-full transition-all ' +
                      (i === step ? 'w-5 h-1.5 bg-purple-400' : 'w-1.5 h-1.5 bg-white/20')
                    }
                  />
                ))}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="w-7 h-7 inline-flex items-center justify-center rounded-full bg-white/5 text-tower-cream/60 hover:text-tower-cream hover:bg-white/10 text-base leading-none transition"
            >
              ×
            </button>
          </div>

          {/* Eyebrow + step copy. */}
          <div className="text-[11.5px] font-bold uppercase tracking-[0.1em] text-tower-cream/40 mb-3">
            {EYEBROWS[step]}
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto">{body[step]}</div>

          {/* Footer nav. */}
          {isLastStep ? (
            <div className="pt-5">
              {/* Skip link sits ABOVE the primary CTA on the final
                  step — keeps the soft "not now" out of the way of the
                  hand reaching for the bold purple Save button. */}
              <button
                type="button"
                onClick={onClose}
                className="w-full text-center text-[12.5px] text-tower-cream/55 hover:text-tower-cream/80 underline-offset-2 hover:underline py-2 mb-2"
              >
                Skip — I&apos;ll explore first
              </button>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="px-5 py-3 rounded-xl bg-white/[0.04] border border-white/10 text-tower-cream/85 font-semibold text-[13px] hover:bg-white/[0.08] transition"
                >
                  ← Back
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onClose()
                    if (signedIn) onShare?.()
                    else onSave?.()
                  }}
                  className="flex-1 px-5 py-3 rounded-xl bg-gradient-to-b from-purple-300 to-purple-400 text-night-deep font-extrabold text-[13.5px] shadow-[0_8px_24px_rgba(168,117,255,0.4)] hover:shadow-[0_12px_28px_rgba(168,117,255,0.5)] transition"
                >
                  {signedIn ? 'Share to start climbing →' : 'Save my team to start climbing →'}
                </button>
              </div>
            </div>
          ) : (
            <div className="pt-5 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setStep(s => (s > 1 ? ((s - 1) as 1 | 2 | 3 | 4) : 1))}
                disabled={step === 1}
                className="px-5 py-3 rounded-xl bg-white/[0.04] border border-white/10 text-tower-cream/85 font-semibold text-[13px] hover:bg-white/[0.08] transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                ← Back
              </button>
              <button
                type="button"
                onClick={() => setStep(s => (s < 4 ? ((s + 1) as 1 | 2 | 3 | 4) : 4))}
                className="flex-1 px-5 py-3 rounded-xl bg-gradient-to-b from-purple-300 to-purple-400 text-night-deep font-extrabold text-[13.5px] shadow-[0_8px_24px_rgba(168,117,255,0.4)] hover:shadow-[0_12px_28px_rgba(168,117,255,0.5)] transition"
              >
                {nextLabel}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
