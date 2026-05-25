'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useFloor, useFloorCount } from '@/lib/floorsConfigClient'
import { buildShareCopyText } from '@/lib/shareCopy'

/**
 * Bottom-sheet share surface for mobile, opened from the
 * MobileBottomNav's hero "Invite to climb" CTA.
 *
 * Sections (top → bottom, per the mockup):
 *
 *   1. Header           — "Floor N · M invites to go" + headline +
 *                         subcopy.
 *   2. Reward chips     — horizontally scrolling cards for the next
 *                         floor, an aspirational mid-tower goal, and
 *                         the penthouse.
 *   3. Share grid       — 2-column 50px tall buttons for X, LinkedIn,
 *                         WhatsApp, Email. Plus a full-width Copy.
 *   4. Copy preview     — the literal string the user will paste.
 *
 * The share intent URLs mirror MySquadDrawer's `handleShare` exactly
 * so anything that worked there works here (same X / LinkedIn copy,
 * same WhatsApp share URL, same mailto, same buildShareCopyText
 * payload). One source of truth for the share text lives in
 * lib/shareCopy.ts.
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
   *  silently disabling everything. Null = no upsell route (logged-in
   *  user without a referralCode, which shouldn't happen in practice). */
  onSignupNudge?: () => void
}

export function MobileShareSheet({
  open,
  onClose,
  inviteUrl,
  currentFloor,
  totalInvites,
  onSignupNudge,
}: Props) {
  const [copied, setCopied] = useState(false)
  // Auto-dismiss the "Copied!" pill 1.5s after a successful copy so
  // the user doesn't see a stale check next time they open the sheet.
  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(false), 1500)
    return () => clearTimeout(t)
  }, [copied])

  // ESC closes — same UX convention as the rest of the modal stack.
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const nextFloor = useFloor(currentFloor + 1)
  const maxFloor = useFloorCount()
  const penthouse = useFloor(maxFloor)
  // Mid-tower aspiration — Floor 10 by convention since it sits ~50%
  // up the ladder. Falls back gracefully if the floor doesn't exist.
  const midFloor = useFloor(Math.min(maxFloor - 1, 10))
  const invitesToNext = nextFloor
    ? Math.max(0, nextFloor.invitesRequired - totalInvites)
    : 0

  if (!open) return null
  if (typeof document === 'undefined') return null

  // ── Share-intent URLs — mirrors MySquadDrawer.handleShare ───────
  const xText = nextFloor
    ? `just built my AI office at diaflow. ${invitesToNext} ${invitesToNext === 1 ? 'invite' : 'invites'} from unlocking the next floor 👀`
    : 'just topped out my AI office at diaflow 🏆'
  const encoded = inviteUrl ? encodeURIComponent(inviteUrl) : ''
  const xHref = inviteUrl
    ? `https://x.com/intent/tweet?text=${encodeURIComponent(xText)}&url=${encoded}&hashtags=DiaflowTower`
    : undefined
  const liHref = inviteUrl
    ? `https://www.linkedin.com/sharing/share-offsite/?url=${encoded}`
    : undefined
  // WhatsApp uses a single `text` query param with the URL inlined —
  // wa.me works on both mobile + desktop and falls back to web.
  const waText = inviteUrl ? `${xText} ${inviteUrl}` : ''
  const waHref = inviteUrl
    ? `https://wa.me/?text=${encodeURIComponent(waText)}`
    : undefined
  // Plain mailto — subject + body. Browsers handle the URL-encode of
  // the body internally but we do it explicitly anyway for safety.
  const mailtoHref = inviteUrl
    ? `mailto:?subject=${encodeURIComponent('I just hired my AI team on Diaflow')}&body=${encodeURIComponent(waText)}`
    : undefined

  const copyPayload = buildShareCopyText(inviteUrl, invitesToNext, !!nextFloor)

  async function handleCopy() {
    if (!copyPayload) {
      onSignupNudge?.()
      return
    }
    try {
      await navigator.clipboard.writeText(copyPayload)
      setCopied(true)
    } catch {
      /* ignore — older browsers without async clipboard */
    }
  }

  function openIntent(href: string | undefined) {
    if (!href) {
      onSignupNudge?.()
      return
    }
    // Open in a new tab/window. On mobile this hands off to the
    // installed app where possible (X, WhatsApp).
    window.open(href, '_blank', 'noopener,noreferrer')
  }

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
        // The sheet eats its own bottom safe-area inset so the
        // grid + preview never hide behind the iOS home indicator.
        style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
      >
        {/* Grip — touch-affordance hint that this is a sheet */}
        <div className="flex justify-center pt-2.5 pb-3" aria-hidden>
          <div className="w-9 h-1 rounded-full bg-white/20" />
        </div>

        <div className="px-5 pb-2">
          <div className="text-[10px] tracking-[0.08em] uppercase text-tower-cream/40 font-bold">
            {nextFloor
              ? `Floor ${nextFloor.id} — ${invitesToNext} ${invitesToNext === 1 ? 'invite' : 'invites'} to go`
              : 'Penthouse — keep sharing'}
          </div>
          <h2 className="text-[18px] font-extrabold leading-tight mt-1">
            Share to unlock<br />
            the rest of your team
          </h2>
          <p className="text-[12px] text-tower-cream/65 leading-relaxed mt-1.5">
            Every invite brings a real teammate to your launch-day workspace.
          </p>
        </div>

        {/* Horizontally scrolling reward chips */}
        <div
          className="flex gap-2 px-5 py-3 overflow-x-auto"
          style={{ scrollbarWidth: 'none' }}
        >
          {nextFloor && (
            <RewardChip
              tone="hot"
              floor={nextFloor.id}
              icon="🎁"
              reward={
                nextFloor.unlockItems?.find(s => s) ?? nextFloor.label ?? '—'
              }
              cost={`${invitesToNext} ${invitesToNext === 1 ? 'invite' : 'invites'}`}
            />
          )}
          {midFloor && midFloor.id !== nextFloor?.id && midFloor.id !== maxFloor && (
            <RewardChip
              floor={midFloor.id}
              icon="🛋"
              reward={
                midFloor.unlockItems?.find(s => s) ?? midFloor.label ?? '—'
              }
              cost={`${Math.max(0, midFloor.invitesRequired - totalInvites)} invites`}
            />
          )}
          {penthouse && (
            <RewardChip
              tone="gold"
              floor={penthouse.id}
              icon="👑"
              reward={
                penthouse.unlockItems?.find(s => s) ?? penthouse.label ?? '—'
              }
              cost={`${Math.max(0, penthouse.invitesRequired - totalInvites)} invites`}
            />
          )}
        </div>

        {/* Share grid — 2 cols × 2 rows + full-width Copy */}
        <div className="px-5 pt-1 pb-3 grid grid-cols-2 gap-2">
          <ShareBtn
            label="X"
            badge={<span className="font-bold">𝕏</span>}
            badgeBg="#000"
            badgeColor="#fff"
            disabled={!inviteUrl}
            onClick={() => openIntent(xHref)}
          />
          <ShareBtn
            label="LinkedIn"
            badge={<span className="font-extrabold italic">in</span>}
            badgeBg="#0a66c2"
            badgeColor="#fff"
            disabled={!inviteUrl}
            onClick={() => openIntent(liHref)}
          />
          <ShareBtn
            label="WhatsApp"
            badge={<span>💬</span>}
            badgeBg="#25d366"
            badgeColor="#fff"
            disabled={!inviteUrl}
            onClick={() => openIntent(waHref)}
          />
          <ShareBtn
            label="Email"
            badge={<span>✉</span>}
            badgeBg="#4b5563"
            badgeColor="#fff"
            disabled={!inviteUrl}
            onClick={() => openIntent(mailtoHref)}
          />
          <button
            onClick={handleCopy}
            disabled={!inviteUrl && !onSignupNudge}
            className="col-span-2 min-h-[50px] flex items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 bg-transparent text-[13px] font-semibold text-tower-cream/90 hover:bg-night-deep/40 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {copied ? (
              <>
                <span aria-hidden>✓</span>
                <span>Copied!</span>
              </>
            ) : (
              <>
                <span aria-hidden>🔗</span>
                <span>Copy invite link</span>
              </>
            )}
          </button>
        </div>

        {/* Copy preview — the literal paste output, so the user knows
            what their followers will see. */}
        {copyPayload && (
          <div className="px-5 pb-4">
            <div className="rounded-xl border border-dashed border-white/10 bg-night-deep/40 px-3 py-2.5 text-[11px] text-tower-cream/65 italic leading-snug">
              “{copyPayload}”
            </div>
          </div>
        )}

        {/* Trial users see a nudge to sign up — share buttons are
            disabled until they have a real referralCode. */}
        {!inviteUrl && onSignupNudge && (
          <div className="px-5 pb-2">
            <button
              onClick={() => {
                onClose()
                onSignupNudge()
              }}
              className="w-full min-h-[50px] rounded-xl bg-tower-gold text-night-deep font-bold text-[14px] shadow-[0_8px_20px_rgba(251,191,36,0.35)]"
            >
              🔒 Claim your team to get my invite link →
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
      className="min-h-[50px] flex items-center gap-2.5 rounded-xl bg-night-deep/60 border border-white/10 px-3 py-2 text-[13px] font-semibold text-tower-cream hover:border-white/20 disabled:opacity-50 disabled:cursor-not-allowed transition"
      aria-label={`Share on ${label}`}
    >
      <span
        className="w-7 h-7 rounded-md inline-flex items-center justify-center text-sm shrink-0"
        style={{ background: badgeBg, color: badgeColor }}
        aria-hidden
      >
        {badge}
      </span>
      <span>{label}</span>
    </button>
  )
}

function RewardChip({
  floor,
  icon,
  reward,
  cost,
  tone,
}: {
  floor: number
  icon: string
  reward: string
  cost: string
  tone?: 'hot' | 'gold'
}) {
  const base =
    'shrink-0 w-[120px] rounded-2xl border px-2.5 py-2.5 text-center'
  const palette =
    tone === 'hot'
      ? 'border-tower-gold/40 bg-gradient-to-b from-tower-gold/15 to-tower-gold/5'
      : tone === 'gold'
      ? 'border-purple-400/40 bg-gradient-to-b from-purple-500/20 to-purple-500/5'
      : 'border-white/10 bg-night-deep/60'
  const rewardColor =
    tone === 'hot' ? 'text-tower-gold font-bold' : 'text-tower-cream font-medium'
  return (
    <div className={`${base} ${palette}`}>
      <div className="text-[9.5px] tracking-[0.08em] uppercase text-tower-cream/40 font-bold">
        Floor {floor}
      </div>
      <div className="text-xl my-0.5" aria-hidden>
        {icon}
      </div>
      <div className={`text-[10.5px] leading-tight ${rewardColor}`}>
        {reward}
      </div>
      <div className="text-[9.5px] text-tower-cream/40 mt-1">{cost}</div>
    </div>
  )
}
