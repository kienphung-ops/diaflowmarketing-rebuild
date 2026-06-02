'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useFloor } from '@/lib/floorsConfigClient'
import { buildShareCopyText } from '@/lib/shareCopy'
import { creditShareUnlock } from '@/lib/spin/useFirstShareSpin'
import { useAnchorPosition } from '@/lib/anchorPositions'
import { useIsDesktop } from '@/hooks/useIsDesktop'
import { useBackdropDismissGuard } from '@/hooks/useBackdropDismissGuard'
import { TeammatePortrait } from './TeammatePortrait'
import { trackEvent } from '@/lib/tracking'

interface Props {
  open: boolean
  onClose: () => void
  /** When set, the card floats next to this character in the 3D
   *  scene (using lib/anchorPositions). When null/undefined the
   *  card falls back to its legacy centered layout. */
  anchorSlug?: string | null
  /** Current floor the user is on. Used to compute the "next" floor
   *  shown in the packed-state copy ("Open up a new seat at Floor N"). */
  currentFloor: number
  /** User's cumulative invites — combined with next-floor threshold
   *  to compute the "N invites from the next floor" wording inside
   *  the Copy-button payload (see buildShareCopyText). */
  totalInvites: number
  /** Slots still available on the current floor. Drives the two
   *  signed-in stages: 0 → share grid (Stage B); >0 → Add-teammate
   *  button (Stage A). Ignored when `signedIn` is false. */
  slotsAvailable: number
  /** Personal invite link — required for the share buttons to be
   *  enabled. `null` for unlogged trial users; signals pre-login
   *  mode (Stage C). */
  inviteUrl: string | null
  /** True when the user has a real account. False for trial mode →
   *  the pre-login Stage C copy + "Save my team" CTA renders. */
  signedIn?: boolean
  /** Fires when the user hits "+ Add teammate" in the open-slot
   *  state (Stage A). Parent typically opens BulkAddTeammatesModal. */
  onAddTeammate?: () => void
  /** Fires when a trial user hits "Save my team" in Stage C. Parent
   *  opens SignupModal. */
  onOpenSignup?: () => void
}

/**
 * Iris pop-up — opens when the user clicks Iris in the office scene.
 * Three states share the same shell (Iris pixel portrait, "Hi, I'm
 * Iris — your AI Recruiter." headline, dark bottom-sheet chrome) and
 * differ only in the body + CTA per the mobile mockup at
 * `requirements/.../diaflow-iris-modal-three-states.html`:
 *
 *   Stage A · Open slot (signedIn, slotsAvailable > 0)
 *     "You've got an open seat, and I've got teammates ready to meet
 *      you." → [ + Add teammate ]
 *
 *   Stage B · Out of slot (signedIn, slotsAvailable === 0)
 *     "I've got teammates ready to bring on, but your office is full.
 *      Open up a new seat at Floor N — share your link to climb."
 *     → [ X ] [ LinkedIn ] [ Copy ]
 *
 *   Stage C · Pre-login (!signedIn)
 *     "I've got teammates lined up for you. Save your team first —
 *      then I'll start bringing them in." → [ Save my team ]
 */
export function IrisHireModal({
  open,
  onClose,
  currentFloor,
  totalInvites,
  slotsAvailable,
  inviteUrl,
  signedIn,
  onAddTeammate,
  onOpenSignup,
  anchorSlug,
}: Props) {
  const [copied, setCopied] = useState(false)
  // Anchor → character (typically 'iris'). When null we fall back to
  // the centered modal layout. See lib/anchorPositions.ts.
  // Live character-anchor only on desktop. On mobile we render as a
  // bottom sheet, where the per-frame transform would just fight the
  // sheet's bottom-edge position.
  // `flipEdge` is defensive here — Iris usually sits at the LEFT
  // edge of the room so the default right-side placement is fine,
  // but if she ever wanders close to the right wall the hook flips
  // the card to her left instead of clipping off-screen. Vertical
  // centring + clamping prevent overflow on short viewports.
  const isDesktop = useIsDesktop()
  const anchorRef = useAnchorPosition(
    open && isDesktop ? anchorSlug ?? null : null,
    { flipEdge: true, vCenter: true, gap: 28 },
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

  // Press-origin + time-gated backdrop dismiss. Must run BEFORE any
  // early return so the hook order stays stable across renders. The
  // synthetic click that follows the opening tap never produces a
  // matching pointerdown on the backdrop, so it harmlessly no-ops
  // here. See useBackdropDismissGuard for the full writeup.
  const backdropDismissHandlers = useBackdropDismissGuard(open, onClose)

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
      void creditShareUnlock('copy')
    } catch {
      /* ignore — older browsers without async clipboard */
    }
  }

  // Same X / LinkedIn intent URLs used by MySquadDrawer +
  // HowItWorksModal so the share affordance behaves identically
  // everywhere it appears. See requirements/share-btn.md for the
  // canonical format.
  const xText = nextFloor
    ? `just built my AI office at diaflow. unlocking Level ${nextFloor.id} next 👀`
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
        // Sheet's z-40 already paints over the z-30 MobileBottomNav
        // while open, so the previous +72px lift was just leaving a
        // dead backdrop band below the content. Drop the lift — the
        // card sits flush with the viewport bottom on mobile (its own
        // env(safe-area-inset-bottom) padding handles iOS).
        'fixed inset-0 z-40 flex items-end md:items-center justify-center backdrop-blur-sm bg-black/70 ' +
        (anchored ? 'md:bg-transparent md:backdrop-blur-0' : '')
      }
      {...backdropDismissHandlers}
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
          // No static transform — `flipEdge` on useAnchorPosition
          // owns the full placement (gap + vertical centre + edge
          // flip on tight viewports).
        >
        {/* Mobile sheet grip — hidden on desktop. */}
        <div className="md:hidden flex justify-center pt-2.5 pb-1" aria-hidden>
          <div className="w-9 h-1 rounded-full bg-white/20" />
        </div>
        {/* Top status row — green dot on the left mirrors the Iris
            online-indicator from the scene, X close on the right. */}
        <div className="flex items-center justify-between px-5">
          <span
            aria-hidden
            className="w-2.5 h-2.5"
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
          {/* Iris pixel portrait — MOBILE ONLY. On desktop the modal
              floats right beside Iris's live minifigure, so repeating
              the portrait inside is redundant; drop it there. */}
          <div className="md:hidden flex justify-center mb-3">
            <TeammatePortrait slug="iris" />
          </div>

          {/* Headline is identical across the three states — only the
              body + CTA change. */}
          <h2 className="text-[19px] font-bold leading-snug tracking-tight mb-3">
            Hi, I&apos;m Iris — your AI Recruiter.
          </h2>

          {!signedIn ? (
            // ── Stage C · Pre-login ────────────────────────────────
            <>
              <p className="text-[14px] text-tower-cream/70 leading-relaxed mb-5">
                I&apos;ve got teammates lined up for you. Save your team
                first — then I&apos;ll start bringing them in.
              </p>
              <button
                onClick={() => {
                  trackEvent('iris_interaction', { action: 'save_team' })
                  onClose()
                  onOpenSignup?.()
                }}
                className="w-full px-4 py-3.5 rounded-xl bg-gradient-to-b from-purple-300 to-purple-400 text-night-deep font-extrabold text-[15px] shadow-[0_8px_24px_rgba(168,117,255,0.4)] hover:shadow-[0_12px_28px_rgba(168,117,255,0.5)] transition"
              >
                Save my team
              </button>
            </>
          ) : hasSlot ? (
            // ── Stage A · Open slot ────────────────────────────────
            <>
              <p className="text-[14px] text-tower-cream/70 leading-relaxed mb-5">
                You&apos;ve got an open seat, and I&apos;ve got teammates
                ready to meet you.
              </p>
              <button
                onClick={() => {
                  trackEvent('iris_interaction', { action: 'add_teammate' })
                  onClose()
                  onAddTeammate?.()
                }}
                className="w-full px-4 py-3.5 rounded-xl bg-gradient-to-b from-purple-300 to-purple-400 text-night-deep font-extrabold text-[15px] shadow-[0_8px_24px_rgba(168,117,255,0.4)] hover:shadow-[0_12px_28px_rgba(168,117,255,0.5)] transition"
              >
                + Add teammate
              </button>
            </>
          ) : (
            // ── Stage B · Out of slot ──────────────────────────────
            <>
              <p className="text-[14px] text-tower-cream/70 leading-relaxed mb-5">
                I&apos;ve got teammates ready to bring on, but your
                office is full.{' '}
                {nextFloor ? (
                  <>
                    Open up a new seat at{' '}
                    <strong className="text-tower-cream">
                      Level {nextFloor.id}
                    </strong>{' '}
                    — share your link to level up.
                  </>
                ) : (
                  <>
                    You&apos;ve reached the penthouse — keep sharing to
                    grow your team.
                  </>
                )}
              </p>

              <div className="grid grid-cols-3 gap-2">
                <a
                  href={xShareHref}
                  aria-disabled={!inviteUrl}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => trackEvent('share_click', { platform: 'twitter', source: 'iris_modal' })}
                  className={`flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-night-deep/80 border border-white/10 text-sm font-semibold hover:bg-night-deep hover:border-white/20 transition ${
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
                  onClick={() => trackEvent('share_click', { platform: 'linkedin', source: 'iris_modal' })}
                  className={`flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-night-deep/80 border border-white/10 text-sm font-semibold hover:bg-night-deep hover:border-white/20 transition ${
                    !inviteUrl ? 'opacity-40 pointer-events-none' : ''
                  }`}
                  aria-label="Share on LinkedIn"
                >
                  <LinkedInLogo />
                  <span>LinkedIn</span>
                </a>
                <button
                  onClick={() => { trackEvent('share_click', { platform: 'copy', source: 'iris_modal' }); handleCopy() }}
                  disabled={!inviteUrl}
                  className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-night-deep/80 border border-white/10 text-sm font-semibold hover:bg-night-deep hover:border-white/20 transition disabled:opacity-40 disabled:cursor-not-allowed"
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

/* Local IrisPortrait moved to components/TeammatePortrait so the
   same chest-up SVG can render in every character-tap modal
   (Mia / Leo / custom recruits). Iris's red-tie + lapel overlay is
   gated by `slug === 'iris'` inside that component. */
