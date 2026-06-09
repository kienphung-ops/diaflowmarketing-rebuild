'use client'

/**
 * ShareModal — desktop-centered share surface (mockup "Floor preview"
 * section 3, desktop variant). The mobile counterpart is
 * MobileShareSheet (bottom sheet); this is the md+ centered modal.
 *
 * Content + share-intent logic mirror MobileShareSheet exactly so the
 * two stay in lockstep: same headline ("Share to reach Floor N"),
 * reward sub-line, invite-link row, and X / LinkedIn / Copy grid.
 * One source of truth for the copy payload lives in lib/shareCopy.ts.
 */

import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useFloor } from '@/lib/floorsConfigClient'
import { buildShareCopyText } from '@/lib/shareCopy'
import { useShareActions } from '@/hooks/useShareActions'

interface Props {
  open: boolean
  onClose: () => void
  inviteUrl: string | null
  currentFloor: number
  totalInvites: number
  /** Optional — fires after the first-share dwell completes and the
   *  spin task claim returns. Parent uses it to bubble the new banked
   *  token count into the Header pill / spin badge so the user sees
   *  their +1 spin immediately. `granted=false` means the claim was
   *  a no-op (already done or network error). */
  onShareSpinClaimed?: (granted: boolean, tokens?: number) => void
}

export function ShareModal({
  open,
  onClose,
  inviteUrl,
  currentFloor,
  totalInvites,
  onShareSpinClaimed,
}: Props) {
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const nextFloor = useFloor(currentFloor + 1)
  const invitesToNext = nextFloor
    ? Math.max(0, nextFloor.invitesRequired - totalInvites)
    : 0
  const reward = nextFloor
    ? nextFloor.unlockItems?.find(s => s && s.trim().length > 0) ?? nextFloor.label
    : 'Penthouse — keep sharing'

  // All share/copy behaviour (copied flag, clipboard + share-gate
  // credit, first-share spin claim, tracking) lives in useShareActions
  // so every surface stays in lockstep. We only feed it the content:
  // the clipboard payload (xText: null → the hook's default tweet).
  // Called before the early returns so the hooks inside run in the same
  // order on every render.
  const copyPayload = buildShareCopyText(inviteUrl)
  const { copied, sharePending, shareTo, copy } = useShareActions({
    inviteUrl,
    xText: null,
    copyText: copyPayload,
    source: 'share_modal',
    onShareSpinClaimed,
  })

  if (!open) return null
  if (typeof document === 'undefined') return null

  const displayUrl = inviteUrl
    ? inviteUrl.replace(/^https?:\/\//, '')
    : 'sign up to get your link'

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Share your invite link"
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="relative w-full max-w-[460px] bg-night-mid border border-white/10 rounded-2xl text-tower-cream shadow-2xl"
        style={{ boxShadow: '0 30px 80px rgba(0,0,0,0.7)' }}
      >
        {/* Close × */}
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3.5 right-3.5 w-7 h-7 inline-flex items-center justify-center rounded-full bg-white/5 text-tower-cream/60 hover:text-tower-cream hover:bg-white/10 text-base leading-none transition"
        >
          ×
        </button>

        <div className="p-6">
          <h2 className="text-[19px] font-extrabold leading-tight pr-8 mb-1.5">
            {nextFloor ? `Share to reach Level ${nextFloor.id}` : 'Share the tower'}
          </h2>
          <p className="text-[13px] text-tower-cream/70 mb-4">
            {nextFloor
              ? `${invitesToNext} ${invitesToNext === 1 ? 'invite' : 'invites'} to Level ${nextFloor.id} · `
              : ''}
            <span className="text-amber-300 font-semibold">
              <span aria-hidden>🎁 </span>{reward}
            </span>
          </p>

          {/* Invite-link row */}
          <div className="flex items-center gap-2 rounded-xl bg-night-deep/60 border border-white/10 px-3.5 py-2.5 mb-3.5">
            <span className="text-[10px] tracking-[0.06em] uppercase text-tower-cream/40 font-bold whitespace-nowrap">
              Your link
            </span>
            <span className="flex-1 min-w-0 font-mono text-[12.5px] text-tower-cream/85 truncate">
              {displayUrl}
            </span>
            <button
              onClick={copy}
              disabled={!inviteUrl}
              className="shrink-0 rounded-md bg-tower-gold text-night-deep px-3 py-1.5 text-[11.5px] font-extrabold hover:bg-tower-gold/90 disabled:opacity-50 disabled:cursor-not-allowed transition"
              aria-label="Copy invite link"
            >
              {copied ? '✓ Copied' : 'Copy'}
            </button>
          </div>

          {/* 3-column share grid */}
          <div className="grid grid-cols-3 gap-2">
            <ShareBtn
              label="X"
              badge={<span className="font-bold">𝕏</span>}
              badgeBg="#000"
              badgeColor="#fff"
              disabled={!inviteUrl || sharePending !== null}
              onClick={() => shareTo('x')}
            />
            <ShareBtn
              label="LinkedIn"
              badge={<span className="font-extrabold italic">in</span>}
              badgeBg="#0a66c2"
              badgeColor="#fff"
              disabled={!inviteUrl || sharePending !== null}
              onClick={() => shareTo('linkedin')}
            />
            <ShareBtn
              label={copied ? 'Copied' : 'Copy'}
              badge={<span aria-hidden>{copied ? '✓' : '🔗'}</span>}
              badgeBg="rgba(168,117,255,0.2)"
              badgeColor="#c4a3ff"
              disabled={!inviteUrl}
              onClick={copy}
            />
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

function ShareBtn({
  label,
  badge,
  badgeBg,
  badgeColor,
  disabled,
  onClick,
}: {
  label: string
  badge: React.ReactNode
  badgeBg: string
  badgeColor: string
  disabled: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center justify-center gap-2 rounded-xl bg-night-deep/60 border border-white/10 px-3 py-3 text-[13px] font-bold text-tower-cream hover:border-tower-gold/50 disabled:opacity-50 disabled:cursor-not-allowed transition"
      aria-label={`Share on ${label}`}
    >
      <span
        className="w-[22px] h-[22px] rounded-md inline-flex items-center justify-center text-[12px] shrink-0"
        style={{ background: badgeBg, color: badgeColor }}
        aria-hidden
      >
        {badge}
      </span>
      {label}
    </button>
  )
}
