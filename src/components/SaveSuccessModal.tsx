'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { buildShareCopyText } from '@/lib/shareCopy'
import { useFirstShareSpin, creditShareUnlock } from '@/lib/spin/useFirstShareSpin'
import { TeammatePortrait } from './TeammatePortrait'

/**
 * "Your office is saved" congratulations modal.
 *
 * Fires once, right after a successful signup (email or Google OAuth)
 * lands the user back on `/`. The trigger is the `?just_signed_up=1`
 * query param — TowerLanding picks it up, opens this modal, then strips
 * the param so a refresh doesn't replay it.
 *
 * Layout (mirrors requirements/flow/desktop/save-success-modal.html):
 *
 *   ┌─────────────────────────────────────────────────────────┐
 *   │ 🎉                                                       │
 *   │ Your office is saved                                  ×  │
 *   │ <team name> is locked in — waiting for you at launch.    │
 *   ├──────────────────────────────────────────────────────── │
 *   │ Mobile: stacked  ·  Desktop: 2 columns                   │
 *   │                                                          │
 *   │   ┌── YOUR TEAMMATES ──┐    ┌── CLIMB TO FLOOR 2 ──┐    │
 *   │   │ Mia · AI Assistant │    │ <url>            ⧉   │    │
 *   │   │ Iris · AI Recruiter│    │ [X] [LinkedIn] [Copy] │    │
 *   │   │ Leo · AI Demo …    │    └─────────────────────┘    │
 *   │   └────────────────────┘                                │
 *   ├──────────────────────────────────────────────────────── │
 *   │ 🔒 Whatever you earn is yours to keep when we launch.    │
 *   ├──────────────────────────────────────────────────────── │
 *   │ [ Back to my office ]                                   │
 *   └─────────────────────────────────────────────────────────┘
 */

interface TeammateLike {
  name: string
  role: string
  slug?: string | null
}

interface Props {
  open: boolean
  onClose: () => void
  teamName: string | null
  /** First 3 are shown (server seeds Iris/Mia/Leo on signup). */
  teammates: TeammateLike[]
  currentFloor: number
  totalInvites: number
  /** When set, the climb card shows "Climb to Floor N · X invites away".
   *  When null (penthouse) the card swaps to a "Top floor" caption. */
  nextFloor: { id: number; invitesRequired: number } | null
  /** The user's personal invite URL (`origin/floor/<code>`). */
  inviteUrl: string | null
  /** Optional — fires after the celebration-modal share completes the
   *  3 s dwell and the task claim returns. Same hook (and same task
   *  keys) as the drawer / desktop share modal — the very first share
   *  from any of these surfaces pays out the +1 spin. */
  onShareSpinClaimed?: (granted: boolean, tokens?: number) => void
}

// Per-slug accent colours for the avatar tile so Iris / Mia / Leo read
// at a glance. Anything outside the seed list cycles through a palette.
const SLUG_COLOR: Record<string, string> = {
  iris: '#1c2440',
  mia: '#5a8ed8',
  leo: '#6d3fc8',
}
const PALETTE = ['#22c55e', '#f59e0b', '#6366f1', '#ec4899', '#14b8a6']
function avatarColor(slug: string | null | undefined, idx: number): string {
  if (slug && SLUG_COLOR[slug]) return SLUG_COLOR[slug]
  return PALETTE[idx % PALETTE.length]
}

export function SaveSuccessModal({
  open,
  onClose,
  teamName,
  teammates,
  currentFloor,
  totalInvites,
  nextFloor,
  inviteUrl,
  onShareSpinClaimed,
}: Props) {
  const [copied, setCopied] = useState(false)
  const invitesToNext = nextFloor
    ? Math.max(0, nextFloor.invitesRequired - totalInvites)
    : 0

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // Same first-share-spin flow as the drawer + desktop ShareModal +
  // mobile share sheet. MUST live above the early returns below so the
  // hook is called in the same order on every render — moving it down
  // tripped React's "rendered more hooks than during the previous
  // render" guard the first time `open` flipped from false → true.
  const xText = nextFloor
    ? `just built my AI office at diaflow. ${invitesToNext} ${
        invitesToNext === 1 ? 'invite' : 'invites'
      } from unlocking the next level 👀`
    : 'just topped out my AI office at diaflow 🏆'
  const { share: triggerShare, pending: sharePending } = useFirstShareSpin({
    inviteUrl,
    xText,
    onClaim: (_, granted, tokens) => onShareSpinClaimed?.(granted, tokens),
  })

  if (!open) return null
  if (typeof document === 'undefined') return null

  async function handleCopy() {
    if (!inviteUrl) return
    const payload = buildShareCopyText(inviteUrl, invitesToNext, !!nextFloor)
    try {
      await navigator.clipboard.writeText(payload)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
      void creditShareUnlock('copy')
    } catch {
      /* ignore */
    }
  }

  function handleShare(network: 'x' | 'linkedin') {
    if (!inviteUrl) return
    if (network === 'x') {
      triggerShare('x')
    } else {
      triggerShare('linkedin')
    }
  }

  const top3 = teammates.slice(0, 3)
  const displayUrl = inviteUrl
    ? inviteUrl.replace(/^https?:\/\//, '')
    : 'diaflow-tower.app/floor/...'
  void currentFloor // reserved for future copy variants; quiet the lint.

  // ── Sub-blocks rendered both for mobile + desktop ────────────────
  const teammatesCard = (
    <div className="rounded-xl bg-[#1B1A38] border border-[#2A2A4D] p-3.5 md:p-4">
      <div className="text-[11px] uppercase tracking-[0.08em] text-tower-cream/55 font-semibold mb-3">
        Your teammates
      </div>
      <div className="space-y-2.5">
        {top3.map((t, i) => (
          <div key={(t.slug ?? '') + i} className="flex items-center gap-3">
            {/* Voxel portrait — shared with the in-room character so
                the avatar reads as "the actual Iris / Mia / Leo from
                my office", not a generic color tile. Slug picks the
                canonical NPC palette; custom recruits fall back to a
                colour cycle. */}
            <div
              className="shrink-0 w-10 h-10 rounded-lg overflow-hidden flex items-end justify-center"
              style={{ background: avatarColor(t.slug, i) + '33' }}
              aria-hidden
            >
              <TeammatePortrait
                slug={t.slug ?? undefined}
                width={36}
                height={46}
              />
            </div>
            <div className="text-[14px] leading-tight">
              <b className="font-semibold text-tower-cream">{t.name}</b>
              <span className="text-tower-cream/55"> · {t.role}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )

  const climbCard = (
    <div className="rounded-xl bg-[#1B1A38] border border-[#2A2A4D] p-3.5 md:p-4 flex flex-col">
      <div className="flex justify-between items-baseline mb-2.5">
        <div className="text-[11px] uppercase tracking-[0.08em] text-tower-cream/55 font-semibold">
          {nextFloor ? `Reach Level ${nextFloor.id}` : 'Penthouse reached'}
        </div>
        <div className="text-[12px] text-purple-300 font-semibold">
          {nextFloor
            ? `${invitesToNext} ${invitesToNext === 1 ? 'invite' : 'invites'} away`
            : '👑 Max level'}
        </div>
      </div>
      {/* URL bar */}
      <div className="flex items-center gap-2.5 px-3 py-2 rounded-[10px] bg-[#15182E] border border-[#2A2A4D] mb-2.5">
        <span className="flex-1 min-w-0 text-[12.5px] text-tower-cream/80 font-mono truncate">
          {displayUrl}
        </span>
        <button
          onClick={handleCopy}
          aria-label="Copy invite link"
          title={copied ? 'Copied' : 'Copy link'}
          className="shrink-0 text-purple-300 hover:text-purple-200 transition w-6 h-6 inline-flex items-center justify-center"
        >
          {copied ? <span aria-hidden>✓</span> : <CopyGlyph />}
        </button>
      </div>
      {/* Share row */}
      <div className="grid grid-cols-3 gap-1.5 md:gap-2 mt-auto">
        <button
          onClick={() => handleShare('x')}
          disabled={!inviteUrl || sharePending !== null}
          className="flex items-center justify-center gap-1.5 px-2 py-2.5 rounded-[9px] bg-[#15182E] border border-[#2A2A4D] text-[12.5px] text-tower-cream/90 hover:bg-[#1B1A38] transition disabled:opacity-50"
          aria-label="Share on X"
        >
          <span className="w-4 h-4 inline-flex items-center justify-center rounded-sm bg-black text-white text-[9px] font-bold">
            X
          </span>
          X
        </button>
        <button
          onClick={() => handleShare('linkedin')}
          disabled={!inviteUrl || sharePending !== null}
          className="flex items-center justify-center gap-1.5 px-2 py-2.5 rounded-[9px] bg-[#15182E] border border-[#2A2A4D] text-[12.5px] text-tower-cream/90 hover:bg-[#1B1A38] transition disabled:opacity-50"
          aria-label="Share on LinkedIn"
        >
          <span className="w-4 h-4 inline-flex items-center justify-center rounded-sm bg-[#0A66C2] text-white text-[9px] font-bold italic">
            in
          </span>
          LinkedIn
        </button>
        <button
          onClick={handleCopy}
          disabled={!inviteUrl}
          className="flex items-center justify-center gap-1.5 px-2 py-2.5 rounded-[9px] bg-[#15182E] border border-[#2A2A4D] text-[12.5px] text-tower-cream/90 hover:bg-[#1B1A38] transition disabled:opacity-50"
          aria-label="Copy invite link"
        >
          <span className="text-purple-300" aria-hidden>
            🔗
          </span>
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
    </div>
  )

  const reassurance = (
    <div className="flex items-center gap-2.5 px-3.5 py-3 rounded-xl bg-amber-400/[0.08] border border-amber-400/30 text-amber-300 text-[13px] md:text-[14px] leading-relaxed">
      <span className="text-lg shrink-0" aria-hidden>
        🔒
      </span>
      <div>Whatever you earn is yours to keep when we launch.</div>
    </div>
  )

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Your office is saved"
      className="fixed inset-0 z-[80] flex items-end md:items-center justify-center md:p-5"
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-black/65 backdrop-blur-sm"
      />

      {/* Sheet — bottom on mobile, centered card on desktop */}
      <div
        onClick={e => e.stopPropagation()}
        className={
          'relative z-[1] flex flex-col text-tower-cream w-full ' +
          'bg-[#0F1224] ' +
          'rounded-t-3xl md:rounded-[20px] ' +
          'md:max-w-[640px] max-h-[94dvh] overflow-y-auto ' +
          'border-t md:border border-white/10 ' +
          'px-5 pt-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] md:px-8 md:py-7'
        }
        style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }}
      >
        {/* Mobile grip */}
        <div className="md:hidden flex justify-center -mt-2 pb-3" aria-hidden>
          <div className="w-9 h-1 rounded-full bg-white/20" />
        </div>

        {/* Close × */}
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 md:top-5 md:right-5 w-7 h-7 md:w-8 md:h-8 rounded-full bg-[#1B1A38] text-tower-cream/75 hover:text-tower-cream flex items-center justify-center text-sm transition"
        >
          ×
        </button>

        {/* Hero */}
        <div className="text-center mb-5 md:mb-6 mt-1 pr-8">
          <div className="text-[44px] md:text-[48px] leading-none mb-3.5">🎉</div>
          <h2 className="text-[22px] md:text-[26px] font-semibold leading-tight mb-1.5">
            Your office is saved
          </h2>
          <p className="text-[14px] md:text-[15px] text-tower-cream/55 leading-relaxed px-2 md:px-0">
            <span className="text-tower-cream/90 font-semibold">
              {teamName?.trim() || 'Your team'}
            </span>{' '}
            is locked in — waiting for you at launch.
          </p>
        </div>

        {/* ── Mobile stack: teammates → reassurance → climb ─────── */}
        <div className="md:hidden space-y-3 mb-4">
          {teammatesCard}
          {reassurance}
          <div className="border-t border-[#2A2A4D] pt-4">{climbCard}</div>
        </div>

        {/* ── Desktop 2-col grid + reassurance below ─────────────── */}
        <div className="hidden md:grid md:grid-cols-2 gap-3.5 mb-4">
          {teammatesCard}
          {climbCard}
        </div>
        <div className="hidden md:block mb-4">{reassurance}</div>

        {/* Primary CTA — closes the modal back to the office. */}
        <button
          onClick={onClose}
          className="w-full px-4 py-3.5 rounded-xl bg-purple-300 hover:bg-purple-200 text-[#1B1A38] font-semibold text-[15px] transition"
        >
          Back to my office
        </button>
      </div>
    </div>,
    document.body,
  )
}

/** Inline copy-glyph (two overlapping rounded rectangles) so the URL-bar
 *  copy affordance doesn't need an icon-font dependency. */
function CopyGlyph() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V5a2 2 0 0 1 2-2h10" />
    </svg>
  )
}
