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

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Top 50 leaderboard"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md px-3 py-6"
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
                const isMe = !!currentReferralCode && entry.referralCode === currentReferralCode
                return (
                  <LeaderboardRow key={entry.referralCode} entry={entry} isMe={isMe} />
                )
              })}
            </ol>
          )}
        </div>

        {/* User's rank pill — only when outside top 50 */}
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
                  {totalInvites ?? 0} invite{(totalInvites ?? 0) === 1 ? '' : 's'}
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
          {entry.country && (
            <>
              <span className="opacity-40">·</span>
              <span>{entry.country}</span>
            </>
          )}
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className="text-sm font-bold text-amber-300">
          {entry.totalInvites}
        </div>
        <div className="text-[9px] uppercase tracking-wider text-tower-cream/40">
          invite{entry.totalInvites === 1 ? '' : 's'}
        </div>
      </div>
    </li>
  )
}
