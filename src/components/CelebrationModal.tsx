'use client'

import { useEffect, useMemo } from 'react'
import { useFloor, useFloorCount } from '@/lib/floorsConfigClient'

interface Props {
  floor: number
  totalInvites: number
  /** When true, the modal renders the trial-flavoured CTA + sign-up nudge. */
  trialMode: boolean
  /** Number of floors climbed in this jump (defaults to 1). Shown in the +N badge. */
  floorsClimbed?: number
  onClose: () => void
  onOpenSignup?: () => void
}

// Decorative confetti — pure CSS dots scattered across the modal. Memoised
// per render of the modal so they don't reshuffle on every state change.
function useConfetti(count = 28) {
  return useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const seed = i * 17 + 31
        return {
          left: (seed * 13) % 100,
          top: (seed * 7) % 100,
          rot: (seed * 31) % 360,
          color: ['#fbbf24', '#a855f7', '#22c55e', '#3b82f6', '#ec4899'][i % 5],
          shape: i % 3 === 0 ? 'circle' : i % 3 === 1 ? 'rect' : 'tri',
        }
      }),
    [count]
  )
}

function ConfettiLayer() {
  const pieces = useConfetti(32)
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
      {pieces.map((p, i) => (
        <span
          key={i}
          className="absolute"
          style={{
            left: `${p.left}%`,
            top: `${p.top}%`,
            transform: `rotate(${p.rot}deg)`,
            width: p.shape === 'tri' ? 0 : 6,
            height: p.shape === 'rect' ? 9 : 6,
            background: p.shape === 'tri' ? 'transparent' : p.color,
            borderRadius: p.shape === 'circle' ? '50%' : 1,
            borderLeft: p.shape === 'tri' ? '4px solid transparent' : undefined,
            borderRight: p.shape === 'tri' ? '4px solid transparent' : undefined,
            borderBottom: p.shape === 'tri' ? `7px solid ${p.color}` : undefined,
            opacity: 0.7,
          }}
        />
      ))}
    </div>
  )
}

// Small SVG-ish placeholder icon for each unlock — just a stylised box
// since we don't have per-item illustrations. The actual item is named
// below so the icon is decorative.
function UnlockIcon() {
  return (
    <div className="mx-auto w-20 h-20 rounded-xl bg-gradient-to-br from-tower-gold/30 to-purple-500/20 flex items-center justify-center shadow-inner">
      <div className="w-12 h-12 rounded-md bg-gradient-to-br from-purple-700 to-purple-900 shadow-lg" />
    </div>
  )
}

export function CelebrationModal({
  floor,
  totalInvites,
  trialMode,
  floorsClimbed = 1,
  onClose,
  onOpenSignup,
}: Props) {
  // Live config from /api/floors. `useFloor` returns the static fallback
  // until the API responds, so values render synchronously on first paint.
  const current = useFloor(floor)
  const next = useFloor(floor + 1)
  const invitesToNext = next ? Math.max(0, next.invitesRequired - totalInvites) : 0
  const maxFloor = useFloorCount()
  const teammateSlots = current?.maxTeammates ?? 4
  const rank = Math.max(1, 500 - totalInvites * 7)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-30 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="relative w-full max-w-md bg-gradient-to-b from-night-mid to-night-deep border border-tower-gold/30 rounded-2xl text-tower-cream shadow-2xl overflow-hidden"
      >
        <ConfettiLayer />

        <div className="relative p-7 pb-5">
          <h2 className="text-3xl md:text-4xl font-bold text-center leading-tight">
            You&apos;re on Floor <span className="text-tower-gold">{floor}</span>
          </h2>
          <p className="mt-1 text-center text-sm text-tower-cream/70">
            Your office is filling up — here&apos;s what you just earned.
          </p>

          {current && (
            <div className="mt-5 rounded-xl bg-night-deep/70 border border-white/5 p-5 text-center">
              <div className="text-[10px] uppercase tracking-widest text-tower-gold/80 mb-3">
                New decor unlocked
              </div>
              <UnlockIcon />
              <div className="mt-3 text-lg font-bold">{current.label}</div>
              <p className="mt-1 text-xs text-tower-cream/60">
                A new addition for your AI teammates. Now installed in your office.
              </p>
            </div>
          )}

          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-night-deep/50 border border-white/5 px-2 py-3">
              <div className="text-base font-bold text-tower-gold">+{floorsClimbed}</div>
              <div className="text-[10px] uppercase tracking-wider text-tower-cream/50 mt-0.5">
                Floors climbed
              </div>
            </div>
            <div className="rounded-lg bg-night-deep/50 border border-white/5 px-2 py-3">
              <div className="text-base font-bold text-tower-gold">{teammateSlots}</div>
              <div className="text-[10px] uppercase tracking-wider text-tower-cream/50 mt-0.5">
                Teammate slots
              </div>
            </div>
            <div className="rounded-lg bg-night-deep/50 border border-white/5 px-2 py-3">
              <div className="text-base font-bold text-tower-gold">#{rank}</div>
              <div className="text-[10px] uppercase tracking-wider text-tower-cream/50 mt-0.5">
                New rank
              </div>
            </div>
          </div>

          {next ? (
            <div className="mt-4 rounded-lg bg-night-deep/40 border border-white/5 px-3 py-2 flex items-center gap-3">
              <div className="text-2xl shrink-0">📦</div>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] uppercase tracking-wider text-tower-cream/50">
                  Next up — Floor {next.id}
                </div>
                <div className="text-sm truncate">
                  <span className="text-tower-gold font-semibold">{invitesToNext}</span> more{' '}
                  {invitesToNext === 1 ? 'invite' : 'invites'} to unlock {next.label}
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-lg bg-tower-gold/10 border border-tower-gold/30 px-3 py-2 text-sm text-center text-tower-gold">
              You reached Floor {maxFloor} — penthouse unlocked. Featured at launch 🎉
            </div>
          )}

          {/* CTA stack. The old layout had a primary "Share & climb to
              floor N" button stacked above a tiny text link "See it in
              my office". We removed the share CTA (sharing already
              lives in the header Invite-link button + MySquad drawer
              — a third path here was redundant and pushed users away
              from the modal). "See it in my office" is now the
              primary action, promoted from text-link to button, so
              the modal has a single clear next-step.

              Trial mode still surfaces "Save your progress" since
              that's a genuinely different upsell, and the penthouse
              ending keeps its own copy. */}
          <div className="mt-5 flex flex-col gap-2">
            {trialMode && onOpenSignup ? (
              <button
                onClick={() => {
                  onClose()
                  onOpenSignup()
                }}
                className="w-full px-4 py-3 rounded-md bg-tower-gold text-night-deep font-semibold text-sm hover:bg-tower-gold/90 transition"
              >
                Save your progress →
              </button>
            ) : !next ? (
              <button
                onClick={onClose}
                className="w-full px-4 py-3 rounded-md bg-tower-gold text-night-deep font-semibold text-sm hover:bg-tower-gold/90"
              >
                Enjoy the penthouse
              </button>
            ) : (
              <button
                onClick={onClose}
                className="w-full px-4 py-3 rounded-md bg-tower-gold text-night-deep font-semibold text-sm hover:bg-tower-gold/90 transition"
              >
                See it in my office →
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
