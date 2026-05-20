'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { TowerView } from '@/components/TowerView'
import { MySquadDrawer } from '@/components/MySquadDrawer'
import { MySquadFloatingButton } from '@/components/MySquadFloatingButton'
import { SignupModal } from '@/components/SignupModal'
import { LeaderboardModal } from '@/components/LeaderboardModal'
import { Header } from '@/components/Header'
import { readTrialState } from '@/lib/trial'
import { getMaxTeammates, getRecruitSlotsAvailable, DEFAULT_NPC_COUNT } from '@/lib/floors'
import type { InviterInfo } from '@/lib/inviter'

interface ServerRecruit {
  id: string
  name: string
  role: string
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
}

export default function TowerPageClient(props: Props) {
  const router = useRouter()
  const [squadOpen, setSquadOpen] = useState(false)
  const [signupOpen, setSignupOpen] = useState(false)
  const [leaderboardOpen, setLeaderboardOpen] = useState(false)

  async function handleLogout() {
    // Clear session server-side, then hard-reload home so the server
    // component re-renders without a session.
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } catch {/* fall through */}
    window.location.href = '/'
  }

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
        totalInvites: props.totalInvites,
        currentFloor: props.currentFloor,
        teammates: props.serverRecruits,
      }
    : {
        teamName: trialTeamName,
        totalInvites: trialTotalInvites,
        currentFloor: trialCurrentFloor,
        teammates: [] as ServerRecruit[],
      }

  const teammateCount = DEFAULT_NPC_COUNT + effective.teammates.length
  const maxTeammates = getMaxTeammates(effective.currentFloor)
  const slotsAvailable = getRecruitSlotsAvailable(effective.currentFloor, effective.teammates.length)

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
        onToggleTower={() => router.push('/')}
        onOpenSignup={!props.signedIn ? () => setSignupOpen(true) : undefined}
      />

      <TowerView
        signedIn={props.signedIn}
        currentFloor={effective.currentFloor}
        totalInvites={effective.totalInvites}
        teamName={effective.teamName}
        onClose={() => router.push('/')}
        onSignIn={() => router.push('/login')}
      />

      {/* Leaderboard trigger — floating button visible on both
          desktop + mobile. Pinned to the right edge above MySquad. */}
      <LeaderboardButton onClick={() => setLeaderboardOpen(true)} />

      {/* My Squad is always visible — desktop right-edge + mobile bottom button */}
      <MySquadFloatingButton visible onClick={() => setSquadOpen(true)} />
      <MobileSquadButton onClick={() => setSquadOpen(true)} />

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
      />

      <LeaderboardModal
        open={leaderboardOpen}
        onClose={() => setLeaderboardOpen(false)}
        currentReferralCode={props.referralCode}
        totalInvites={effective.totalInvites}
      />

      {signupOpen && <SignupModal onClose={() => setSignupOpen(false)} />}
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
 * Mobile-only square button anchored to bottom-right, mirroring the
 * floating-right-edge button on desktop. The full bottom action bar from
 * the home page would be redundant here — on /tower the only actions are
 * navigating back to office (via Header's Tower toggle) and My Squad.
 */
function MobileSquadButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label="Open My Squad"
      className="md:hidden fixed bottom-5 right-5 z-30 px-3.5 py-2.5 rounded-full bg-tower-gold text-night-deep font-semibold text-xs shadow-lg flex items-center gap-1.5"
      style={{ boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}
    >
      <span aria-hidden>📋</span>
      My Squad
    </button>
  )
}
