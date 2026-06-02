'use client'

/**
 * Leaderboard modal — top 50 users by invite count.
 *
 * Reads /api/leaderboard on open (cache-control prevents stale data).
 * The signed-in user's row is highlighted; users outside the top 50
 * get a separate "Your rank" pill at the bottom showing "50+" with
 * their invite total.
 */

import { useEffect, useState } from 'react'

interface LeaderboardEntry {
  rank: number
  teamName: string | null
  totalInvites: number
  country: string | null
  referralCode: string
}

interface LeaderboardResponse {
  top50: LeaderboardEntry[]
  currentUserRank: number | null
  isInTop50: boolean
}

interface Props {
  open: boolean
  onClose: () => void
  /** Current user's referral code — used to highlight their row in top50. */
  currentReferralCode?: string | null
  /** Current user's invite total — shown in the bottom "Your rank" pill
   *  when the user is outside the top 50. */
  totalInvites?: number
}

export function LeaderboardModal({
  open,
  onClose,
  currentReferralCode,
  totalInvites,
}: Props) {
  const [data, setData] = useState<LeaderboardResponse | null>(null)
  const [loading, setLoading] = useState(false)

  // Fetch on open + abort if the user closes the modal before the
  // response lands. Without this, setData would fire on a closed
  // modal — harmless visually but a React warning + wasted bandwidth.
  useEffect(() => {
    if (!open) return
    const ac = new AbortController()
    setLoading(true)
    fetch('/api/leaderboard', { cache: 'no-store', signal: ac.signal })
      .then(r => (r.ok ? r.json() : null))
      .then((d: LeaderboardResponse | null) => {
        if (!ac.signal.aborted) setData(d)
      })
      .catch(err => {
        if ((err as Error).name === 'AbortError') return
        if (!ac.signal.aborted) setData(null)
      })
      .finally(() => {
        if (!ac.signal.aborted) setLoading(false)
      })
    return () => ac.abort()
  }, [open])

  // Esc closes
  useEffect(() => {
    if (!open) return
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  const userRank = data?.currentUserRank ?? null
  const outsideTop50 = userRank !== null && userRank >= 51

  // ── MOBILE LAYOUT ──────────────────────────────────────────────
  // Bottom-anchored compact card matching the mockup .anchor-mini
  // style: translucent purple gradient, purple-tint border, parked
  // just above the MobileBottomNav (~82px tall + safe-area inset).
  // The card scrolls (max-h-[60vh] + overflow-y-auto), so show the full
  // top 50 on mobile too — same list as desktop, just in a compact card.
  const mobileTopRows = data?.top50 ?? []
  return (
    <>
      {/* MOBILE: bottom-anchored card (sub-md only). */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Top 50 leaderboard"
        onClick={onClose}
        className="md:hidden fixed inset-0 z-50 bg-black/40"
      >
        <div
          onClick={e => e.stopPropagation()}
          className="
            absolute left-3 right-3
            bottom-[calc(82px+env(safe-area-inset-bottom))]
            rounded-2xl border border-purple-400/30
            bg-gradient-to-b from-purple-500/20 to-night-deep/95
            backdrop-blur-md shadow-[0_12px_40px_rgba(0,0,0,0.55)]
            text-tower-cream max-h-[60vh] flex flex-col
          "
        >
          {/* Header — purple uppercase label, centered, with a small
              close ×. Matches the mockup's "🏆 TODAY'S LEADERS" pill
              style. */}
          <div className="relative flex items-center justify-center px-3 pt-3 pb-2">
            <div className="text-[11px] tracking-[0.12em] uppercase font-bold text-purple-200">
              🏆 Today&apos;s leaders
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              className="absolute right-2 top-1.5 text-tower-cream/55 hover:text-tower-cream text-lg leading-none p-1"
            >
              ×
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-3 pb-2">
            {loading && (
              <div className="text-center text-tower-cream/60 text-xs py-4">
                Loading…
              </div>
            )}
            {!loading && data && data.top50.length === 0 && (
              <div className="text-center text-tower-cream/60 text-xs py-4">
                No invites recorded yet — be the first!
              </div>
            )}
            {!loading && mobileTopRows.length > 0 && (
              <ul>
                {mobileTopRows.map((entry, idx) => {
                  const isMe =
                    !!currentReferralCode &&
                    entry.referralCode === currentReferralCode
                  const isLast = idx === mobileTopRows.length - 1
                  return (
                    <MobileLeaderRow
                      key={entry.referralCode}
                      entry={entry}
                      isMe={isMe}
                      isLast={isLast}
                    />
                  )
                })}
              </ul>
            )}
          </div>

          {/* Outside-top-50 footer pill — compact mobile variant. */}
          {outsideTop50 && (
            <div className="border-t border-purple-400/20 px-3 py-2 flex items-center justify-between text-[11px]">
              <span className="text-tower-cream/60">
                Your rank{' '}
                <span className="text-tower-gold font-bold">50+</span>
              </span>
              <span className="text-tower-cream/45">
                {totalInvites ?? 0} invite{(totalInvites ?? 0) === 1 ? '' : 's'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* DESKTOP: original centered modal (md+ only). Untouched
          palette + layout — only mobile got the purple-gradient
          redesign. */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Top 50 leaderboard"
        onClick={onClose}
        className="hidden md:flex fixed inset-0 z-50 items-center justify-center bg-black/70 backdrop-blur-md px-3 py-6"
      >
        <div
          onClick={e => e.stopPropagation()}
          className="relative w-full max-w-md max-h-[88vh] flex flex-col rounded-2xl bg-night-mid border border-tower-gold/40 shadow-2xl text-tower-cream"
        >
          <header className="flex items-center justify-between px-5 py-4 border-b border-white/10">
            <div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-tower-gold/80">
                Leaderboard
              </div>
              <h2 className="text-lg font-bold mt-0.5">🏆 Top 50 inviters</h2>
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              className="text-tower-cream/60 hover:text-tower-cream text-2xl leading-none"
            >
              ×
            </button>
          </header>

          <div className="flex-1 overflow-y-auto px-3 py-3">
            {loading && (
              <div className="text-center text-tower-cream/60 text-sm py-6">
                Loading the leaderboard…
              </div>
            )}
            {!loading && data && data.top50.length === 0 && (
              <div className="text-center text-tower-cream/60 text-sm py-6">
                No invites recorded yet — be the first!
              </div>
            )}
            {!loading && data && data.top50.length > 0 && (
              <ol className="space-y-1">
                {data.top50.map(entry => {
                  const isMe =
                    !!currentReferralCode &&
                    entry.referralCode === currentReferralCode
                  return (
                    <LeaderboardRow
                      key={entry.referralCode}
                      entry={entry}
                      isMe={isMe}
                    />
                  )
                })}
              </ol>
            )}
          </div>

          {outsideTop50 && (
            <div className="px-5 py-3 border-t border-white/10 bg-night-deep/60">
              <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-lg bg-tower-gold/10 border border-tower-gold/30">
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-tower-gold/70">
                    Your rank
                  </div>
                  <div className="text-base font-bold text-tower-gold">50+</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-tower-cream/60">
                    {totalInvites ?? 0} invite
                    {(totalInvites ?? 0) === 1 ? '' : 's'}
                  </div>
                  <div className="text-[10px] text-tower-cream/40 mt-0.5">
                    Keep inviting to break into the top 50
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

/**
 * Compact mobile row matching the mockup: rank on the left (gold
 * when #1, faint otherwise), team name centered, invites on the
 * right (faint). Bottom border on all but the last row gives the
 * stacked-divider look from the screenshot.
 */
function MobileLeaderRow({
  entry,
  isMe,
  isLast,
}: {
  entry: LeaderboardEntry
  isMe: boolean
  isLast: boolean
}) {
  const displayName = entry.teamName?.trim() || `Team ${entry.referralCode}`
  const rankColor =
    entry.rank === 1
      ? 'text-tower-gold'
      : isMe
      ? 'text-purple-200'
      : 'text-tower-cream/50'
  return (
    <li
      className={
        'flex items-center gap-2 py-2 ' +
        (isLast ? '' : 'border-b border-white/8')
      }
    >
      <div className={`w-5 text-[13px] font-bold ${rankColor}`}>
        {entry.rank}
      </div>
      <div className="flex-1 min-w-0 text-center">
        <span
          className={
            'text-[12.5px] font-medium truncate inline-block max-w-full align-middle ' +
            (isMe ? 'text-purple-100' : 'text-tower-cream/90')
          }
        >
          {displayName}
        </span>
        {isMe && (
          <span className="ml-1.5 text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-purple-400/25 text-purple-100 font-bold align-middle">
            You
          </span>
        )}
      </div>
      <div className="text-[11px] text-tower-cream/45 shrink-0">
        {entry.totalInvites} invite{entry.totalInvites === 1 ? '' : 's'}
      </div>
    </li>
  )
}

function LeaderboardRow({ entry, isMe }: { entry: LeaderboardEntry; isMe: boolean }) {
  const medal = entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : null
  const displayName = entry.teamName?.trim() || `Team ${entry.referralCode}`
  return (
    <li
      className={`flex items-center gap-3 px-3 py-2 rounded-lg transition ${
        isMe
          ? 'bg-tower-gold/15 border border-tower-gold/50 ring-1 ring-tower-gold/30'
          : 'hover:bg-white/5'
      }`}
    >
      <div
        className={`shrink-0 w-9 text-center font-bold ${
          isMe ? 'text-tower-gold' : entry.rank <= 3 ? 'text-tower-gold' : 'text-tower-cream/55'
        }`}
      >
        {medal ?? `#${entry.rank}`}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="font-semibold truncate text-sm">{displayName}</span>
          {isMe && (
            <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-tower-gold/30 text-tower-gold font-bold">
              You
            </span>
          )}
        </div>
        <div className="text-[10px] text-tower-cream/45 flex items-center gap-1.5 mt-0.5">
          <span className="font-mono">{entry.referralCode}</span>
          {/* {entry.country && (
            <>
              <span className="opacity-40">·</span>
              <span>{entry.country}</span>
            </>
          )} */}
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className="text-sm font-bold text-purple-300">
          {entry.totalInvites}
        </div>
        <div className="text-[9px] uppercase tracking-wider text-tower-cream/40">
          invite{entry.totalInvites === 1 ? '' : 's'}
        </div>
      </div>
    </li>
  )
}
