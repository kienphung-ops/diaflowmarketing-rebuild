'use client'

import { useEffect, useState } from 'react'
import { useFloor, useFloorCount } from '@/lib/floorsConfigClient'
import { DISCORD_URL } from '@/lib/links'
import { HowItWorksModal } from './HowItWorksModal'
import { useOrigin } from '@/hooks/useOrigin'
import type { InviterInfo } from '@/lib/inviter'

interface ServerRecruit {
  id: string
  name: string
  role: string
  slug?: string | null
  isDefault?: boolean
  pokes?: number
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
  userEmail,
  onVerifyEmail,
  onLogout,
  visiting,
  // Below are still part of Props for callers but the drawer no longer
  // renders share-floor / teammate-list / add-teammate UI. The /floor/<code>
  // route is the canonical share + invite URL, and per-teammate
  // interactions happen via the 3D scene + bulk-add modal.
}: Props) {
  const [renaming, setRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState(teamName ?? '')
  const [copied, setCopied] = useState(false)
  const [howItWorksOpen, setHowItWorksOpen] = useState(false)

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
    try {
      await navigator.clipboard.writeText(inviteUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* ignore */
    }
  }

  function handleShare(network: 'x' | 'linkedin' | 'threads') {
    if (!inviteUrl) return
    const text = `Building my AI squad with @Diaflow. Currently on Floor ${currentFloor} of ${totalFloors} — climb with me`
    const encoded = encodeURIComponent(text + ' ' + inviteUrl)
    const urls: Record<typeof network, string> = {
      x: `https://x.com/intent/tweet?text=${encoded}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(inviteUrl)}`,
      threads: `https://www.threads.net/intent/post?text=${encoded}`,
    }
    window.open(urls[network], '_blank', 'noopener,noreferrer,width=620,height=620')
  }


  return (
    <div
      className={`fixed inset-y-0 right-0 z-30 w-full md:w-[440px] max-w-full bg-night-mid/95 border-l border-white/10 backdrop-blur-md shadow-2xl flex flex-col text-tower-cream transition-transform duration-300 ${
        open ? 'translate-x-0' : 'translate-x-full'
      }`}
    >
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
        <h2 className="text-2xl font-bold">My Squad</h2>
        <button onClick={onClose} className="text-tower-cream/50 hover:text-tower-cream text-xl" aria-label="Close">
          ×
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
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

        {/* Unverified-email CTA — signed-in user, emailVerified is false
            in the DB. Hidden once verification completes (parent
            re-fetches /api/me to flip `emailVerified` to true). */}
        {onVerifyEmail && emailVerified === false && (
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
                <div className="text-[11px] text-tower-cream/60 mt-1">
                  Confirms we can reach you with floor-up notifications and
                  invite credits.
                </div>
              </div>
              <button
                onClick={onVerifyEmail}
                className="shrink-0 px-3 py-1.5 rounded-md bg-purple-300 text-night-deep font-semibold text-xs hover:bg-purple-200 transition"
              >
                Verify
              </button>
            </div>
          </div>
        )}

        {/* Floor-activity stats — viewer count + total pokes.
            Section label adapts to context:
              - `ownerName` set → "Visiting <name>" (guest on /floor/[code])
              - `ownerName` null → "Your floor" (owner on /office or /tower)
            Provides a single place for floor-side metrics whether the
            user is browsing their own page or someone else's. */}
        {visiting && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3">
            <div className="flex items-baseline justify-between mb-2">
              <div className="text-[10px] uppercase tracking-[0.18em] text-amber-300/80">
                {visiting.ownerName ? 'Visiting' : 'Your floor'}
              </div>
              {visiting.ownerName && (
                <div className="text-xs font-semibold text-amber-200 truncate ml-2 max-w-[160px]">
                  {visiting.ownerName}
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-night-deep/60 border border-white/5">
                <DrawerEyeIcon />
                <div className="leading-tight">
                  <div className="text-sm font-bold text-tower-cream tabular-nums">
                    {visiting.viewerCount}
                  </div>
                  <div className="text-[9px] uppercase tracking-wider text-tower-cream/50">
                    viewing
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-night-deep/60 border border-white/5">
                <span className="text-amber-300 text-base leading-none" aria-hidden>★</span>
                <div className="leading-tight">
                  <div className="text-sm font-bold text-tower-cream tabular-nums">
                    {visiting.totalPokes}
                  </div>
                  <div className="text-[9px] uppercase tracking-wider text-tower-cream/50">
                    {visiting.totalPokes === 1 ? 'total poke' : 'total pokes'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Team name */}
        <div>
          <div className="text-[11px] uppercase tracking-widest text-tower-cream/40 mb-2">Your squad</div>
          <div className="flex items-center gap-2">
            {renaming ? (
              <>
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
              </>
            ) : (
              <>
                <div className="text-3xl font-bold lowercase">{teamName || 'untitled'}</div>
                <button
                  onClick={() => setRenaming(true)}
                  className="text-xs px-2 py-1 rounded bg-night-deep/80 border border-white/10 text-tower-cream/60 hover:text-tower-cream"
                >
                  ✎ Rename
                </button>
              </>
            )}
          </div>

          {/* Invite link */}
          {referralCode ? (
            <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-md bg-night-deep border border-white/10">
              <span className="flex-1 text-sm font-mono text-tower-cream/80 truncate">{inviteUrl}</span>
              <button
                onClick={handleCopy}
                className="text-tower-cream/60 hover:text-tower-gold text-sm"
                aria-label="Copy invite link"
              >
                {copied ? '✓' : '⧉'}
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenSignup}
              className="mt-3 w-full px-3 py-2 rounded-md bg-night-deep border border-tower-gold/30 text-sm text-tower-gold hover:bg-night-deep/80"
            >
              Sign up to get your invite link →
            </button>
          )}
        </div>

        {/* Invited-by card — only when the server has a sealed inviter row. */}
        {inviter && <InvitedByCard inviter={inviter} />}

        {/* Current floor card */}
        <div className="rounded-xl p-4 bg-gradient-to-br from-purple-900/40 to-purple-800/20 border border-purple-500/30">
          <div className="flex items-baseline justify-between">
            <div className="text-[11px] uppercase tracking-widest text-tower-cream/50">Current floor</div>
            <div className="text-right">
              <div className="text-sm font-semibold">
                {rank == null ? (
                  <span className="text-tower-cream/40">Rank —</span>
                ) : rank >= 51 ? (
                  <span title="Outside top 50 — keep inviting!">Rank 50+</span>
                ) : (
                  <>Rank #{rank}</>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <div className="text-5xl font-bold">{currentFloor}</div>
            <div className="text-base text-tower-cream/50">of {totalFloors}</div>
          </div>
          <div className="mt-3 h-1.5 rounded-full bg-night-deep/60 overflow-hidden">
            <div className="h-full bg-purple-400" style={{ width: `${progressPct}%` }} />
          </div>
          <div className="mt-2 flex items-center justify-between text-xs">
            <span className="text-tower-cream/80">
              {nextFloor
                ? `${invitesToNext} more ${invitesToNext === 1 ? 'invite' : 'invites'} → Floor ${nextFloor.id}`
                : 'You reached the top'}
            </span>
            {nextFloor && <span className="text-tower-cream/60">{nextFloor.label}</span>}
          </div>
        </div>

        {/* Share-floor section + per-teammate list were removed per
            product call: the invite URL above already doubles as the
            share-floor URL (one /floor/<code> route), and the scene
            view already shows everyone — the redundant drawer list
            was clutter. Edit modal is still reachable by clicking
            teammates in the 3D scene (or via the bulk-add CTA). */}

        {/* Share */}
        <div>
          <div className="text-sm font-semibold mb-2">Share to climb faster</div>
          <div className="grid grid-cols-3 gap-2">
            {(['x', 'linkedin', 'threads'] as const).map(net => (
              <button
                key={net}
                onClick={() => handleShare(net)}
                className="px-3 py-2 rounded-md bg-night-deep/80 border border-white/10 text-sm font-semibold capitalize hover:bg-night-deep transition"
                disabled={!inviteUrl}
              >
                {net === 'x' ? '𝕏 X' : net === 'linkedin' ? '🔗 LinkedIn' : '@ Threads'}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={() => setHowItWorksOpen(true)}
          className="flex items-center justify-between w-full text-xs hover:bg-night-deep/40 rounded-md px-1 py-0.5 -mx-1 transition"
        >
          <span className="flex items-center gap-1 text-tower-cream/50">ⓘ How it works</span>
          <span className="text-purple-300 hover:text-purple-200 font-semibold">Open →</span>
        </button>
      </div>

      <HowItWorksModal
        open={howItWorksOpen}
        onClose={() => setHowItWorksOpen(false)}
        inviteUrl={inviteUrl || null}
      />

      <div className="border-t border-white/5 p-4 mt-auto space-y-2">
        {/* Sign out — only for signed-in users (anonymous trial has no
            session to clear). Posted via the parent handler so any
            client-side cleanup (cache busts, toast, redirect) is
            centralised in TowerLanding. */}
        {onLogout && (
          <button
            onClick={onLogout}
            className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-md bg-night-deep/60 border border-white/10 text-tower-cream/80 hover:border-red-400/40 hover:text-red-300 hover:bg-red-500/5 font-semibold text-sm transition"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Sign out
          </button>
        )}
        <a
          href={DISCORD_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-md bg-[#5865f2] hover:bg-[#4752c4] text-white font-semibold transition"
        >
          <svg width="18" height="14" viewBox="0 0 71 55" fill="white" xmlns="http://www.w3.org/2000/svg" aria-hidden>
            <path d="M60.1045 4.8978C55.5792 2.8214 50.7265 1.2916 45.6527 0.41542C45.5603 0.39851 45.468 0.44077 45.4204 0.52529C44.7963 1.6353 44.105 3.0834 43.6209 4.2216C38.1637 3.4046 32.7345 3.4046 27.3892 4.2216C26.905 3.0581 26.1886 1.6353 25.5617 0.52529C25.5141 0.44336 25.4218 0.40110 25.3294 0.41542C20.2584 1.2888 15.4057 2.8186 10.8776 4.8978C10.8384 4.9147 10.8048 4.9429 10.7825 4.9795C1.57795 18.7309 -0.943561 32.1443 0.293408 45.3914C0.299005 45.4562 0.335386 45.5182 0.385761 45.5576C7.41596 50.7066 14.2196 53.9330 20.8952 56.0834C20.9876 56.1127 21.0857 56.0806 21.1445 56.0074C22.7586 53.8321 24.2017 51.5327 25.4414 49.1156C25.5026 48.9988 25.4442 48.8594 25.3183 48.8143C23.0568 47.9498 20.9009 46.9023 18.8254 45.7017C18.6864 45.6195 18.6752 45.4225 18.8030 45.3260C19.2317 45.0054 19.6605 44.6733 20.0701 44.3383C20.1347 44.2844 20.2243 44.2731 20.2998 44.3073C32.3202 49.7978 45.4020 49.7978 57.2796 44.3073C57.3551 44.2703 57.4447 44.2816 57.5121 44.3355C57.9217 44.6705 58.3505 45.0054 58.7820 45.3260C58.9098 45.4225 58.9014 45.6195 58.7624 45.7017C56.6869 46.9247 54.5310 47.9498 52.2667 48.8115C52.1408 48.8566 52.0852 48.9988 52.1464 49.1156C53.4085 51.5299 54.8516 53.8265 56.4349 56.0046C56.4937 56.0806 56.5946 56.1127 56.6870 56.0834C63.3933 53.9330 70.1970 50.7066 77.2272 45.5576C77.2804 45.5182 77.3140 45.4590 77.3196 45.3942C78.8187 30.0731 74.8719 16.7700 67.0575 4.9823C67.0380 4.9429 67.0044 4.9147 66.9624 4.8978ZM25.7628 37.2926C22.2211 37.2926 19.3038 34.0454 19.3038 30.0645C19.3038 26.0836 22.1648 22.8364 25.7628 22.8364C29.3889 22.8364 32.2779 26.1120 32.2218 30.0645C32.2218 34.0454 29.3608 37.2926 25.7628 37.2926ZM45.3311 37.2926C41.7895 37.2926 38.8721 34.0454 38.8721 30.0645C38.8721 26.0836 41.7331 22.8364 45.3311 22.8364C48.9573 22.8364 51.8462 26.1120 51.7901 30.0645C51.7901 34.0454 48.9573 37.2926 45.3311 37.2926Z" />
          </svg>
          Join us on Discord
        </a>
      </div>
    </div>
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
