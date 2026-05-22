'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { TowerView } from '@/components/TowerView'
import { MySquadDrawer } from '@/components/MySquadDrawer'
import { MySquadFloatingButton } from '@/components/MySquadFloatingButton'
import { SignupModal } from '@/components/SignupModal'
import { LeaderboardModal } from '@/components/LeaderboardModal'
import { EmailVerifyModal } from '@/components/EmailVerifyModal'
import { CelebrationModal } from '@/components/CelebrationModal'
import { Header } from '@/components/Header'
import { ViewTransitionOverlay } from '@/components/ViewTransitionOverlay'
import { ToastStack, type ToastMessage } from '@/components/Toast'
import { readTrialState } from '@/lib/trial'
import {
  computeTeammateCount,
  filterCustomTeammates,
  DEFAULT_NPC_COUNT,
} from '@/lib/floors'
import { useMaxTeammates } from '@/lib/floorsConfigClient'
import { useRealtimeFloor } from '@/hooks/useRealtimeFloor'
import { useFloorPresence } from '@/hooks/useFloorPresence'
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
  signedIn: boolean
  /** Server-fetched values; ignored when `signedIn=false`. */
  currentFloor: number
  totalInvites: number
  teamName: string | null
  referralCode: string | null
  serverRecruits: ServerRecruit[]
  inviter: InviterInfo | null
  userEmail: string | null
  emailVerified: boolean
}

export default function TowerPageClient(props: Props) {
  const router = useRouter()
  const [squadOpen, setSquadOpen] = useState(false)
  const [signupOpen, setSignupOpen] = useState(false)
  const [leaderboardOpen, setLeaderboardOpen] = useState(false)
  const [emailVerifyOpen, setEmailVerifyOpen] = useState(false)
  // Spinner overlay during the slow /tower → / RSC round-trip. See the
  // TowerLanding.client.tsx note for the full rationale.
  const [isNavigating, setIsNavigating] = useState(false)
  // Mirror server-supplied emailVerified locally so completing the
  // EmailVerifyModal flow hides the "Verify your email" banner
  // immediately (without waiting for /api/me round-trip).
  const [emailVerified, setEmailVerified] = useState(props.emailVerified)
  // Leaderboard rank — fetched client-side from /api/leaderboard,
  // mirroring the home-page flow. `null` while loading / for trial.
  const [rank, setRank] = useState<number | null>(null)
  // Live server-side state that supersedes the initial props once SSE
  // events start landing. The initial render uses props (server-fetched
  // at request time); the SSE stream then pushes deltas as invites
  // verify in the background. Without this, /tower would freeze on
  // the values captured at first paint and miss any subsequent invite
  // credits — which was the original bug.
  const [liveTotalInvites, setLiveTotalInvites] = useState(props.totalInvites)
  const [liveCurrentFloor, setLiveCurrentFloor] = useState(props.currentFloor)
  // Toasts + celebration modal — same UX as the office view, so the
  // user gets the same feedback regardless of which view they're on
  // when an invite gets credited.
  const [toasts, setToasts] = useState<ToastMessage[]>([])
  const [celebrationFloor, setCelebrationFloor] = useState<number | null>(null)
  const [celebrationFloorsClimbed, setCelebrationFloorsClimbed] = useState(0)

  const pushToast = useCallback((msg: Omit<ToastMessage, 'id'>) => {
    setToasts(prev => [...prev, { ...msg, id: `t-${Date.now()}-${Math.random()}` }])
  }, [])
  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  async function handleLogout() {
    // Clear session server-side, then hard-reload home so the server
    // component re-renders without a session.
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } catch {/* fall through */}
    window.location.href = '/'
  }

  // Fetch leaderboard rank for signed-in users. Re-fetches whenever the
  // LIVE total-invites moves (driven by either the initial server prop
  // OR a subsequent SSE invite-accepted event), so /tower's rank pill
  // stays in sync with /api/leaderboard the same way the office view's
  // does.
  useEffect(() => {
    if (!props.signedIn) {
      setRank(null)
      return
    }
    const ac = new AbortController()
    fetch('/api/leaderboard', { cache: 'no-store', signal: ac.signal })
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (ac.signal.aborted || !data) return
        setRank(typeof data.currentUserRank === 'number' ? data.currentUserRank : null)
      })
      .catch(err => {
        if ((err as Error).name === 'AbortError') return
        /* swallow */
      })
    return () => ac.abort()
  }, [props.signedIn, liveTotalInvites])

  // Real-time updates via SSE — mirrors the office view (TowerLanding).
  // Without this hook, /tower would never learn that an invite just
  // verified, so the YOU marker, rank pill, MySquad progress bar, and
  // teammate-slot math would all freeze on the values captured at first
  // paint. Vercel's 25-second function cap forces SSE reconnects; the
  // `onSnapshot` handler diffs the post-reconnect baseline against
  // client state so any updates that landed during the reconnect window
  // still surface as a celebration / toast.
  useRealtimeFloor({
    enabled: props.signedIn,
    onSnapshot: data => {
      const floorClimbed = data.currentFloor - liveCurrentFloor
      const invitesDelta = data.totalInvites - liveTotalInvites
      if (floorClimbed > 0) {
        setCelebrationFloorsClimbed(floorClimbed)
        setCelebrationFloor(data.currentFloor)
      }
      if (invitesDelta > 0) {
        pushToast({
          title:
            invitesDelta === 1
              ? '+1 invite accepted'
              : `+${invitesDelta} invites accepted`,
          body: 'A new teammate slot is waiting — add them to your squad.',
          tone: 'success',
        })
      }
      setLiveCurrentFloor(data.currentFloor)
      setLiveTotalInvites(data.totalInvites)
    },
    onFloorUp: data => {
      const climbed = Math.max(1, data.currentFloor - liveCurrentFloor)
      setCelebrationFloorsClimbed(climbed)
      setCelebrationFloor(data.currentFloor)
      setLiveCurrentFloor(data.currentFloor)
      setLiveTotalInvites(data.totalInvites)
    },
    onInviteAccepted: data => {
      setLiveTotalInvites(data.totalInvites)
      pushToast({
        title: data.delta === 1 ? '+1 invite accepted' : `+${data.delta} invites accepted`,
        body: 'A new teammate slot is waiting — add them to your squad.',
        tone: 'success',
      })
    },
  })

  // Anonymous visitors hydrate from localStorage so My Squad still shows
  // their trial team name + invite count. Trial state never grants a YOU
  // marker — that's strictly server-session gated inside TowerView.
  const [trialTeamName, setTrialTeamName] = useState<string | null>(null)
  const [trialTotalInvites, setTrialTotalInvites] = useState(0)
  const [trialCurrentFloor, setTrialCurrentFloor] = useState(1)

  useEffect(() => {
    if (props.signedIn) return
    const t = readTrialState()
    if (t) {
      setTrialTeamName(t.teamName)
      setTrialTotalInvites(t.totalInvites)
      setTrialCurrentFloor(t.currentFloor)
    }
  }, [props.signedIn])

  const effective = props.signedIn
    ? {
        teamName: props.teamName,
        // Live values from the SSE stream when available — they fall
        // back to the props on initial render (before the first
        // snapshot event arrives) so SSR hydration matches.
        totalInvites: liveTotalInvites,
        currentFloor: liveCurrentFloor,
        teammates: props.serverRecruits,
      }
    : {
        teamName: trialTeamName,
        totalInvites: trialTotalInvites,
        currentFloor: trialCurrentFloor,
        teammates: [] as ServerRecruit[],
      }

  // Defaults (Iris/Mia/Leo) live in the DB now, so `effective.teammates`
  // for a signed-in user already contains them. Use the shared helper
  // so the count matches the home-page badge exactly.
  const teammateCount = computeTeammateCount(effective.teammates)
  // Live max-teammates from /api/floors (cached). Falls back to static
  // FLOOR_MAX_TEAMMATES until the first API response.
  const maxTeammates = useMaxTeammates(effective.currentFloor)
  // Slot math runs against the user-recruited slice only — defaults
  // never block adding new teammates.
  const customCount = filterCustomTeammates(effective.teammates).length
  const slotsAvailable = Math.max(0, maxTeammates - DEFAULT_NPC_COUNT - customCount)

  // Owner-side floor stats — same as /office: live viewer count via
  // `observe` mode (no self-counting) + sum of teammate pokes. Surfaced
  // in MySquadDrawer's "Your floor" pill. Anonymous users have no
  // referralCode, so the hook returns 0 and the pill is suppressed.
  const ownerViewerCount = useFloorPresence({
    code: props.signedIn ? props.referralCode : null,
    mode: 'observe',
  })
  const ownerTotalPokes = effective.teammates.reduce(
    (sum, t) => sum + (t.pokes ?? 0),
    0,
  )

  return (
    <main className="fixed inset-0 overflow-hidden bg-[#04040d]">
      {/* Header — same as home, with `showTower=true` so the toggle reads
          "Office view" and navigates back to /. */}
      <Header
        signedIn={props.signedIn}
        currentFloor={effective.currentFloor}
        totalInvites={effective.totalInvites}
        referralCode={props.referralCode}
        teammateCount={teammateCount}
        maxTeammates={maxTeammates}
        slotsAvailable={slotsAvailable}
        showTower={true}
        onToggleTower={() => {
          setIsNavigating(true)
          router.push('/')
        }}
        onOpenSignup={!props.signedIn ? () => setSignupOpen(true) : undefined}
      />

      <TowerView
        signedIn={props.signedIn}
        currentFloor={effective.currentFloor}
        totalInvites={effective.totalInvites}
        teamName={effective.teamName}
        onClose={() => {
          setIsNavigating(true)
          router.push('/')
        }}
        onSignIn={() => router.push('/login')}
      />

      {/* Office navigation overlay — covers the tower while / loads. */}
      {isNavigating && <ViewTransitionOverlay label="Loading office view…" />}

      {/* Leaderboard trigger — floating button visible on both
          desktop + mobile. Pinned to the right edge above MySquad. */}
      <LeaderboardButton onClick={() => setLeaderboardOpen(true)} />

      {/* My Squad is always visible — desktop right-edge + mobile
          floating pill (bottom-right). The Office toggle sits to its
          left as a second compact pill so /tower mobile keeps a way
          back to / without consuming a full sticky bottom bar (which
          would cover the bottom rows of the tower image). */}
      <MySquadFloatingButton visible onClick={() => setSquadOpen(true)} />
      <MobileTowerActions
        onOpenSquad={() => setSquadOpen(true)}
        onGoOffice={() => {
          setIsNavigating(true)
          router.push('/')
        }}
      />

      <MySquadDrawer
        open={squadOpen}
        onClose={() => setSquadOpen(false)}
        teamName={effective.teamName}
        referralCode={props.referralCode}
        totalInvites={effective.totalInvites}
        currentFloor={effective.currentFloor}
        emailCaptured={props.signedIn}
        teammates={effective.teammates}
        inviter={props.inviter}
        onOpenSignup={!props.signedIn ? () => setSignupOpen(true) : undefined}
        onLogout={props.signedIn ? handleLogout : undefined}
        emailVerified={props.signedIn ? emailVerified : undefined}
        userEmail={props.userEmail}
        onVerifyEmail={
          props.signedIn && !emailVerified ? () => setEmailVerifyOpen(true) : undefined
        }
        rank={rank}
        // Owner-side floor activity — `ownerName: null` flips the
        // drawer's pill label from "Visiting <name>" to "Your floor".
        visiting={
          props.signedIn && props.referralCode
            ? {
                ownerName: null,
                viewerCount: ownerViewerCount,
                totalPokes: ownerTotalPokes,
              }
            : undefined
        }
      />

      <LeaderboardModal
        open={leaderboardOpen}
        onClose={() => setLeaderboardOpen(false)}
        currentReferralCode={props.referralCode}
        totalInvites={effective.totalInvites}
      />

      {signupOpen && <SignupModal onClose={() => setSignupOpen(false)} />}

      <EmailVerifyModal
        open={emailVerifyOpen}
        onClose={() => setEmailVerifyOpen(false)}
        email={props.userEmail}
        onVerified={() => setEmailVerified(true)}
      />

      {/* Floor-up celebration — gated behind signed-in (anonymous /
          trial users never see this modal, matching the office view's
          policy). Fires from the SSE `floor-up` handler above. */}
      {props.signedIn && celebrationFloor != null && (
        <CelebrationModal
          floor={celebrationFloor}
          totalInvites={effective.totalInvites}
          trialMode={false}
          floorsClimbed={celebrationFloorsClimbed}
          onClose={() => setCelebrationFloor(null)}
        />
      )}

      {/* Toasts — used by the SSE `invite-accepted` handler so the user
          gets the same "+1 invite accepted" feedback on /tower as they
          do in the office view. */}
      <ToastStack toasts={toasts} onDismiss={dismissToast} />
    </main>
  )
}

/**
 * Floating "Top 50" button — mirrors MySquad's right-edge dock above
 * it (desktop) and sits next to the mobile My Squad pill (mobile).
 */
function LeaderboardButton({ onClick }: { onClick: () => void }) {
  return (
    <>
      {/* Desktop vertical pill — sits clearly ABOVE MySquad with a
          generous gap so the two right-edge docks don't visually
          merge or overlap on shorter viewports. MySquad is centered
          vertically (`top-1/2 -translate-y-1/2`); ours is offset up
          by 140px to clear it on every common viewport height. */}
      <button
        onClick={onClick}
        aria-label="Open leaderboard"
        className="hidden md:block fixed right-0 top-1/2 z-20 group"
        style={{ transform: 'translateY(calc(-50% - 140px))' }}
      >
        <div className="flex flex-col items-center gap-2 px-2 py-3 rounded-l-xl bg-night-mid/90 border border-tower-gold/40 border-r-0 backdrop-blur-sm shadow-lg group-hover:bg-night-mid transition">
          <span className="text-tower-gold text-lg" aria-hidden>🏆</span>
          <span
            className="text-tower-cream font-semibold text-xs tracking-wide"
            style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
          >
            Top 50
          </span>
        </div>
      </button>
      {/* Mobile pill — stacked ABOVE the bottom-right My Squad pill so
          they don't collide on narrow phones. */}
      {/* Mobile Top-50 pill — stacked ABOVE the bottom-right Office +
          My Squad row so they don't collide on narrow phones. The
          TowerView info card lives at TOP-left now, so the bottom
          strip is free for these floating pills. */}
      <button
        onClick={onClick}
        aria-label="Open leaderboard"
        className="md:hidden fixed bottom-[5rem] right-5 z-30 px-3 py-2.5 rounded-full bg-night-mid border border-tower-gold/40 text-tower-gold font-semibold text-xs shadow-lg flex items-center gap-1"
        style={{ boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}
      >
        <span aria-hidden>🏆</span>
        Top 50
      </button>
    </>
  )
}

/**
 * Two compact bottom-right pills for /tower mobile: Office (back to /)
 * + My Squad. Kept as floating pills rather than a full sticky bottom
 * bar so the tower image isn't covered. The Office pill sits to the
 * LEFT of My Squad on the same baseline so both are reachable with one
 * thumb. The TowerView info card was relocated from bottom-left to
 * top-left specifically so this row could anchor to bottom-5 without
 * overlapping anything.
 */
function MobileTowerActions({
  onOpenSquad,
  onGoOffice,
}: {
  onOpenSquad: () => void
  onGoOffice: () => void
}) {
  return (
    <div
      className="md:hidden fixed bottom-5 right-5 z-30 flex items-center gap-2"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <button
        onClick={onGoOffice}
        aria-label="Back to office view"
        className="px-3.5 py-2.5 rounded-full bg-night-mid/95 border border-tower-gold/40 text-tower-cream font-semibold text-xs shadow-lg flex items-center gap-1.5 backdrop-blur-sm"
        style={{ boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}
      >
        <span aria-hidden>🏠</span>
        Office
      </button>
      <button
        onClick={onOpenSquad}
        aria-label="Open My Squad"
        className="px-3.5 py-2.5 rounded-full bg-tower-gold text-night-deep font-semibold text-xs shadow-lg flex items-center gap-1.5"
        style={{ boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}
      >
        <span aria-hidden>📋</span>
        My Squad
      </button>
    </div>
  )
}
