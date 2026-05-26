'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useFloor, useFloorCount } from '@/lib/floorsConfigClient'
import { computeTeammateCount } from '@/lib/floors'
import { DISCORD_URL } from '@/lib/links'
import { HowItWorksModal } from './HowItWorksModal'
import { useOrigin } from '@/hooks/useOrigin'
import { buildShareCopyText } from '@/lib/shareCopy'
import type { InviterInfo } from '@/lib/inviter'

interface ServerRecruit {
  id: string
  name: string
  role: string
  slug?: string | null
  isDefault?: boolean
  pokes?: number
  description?: string | null
}

interface Props {
  open: boolean
  onClose: () => void
  teamName: string | null
  onTeamNameChange?: (next: string) => void
  referralCode: string | null
  totalInvites: number
  currentFloor: number
  emailCaptured: boolean
  teammates: ServerRecruit[]
  onTeammateUpdate?: (id: string, patch: { name?: string; role?: string }) => void
  onAddTeammate?: () => void
  onOpenSignup?: () => void
  /** Who invited the current user — server-sealed at signup time. `null`
   *  when the user signed up without a referral link or is anonymous. */
  inviter?: InviterInfo | null
  /** Resets every character (NPCs + recruited) back to their default
   *  positions. Useful when a teammate has been dragged behind the wall
   *  or off-screen and the user wants a clean reset. */
  onResetAllPositions?: () => void
  /** Server-computed leaderboard rank. `null` while loading or
   *  for anonymous users; `51` represents "outside top 50" (rendered
   *  as "50+"). See /api/leaderboard. */
  rank?: number | null
  /** True when the current user's email is verified (User.emailVerified
   *  set). When false, the drawer renders a "Verify your email" CTA. */
  emailVerified?: boolean
  /** Current user's email — shown next to the verification CTA so they
   *  know which inbox to check. */
  userEmail?: string | null
  /** Opens the EmailVerifyModal — handled by the parent so any
   *  post-verify state updates (re-fetch /api/me, toast, etc.) are
   *  centralised. */
  onVerifyEmail?: () => void
  /** True when the user's floor is publicly shareable. Drives the
   *  Public/Private toggle in the drawer header. */
  publicVisible?: boolean
  /** Toggle handler — receives the new boolean to PATCH. */
  onTogglePublic?: (next: boolean) => void
  /** Sign-out handler — POSTs /api/auth/logout, clears session cookie,
   *  reloads to the home page. Only wired up for signed-in users. */
  onLogout?: () => void
  /** Opens the Arrange-your-room editor. Closes the drawer + launches
   *  a fullscreen drag interface (RoomArranger). Only wired up for
   *  signed-in users on the home page — trial sessions don't have a
   *  DB row to persist arrangements into. */
  onArrangeRoom?: () => void
  /** Live floor-activity stats — viewer count + total pokes — shown
   *  as a compact pill near the top of the drawer. Used on:
   *
   *   - `/floor/[code]` (visitor): pass `ownerName` so the section
   *     header reads "Visiting <ownerName>".
   *   - `/office` and `/tower` (owner viewing their own floor): leave
   *     `ownerName` null so the section header reads "Your floor".
   *
   *  When undefined the section doesn't render. */
  visiting?: {
    /** Owner's team name when the viewer is a guest; null when the
     *  viewer is the owner themselves. */
    ownerName: string | null
    /** Number of users currently on the floor. Anonymous heartbeat
     *  via `useFloorPresence` — see that hook for semantics. */
    viewerCount: number
    /** Sum of pokes across all teammates on the floor. */
    totalPokes: number
  }
}

// Invite link + share-floor link are now the SAME URL — visitors land
// on /floor/<code>, see the owner's scene, and unlogged users get a
// bottom CTA that funnels them into the referral signup flow. Server
// no longer gates by `publicVisible`, so every code resolves.
function buildInviteUrl(origin: string, code: string | null): string {
  if (!code) return ''
  return `${origin}/floor/${code}`
}

export function MySquadDrawer({
  open,
  onClose,
  teamName,
  onTeamNameChange,
  referralCode,
  totalInvites,
  currentFloor,
  emailCaptured,
  onOpenSignup,
  inviter,
  rank,
  emailVerified,
  onLogout,
  onArrangeRoom,
  visiting,
  teammates,
  // Below are still part of Props for callers but the drawer no longer
  // renders share-floor list / add-teammate UI. The /floor/<code>
  // route is the canonical share + invite URL, and per-teammate
  // interactions happen via the 3D scene + bulk-add modal. `teammates`
  // is still consumed to render the "N teammates locked in" pill above
  // the floor card (Section 2, screen 9).
}: Props) {
  const [renaming, setRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState(teamName ?? '')
  const [copied, setCopied] = useState(false)
  const [howItWorksOpen, setHowItWorksOpen] = useState(false)
  // Sign-out confirm gate — first click opens a small modal asking
  // "are you sure?". Avoids accidental logouts (the link sits right
  // next to the team-name row and is easy to mis-tap on mobile).
  const [signOutConfirmOpen, setSignOutConfirmOpen] = useState(false)

  useEffect(() => {
    setRenameValue(teamName ?? '')
  }, [teamName])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Auto-reset the sign-out confirm when the drawer closes — opening
  // it later shouldn't show a stale "Sign out?" prompt the user
  // already dismissed.
  useEffect(() => {
    if (!open) setSignOutConfirmOpen(false)
  }, [open])

  const origin = useOrigin()
  const inviteUrl = buildInviteUrl(origin, referralCode)
  // Live floor config from /api/floors (cached aggressively client-side).
  // `useFloor` falls back to the static FLOOR_CONFIG snapshot until the
  // API responds, so the progress bar never flashes empty.
  const nextFloor = useFloor(currentFloor + 1)
  const currentFloorCfg = useFloor(currentFloor)
  const totalFloors = useFloorCount()
  const invitesToNext = nextFloor ? Math.max(0, nextFloor.invitesRequired - totalInvites) : 0
  const progressPct = nextFloor
    ? Math.min(
        100,
        Math.round(
          ((totalInvites - (currentFloorCfg?.invitesRequired ?? 0)) /
            Math.max(1, nextFloor.invitesRequired - (currentFloorCfg?.invitesRequired ?? 0))) *
            100
        )
      )
    : 100

  async function handleCopy() {
    if (!inviteUrl) return
    // Paste a marketing-formatted string ("built my AI office, N invites
    // from the next floor — <url>") instead of the bare URL — see
    // `buildShareCopyText` for the canonical format used across all
    // three Copy buttons (this drawer + IrisHireModal + HowItWorksModal).
    const payload = buildShareCopyText(inviteUrl, invitesToNext, !!nextFloor)
    try {
      await navigator.clipboard.writeText(payload)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* ignore */
    }
  }

  /**
   * Build the share copy + open the network's intent URL. URL format
   * comes from requirements/share-btn.md:
   *
   *   X        → https://x.com/intent/tweet?text=<text>&url=<inviteUrl>&hashtags=DiaflowTower
   *   LinkedIn → https://www.linkedin.com/sharing/share-offsite/?url=<inviteUrl>
   *
   * Text is the marketing copy from the same spec, with dynamic
   * `invitesToNext` injected. The invite URL is passed in `&url=`
   * (NOT appended to text) so X auto-appends + auto-shortens the
   * link cleanly. LinkedIn's share-offsite intent only accepts a
   * `url` param — it pulls the title/description from the OG tags
   * already configured on /floor/[code] (see app/floor/[code]/page.tsx
   * generateMetadata), so no separate `text` plumbing is needed.
   */
  function handleShare(network: 'x' | 'linkedin') {
    if (!inviteUrl) return
    const xText = nextFloor
      ? `just built my AI office at diaflow. ${invitesToNext} ${invitesToNext === 1 ? 'invite' : 'invites'} from unlocking the next floor 👀`
      : 'just topped out my AI office at diaflow 🏆'

    if (network === 'x') {
      window.open(
        `https://x.com/intent/tweet?text=${encodeURIComponent(xText)}&url=${encodeURIComponent(inviteUrl)}&hashtags=DiaflowTower`,
        '_blank',
        'noopener,noreferrer,width=620,height=620',
      )
      return
    }
    window.open(
      `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(inviteUrl)}`,
      '_blank',
      'noopener,noreferrer,width=620,height=620',
    )
  }


  return (
    <>
      {/* Mobile-only backdrop — fades in when the sheet is open and
          tap-to-close so the user can dismiss without hunting for
          the × button. Hidden on desktop where the drawer occupies a
          fixed right strip and the rest of the page remains usable. */}
      <div
        className={`md:hidden fixed inset-0 z-20 bg-black/60 transition-opacity duration-300 ${
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
        aria-hidden
      />
      <div
        /* Responsive geometry — bottom sheet on mobile, right drawer
           on desktop. Closed states match the sheet direction:
             mobile  closed → translate-y-full (slides off the bottom)
             desktop closed → translate-x-full (slides off the right)
           Both axes are reset to 0 at md+ so the slide direction
           never compounds with the opposite axis. */
        className={
          // Base sheet card.
          'fixed z-30 flex flex-col text-tower-cream ' +
          'bg-night-mid/95 backdrop-blur-md shadow-2xl ' +
          // Mobile shape: bottom sheet anchored to the bottom edge,
          // 88% of the viewport tall, with a rounded top + grip.
          'bottom-0 left-0 right-0 top-auto h-[88vh] max-h-[calc(100dvh-3rem)] ' +
          'rounded-t-3xl border-t border-white/10 ' +
          // Desktop shape: full-height drawer on the right edge.
          'md:top-0 md:bottom-0 md:right-0 md:left-auto md:h-full md:max-h-none ' +
          'md:w-[440px] md:max-w-full md:rounded-none md:border-t-0 md:border-l md:border-white/10 ' +
          // Transform-driven open/close — see the multi-axis trick
          // above. Mobile slides vertically; desktop horizontally.
          'transition-transform duration-300 ' +
          (open
            ? 'translate-y-0 md:translate-x-0'
            : 'translate-y-full md:translate-y-0 md:translate-x-full')
        }
      >
        {/* Mobile grip + floating close — touch-affordance that
            this is a sheet, plus a small × so the user can dismiss
            without dragging. Hidden on desktop. */}
        <div className="md:hidden relative pt-2.5">
          <div className="flex justify-center" aria-hidden>
            <div className="w-9 h-1 rounded-full bg-white/20" />
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute right-3 top-1 text-tower-cream/50 hover:text-tower-cream text-xl leading-none px-2 py-1"
          >
            ×
          </button>
        </div>

        {/* Desktop-only title bar — the mobile mockup (Section 2,
            screen 9) drops the redundant "My Squad" header since the
            team name below already serves as the visual title. */}
        <div className="hidden md:flex items-center justify-between px-6 py-4 border-b border-white/5">
          <h2 className="text-2xl font-bold">My Squad</h2>
          <button onClick={onClose} className="text-tower-cream/50 hover:text-tower-cream text-xl" aria-label="Close">
            ×
          </button>
        </div>

      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
        {/* Mobile-only small "My Squad" label — only shown in the
            pre-login state (Section 2, screen 8). The post-login
            view leans on the team name as the visual header so the
            extra label would just add noise. Desktop always has the
            full title bar above. */}
        {!referralCode && (
          <div className="md:hidden text-center text-[13px] font-bold text-tower-cream/70 tracking-wide">
            My Squad
          </div>
        )}

        {/* "You're in" banner only shows when we DON'T have explicit
            verification state (trial captures + legacy flow). For
            signed-in users we route through the verify-email banner
            below — showing green checkmark when actually unverified
            was misleading users into thinking their email was confirmed. */}
        {emailCaptured && emailVerified === undefined && (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
            ✓ You&apos;re in — we&apos;ll email you on launch day
          </div>
        )}
        {emailVerified === true && (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
            ✓ Email verified
          </div>
        )}

        {/* Standalone "Visiting <name>" pill was here previously. It
            was removed so /floor/[code] MySquad mirrors /office +
            /tower: the viewing + total-pokes stats now live INSIDE
            the Current Floor card (single focal panel instead of two
            stacked ones). Whose floor we're looking at is surfaced as
            a small "Visiting <owner>" caption next to those stats —
            see the activity row below. */}

        {/* Team name — pre-login centers the name (screen 8);
            post-login renders the full row with Rename + Sign-out
            (screen 9). Two separate sub-trees instead of one
            conditionally-classed row keeps the parser simple. */}
        {!referralCode ? (
          renaming ? (
            <div className="flex items-center gap-2">
              <input
                autoFocus
                value={renameValue}
                onChange={e => setRenameValue(e.target.value.slice(0, 40))}
                className="flex-1 px-2 py-1 rounded bg-night-deep border border-white/10 focus:border-tower-gold focus:outline-none text-2xl font-bold"
              />
              <button
                onClick={() => {
                  onTeamNameChange?.(renameValue.trim())
                  setRenaming(false)
                }}
                className="text-xs text-tower-gold hover:underline"
              >
                Save
              </button>
            </div>
          ) : (
            <div className="text-center text-3xl font-bold">
              {teamName || 'untitled'}
            </div>
          )
        ) : renaming ? (
          <div className="flex items-center gap-2">
            <input
              autoFocus
              value={renameValue}
              onChange={e => setRenameValue(e.target.value.slice(0, 40))}
              className="flex-1 px-2 py-1 rounded bg-night-deep border border-white/10 focus:border-tower-gold focus:outline-none text-2xl font-bold"
            />
            <button
              onClick={() => {
                onTeamNameChange?.(renameValue.trim())
                setRenaming(false)
              }}
              className="text-xs text-tower-gold hover:underline"
            >
              Save
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <div className="text-3xl font-bold">{teamName || 'untitled'}</div>
            <button
              onClick={() => setRenaming(true)}
              className="text-xs px-2 py-1 rounded bg-night-deep/80 border border-white/10 text-tower-cream/60 hover:text-tower-cream"
            >
              ✎ Rename
            </button>
            {onLogout && (
              <button
                type="button"
                onClick={() => setSignOutConfirmOpen(true)}
                className="ml-auto text-xs text-red-400 hover:text-red-300 underline-offset-2 hover:underline transition"
              >
                Sign out
              </button>
            )}
          </div>
        )}

        {/* Invited-by card moved BELOW "How it works" per user
            feedback — was previously stacked at the top of the
            drawer where it crowded the floor card. See the matching
            placement marker further down. */}

        {/* "🔒 N teammates locked in" pill — shown for both pre- and
            post-login (Section 2, screens 8 + 9). Pre-login the
            trial user's `teammates` array is empty since they have no
            DB rows, but the three default NPCs (Iris/Mia/Leo) are
            still "locked in" conceptually — so we use
            `computeTeammateCount`, which adds the defaults when the
            array doesn't include them. */}
        {(() => {
          const lockedInCount = computeTeammateCount(teammates ?? [])
          if (lockedInCount <= 0) return null
          return (
            <div className="flex justify-center">
              <div className="rounded-full bg-emerald-500/10 border border-emerald-500/30 px-3.5 py-2 text-[12px] font-semibold text-emerald-200 inline-flex items-center gap-2">
                <span aria-hidden>🔒</span>
                <span>
                  <strong className="tabular-nums">{lockedInCount}</strong>{' '}
                  {lockedInCount === 1 ? 'teammate' : 'teammates'} locked in
                </span>
              </div>
            </div>
          )
        })()}

        {/* Pre-login SAVE GLOW CARD + tower/rewards link cards
            (Section 2, screen 8). The save card is the focal CTA;
            the two link cards beneath give a trial user secondary
            paths to explore the tower or peek at the rewards while
            they decide to convert. All hidden post-login. */}
        {!referralCode && (
          <>
            <div className="rounded-xl border border-purple-500/40 bg-gradient-to-b from-purple-500/20 to-purple-500/[0.05] p-4 shadow-[0_0_24px_rgba(168,139,250,0.25)] text-center">
              <div className="text-[10px] uppercase tracking-[0.08em] font-bold text-purple-300 mb-1.5">
                ⚠ Not saved yet
              </div>
              <div className="text-[15px] font-bold leading-tight mb-1">
                Save your team for launch.
              </div>
              <div className="text-[11.5px] text-tower-cream/65 leading-relaxed mb-3">
                Free. Just an email. Office waits for you when AI Teammate ships.
              </div>
              <button
                onClick={onOpenSignup}
                className="w-full px-3 py-2.5 rounded-lg bg-purple-400 text-night-deep font-extrabold text-[13px] shadow-[0_4px_14px_rgba(168,139,250,0.45)] hover:bg-purple-300 transition"
              >
                Save my team →
              </button>
            </div>

            <Link
              href="/tower"
              onClick={onClose}
              className="w-full rounded-xl bg-night-mid/60 border border-white/10 px-3.5 py-3 flex items-center gap-3 hover:border-white/20 transition"
            >
              <span className="text-lg leading-none shrink-0" aria-hidden>
                🏢
              </span>
              <div className="flex-1 min-w-0 text-left">
                <div className="text-[12.5px] font-bold text-tower-cream leading-tight">
                  Take the tower tour
                </div>
                <div className="text-[10.5px] text-tower-cream/55 mt-0.5">
                  60 sec walkthrough
                </div>
              </div>
              <span className="text-tower-cream/40 text-base shrink-0" aria-hidden>
                ›
              </span>
            </Link>

            <button
              type="button"
              onClick={() => setHowItWorksOpen(true)}
              className="w-full rounded-xl bg-night-mid/60 border border-white/10 px-3.5 py-3 flex items-center gap-3 hover:border-white/20 transition"
            >
              <span className="text-lg leading-none shrink-0" aria-hidden>
                🎁
              </span>
              <div className="flex-1 min-w-0 text-left">
                <div className="text-[12.5px] font-bold text-tower-cream leading-tight">
                  See all 20 floor rewards
                </div>
                <div className="text-[10.5px] text-tower-cream/55 mt-0.5">
                  Free beta at Floor 3
                </div>
              </div>
              <span className="text-tower-cream/40 text-base shrink-0" aria-hidden>
                ›
              </span>
            </button>
          </>
        )}

        {/* ── Post-login content: floor card + share + quick actions.
            Hidden in trial mode (no referralCode) where the focal
            CTA is the save-card group above. Each section is gated
            individually rather than wrapped in a fragment to keep the
            parse tree simple. ─────────────────────────────────── */}

        {/* Current floor card — Section 2, screen 9. */}
        {referralCode && (
        <div className="rounded-xl p-4 bg-gradient-to-br from-purple-900/40 to-purple-800/20 border border-purple-500/30">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-widest text-tower-cream/50 mb-1">
                Current floor
              </div>
              <div className="flex items-baseline gap-2">
                <div className="text-5xl font-bold leading-none tabular-nums">
                  {currentFloor}
                </div>
                <div className="text-base text-tower-cream/50">
                  of {totalFloors}
                </div>
              </div>
            </div>
            {/* Invites + rank stack — right-aligned, rank in amber to
                match the mockup (was purple-300 before). */}
            <div className="text-right space-y-0.5 shrink-0">
              <div className="text-base font-semibold text-tower-cream">
                <strong className="tabular-nums">{totalInvites}</strong>{' '}
                <span className="text-tower-cream/70 font-normal text-sm">
                  {totalInvites === 1 ? 'invite' : 'invites'}
                </span>
              </div>
              <div className="text-sm font-bold text-amber-300">
                {rank == null ? (
                  <span className="text-tower-cream/40 font-semibold">Rank —</span>
                ) : rank >= 51 ? (
                  <span title="Outside top 50 — keep inviting!">Rank 50+</span>
                ) : (
                  <>Rank #{rank}</>
                )}
              </div>
            </div>
          </div>

          <div className="mt-3 h-1.5 rounded-full bg-night-deep/60 overflow-hidden">
            <div className="h-full bg-purple-400" style={{ width: `${progressPct}%` }} />
          </div>

          {/* "Next" line — centered under the progress bar so it
              reads as a caption for the bar itself. */}
          <div className="mt-2.5 text-center text-xs text-tower-cream/80">
            {nextFloor ? (
              <>
                <span className="text-tower-cream/55">Next:</span>{' '}
                <span className="font-bold text-tower-cream">Floor {nextFloor.id}</span>{' '}
                <span className="text-tower-cream/55">·</span>{' '}
                <span className="font-semibold">
                  {invitesToNext} {invitesToNext === 1 ? 'invite' : 'invites'} away
                </span>
              </>
            ) : (
              'You reached the top'
            )}
          </div>

          {/* Floor-activity row — viewers + total pokes. Rendered for
              both owner-on-own-floor and visitor-on-other-floor so the
              drawer layout stays consistent across contexts. Divider
              + centered layout matches the mockup. */}
          {visiting && (
            <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-center gap-5 text-xs flex-wrap">
              {/* Viewer count is meaningful when visiting someone
                  else's floor (other people might be there too). On
                  the owner's own /office it's mostly self-reference,
                  so we hide it when ownerName is null to keep the
                  row tight with just the pokes stat — mirrors the
                  mockup where Floor 6 only shows the pokes line. */}
              {visiting.ownerName && (
                <span className="flex items-center gap-1.5 text-tower-cream/85">
                  <DrawerEyeIcon />
                  <strong className="text-sm font-bold tabular-nums text-tower-cream">
                    {visiting.viewerCount}
                  </strong>
                  <span className="text-tower-cream/55">viewing</span>
                </span>
              )}
              <span className="flex items-center gap-1.5 text-tower-cream/85">
                <span className="text-amber-300 text-sm leading-none" aria-hidden>★</span>
                <strong className="text-sm font-bold tabular-nums text-tower-cream">
                  {visiting.totalPokes}
                </strong>
                <span className="text-tower-cream/55">
                  {visiting.totalPokes === 1 ? 'poke' : 'pokes'}
                </span>
                {!visiting.ownerName && (
                  <span className="text-tower-cream/55 italic"> · just for fun</span>
                )}
              </span>
              {visiting.ownerName && (
                <span className="text-amber-300/80 italic truncate max-w-[150px]">
                  on {visiting.ownerName}&apos;s floor
                </span>
              )}
            </div>
          )}
        </div>
        )}

        {/* Share — three actions in one row: X, LinkedIn, Copy. Hidden
            pre-login (the focal CTA is the save card above). */}
        {referralCode && (
        <div>
          {/* Share-section header row — title on the left, "{N} invites
              away" sub on the right (Section 2, screen 9). Mirrors the
              MobileShareSheet header so trial vs post-login both read
              the same way. */}
          <div className="flex items-baseline justify-between gap-2 mb-2.5">
            <h3 className="text-sm font-bold text-tower-cream">
              {nextFloor
                ? `Share to reach Floor ${nextFloor.id}`
                : 'Share your penthouse'}
            </h3>
            <span className="text-[11px] font-semibold text-purple-300 whitespace-nowrap">
              {nextFloor
                ? `${invitesToNext} ${invitesToNext === 1 ? 'invite' : 'invites'} away`
                : '👑 Top floor'}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => handleShare('x')}
              disabled={!inviteUrl}
              className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-md bg-night-deep/80 border border-white/10 text-sm font-semibold hover:bg-night-deep hover:border-white/20 transition disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Share on X"
            >
              <XLogo />
              <span>X</span>
            </button>
            <button
              onClick={() => handleShare('linkedin')}
              disabled={!inviteUrl}
              className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-md bg-night-deep/80 border border-white/10 text-sm font-semibold hover:bg-night-deep hover:border-white/20 transition disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Share on LinkedIn"
            >
              <LinkedInLogo />
              <span>LinkedIn</span>
            </button>
            <button
              onClick={handleCopy}
              disabled={!inviteUrl}
              className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-md bg-night-deep/80 border border-white/10 text-sm font-semibold hover:bg-night-deep hover:border-white/20 transition disabled:opacity-50 disabled:cursor-not-allowed"
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
        </div>
        )}

        {/* Quick actions — 2-column card grid (Section 2, screen 9).
            Hidden pre-login. */}
        {referralCode && (
        <div className={`grid gap-2 ${onArrangeRoom ? 'grid-cols-2' : 'grid-cols-1'}`}>
          <button
            type="button"
            onClick={() => setHowItWorksOpen(true)}
            className="flex flex-col items-center justify-center gap-1 px-3 py-3.5 rounded-xl bg-night-deep/60 border border-white/10 text-tower-cream hover:border-white/20 transition"
          >
            <span className="text-base leading-none" aria-hidden>ⓘ</span>
            <span className="text-[12px] font-semibold">How it works</span>
          </button>
          {onArrangeRoom && (
            <button
              type="button"
              onClick={onArrangeRoom}
              className="flex flex-col items-center justify-center gap-1 px-3 py-3.5 rounded-xl bg-night-deep/60 border border-white/10 text-tower-cream hover:border-white/20 transition"
            >
              <span className="text-base leading-none" aria-hidden>🪄</span>
              <span className="text-[12px] font-semibold">Arrange room</span>
            </button>
          )}
        </div>
        )}

        {/* Discord CTA — sits inline directly under the quick-actions
            grid (Section 2, screen 9), not pinned to the drawer footer.
            Shown for BOTH pre- and post-login, so the trial user has
            a community fallback even when the floor/share/quick-action
            block above is hidden. */}
        <a
          href={DISCORD_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl bg-[#5865f2] hover:bg-[#4752c4] text-white font-semibold transition"
        >
          <svg width="18" height="14" viewBox="0 0 71 55" fill="white" xmlns="http://www.w3.org/2000/svg" aria-hidden>
            <path d="M60.1045 4.8978C55.5792 2.8214 50.7265 1.2916 45.6527 0.41542C45.5603 0.39851 45.468 0.44077 45.4204 0.52529C44.7963 1.6353 44.105 3.0834 43.6209 4.2216C38.1637 3.4046 32.7345 3.4046 27.3892 4.2216C26.905 3.0581 26.1886 1.6353 25.5617 0.52529C25.5141 0.44336 25.4218 0.40110 25.3294 0.41542C20.2584 1.2888 15.4057 2.8186 10.8776 4.8978C10.8384 4.9147 10.8048 4.9429 10.7825 4.9795C1.57795 18.7309 -0.943561 32.1443 0.293408 45.3914C0.299005 45.4562 0.335386 45.5182 0.385761 45.5576C7.41596 50.7066 14.2196 53.9330 20.8952 56.0834C20.9876 56.1127 21.0857 56.0806 21.1445 56.0074C22.7586 53.8321 24.2017 51.5327 25.4414 49.1156C25.5026 48.9988 25.4442 48.8594 25.3183 48.8143C23.0568 47.9498 20.9009 46.9023 18.8254 45.7017C18.6864 45.6195 18.6752 45.4225 18.8030 45.3260C19.2317 45.0054 19.6605 44.6733 20.0701 44.3383C20.1347 44.2844 20.2243 44.2731 20.2998 44.3073C32.3202 49.7978 45.4020 49.7978 57.2796 44.3073C57.3551 44.2703 57.4447 44.2816 57.5121 44.3355C57.9217 44.6705 58.3505 45.0054 58.7820 45.3260C58.9098 45.4225 58.9014 45.6195 58.7624 45.7017C56.6869 46.9247 54.5310 47.9498 52.2667 48.8115C52.1408 48.8566 52.0852 48.9988 52.1464 49.1156C53.4085 51.5299 54.8516 53.8265 56.4349 56.0046C56.4937 56.0806 56.5946 56.1127 56.6870 56.0834C63.3933 53.9330 70.1970 50.7066 77.2272 45.5576C77.2804 45.5182 77.3140 45.4590 77.3196 45.3942C78.8187 30.0731 74.8719 16.7700 67.0575 4.9823C67.0380 4.9429 67.0044 4.9147 66.9624 4.8978ZM25.7628 37.2926C22.2211 37.2926 19.3038 34.0454 19.3038 30.0645C19.3038 26.0836 22.1648 22.8364 25.7628 22.8364C29.3889 22.8364 32.2779 26.1120 32.2218 30.0645C32.2218 34.0454 29.3608 37.2926 25.7628 37.2926ZM45.3311 37.2926C41.7895 37.2926 38.8721 34.0454 38.8721 30.0645C38.8721 26.0836 41.7331 22.8364 45.3311 22.8364C48.9573 22.8364 51.8462 26.1120 51.7901 30.0645C51.7901 34.0454 48.9573 37.2926 45.3311 37.2926Z" />
          </svg>
          Join us on Discord
        </a>

        {/* Invited-by card — moved down from the top per user
            feedback. Only renders when the server sealed an inviter
            on signup. */}
        {inviter && <InvitedByCard inviter={inviter} />}

        {/* Unverified-email CTA — signed-in user, emailVerified is false
            in the DB. Hidden once verification completes (parent re-
            fetches /api/me to flip `emailVerified` to true). Moved
            BELOW the "How it works" row so it doesn't dominate the
            top of the drawer — the prompt is still findable but isn't
            the first thing the user sees. */}
        {/* {onVerifyEmail && emailVerified === false && (
          <div className="rounded-lg border border-purple-500/30 bg-purple-500/10 px-3 py-2.5 text-sm">
            <div className="flex items-start gap-3">
              <div className="text-purple-300 text-base leading-none mt-0.5" aria-hidden>⚠</div>
              <div className="flex-1 min-w-0">
                <div className="text-purple-200 font-semibold mb-0.5">
                  Verify your email
                </div>
                {userEmail && (
                  <div className="text-[11px] text-purple-100/70 truncate">
                    {userEmail}
                  </div>
                )}
              </div>
              <button
                onClick={onVerifyEmail}
                className="shrink-0 px-3 py-1.5 rounded-md bg-purple-300 text-night-deep font-semibold text-xs hover:bg-purple-200 transition"
              >
                Verify
              </button>
            </div>
          </div>
        )} */}
      </div>

      <HowItWorksModal
        open={howItWorksOpen}
        onClose={() => setHowItWorksOpen(false)}
        inviteUrl={inviteUrl || null}
        currentFloor={currentFloor}
        totalInvites={totalInvites}
        // Threading the same trial-mode signup opener the drawer
        // itself uses → rewards modal footer swaps to the Save CTA
        // when the user is pre-login.
        onOpenSignup={onOpenSignup}
      />

      {/* Discord CTA used to live in a fixed footer here; it's now
          inline inside the scrolling content, right under the
          quick-actions grid, per Section 2 / screen 9. */}

      {/* Sign-out confirmation modal — rendered as a portal-style
          overlay over the entire drawer so the dim backdrop reads as
          "you need to answer this first". Lightweight (no react-dom
          portal) since it's already mounted inside the fixed drawer
          which has `inset-y-0` covering the viewport vertically. */}
      {signOutConfirmOpen && onLogout && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="signout-confirm-title"
          className="absolute inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm px-6"
          onClick={() => setSignOutConfirmOpen(false)}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="w-full max-w-xs bg-night-mid border border-white/15 rounded-2xl p-5 text-tower-cream shadow-2xl"
          >
            <h3 id="signout-confirm-title" className="text-base font-bold mb-1">
              Sign out?
            </h3>
            <p className="text-xs text-tower-cream/65 mb-4 leading-relaxed">
              You&apos;ll need to sign back in to see your room and invites.
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSignOutConfirmOpen(false)}
                className="flex-1 px-3 py-2 rounded-md border border-white/15 text-tower-cream/80 hover:bg-night-deep hover:text-tower-cream text-sm transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setSignOutConfirmOpen(false)
                  onLogout()
                }}
                className="flex-1 px-3 py-2 rounded-md bg-red-500/90 hover:bg-red-500 text-white font-semibold text-sm transition"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </>
  )
}

// ─── Invited-by card ────────────────────────────────────────────────────
/**
 * Shows who invited the currently signed-in user. Sealed server-side at
 * signup (User.referredByCode + User.referredAt) — once set, never
 * overwritten, so this is the definitive answer the user can rely on.
 *
 * Identity priority: inviter's team name (most personal) → masked email
 * (most trustworthy when no team name) → referral code (fallback).
 */
function InvitedByCard({ inviter }: { inviter: InviterInfo }) {
  const displayName = inviter.teamName?.trim() || inviter.emailMasked
  const invitedAtLabel = formatInvitedAt(inviter.invitedAt)
  return (
    <div className="rounded-xl p-4 bg-gradient-to-br from-purple-900/20 to-purple-800/5 border border-purple-500/25">
      <div className="text-[11px] uppercase tracking-widest text-purple-200/70 mb-2">
        Invited by
      </div>
      <div className="flex items-start gap-3">
        {/* Avatar — initial of team name or first letter of email */}
        <div className="shrink-0 w-10 h-10 rounded-full bg-purple-400/20 border border-purple-300/40 flex items-center justify-center text-base font-bold text-purple-200">
          {(displayName[0] ?? '?').toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-lg font-semibold text-tower-cream truncate">
            {displayName}
          </div>
          <div className="text-xs text-tower-cream/55 flex items-center gap-1.5 mt-0.5 flex-wrap">
            <span className="font-mono">{inviter.referralCode}</span>
            {inviter.country && (
              <>
                <span className="opacity-40">·</span>
                <span>{inviter.country}</span>
              </>
            )}
            {invitedAtLabel && (
              <>
                <span className="opacity-40">·</span>
                <span>{invitedAtLabel}</span>
              </>
            )}
          </div>
          <div className="text-[10px] text-tower-cream/40 mt-1.5">
            🔒 Your inviter is sealed and cannot be reassigned
          </div>
        </div>
      </div>
    </div>
  )
}

/** "2 days ago" / "just now" — null when there's no timestamp. */
function formatInvitedAt(iso: string | null): string | null {
  if (!iso) return null
  const ms = Date.now() - new Date(iso).getTime()
  if (ms < 0 || Number.isNaN(ms)) return null
  const min = Math.floor(ms / 60_000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.floor(hr / 24)
  if (day < 30) return `${day}d ago`
  const mo = Math.floor(day / 30)
  if (mo < 12) return `${mo}mo ago`
  return `${Math.floor(mo / 12)}y ago`
}

// `ShareFloorToggle` + the per-section `EyeIcon` used to live here
// for an in-drawer privacy switch. Now that the share URL is unified
// with the invite URL (always `/floor/<code>`), there's no toggle —
// the section was removed from the drawer.

/** X / Twitter wordmark — single-glyph "𝕏" doesn't render reliably on
 *  every OS font set, so we use the official path. */
function XLogo() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  )
}

/** Two interlocking chain links — used on the Copy button so it
 *  visually pairs with the X / LinkedIn buttons (icon + text). */
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

/** LinkedIn "in" mark. */
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

/** Minimal eye SVG — used for the "Visiting" pill so visitors can see
 *  how many other people are also looking at the floor right now. */
function DrawerEyeIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-tower-cream/70 shrink-0"
      aria-hidden
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}
