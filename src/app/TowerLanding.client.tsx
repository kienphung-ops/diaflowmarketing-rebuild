'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { Header } from '@/components/Header'
import { CelebrationModal } from '@/components/CelebrationModal'
import { SignupModal } from '@/components/SignupModal'
import { IrisBubble, MiaBubble, LeoBubble } from '@/components/OnboardingBubble'
import { MySquadDrawer } from '@/components/MySquadDrawer'
import { MySquadFloatingButton } from '@/components/MySquadFloatingButton'
import { MiaInfoCard } from '@/components/MiaInfoCard'
import { LeoEmailDrawer } from '@/components/LeoEmailDrawer'
import { TeammateEditModal } from '@/components/TeammateEditModal'
import { ToastStack, type ToastMessage } from '@/components/Toast'
import { useFloorPolling } from '@/hooks/useFloorPolling'
import {
  advanceTrialInvites,
  defaultTrialState,
  nextOnboardingStep,
  readTrialState,
  saveTrialState,
  type TrialState,
} from '@/lib/trial'

const SceneCanvas = dynamic(
  () => import('@/components/scene/SceneCanvas').then(m => ({ default: m.SceneCanvas })),
  { ssr: false }
)

interface ServerRecruit {
  id: string
  name: string
  role: string
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
}

export default function TowerLanding(props: Props) {
  const isTrial = !props.signedIn

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
  const [showSignupModal, setShowSignupModal] = useState(false)
  const [showTower, setShowTower] = useState(false)
  const [activeNpcModal, setActiveNpcModal] = useState<'iris' | 'mia' | 'leo' | null>(null)
  const [squadOpen, setSquadOpen] = useState(false)
  const [editingTeammate, setEditingTeammate] = useState<ServerRecruit | null>(null)
  const [toasts, setToasts] = useState<ToastMessage[]>([])
  const prevTrialFloorRef = useRef(trial.currentFloor)

  const pushToast = useCallback((msg: Omit<ToastMessage, 'id'>) => {
    setToasts(prev => [...prev, { ...msg, id: `t-${Date.now()}-${Math.random()}` }])
  }, [])

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

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
      setCelebrationFloor(trial.currentFloor)
    }
    prevTrialFloorRef.current = trial.currentFloor
  }, [trial.currentFloor])

  // Live polling: signed-in users get notifications when invites verify in the background.
  useFloorPolling({
    enabled: !isTrial,
    onFloorUp: data => {
      setServerState(prev => ({
        ...prev,
        currentFloor: data.currentFloor,
        totalInvites: data.totalInvites,
        unlockedItemKeys: data.unlockedItemKeys,
      }))
      setCelebrationFloor(data.currentFloor)
    },
    onInviteAccepted: data => {
      setServerState(prev => ({ ...prev, totalInvites: data.totalInvites }))
      pushToast({
        title: data.delta === 1 ? '+1 invite accepted' : `+${data.delta} invites accepted`,
        body: 'A new teammate just joined your squad.',
        tone: 'success',
      })
      // Refresh recruits list (invite verify auto-creates a RecruitedTeammate row).
      fetch('/api/recruit')
        .then(r => (r.ok ? r.json() : null))
        .then(j => {
          if (j?.teammates) setRecruits(j.teammates)
        })
        .catch(() => {})
    },
  })

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
    setRecruits(prev => [
      ...prev,
      {
        id: `trial-inv-${Date.now()}`,
        name: `Teammate #${prev.length + 1}`,
        role: 'Operations Assistant',
      },
    ])
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
        name: `Teammate #${recruits.length + 1}`,
        role: 'Operations Assistant',
      }
      setRecruits(prev => [...prev, draft])
      setEditingTeammate(draft)
    } else {
      fetch('/api/recruit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: `Teammate #${recruits.length + 1}`, role: 'Operations Assistant' }),
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

  return (
    <main className="fixed inset-0 overflow-hidden">
      <Header
        signedIn={props.signedIn}
        currentFloor={effective.currentFloor}
        totalInvites={effective.totalInvites}
        referralCode={props.referralCode}
        onSimulateInvite={isTrial && onboardingComplete ? handleSimulateInvite : undefined}
        onOpenSignup={isTrial ? () => setShowSignupModal(true) : undefined}
        showTower={showTower}
        onToggleTower={onboardingComplete ? () => setShowTower(s => !s) : undefined}
        teammateCount={recruits.length}
      />

      <SceneCanvas
        onboardingStep={activeStep}
        companyName={effective.teamName ?? null}
        recruitedCharacters={recruits.map(r => ({ name: r.name, role: r.role }))}
        showTower={showTower}
        currentFloor={effective.currentFloor}
        unlockedItemKeys={effective.unlockedItemKeys}
        onFloorClick={n => {
          if (n === effective.currentFloor) setShowTower(false)
        }}
        onNpcClick={slug => {
          if (slug === 'iris') setSquadOpen(true)
          else setActiveNpcModal(slug)
        }}
        onTeammateClick={idx => {
          const t = recruits[idx]
          if (t) setEditingTeammate(t)
        }}
      />

      <MySquadFloatingButton visible={onboardingComplete && !showTower} onClick={() => setSquadOpen(true)} />

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
      />

      <TeammateEditModal
        open={!!editingTeammate}
        teammate={editingTeammate}
        onClose={() => setEditingTeammate(null)}
        onSave={handleTeammateUpdate}
        onDelete={handleTeammateDelete}
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
          onClose={() => setCelebrationFloor(null)}
          onOpenSignup={isTrial ? () => setShowSignupModal(true) : undefined}
        />
      )}
      {showSignupModal && <SignupModal onClose={() => setShowSignupModal(false)} />}
    </main>
  )
}
