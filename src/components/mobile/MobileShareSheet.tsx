'use client'

import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useFloor } from '@/lib/floorsConfigClient'
import { buildShareCopyText } from '@/lib/shareCopy'
import { useShareActions } from '@/hooks/useShareActions'

/**
 * Bottom-sheet share surface for mobile, opened from the
 * MobileBottomNav's hero "Invite to climb" CTA.
 *
 * Section 2 / Screen 7 layout (top → bottom):
 *
 *   1. Header           — "Share to reach Floor N" + small invite-count
 *                         badge on the right.
 *   2. Reward line      — "🎁 Next unlock: <reward>"
 *   3. URL pill         — "Your link" eyebrow + truncated URL with an
 *                         inline Copy button.
 *   4. Share grid       — 3 equal-width buttons (X / LinkedIn / Copy).
 *
 * All share/copy behaviour is centralised in useShareActions, so this
 * sheet behaves identically to every other share surface. Share text
 * lives in lib/shareCopy.ts (copy) + the hook's default (tweet).
 *
 * Hidden on md+ — desktop users go through MySquadDrawer's share row.
 */

interface Props {
  open: boolean
  onClose: () => void
  inviteUrl: string | null
  currentFloor: number
  totalInvites: number
  /** Used by trial users — fired when share is attempted without a
   *  real invite link so we can route them through signup instead of
   *  silently disabling everything. */
  onSignupNudge?: () => void
  /** Optional — fires after the first-share spin claim completes so
   *  the parent can refresh the header token pill / spin badge. */
  onShareSpinClaimed?: (granted: boolean, tokens?: number) => void
}

export function MobileShareSheet({
  open,
  onClose,
  inviteUrl,
  currentFloor,
  totalInvites,
  onSignupNudge,
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
  // credit, first-share spin claim, tracking, and the trial-user signup
  // nudge when there's no link yet) lives in useShareActions — the same
  // hook every other surface uses, so the first share from anywhere pays
  // out the matching spin task. Called before the early returns so the
  // hooks inside run in the same order on every render. xText: null →
  // the hook's default tweet.
  const copyPayload = buildShareCopyText(inviteUrl)
  const { copied, sharePending, shareTo, copy } = useShareActions({
    inviteUrl,
    xText: null,
    copyText: copyPayload,
    source: 'mobile_share',
    onShareSpinClaimed,
    onSignupNudge,
  })

  if (!open) return null
  if (typeof document === 'undefined') return null

  // Display-only version of the URL — strip the protocol so the pill
  // can show more of the meaningful path on narrow screens.
  const displayUrl = inviteUrl
    ? inviteUrl.replace(/^https?:\/\//, '')
    : 'sign up to get your link'

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Share your invite link"
      className="md:hidden fixed inset-0 z-40 flex items-end justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="w-full bg-night-mid border-t border-white/10 rounded-t-3xl text-tower-cream shadow-[0_-16px_40px_rgba(0,0,0,0.5)]"
        style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
      >
        {/* Grip */}
        <div className="flex justify-center pt-2.5 pb-3" aria-hidden>
          <div className="w-9 h-1 rounded-full bg-white/20" />
        </div>

        {/* Header row — title on the left, invite-count badge on the right */}
        <div className="px-5 pb-1 flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <h2 className="text-[18px] font-extrabold leading-tight">
              {nextFloor ? `Share to reach Level ${nextFloor.id}` : 'Share the tower'}
            </h2>
            <p className="text-[12.5px] text-tower-cream/70 leading-snug mt-1">
              <span aria-hidden>🎁 </span>
              <span className="text-tower-cream/55">Next unlock:</span>{' '}
              <span className="text-tower-cream font-semibold">{reward}</span>
            </p>
          </div>
          {nextFloor && (
            <div
              className="shrink-0 rounded-md bg-purple-500/15 border border-purple-400/30 px-2 py-1 text-center min-w-[58px]"
              aria-label={`${invitesToNext} invites to go`}
            >
              <div className="text-[15px] font-extrabold text-purple-200 leading-none">
                {invitesToNext}
              </div>
              <div className="text-[8.5px] tracking-[0.06em] uppercase text-purple-200/70 font-bold mt-0.5">
                {invitesToNext === 1 ? 'invite' : 'invites'}
              </div>
            </div>
          )}
        </div>

        {/* Inline URL + Copy pill */}
        <div className="px-5 pt-3">
          <div className="text-[9.5px] tracking-[0.08em] uppercase text-tower-cream/40 font-bold mb-1.5">
            Your link
          </div>
          <div className="flex items-stretch gap-2">
            <div className="flex-1 min-w-0 rounded-xl bg-night-deep/60 border border-white/10 px-3 py-2.5 font-mono text-[12px] text-tower-cream/85 truncate">
              {displayUrl}
            </div>
            <button
              onClick={copy}
              disabled={!inviteUrl && !onSignupNudge}
              className="shrink-0 rounded-xl bg-tower-gold/15 border border-tower-gold/30 px-3.5 text-[12px] font-bold text-tower-gold hover:bg-tower-gold/25 disabled:opacity-50 disabled:cursor-not-allowed transition"
              aria-label="Copy invite link"
            >
              {copied ? '✓ Copied' : 'Copy'}
            </button>
          </div>
        </div>

        {/* 3-column share grid — X / LinkedIn / Copy */}
        <div className="px-5 pt-3 pb-3 grid grid-cols-3 gap-2">
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
            badgeBg="rgba(255,255,255,0.08)"
            badgeColor="#f5f1e8"
            disabled={!inviteUrl && !onSignupNudge}
            onClick={copy}
          />
        </div>

        {/* Trial users — single nudge replaces the disabled share buttons
            with an actionable claim CTA. */}
        {!inviteUrl && onSignupNudge && (
          <div className="px-5 pb-2">
            <button
              onClick={() => {
                onClose()
                onSignupNudge()
              }}
              className="w-full min-h-[50px] rounded-xl bg-tower-gold text-night-deep font-bold text-[14px] shadow-[0_8px_20px_rgba(251,191,36,0.35)]"
            >
              🔒 Save Your Team to get my invite link →
            </button>
          </div>
        )}
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
      className="min-h-[52px] flex flex-col items-center justify-center gap-1 rounded-xl bg-night-deep/60 border border-white/10 px-2 py-2 text-[11.5px] font-semibold text-tower-cream hover:border-white/20 disabled:opacity-50 disabled:cursor-not-allowed transition"
      aria-label={`Share on ${label}`}
    >
      <span
        className="w-6 h-6 rounded-md inline-flex items-center justify-center text-[12px] shrink-0"
        style={{ background: badgeBg, color: badgeColor }}
        aria-hidden
      >
        {badge}
      </span>
      <span className="leading-none">{label}</span>
    </button>
  )
}
