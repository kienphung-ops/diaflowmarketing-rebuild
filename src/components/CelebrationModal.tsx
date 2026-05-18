'use client'

import { useEffect } from 'react'
import { FLOOR_CONFIG, getFloorConfig } from '@/lib/floors'

interface Props {
  floor: number
  totalInvites: number
  /** When true, render a 'Save your progress' CTA wired to onOpenSignup. */
  trialMode: boolean
  onClose: () => void
  onOpenSignup?: () => void
}

export function CelebrationModal({ floor, totalInvites, trialMode, onClose, onOpenSignup }: Props) {
  const current = getFloorConfig(floor)
  const next = getFloorConfig(floor + 1)
  const invitesToNext = next ? Math.max(0, next.invitesRequired - totalInvites) : 0
  const maxFloor = FLOOR_CONFIG.length

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
      className="fixed inset-0 z-20 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="w-full max-w-md bg-night-mid border border-tower-gold/30 rounded-2xl p-8 text-tower-cream shadow-2xl"
      >
        <div className="text-xs uppercase tracking-widest text-tower-gold/80 mb-1">Level up</div>
        <h2 className="text-3xl font-bold text-white mb-4">
          You&apos;re on Floor <span className="text-tower-gold">{floor}</span>
        </h2>

        {current && (
          <div className="mb-5 px-4 py-3 rounded-lg bg-night-deep/60 border border-white/5">
            <div className="text-[11px] uppercase tracking-wider text-tower-cream/50 mb-1">
              You just unlocked
            </div>
            <div className="text-base font-semibold text-tower-gold">{current.label}</div>
          </div>
        )}

        {next ? (
          <p className="text-sm text-tower-cream/80 mb-6">
            Floor <span className="text-tower-gold font-semibold">{next.floor}</span> unlocks at{' '}
            <span className="text-tower-gold font-semibold">{next.invitesRequired}</span> invites.
            {invitesToNext > 0 && (
              <>
                {' '}
                You&apos;re{' '}
                <span className="text-tower-gold font-semibold">{invitesToNext}</span>{' '}
                {invitesToNext === 1 ? 'invite' : 'invites'} away.
              </>
            )}
          </p>
        ) : (
          <p className="text-sm text-tower-cream/80 mb-6">
            You reached the top — Floor {maxFloor}. Featured at launch.
          </p>
        )}

        <div className="flex gap-2">
          {trialMode && onOpenSignup ? (
            <button
              onClick={() => {
                onClose()
                onOpenSignup()
              }}
              className="flex-1 px-4 py-2.5 rounded-md bg-tower-gold text-night-deep font-semibold text-sm hover:bg-tower-gold/90 transition"
            >
              Save your progress
            </button>
          ) : null}
          <button
            onClick={onClose}
            className={
              trialMode && onOpenSignup
                ? 'px-4 py-2.5 rounded-md bg-night-deep/60 border border-white/10 text-tower-cream/80 text-sm hover:bg-night-deep transition'
                : 'flex-1 px-4 py-2.5 rounded-md bg-tower-gold text-night-deep font-semibold text-sm hover:bg-tower-gold/90 transition'
            }
          >
            {trialMode && onOpenSignup ? 'Keep playing' : 'Continue'}
          </button>
        </div>
      </div>
    </div>
  )
}
