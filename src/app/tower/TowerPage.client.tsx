'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
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
import { useOrigin } from '@/hooks/useOrigin'
import { MobileBottomNav } from '@/components/mobile/MobileBottomNav'
import { MobileCounterChips } from '@/components/mobile/MobileCounterChips'
import { MobileProgressPill } from '@/components/mobile/MobileProgressPill'
import { MobileShareSheet } from '@/components/mobile/MobileShareSheet'
import type { InviterInfo } from '@/lib/inviter'

interface ServerRecruit {
  id: string
  name: string
  role: string
  slug?: string | null
  isDefault?: boolean
  pokes?: number
  /** "Launch-day promise" — Diaflow-API-generated sentence shown in
   *  the speech bubble. May be null while the bulk-add background
   *  fetch is still resolving; UI falls back to a generic line. */
  description?: string | null
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

  // Warm the next likely routes so Office↔Tower navigation feels
  // instant. From /tower the user almost always either goes back
  // home (/) or peeks into a specific floor (/tower-view/N). We
  // prefetch the office route on mount + the user's CURRENT floor
  // preview as a reasonable default for the floor-peek path.
  useEffect(() => {
    router.prefetch('/')
    if (props.currentFloor >= 1 && props.currentFloor <= 20) {
      router.prefetch(`/tower-view/${props.currentFloor}`)
    }
  }, [router, props.currentFloor])

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
  // Highest floor we've observed for this user during this mount.
  // Initialised from the SSR prop so the first SSE snapshot (which
  // simply replays the current floor on every reconnect AND on every
  // page-to-page navigation) is treated as a baseline, not an
  // upgrade — prevents the celebration modal firing when the user
  // navigates Office → Tower → Office.
  const baselineFloorRef = useRef(props.currentFloor)
  // Mobile share bottom-sheet — opened from the hero "Invite to climb"
  // tab. Same component as TowerLanding.
  const [mobileShareOpen, setMobileShareOpen] = useState(false)
  // Origin for composing the shareable invite URL (post-hydration only).
  const origin = useOrigin()

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
      // Celebration gate via ref baseline — see comment on
      // baselineFloorRef. Compares against the highest seen floor,
      // NOT the closure'd liveCurrentFloor (which can be stale across
      // SSE reconnects + page remounts).
      if (data.currentFloor > baselineFloorRef.current) {
        setCelebrationFloorsClimbed(data.currentFloor - baselineFloorRef.current)
        setCelebrationFloor(data.currentFloor)
        baselineFloorRef.current = data.currentFloor
      }
      const invitesDelta = data.totalInvites - liveTotalInvites
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
      // Even though the server only emits floor-up on a strict
      // increase, the client gate consults the ref so a duplicate or
      // out-of-order event can't replay the modal.
      if (data.currentFloor > baselineFloorRef.current) {
        setCelebrationFloorsClimbed(data.currentFloor - baselineFloorRef.current)
        setCelebrationFloor(data.currentFloor)
        baselineFloorRef.current = data.currentFloor
      }
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
        // Header "Invite" pill on mobile opens the share sheet.
        onMobileInvite={
          props.signedIn ? () => setMobileShareOpen(true) : undefined
        }
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

      {/* Mobile chrome — counter chips below the header, share sheet,
          progress pill, and the three-slot bottom nav. The "Tower" tab
          is the active one here; tapping "Office" navigates back to /,
          and "Invite to climb" opens the share sheet. */}
      <div className="md:hidden fixed top-[52px] inset-x-0 z-10">
        <MobileCounterChips
          currentFloor={effective.currentFloor}
          totalInvites={effective.totalInvites}
          teammateCount={teammateCount}
          maxTeammates={maxTeammates}
        />
      </div>
      <MobileProgressPill
        currentFloor={effective.currentFloor}
        totalInvites={effective.totalInvites}
        hidden={squadOpen || mobileShareOpen || signupOpen || leaderboardOpen}
        // Tower view stacks a leaderboard / floor-info card lower
        // in the screen; lift the progress pill so they don't collide.
        bottomOffsetClass="bottom-[calc(82px+env(safe-area-inset-bottom))]"
      />
      <MobileBottomNav
        active="tower"
        onGoOffice={() => {
          setIsNavigating(true)
          router.push('/')
        }}
        onGoTower={() => {
          /* already here */
        }}
        // Hero tab opens MySquadDrawer; share lives on the header
        // "Invite" pill.
        onOpenSquad={() => setSquadOpen(true)}
      />
      <MobileShareSheet
        open={mobileShareOpen}
        onClose={() => setMobileShareOpen(false)}
        inviteUrl={
          props.signedIn && props.referralCode && origin
            ? `${origin}/floor/${props.referralCode}`
            : null
        }
        currentFloor={effective.currentFloor}
        totalInvites={effective.totalInvites}
        onSignupNudge={!props.signedIn ? () => setSignupOpen(true) : undefined}
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

// MobileTowerActions was retired in favour of MobileBottomNav +
// MobileShareSheet. The new three-slot nav carries Office / Invite /
// Tower as a sticky bar at the bottom of every page, replacing the
// floating "Office + My Squad" pill row that used to live here.
