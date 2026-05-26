'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useFloorsConfig, useFloor } from '@/lib/floorsConfigClient'
import { buildShareCopyText } from '@/lib/shareCopy'

interface Props {
  open: boolean
  onClose: () => void
  inviteUrl: string | null
  /** Current floor — used to compute next-floor delta for the Copy
   *  button's enriched payload + the YOU marker in the table. */
  currentFloor?: number
  /** User's cumulative invites. */
  totalInvites?: number
  /** Trial → Save CTA in the footer. When undefined the footer
   *  falls back to the share row (signed-in case). */
  onOpenSignup?: () => void
}

/**
 * "Every floor, every unlock" rewards modal.
 *
 * Rewritten to match the mobile mockup (Section 4, screens 12/13):
 *
 *   ┌─────────────────────────────────────────┐
 *   │ Every floor, every unlock           ×   │
 *   │ 20 floors. Climb by inviting friends.   │
 *   ├──────────────────────────────────────── │
 *   │ FLOOR · INVITES · REWARDS               │
 *   ├──────────────────────────────────────── │
 *   │ 1 [YOU] · — · Hire 3 · 🖼 Frame + desk │ ← current row (accent)
 *   │ 2      · 1 · Hire 4 · 💡 Lamp + chair  │
 *   │ 3      · 2 · Hire 5 · 🪑 …  🚀 Free beta│ ← milestone (gold)
 *   │ …                                       │
 *   │ 20     · 108 · 👑 Penthouse · 3-mo Pro… │ ← penthouse (purple)
 *   ├──────────────────────────────────────── │
 *   │ FOOTER (swaps by login state):          │
 *   │   pre-login  → ⚠ glow card + Save CTA   │
 *   │   logged-in  → Share to reach Floor N   │
 *   └─────────────────────────────────────────┘
 *
 * Rows color-code by tier so the user can scan to "what matters":
 *   current floor       → accent (purple) + YOU badge
 *   milestone (real)    → gold left-border + gold floor/invites
 *   penthouse (final)   → purple-tinted gradient
 *   regular             → muted opacity
 *
 * A floor is treated as a "milestone" when `productReward` is set
 * (non-empty string) — those are the floors where Diaflow promises
 * something real (free beta, free Pro months, featured-at-launch).
 * Decor-only floors stay muted.
 */
export function HowItWorksModal({
  open,
  onClose,
  inviteUrl,
  currentFloor = 1,
  totalInvites = 0,
  onOpenSignup,
}: Props) {
  const [copied, setCopied] = useState(false)
  const floors = useFloorsConfig()
  const nextFloor = useFloor(currentFloor + 1)
  const invitesToNext = nextFloor
    ? Math.max(0, nextFloor.invitesRequired - totalInvites)
    : 0

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!open) return null
  if (typeof document === 'undefined') return null

  // ── Share payload (post-login footer) ──────────────────────────
  const xText = encodeURIComponent(
    'just built my AI office at diaflow 🚀 climb the floors with me'
  )
  const encodedUrl = inviteUrl ? encodeURIComponent(inviteUrl) : ''
  const xShareHref = inviteUrl
    ? `https://x.com/intent/tweet?text=${xText}&url=${encodedUrl}&hashtags=DiaflowTower`
    : undefined
  const linkedinShareHref = inviteUrl
    ? `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`
    : undefined

  async function handleCopy() {
    if (!inviteUrl) return
    const payload = buildShareCopyText(inviteUrl, invitesToNext, !!nextFloor)
    try {
      await navigator.clipboard.writeText(payload)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* ignore */
    }
  }

  // Footer mode — pre-login if we don't have an invite URL AND the
  // caller wired onOpenSignup. Otherwise share row.
  const isPreLogin = !inviteUrl && !!onOpenSignup

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-end md:items-center justify-center md:p-5"
      role="dialog"
      aria-modal="true"
      aria-label="Every floor, every unlock"
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
          'relative z-[1] flex flex-col text-tower-cream overflow-hidden w-full ' +
          'bg-[#181a2e] ' +
          'rounded-t-3xl md:rounded-2xl ' +
          'max-h-[88dvh] md:max-h-[90vh] md:max-w-[520px] ' +
          'border-t md:border border-white/10'
        }
      >
        {/* Mobile grip */}
        <div className="md:hidden flex justify-center pt-2.5" aria-hidden>
          <div className="w-9 h-1 rounded-full bg-white/20" />
        </div>

        {/* Header — title + subtitle + close × */}
        <header className="flex items-start justify-between gap-3 px-5 py-4 border-b border-white/10 shrink-0">
          <div>
            <h2 className="text-[17px] md:text-lg font-extrabold leading-tight">
              Every floor, every unlock
            </h2>
            <p className="text-[11.5px] md:text-xs text-tower-cream/55 mt-0.5 leading-relaxed">
              {inviteUrl
                ? 'Climb by inviting friends.'
                : '20 floors. Climb by inviting friends.'}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 w-6 h-6 rounded-full bg-white/5 text-tower-cream/60 hover:text-tower-cream text-sm leading-none flex items-center justify-center"
          >
            ×
          </button>
        </header>

        {/* Column headers — sticky-feel band above the scroll list */}
        <div
          className="grid items-center gap-2.5 px-5 py-2 bg-white/[0.02] border-b border-white/5 text-[9.5px] font-bold uppercase tracking-[0.06em] text-tower-cream/45 shrink-0"
          style={{ gridTemplateColumns: '36px 50px 1fr' }}
        >
          <div className="text-center">Floor</div>
          <div className="text-center">Invites</div>
          <div>Rewards</div>
        </div>

        {/* Scrollable reward list */}
        <div className="flex-1 overflow-y-auto bg-[#181a2e]">
          {floors.map(cfg => {
            const isCurrent = cfg.id === currentFloor
            const isPenthouse = cfg.id === floors.length
            const hasReward = !!cfg.productReward?.trim()
            const isMilestone = hasReward && !isPenthouse
            const isFaded = !isCurrent && !isMilestone && !isPenthouse

            // Row tint + left-border per tier. Milestone floors use
            // amber tokens directly — the project's `tower-gold` alias
            // was retired into a purple in tailwind.config (kept for
            // markup back-compat), so we'd render purple-on-purple
            // here instead of the intended gold accent.
            const rowClass = isCurrent
              ? 'bg-purple-500/[0.06] border-l-2 border-l-purple-400'
              : isPenthouse
              ? 'bg-gradient-to-r from-purple-500/15 via-purple-500/[0.04] to-transparent border-l-2 border-l-purple-300'
              : isMilestone
              ? 'bg-gradient-to-r from-amber-400/10 via-amber-400/[0.03] to-transparent border-l-2 border-l-amber-400'
              : ''

            // Number / invite-count text colour
            const accentText = isCurrent
              ? 'text-purple-200'
              : isPenthouse
              ? 'text-purple-300'
              : isMilestone
              ? 'text-amber-300'
              : 'text-tower-cream/70'

            return (
              <div
                key={cfg.id}
                className={
                  'grid items-start gap-2.5 px-5 py-2.5 border-b border-white/5 text-[12px] ' +
                  rowClass +
                  (isFaded ? ' opacity-65' : '')
                }
                style={{ gridTemplateColumns: '36px 50px 1fr' }}
              >
                {/* Floor number */}
                <div className="text-center">
                  <div className={`text-[15px] font-extrabold leading-none ${accentText}`}>
                    {cfg.id}
                  </div>
                  {isCurrent && (
                    <div className="mt-1 inline-block px-1 py-0.5 rounded text-[8px] font-extrabold tracking-[0.04em] bg-purple-500 text-night-deep">
                      YOU
                    </div>
                  )}
                </div>

                {/* Invites required — em-dash on floor 1 */}
                <div className={`text-center text-[14px] font-extrabold leading-tight ${accentText}`}>
                  {cfg.id === 1 ? '—' : cfg.invitesRequired}
                </div>

                {/* Reward description — hire-cap (bold), decor list
                    (muted), real-reward pill (gold or purple). */}
                <div className="leading-snug">
                  <span className="font-bold text-tower-cream">
                    Hire up to {cfg.maxTeammates}
                  </span>
                  {cfg.unlockItems.length > 0 && (
                    <>
                      <span className="text-tower-cream/30 mx-1.5">·</span>
                      <span className="text-tower-cream/65">
                        {cfg.unlockItems.join(' + ')}
                      </span>
                    </>
                  )}
                  {hasReward && (
                    <div className="mt-1.5">
                      <span
                        className={
                          'inline-block px-1.5 py-0.5 rounded text-[10.5px] font-extrabold border ' +
                          (isPenthouse
                            ? 'bg-purple-500/20 border-purple-400/40 text-purple-200'
                            : 'bg-amber-400/15 border-amber-400/40 text-amber-300')
                        }
                      >
                      {cfg.productReward}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer — pre-login Save CTA vs post-login share row */}
        <div className="shrink-0 border-t border-white/10 bg-[#181a2e] px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {isPreLogin ? (
            <>
              <div className="rounded-xl  flex-col items-center justify-center  border border-tower-gold/40 bg-gradient-to-b from-tower-gold/15 to-tower-gold/[0.03] p-3 mb-3">
                <div className="text-[10px] uppercase tracking-[0.06em] font-extrabold text-tower-gold mb-1">
                  ⚠ Not saved yet
                </div>
                <div className="text-[13px] font-bold leading-tight">
                  Save your team to start climbing.
                </div>
              </div>
              <button
                onClick={() => {
                  onClose()
                  onOpenSignup?.()
                }}
                className="w-full px-3 py-3 rounded-xl bg-tower-gold text-night-deep font-extrabold text-[14px] shadow-[0_6px_18px_rgba(251,191,36,0.4)] hover:bg-tower-gold/95 transition"
              >
                Save my team →
              </button>
            </>
          ) : (
            <>
              <div className="flex items-baseline justify-between mb-2">
                <div className="text-[13px] font-bold">
                  {nextFloor
                    ? `Share to reach Floor ${nextFloor.id}`
                    : 'Share your office'}
                </div>
                <div className="text-[11px] text-purple-300 font-semibold">
                  {nextFloor
                    ? `${invitesToNext} ${invitesToNext === 1 ? 'invite' : 'invites'} away`
                    : 'penthouse'}
                </div>
              </div>
              {!inviteUrl && (
                <div className="text-[12px] text-tower-cream/55 mb-2 px-3 py-2 rounded-md bg-white/[0.03] border border-white/5">
                  Sign up to get your personal invite link.
                </div>
              )}
              <div className="grid grid-cols-3 gap-2">
                <a
                  href={xShareHref}
                  target="_blank"
                  rel="noreferrer"
                  aria-disabled={!inviteUrl}
                  className={
                    'flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-[13px] font-bold text-tower-cream bg-night-deep/80 border border-white/10 ' +
                    (inviteUrl ? '' : 'opacity-40 pointer-events-none')
                  }
                >
                  <span className="w-5 h-5 rounded-md bg-black inline-flex items-center justify-center text-[11px] font-bold">
                    𝕏
                  </span>
                  X
                </a>
                <a
                  href={linkedinShareHref}
                  target="_blank"
                  rel="noreferrer"
                  aria-disabled={!inviteUrl}
                  className={
                    'flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-[13px] font-bold text-tower-cream bg-night-deep/80 border border-white/10 ' +
                    (inviteUrl ? '' : 'opacity-40 pointer-events-none')
                  }
                >
                  <span className="w-5 h-5 rounded-md bg-[#0a66c2] inline-flex items-center justify-center text-[11px] font-extrabold italic text-white">
                    in
                  </span>
                  LinkedIn
                </a>
                <button
                  onClick={handleCopy}
                  disabled={!inviteUrl}
                  className={
                    'flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-[13px] font-bold text-tower-cream bg-night-deep/80 border border-white/10 ' +
                    (inviteUrl ? '' : 'opacity-40 cursor-not-allowed')
                  }
                >
                  <span className="w-5 h-5 rounded-md bg-purple-500/20 inline-flex items-center justify-center text-[12px] text-purple-200">
                    🔗
                  </span>
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
