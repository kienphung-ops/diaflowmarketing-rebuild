'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useFloor } from '@/lib/floorsConfigClient'
import { buildShareCopyText } from '@/lib/shareCopy'
import { useAnchorPosition } from '@/lib/anchorPositions'
import { useIsDesktop } from '@/hooks/useIsDesktop'

interface Props {
  open: boolean
  onClose: () => void
  /** When set, the card floats next to this character in the 3D
   *  scene (using lib/anchorPositions). When null/undefined the
   *  card falls back to its legacy centered layout. */
  anchorSlug?: string | null
  /** Current floor the user is on. Used to compute the "next" floor
   *  shown in the packed-state copy ("Unlock a new slot at Floor X"). */
  currentFloor: number
  /** User's cumulative invites — combined with next-floor threshold
   *  to compute the "N invites from the next floor" wording inside
   *  the Copy-button payload (see buildShareCopyText). */
  totalInvites: number
  /** Slots still available on the current floor. Drives the two-state
   *  copy: 0 → "Need to hire another teammate?" + share; >0 → "You
   *  have an open slot." + Add-teammate button. */
  slotsAvailable: number
  /** Personal invite link — required for the share buttons to be
   *  enabled. `null` for unlogged trial users; the buttons grey out. */
  inviteUrl: string | null
  /** Fires when the user hits "+ Add teammate" in the open-slot state.
   *  Parent typically opens BulkAddTeammatesModal. */
  onAddTeammate?: () => void
}

/**
 * Iris pop-up — replaces the MySquadDrawer that used to open when the
 * user clicks Iris in the office scene. Iris is the "HR / hiring"
 * NPC; this modal is her recruiting prompt and has two clear modes
 * based on whether there's open headcount on the user's current floor.
 *
 *  - Packed (slotsAvailable === 0): nudges the user to climb a floor
 *    via sharing. Three share affordances stacked horizontally —
 *    X / LinkedIn / Copy — same as MySquadDrawer's share row.
 *
 *  - Open slot (slotsAvailable > 0): single "+ Add teammate" CTA that
 *    routes into the BulkAddTeammatesModal upstream.
 */
export function IrisHireModal({
  open,
  onClose,
  currentFloor,
  totalInvites,
  slotsAvailable,
  inviteUrl,
  onAddTeammate,
  anchorSlug,
}: Props) {
  const [copied, setCopied] = useState(false)
  // Anchor → character (typically 'iris'). When null we fall back to
  // the centered modal layout. See lib/anchorPositions.ts.
  // Live character-anchor only on desktop. On mobile we render as a
  // bottom sheet, where the per-frame transform would just fight the
  // sheet's bottom-edge position.
  const isDesktop = useIsDesktop()
  const anchorRef = useAnchorPosition(
    open && isDesktop ? anchorSlug ?? null : null,
  )
  const anchored = !!anchorSlug && isDesktop
  // "Next floor" copy — defaults to currentFloor+1; at the penthouse
  // we just don't bother (user can't go higher) and the share copy
  // shifts to a generic "keep growing your office" line.
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

  const hasSlot = slotsAvailable > 0

  async function handleCopy() {
    if (!inviteUrl) return
    // Same enriched payload as MySquadDrawer + HowItWorksModal — see
    // buildShareCopyText for the canonical format.
    const payload = buildShareCopyText(inviteUrl, invitesToNext, !!nextFloor)
    try {
      await navigator.clipboard.writeText(payload)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* ignore — older browsers without async clipboard */
    }
  }

  // Same X / LinkedIn intent URLs used by MySquadDrawer +
  // HowItWorksModal so the share affordance behaves identically
  // everywhere it appears. See requirements/share-btn.md for the
  // canonical format.
  const xText = nextFloor
    ? `just built my AI office at diaflow. unlocking floor ${nextFloor.id} next 👀`
    : 'just topped out my AI office at diaflow 🏆'
  const encodedUrl = inviteUrl ? encodeURIComponent(inviteUrl) : ''
  const xShareHref = inviteUrl
    ? `https://x.com/intent/tweet?text=${encodeURIComponent(xText)}&url=${encodedUrl}&hashtags=DiaflowTower`
    : undefined
  const linkedinShareHref = inviteUrl
    ? `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`
    : undefined

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      // Mobile = full-width bottom sheet anchored to the viewport's
      // bottom edge. Desktop = either anchored to the character (when
      // anchorSlug is set) or a centered modal (legacy fallback).
      className={
        // Mobile lift — push the bottom sheet up by the
        // MobileBottomNav height so the card doesn't slide UNDER
        // the nav. Desktop loses the lift via md:pb-0 since the
        // card is centred there.
        'fixed inset-0 z-40 flex items-end md:items-center justify-center backdrop-blur-sm bg-black/70 ' +
        'pb-[calc(72px+env(safe-area-inset-bottom))] md:pb-0 ' +
        (anchored ? 'md:bg-transparent md:backdrop-blur-0' : '')
      }
      onClick={onClose}
    >
      <div
        ref={anchored ? anchorRef : undefined}
        onClick={e => e.stopPropagation()}
        className={
          'w-full md:w-auto ' +
          (anchored ? 'md:absolute md:top-0 md:left-0 md:pointer-events-none' : '')
        }
        style={anchored ? { willChange: 'transform' } : undefined}
      >
        <div
          className={
            // Card shell — bottom sheet on mobile, regular card on
            // desktop. Mobile gets a sheet grip + safe-area padding.
            'relative bg-night-mid border-t border-white/10 text-tower-cream shadow-2xl overflow-hidden ' +
            'rounded-t-3xl md:rounded-2xl md:border md:border-white/10 ' +
            'w-full md:w-[min(420px,calc(100vw-32px))] md:max-w-md ' +
            'pb-[max(0.5rem,env(safe-area-inset-bottom))] md:pb-0 ' +
            (anchored ? 'md:pointer-events-auto' : 'md:mx-auto')
          }
          style={
            anchored
              ? // Same translate-(28px, -50%) trick used by the other
                // anchored pop-ups so the card sits beside the head.
                { transform: 'translate(28px, -50%)' }
              : undefined
          }
        >
        {/* Mobile sheet grip — hidden on desktop. */}
        <div className="md:hidden flex justify-center pt-2.5 pb-1" aria-hidden>
          <div className="w-9 h-1 rounded-full bg-white/20" />
        </div>
        {/* Top status row — green dot on the left mirrors the Iris
            online-indicator from the scene, X close on the right. */}
        <div className="flex items-center justify-between px-5 pt-4">
          <span
            aria-hidden
            className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.7)]"
          />
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-tower-cream/50 hover:text-tower-cream text-xl leading-none p-1"
          >
            ×
          </button>
        </div>

        <div className="px-7 pb-7 pt-2 text-center">
          <div className="text-4xl mb-3" aria-hidden>
            🏢
          </div>

          {hasSlot ? (
            <>
              <h2 className="text-xl font-bold mb-2">You have an open slot.</h2>
              <p className="text-sm text-tower-cream/70 mb-5 leading-relaxed">
                {slotsAvailable === 1
                  ? '1 teammate slot is waiting to be filled on this floor.'
                  : `${slotsAvailable} teammate slots are waiting to be filled on this floor.`}
              </p>
              <button
                onClick={() => {
                  onClose()
                  onAddTeammate?.()
                }}
                className="w-full px-4 py-3 rounded-md bg-tower-gold text-night-deep font-semibold text-sm hover:bg-tower-gold/90 transition"
              >
                + Add teammate
              </button>
            </>
          ) : (
            <>
              <h2 className="text-xl font-bold mb-2">Need to hire another teammate?</h2>
              <p className="text-sm text-tower-cream/70 mb-5 leading-relaxed">
                {nextFloor ? (
                  <>
                    Unlock a new teammate slot at <strong className="text-tower-cream">Floor {nextFloor.id}</strong>.
                    {' '}Share your link to get there.
                  </>
                ) : (
                  <>
                    You&apos;ve reached the penthouse — keep sharing to grow
                    your office further.
                  </>
                )}
              </p>

              <div className="grid grid-cols-3 gap-2">
                <a
                  href={xShareHref}
                  aria-disabled={!inviteUrl}
                  target="_blank"
                  rel="noreferrer"
                  className={`flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-md bg-night-deep/80 border border-white/10 text-sm font-semibold hover:bg-night-deep hover:border-white/20 transition ${
                    !inviteUrl ? 'opacity-40 pointer-events-none' : ''
                  }`}
                  aria-label="Share on X"
                >
                  <XLogo />
                  <span>X</span>
                </a>
                <a
                  href={linkedinShareHref}
                  aria-disabled={!inviteUrl}
                  target="_blank"
                  rel="noreferrer"
                  className={`flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-md bg-night-deep/80 border border-white/10 text-sm font-semibold hover:bg-night-deep hover:border-white/20 transition ${
                    !inviteUrl ? 'opacity-40 pointer-events-none' : ''
                  }`}
                  aria-label="Share on LinkedIn"
                >
                  <LinkedInLogo />
                  <span>LinkedIn</span>
                </a>
                <button
                  onClick={handleCopy}
                  disabled={!inviteUrl}
                  className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-md bg-night-deep/80 border border-white/10 text-sm font-semibold hover:bg-night-deep hover:border-white/20 transition disabled:opacity-40 disabled:cursor-not-allowed"
                  aria-label="Copy invite link"
                >
                  {copied ? (
                    <>
                      <span aria-hidden>✓</span>
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <LinkIcon />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>

              {!inviteUrl && (
                <p className="mt-3 text-[11px] text-tower-cream/40">
                  Sign up to get your personal invite link.
                </p>
              )}
            </>
          )}
        </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

/* — Inline icons (kept local so this modal is drop-in without forcing
   a new shared component just for three svgs). Glyphs match the ones
   used in MySquadDrawer + HowItWorksModal so the share row reads as
   the same affordance wherever the user sees it. — */

function XLogo() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  )
}

function LinkedInLogo() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.063 2.063 0 1 1 2.063 2.065zm1.778 13.019H3.555V9h3.56v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  )
}

function LinkIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.5 1.5" />
      <path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.5-1.5" />
    </svg>
  )
}
