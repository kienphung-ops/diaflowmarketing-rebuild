'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { Header } from '@/components/Header'
import { CelebrationModal } from '@/components/CelebrationModal'
import { SignupModal } from '@/components/SignupModal'
import { IrisBubble, MiaBubble, LeoBubble } from '@/components/OnboardingBubble'
import { MySquadDrawer } from '@/components/MySquadDrawer'
import { MySquadFloatingButton } from '@/components/MySquadFloatingButton'
import { MiaInfoCard } from '@/components/MiaInfoCard'
import { LeoEmailDrawer } from '@/components/LeoEmailDrawer'
import { TeammateEditModal } from '@/components/TeammateEditModal'
import { BulkAddTeammatesModal } from '@/components/BulkAddTeammatesModal'
import { MobileBottomBar } from '@/components/MobileBottomBar'
import { EmailVerifyModal } from '@/components/EmailVerifyModal'
import { ToastStack, type ToastMessage } from '@/components/Toast'
import { useRealtimeFloor } from '@/hooks/useRealtimeFloor'
import { getMaxTeammates, getRecruitSlotsAvailable, DEFAULT_NPC_COUNT } from '@/lib/floors'
import {
  advanceTrialInvites,
  defaultTrialState,
  nextOnboardingStep,
  readTrialState,
  saveTrialState,
  type TrialState,
} from '@/lib/trial'

import { SceneSkeleton } from '@/components/fallback/SceneSkeleton'

const SceneCanvas = dynamic(
  () => import('@/components/scene/SceneCanvas').then(m => ({ default: m.SceneCanvas })),
  { ssr: false, loading: () => <SceneSkeleton /> }
)

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
  currentFloor: number
  unlockedItemKeys: string[]
  referralCode: string | null
  totalInvites: number
  signedIn: boolean
  serverRecruits: ServerRecruit[]
  serverTeamName: string | null
  serverTeamPurpose: string | null
  inviter: InviterInfo | null
  emailVerified: boolean
  userEmail: string | null
  publicVisible: boolean
}

export default function TowerLanding(props: Props) {
  const isTrial = !props.signedIn
  const router = useRouter()

  const [trial, setTrial] = useState<TrialState>(() => ({
    ...defaultTrialState(),
    totalInvites: props.totalInvites,
    currentFloor: props.currentFloor,
    unlockedItemKeys: props.unlockedItemKeys,
    onboardingStep: isTrial ? 'iris' : 'done',
  }))

  // Live server state for signed-in users (kept in sync via polling).
  const [serverState, setServerState] = useState({
    currentFloor: props.currentFloor,
    totalInvites: props.totalInvites,
    unlockedItemKeys: props.unlockedItemKeys,
    teamName: props.serverTeamName,
  })

  const [recruits, setRecruits] = useState<ServerRecruit[]>(props.serverRecruits)
  const [celebrationFloor, setCelebrationFloor] = useState<number | null>(null)
  const [celebrationFloorsClimbed, setCelebrationFloorsClimbed] = useState(0)
  const [showSignupModal, setShowSignupModal] = useState(false)
  const [activeNpcModal, setActiveNpcModal] = useState<'iris' | 'mia' | 'leo' | null>(null)
  const [squadOpen, setSquadOpen] = useState(false)
  const [editingTeammate, setEditingTeammate] = useState<ServerRecruit | null>(null)
  const [bulkAddOpen, setBulkAddOpen] = useState(false)
  const [toasts, setToasts] = useState<ToastMessage[]>([])
  // Reset-position signal — bumped by MySquadDrawer / TeammateEditModal
  // and consumed by OfficeScene's `resetSignal` effect.
  const [resetSignal, setResetSignal] = useState<{ slug: string | 'all' | null; counter: number } | null>(null)
  // Leaderboard rank — fetched from /api/leaderboard. `null` for
  // anonymous, `51` = "outside top 50" (renders as "50+").
  const [rank, setRank] = useState<number | null>(null)
  // Email verification state — initial value from server, flipped to
  // true after the user completes the EmailVerifyModal flow.
  const [emailVerified, setEmailVerified] = useState(props.emailVerified)
  const [emailVerifyOpen, setEmailVerifyOpen] = useState(false)
  // Public/private floor share state — initial from server, mutated
  // via the toggle which PATCHes /api/user/visibility.
  const [publicVisible, setPublicVisible] = useState(props.publicVisible)
  const prevTrialFloorRef = useRef(trial.currentFloor)

  const pushToast = useCallback((msg: Omit<ToastMessage, 'id'>) => {
    setToasts(prev => [...prev, { ...msg, id: `t-${Date.now()}-${Math.random()}` }])
  }, [])

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const handleResetTeammatePosition = useCallback((id: string) => {
    // `id` is a recruited teammate id; map index → "recruited-N" slug
    // using the same custom-only filter the scene uses so positions
    // line up. Defaults aren't draggable so they're never in here.
    const idx = recruits.filter(r => !r.isDefault).findIndex(r => r.id === id)
    if (idx === -1) return
    setResetSignal(prev => ({ slug: `recruited-${idx}`, counter: (prev?.counter ?? 0) + 1 }))
    pushToast({ title: 'Teammate sent back to default spot', tone: 'success' })
  }, [recruits, pushToast])

  const handleResetAllPositions = useCallback(() => {
    setResetSignal(prev => ({ slug: 'all', counter: (prev?.counter ?? 0) + 1 }))
    pushToast({ title: 'All teammates reset', tone: 'success' })
  }, [pushToast])

  const handleTogglePublic = useCallback(async (next: boolean) => {
    // Optimistic UI — flip locally then PATCH; revert on failure.
    setPublicVisible(next)
    try {
      const r = await fetch('/api/user/visibility', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ publicVisible: next }),
      })
      if (!r.ok) throw new Error('Failed')
      pushToast({
        title: next ? 'Floor is public 🌐' : 'Floor is private 🔒',
        tone: 'success',
      })
    } catch {
      setPublicVisible(!next)
      pushToast({ title: 'Couldn\'t update sharing', tone: 'warn' })
    }
  }, [pushToast])

  // Stash ?ref=CODE from URL.
  useEffect(() => {
    const url = new URL(window.location.href)
    const ref = url.searchParams.get('ref')
    if (ref) {
      try {
        window.localStorage.setItem('diaflow_pending_ref', ref.toUpperCase())
      } catch {
        /* ignore */
      }
    }
  }, [])

  // Trial state hydrate.
  useEffect(() => {
    if (!isTrial) return
    const stored = readTrialState()
    if (stored) {
      setTrial(stored)
      prevTrialFloorRef.current = stored.currentFloor
    } else {
      const fresh = defaultTrialState()
      setTrial(fresh)
      saveTrialState(fresh)
    }
  }, [isTrial])

  // Celebration on trial floor increase.
  useEffect(() => {
    if (trial.currentFloor > prevTrialFloorRef.current) {
      setCelebrationFloorsClimbed(trial.currentFloor - prevTrialFloorRef.current)
      setCelebrationFloor(trial.currentFloor)
    }
    prevTrialFloorRef.current = trial.currentFloor
  }, [trial.currentFloor])

  // Show the current-floor popup once on initial page load (mỗi lần reload).
  useEffect(() => {
    const initialFloor = isTrial ? trial.currentFloor : serverState.currentFloor
    setCelebrationFloorsClimbed(0)
    setCelebrationFloor(initialFloor)
    // Run only on mount — subsequent floor changes are handled by the
    // increase-detection effects above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Real-time updates via SSE: signed-in users get notifications pushed
  // from the server when invites verify in the background.
  useRealtimeFloor({
    enabled: !isTrial,
    onSnapshot: data => {
      setServerState(prev => ({
        ...prev,
        currentFloor: data.currentFloor,
        totalInvites: data.totalInvites,
        unlockedItemKeys: data.unlockedItemKeys,
      }))
    },
    onFloorUp: data => {
      setServerState(prev => {
        const climbed = Math.max(1, data.currentFloor - prev.currentFloor)
        setCelebrationFloorsClimbed(climbed)
        return {
          ...prev,
          currentFloor: data.currentFloor,
          totalInvites: data.totalInvites,
          unlockedItemKeys: data.unlockedItemKeys,
        }
      })
      setCelebrationFloor(data.currentFloor)
    },
    onInviteAccepted: data => {
      setServerState(prev => ({ ...prev, totalInvites: data.totalInvites }))
      pushToast({
        title: data.delta === 1 ? '+1 invite accepted' : `+${data.delta} invites accepted`,
        body: 'A new teammate slot is waiting — add them to your squad.',
        tone: 'success',
      })
    },
  })

  // Fetch leaderboard rank for signed-in users. Re-fetch when totalInvites
  // changes so the rank stays roughly in sync after invite events.
  // AbortController so re-renders / unmounts cancel the in-flight fetch
  // instead of resolving setState on a stale closure.
  useEffect(() => {
    if (isTrial) {
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
        /* swallow other errors */
      })
    return () => ac.abort()
  }, [isTrial, serverState.totalInvites])

  function persist(next: TrialState) {
    setTrial(next)
    saveTrialState(next)
  }

  const handleIrisSubmit = useCallback(
    (companyName: string) => {
      persist({ ...trial, teamName: companyName, onboardingStep: nextOnboardingStep('iris') })
    },
    [trial]
  )

  const handleMiaSubmit = useCallback(
    (teamPurpose: string) => {
      persist({ ...trial, teamPurpose, onboardingStep: nextOnboardingStep('mia') })
    },
    [trial]
  )

  const handleLeoSubmit = useCallback(
    (email: string) => {
      persist({ ...trial, email, onboardingStep: 'done' })
    },
    [trial]
  )
  const handleLeoSkip = useCallback(() => {
    persist({ ...trial, onboardingStep: 'done' })
  }, [trial])

  function handleSimulateInvite() {
    if (!isTrial) return
    setTrial(prev => {
      const next = advanceTrialInvites(prev)
      saveTrialState(next)
      return next
    })
    // No auto-recruit. Invite count goes up + floor unlocks new slot;
    // user fills the slot manually via BulkAddTeammatesModal (auto-opens
    // when celebration modal closes if slotsAvailable > 0).
  }

  function handleTeammateUpdate(id: string, patch: { name?: string; role?: string }) {
    setRecruits(prev =>
      prev.map(t => (t.id === id ? { ...t, name: patch.name ?? t.name, role: patch.role ?? t.role } : t))
    )
    if (!isTrial && !id.startsWith('trial-')) {
      fetch(`/api/recruit/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      }).catch(() => {})
    }
  }

  function handleTeammateDelete(id: string) {
    setRecruits(prev => prev.filter(t => t.id !== id))
    if (!isTrial && !id.startsWith('trial-')) {
      fetch(`/api/recruit/${id}`, { method: 'DELETE' }).catch(() => {})
    }
  }

  function handleAddTeammate() {
    const id = isTrial ? `trial-${Date.now()}` : ''
    if (isTrial) {
      const draft = {
        id,
        name: `Teammate #${recruits.filter(r => !r.isDefault).length + 1}`,
        role: 'Operations Assistant',
      }
      setRecruits(prev => [...prev, draft])
      setEditingTeammate(draft)
    } else {
      fetch('/api/recruit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: `Teammate #${recruits.filter(r => !r.isDefault).length + 1}`, role: 'Operations Assistant' }),
      })
        .then(r => (r.ok ? r.json() : null))
        .then(j => {
          if (j?.teammate) {
            setRecruits(prev => [...prev, j.teammate])
            setEditingTeammate(j.teammate)
          }
        })
        .catch(() => {})
    }
  }

  function handleBulkAdd(drafts: { name: string; role: string }[]) {
    if (drafts.length === 0) return
    if (isTrial) {
      setRecruits(prev => [
        ...prev,
        ...drafts.map((d, i) => ({
          id: `trial-bulk-${Date.now()}-${i}`,
          name: d.name,
          role: d.role,
        })),
      ])
      pushToast({
        title: `Added ${drafts.length} teammate${drafts.length === 1 ? '' : 's'}`,
        tone: 'success',
      })
      return
    }
    // Signed-in: POST each in parallel.
    Promise.all(
      drafts.map(d =>
        fetch('/api/recruit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(d),
        })
          .then(r => (r.ok ? r.json() : null))
          .catch(() => null)
      )
    ).then(results => {
      const added = results.map(r => r?.teammate).filter(Boolean) as ServerRecruit[]
      if (added.length > 0) {
        setRecruits(prev => [...prev, ...added])
        pushToast({
          title: `Added ${added.length} teammate${added.length === 1 ? '' : 's'}`,
          tone: 'success',
        })
      }
    })
  }

  function handleTeamNameChange(next: string) {
    if (isTrial) {
      persist({ ...trial, teamName: next })
    } else {
      setServerState(prev => ({ ...prev, teamName: next }))
      // TODO: PATCH /api/me to persist on the User row.
    }
  }

  const effective = isTrial
    ? {
        totalInvites: trial.totalInvites,
        currentFloor: trial.currentFloor,
        unlockedItemKeys: trial.unlockedItemKeys,
        teamName: trial.teamName,
        teamPurpose: trial.teamPurpose,
        email: trial.email,
      }
    : {
        totalInvites: serverState.totalInvites,
        currentFloor: serverState.currentFloor,
        unlockedItemKeys: serverState.unlockedItemKeys,
        teamName: serverState.teamName,
        teamPurpose: props.serverTeamPurpose,
        email: null as string | null,
      }

  const activeStep = isTrial ? trial.onboardingStep : 'done'
  const onboardingComplete = activeStep === 'done'
  const emailCaptured = !!(isTrial ? trial.email : null)
  // The 3 default NPCs (Iris/Mia/Leo) now live in the same recruits
  // array as user-added teammates (DB-backed, with pokes). Split them
  // so the OfficeScene + slot math only treat user-recruited rows as
  // "recruited" — defaults are still rendered via characters.config
  // visuals.
  const customRecruits = recruits.filter(r => !r.isDefault)
  const slotsAvailable = getRecruitSlotsAvailable(effective.currentFloor, customRecruits.length)
  const maxTeammates = getMaxTeammates(effective.currentFloor)

  return (
    <main className="fixed inset-0 overflow-hidden">
      <Header
        signedIn={props.signedIn}
        currentFloor={effective.currentFloor}
        totalInvites={effective.totalInvites}
        referralCode={props.referralCode}
        onSimulateInvite={isTrial && onboardingComplete ? handleSimulateInvite : undefined}
        onOpenSignup={isTrial ? () => setShowSignupModal(true) : undefined}
        // Tower view is now a dedicated route — see /tower. Button navigates
        // there instead of toggling an overlay.
        showTower={false}
        onToggleTower={onboardingComplete ? () => router.push('/tower') : undefined}
        teammateCount={DEFAULT_NPC_COUNT + customRecruits.length}
        maxTeammates={maxTeammates}
        slotsAvailable={slotsAvailable}
        onAddTeammates={onboardingComplete && slotsAvailable > 0 ? () => setBulkAddOpen(true) : undefined}
      />

      <SceneCanvas
        onboardingStep={activeStep}
        companyName={effective.teamName ?? null}
        recruitedCharacters={customRecruits.map(r => ({ name: r.name, role: r.role }))}
        currentFloor={effective.currentFloor}
        unlockedItemKeys={effective.unlockedItemKeys}
        onFloorClick={() => {}}
        onNpcClick={slug => {
          if (slug === 'iris') setSquadOpen(true)
          else setActiveNpcModal(slug)
        }}
        onTeammateClick={idx => {
          const t = customRecruits[idx]
          if (t) setEditingTeammate(t)
        }}
        resetSignal={resetSignal}
      />

      <MySquadFloatingButton visible={onboardingComplete} onClick={() => setSquadOpen(true)} />

      {onboardingComplete && (
        <MobileBottomBar
          slotsAvailable={slotsAvailable}
          showTower={false}
          onOpenSquad={() => setSquadOpen(true)}
          onAddTeammates={slotsAvailable > 0 ? () => setBulkAddOpen(true) : undefined}
          onToggleTower={() => router.push('/tower')}
          onSimulateInvite={isTrial ? handleSimulateInvite : undefined}
        />
      )}

      {isTrial && activeStep !== 'done' && (
        <div className="fixed inset-0 z-20 flex items-end justify-center pb-20 pointer-events-none">
          <div className="pointer-events-auto">
            {activeStep === 'iris' && <IrisBubble onSubmit={handleIrisSubmit} />}
            {activeStep === 'mia' && (
              <MiaBubble companyName={trial.teamName ?? 'Your team'} onSubmit={handleMiaSubmit} />
            )}
            {activeStep === 'leo' && <LeoBubble onSubmit={handleLeoSubmit} onSkip={handleLeoSkip} />}
          </div>
        </div>
      )}

      <MySquadDrawer
        open={squadOpen}
        onClose={() => setSquadOpen(false)}
        teamName={effective.teamName ?? null}
        onTeamNameChange={handleTeamNameChange}
        referralCode={props.referralCode}
        totalInvites={effective.totalInvites}
        currentFloor={effective.currentFloor}
        emailCaptured={emailCaptured}
        teammates={recruits}
        onTeammateUpdate={handleTeammateUpdate}
        onAddTeammate={handleAddTeammate}
        onOpenSignup={() => setShowSignupModal(true)}
        inviter={props.inviter}
        onResetAllPositions={handleResetAllPositions}
        rank={rank}
        emailVerified={props.signedIn ? emailVerified : undefined}
        userEmail={props.userEmail}
        onVerifyEmail={props.signedIn && !emailVerified ? () => setEmailVerifyOpen(true) : undefined}
        publicVisible={publicVisible}
        onTogglePublic={props.signedIn ? handleTogglePublic : undefined}
      />

      <TeammateEditModal
        open={!!editingTeammate}
        teammate={editingTeammate}
        onClose={() => setEditingTeammate(null)}
        onSave={handleTeammateUpdate}
        onDelete={handleTeammateDelete}
        onResetPosition={handleResetTeammatePosition}
      />

      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      <MiaInfoCard open={activeNpcModal === 'mia'} onClose={() => setActiveNpcModal(null)} />

      <LeoEmailDrawer
        open={activeNpcModal === 'leo'}
        onClose={() => setActiveNpcModal(null)}
        defaultEmail={effective.email ?? null}
        onCaptured={email => {
          if (isTrial) persist({ ...trial, email })
        }}
      />

      {celebrationFloor != null && (
        <CelebrationModal
          floor={celebrationFloor}
          totalInvites={effective.totalInvites}
          trialMode={isTrial}
          floorsClimbed={celebrationFloorsClimbed}
          onClose={() => {
            setCelebrationFloor(null)
            // After celebrating an actual level-up (not the initial-load
            // recap), prompt to fill any new teammate slots.
            if (celebrationFloorsClimbed > 0) {
              const nextSlots = getRecruitSlotsAvailable(effective.currentFloor, recruits.length)
              if (nextSlots > 0) setBulkAddOpen(true)
            }
          }}
          onOpenSignup={isTrial ? () => setShowSignupModal(true) : undefined}
          onOpenSquad={onboardingComplete ? () => setSquadOpen(true) : undefined}
        />
      )}

      <BulkAddTeammatesModal
        open={bulkAddOpen}
        slotsAvailable={slotsAvailable}
        currentFloor={effective.currentFloor}
        onClose={() => setBulkAddOpen(false)}
        onAdd={handleBulkAdd}
      />
      {showSignupModal && <SignupModal onClose={() => setShowSignupModal(false)} />}

      <EmailVerifyModal
        open={emailVerifyOpen}
        onClose={() => setEmailVerifyOpen(false)}
        email={props.userEmail}
        onVerified={() => {
          setEmailVerified(true)
          pushToast({ title: 'Email verified ✓', tone: 'success' })
        }}
      />
    </main>
  )
}
