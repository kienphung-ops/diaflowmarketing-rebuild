'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { Header } from '@/components/Header'
import { CelebrationModal } from '@/components/CelebrationModal'
import { SignupModal } from '@/components/SignupModal'
import { IrisHireModal } from '@/components/IrisHireModal'
import { ViewTransitionOverlay } from '@/components/ViewTransitionOverlay'
import { RoomArranger } from '@/components/RoomArranger'
import { useOrigin } from '@/hooks/useOrigin'
import {
  IrisBubble,
  MiaBubble,
  MiaInfoBubble,
  LeoBubble,
} from '@/components/OnboardingBubble'
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
import { useFloorPresence } from '@/hooks/useFloorPresence'
import {
  computeTeammateCount,
  filterCustomTeammates,
  DEFAULT_NPC_COUNT,
} from '@/lib/floors'
import { useMaxTeammates } from '@/lib/floorsConfigClient'
import {
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
  /** Diaflow-derived role recommendation for `serverTeamPurpose`. Null
   *  when the user pre-dates this feature OR signed up via a flow that
   *  skipped the Mia step — the client backfills via /api/job-summary
   *  in that case so MySquad / future onboarding shows the role. */
  serverRecommendedRole: string | null
  /** Reason string that pairs with `serverRecommendedRole`. */
  serverReason: string | null
  /** Per-user item position overrides from `User.itemPositions`.
   *  Drives the rendered item positions when present; empty map
   *  falls back to FloorItems' canonical layout. */
  serverItemPositions: Record<string, [number, number, number]>
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
  // Iris recruiting popup — replaces the old MySquadDrawer-on-Iris-
  // click behaviour. Has two states driven by slot availability;
  // see IrisHireModal for the copy.
  const [irisModalOpen, setIrisModalOpen] = useState(false)
  // Browser origin (post-hydration) — needed to compose the personal
  // invite URL that IrisHireModal's share buttons use. See useOrigin
  // for the SSR/hydration safety.
  const origin = useOrigin()
  // Set true the moment the user clicks Tower view (header or mobile
  // bottom bar) so a fullscreen spinner covers the office while the
  // /tower RSC fetches. Page nav unmounts this whole component, so
  // there's no setIsNavigating(false) — the overlay disappears with
  // the rest of the page when /tower mounts.
  const [isNavigating, setIsNavigating] = useState(false)
  // Arrange-your-room feature. `itemPositions` is the live map driving
  // the scene (initially seeded from the server, mutated by the
  // arrange-mode drag handler). `arrangeMode` is the boolean toggle
  // that opens the toolbar + enables item drag. `arrangeSnapshot` is
  // the pre-edit copy so Cancel can revert cleanly.
  const [itemPositions, setItemPositions] = useState<Record<string, [number, number, number]>>(
    () => ({ ...props.serverItemPositions }),
  )
  const [arrangeMode, setArrangeMode] = useState(false)
  const arrangeSnapshotRef = useRef<Record<string, [number, number, number]>>({})
  const [arrangeSaving, setArrangeSaving] = useState(false)
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
  // Highest floor we've actually observed for this user during this
  // mount. Initialised from the SSR'd prop so the FIRST SSE snapshot
  // — which always replays the current floor on every reconnect AND
  // on every page remount — is treated as a baseline, not an upgrade.
  // Only a strictly higher value than this ref fires the celebration.
  //
  // This guards the "office → tower → office" navigation: previously
  // the snapshot's `prev.currentFloor` comparison could be a false
  // positive when the closure / setState batching landed before the
  // ref was bumped, surfacing the upgrade modal on every return trip.
  const baselineFloorRef = useRef(props.currentFloor)

  const pushToast = useCallback((msg: Omit<ToastMessage, 'id'>) => {
    setToasts(prev => [...prev, { ...msg, id: `t-${Date.now()}-${Math.random()}` }])
  }, [])

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  // Arrange-your-room handlers. Order matters — these depend on
  // pushToast above, which is declared with useCallback so it stays
  // stable across renders.
  const handleStartArrange = useCallback(() => {
    if (!props.signedIn) return
    arrangeSnapshotRef.current = { ...itemPositions }
    setArrangeMode(true)
    setSquadOpen(false) // close the drawer so the room is visible
  }, [props.signedIn, itemPositions])

  const handleCancelArrange = useCallback(() => {
    setItemPositions({ ...arrangeSnapshotRef.current })
    setArrangeMode(false)
  }, [])

  const handleSaveArrange = useCallback(async () => {
    setArrangeSaving(true)
    try {
      const r = await fetch('/api/user/item-positions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ positions: itemPositions }),
      })
      if (!r.ok) throw new Error('save failed')
      pushToast({ title: 'Room saved ✓', tone: 'success' })
      setArrangeMode(false)
    } catch {
      // ToastMessage only supports info/warn/success — use 'warn' for
      // a recoverable failure (we tell the user to retry).
      pushToast({
        title: 'Couldn’t save room layout',
        body: 'Try again — the network rejected the request.',
        tone: 'warn',
      })
    } finally {
      setArrangeSaving(false)
    }
  }, [itemPositions, pushToast])

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

  const handleLogout = useCallback(async () => {
    // POST /api/auth/logout clears the session cookie server-side.
    // Hard-reload the home page so the server component re-renders
    // with `signedIn=false` and the anonymous onboarding state loads
    // fresh — softer router.refresh() leaves stale client state.
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } catch {
      // Even if the request fails, fall through to the redirect —
      // the user's intent was to sign out.
    }
    window.location.href = '/'
  }, [])

  // Quietly warm the next routes the user is most likely to navigate
  // to so the transition feels instant. router.prefetch() pulls the
  // JS chunks + RSC payload without rendering anything — Vercel's
  // edge cache also gets a free warmup.
  //
  //   signed-in: /tower (the Office↔Tower toggle is the #1 click)
  //   trial:     /signup (the "Claim your team" CTA destination)
  //
  // Both pages: prefetch /how-it-works since the MySquadDrawer link
  // is a single tap away.
  useEffect(() => {
    router.prefetch('/how-it-works')
    if (props.signedIn) {
      router.prefetch('/tower')
    } else {
      router.prefetch('/signup')
      router.prefetch('/login')
    }
  }, [router, props.signedIn])

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

  // Tracks the signed-in backfill `/api/job-summary` call below — set
  // to true when the request fires, false on completion / abort.
  // Threaded into MiaInfoCard so clicking Mia mid-backfill shows the
  // loading spinner instead of the stale default skills list.
  const [signedInBackfillLoading, setSignedInBackfillLoading] = useState(false)

  // Signed-in backfill — when the user has a `teamPurpose` (job text)
  // on file but no Diaflow-derived `recommendedRole` / `reason`, fire
  // a single /api/job-summary call so subsequent loads have the
  // personalised values. Covers legacy accounts that pre-date this
  // feature and any signup path that skipped Mia onboarding.
  // Fires once per page mount, gated on the signed-in flag.
  useEffect(() => {
    if (!props.signedIn) return
    if (!props.serverTeamPurpose) return
    if (props.serverRecommendedRole && props.serverReason) return
    const ac = new AbortController()
    setSignedInBackfillLoading(true)
    fetch('/api/job-summary', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ job: props.serverTeamPurpose }),
      signal: ac.signal,
    })
      .catch(err => {
        // Silent — the backfill is best-effort. Next mount will retry.
        if ((err as Error).name !== 'AbortError') {
          /* swallow */
        }
      })
      .finally(() => {
        // The response landed (or failed) — flip the spinner off. If
        // the component unmounted mid-flight, AbortController already
        // aborted the request; this `finally` runs synchronously and
        // setting state on an unmounted node is a no-op in StrictMode.
        if (!ac.signal.aborted) setSignedInBackfillLoading(false)
      })
    return () => {
      ac.abort()
      setSignedInBackfillLoading(false)
    }
  }, [props.signedIn, props.serverTeamPurpose, props.serverRecommendedRole, props.serverReason])

  // Floor-up celebration — SIGNED-IN ONLY. Trial / anonymous users
  // never see the upgrade modal; the bar to viewing the celebration is
  // an authenticated session (the only way `props.signedIn` is true is
  // a valid signed JWT cookie verified server-side in page.tsx via
  // readSession). The internal trial counter still advances so the
  // scene reflects their progress, but no modal fires.
  useEffect(() => {
    if (!props.signedIn) {
      prevTrialFloorRef.current = trial.currentFloor
      return
    }
    if (trial.currentFloor > prevTrialFloorRef.current) {
      setCelebrationFloorsClimbed(trial.currentFloor - prevTrialFloorRef.current)
      setCelebrationFloor(trial.currentFloor)
    }
    prevTrialFloorRef.current = trial.currentFloor
  }, [trial.currentFloor, props.signedIn])

  // (Removed) Initial-load celebration. Previously this effect fired
  // CelebrationModal on every mount for signed-in users — even on plain
  // page refresh with no floor change — which made the modal feel like
  // spam. Floor-up celebration now only fires from:
  //   - trial → real-floor jumps (the effect above)
  //   - SSE `floor-up` events (useRealtimeFloor below)
  //   - SSE snapshot diffs where serverFloor > client floor (also below)
  // i.e. the modal only opens when the user actually advances a floor.

  // Real-time updates via SSE: signed-in users get notifications pushed
  // from the server when invites verify in the background.
  //
  // Vercel caps streaming responses at 25s on hobby/pro plans, so
  // every ~25s the SSE function exits and EventSource auto-reconnects.
  // The new connection's *snapshot* shows the current DB state — if
  // the user's floor went up between disconnect and reconnect, the
  // `floor-up` event was lost. We compensate by also diffing the
  // snapshot against existing client state: any positive delta is
  // treated as a floor-up / invite-accepted that we missed.
  useRealtimeFloor({
    enabled: !isTrial,
    onSnapshot: data => {
      // Celebration gate: only fire when the snapshot strictly exceeds
      // the highest floor observed during this mount (initial baseline
      // = props.currentFloor from SSR). This survives SSE reconnects,
      // React StrictMode double-mounts, and Office↔Tower navigation,
      // all of which can replay the same snapshot value.
      if (data.currentFloor > baselineFloorRef.current) {
        setCelebrationFloorsClimbed(data.currentFloor - baselineFloorRef.current)
        setCelebrationFloor(data.currentFloor)
        baselineFloorRef.current = data.currentFloor
      }
      // Invite toast gate: same shape — only fire when the snapshot's
      // totalInvites strictly exceeds the prior committed value. We
      // read `prev.totalInvites` inside the functional setter so the
      // diff is computed against the latest committed state even if a
      // burst of snapshots lands in the same tick.
      setServerState(prev => {
        const invitesDelta = data.totalInvites - prev.totalInvites
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
        return {
          ...prev,
          currentFloor: data.currentFloor,
          totalInvites: data.totalInvites,
          unlockedItemKeys: data.unlockedItemKeys,
        }
      })
    },
    onFloorUp: data => {
      // Server only emits floor-up on a strict increase, but the
      // client gate still consults the ref so a duplicate or
      // out-of-order event can't replay the modal.
      if (data.currentFloor > baselineFloorRef.current) {
        setCelebrationFloorsClimbed(data.currentFloor - baselineFloorRef.current)
        setCelebrationFloor(data.currentFloor)
        baselineFloorRef.current = data.currentFloor
      }
      setServerState(prev => ({
        ...prev,
        currentFloor: data.currentFloor,
        totalInvites: data.totalInvites,
        unlockedItemKeys: data.unlockedItemKeys,
      }))
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
  // X-close on Iris modal — advance without a team name. `trial.teamName`
  // stays null and MiaBubble will fall back to "Your team".
  const handleIrisSkip = useCallback(() => {
    persist({ ...trial, onboardingStep: nextOnboardingStep('iris') })
  }, [trial])

  // True from the moment Mia's job submit fires until the Diaflow
  // upstream returns (or fails). Drives the "Hang on…" hint inside
  // MiaInfoBubble so the user knows we're personalising rather than
  // serving the default copy.
  const [jobSummaryLoading, setJobSummaryLoading] = useState(false)

  const handleMiaSubmit = useCallback(
    async (jobRole: string) => {
      // Advance the onboarding step immediately so the mia-info modal
      // can render — with the default copy at first, then re-render
      // with the personalised role/reason as soon as the API returns.
      const advanced: TrialState = {
        ...trial,
        teamPurpose: jobRole,
        // Reset any prior recommendation — a new job means the old
        // role+reason no longer applies. Re-fetched below.
        recommendedRole: null,
        reason: null,
        onboardingStep: nextOnboardingStep('mia'),
      }
      persist(advanced)

      // Kick off Diaflow process+poll API. The route handles the
      // upstream (with a 25 s timeout) so this single fetch is the
      // entire integration from the client's side. Signed-in users
      // also get the result persisted into `User.recommendedRole` /
      // `User.reason` by the route handler.
      setJobSummaryLoading(true)
      try {
        const r = await fetch('/api/job-summary', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ job: jobRole }),
        })
        const data = (await r.json().catch(() => ({}))) as {
          success?: boolean
          recommendedRole?: string
          reason?: string
        }
        if (data.success && data.recommendedRole && data.reason) {
          // Merge into the latest trial state — read fresh from
          // storage so we don't clobber state that changed during
          // the API call (e.g. user advanced to leo / done).
          const latest = readTrialState() ?? advanced
          persist({
            ...latest,
            recommendedRole: data.recommendedRole,
            reason: data.reason,
          })
        }
      } catch {
        // Network failure — modal falls back to default copy. The
        // signed-in backfill effect below retries on next mount.
      } finally {
        setJobSummaryLoading(false)
      }
    },
    [trial]
  )
  const handleMiaSkip = useCallback(() => {
    persist({ ...trial, onboardingStep: nextOnboardingStep('mia') })
  }, [trial])

  // Mia's intro card has no input — clicking "Meet your next teammate"
  // (or the X close) advances to Leo. Same handler for both.
  const handleMiaInfoNext = useCallback(() => {
    persist({ ...trial, onboardingStep: nextOnboardingStep('mia-info') })
  }, [trial])

  // Leo's onboarding modal is now video-only (the waitlist email
  // capture moved to signup itself). A single handler advances the
  // step regardless of whether the user clicked "Got it" or X-closed
  // — both mean "I'm done watching, let me into the office".
  const handleLeoDone = useCallback(() => {
    persist({ ...trial, onboardingStep: 'done' })
  }, [trial])

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

  /**
   * Drag-to-poke handler — fires from OfficeScene whenever a teammate
   * was meaningfully dragged (> 0.2 world units). Mirrors the visitor
   * view's `pokeBySlug` so the owner gets the same "drag = poke"
   * affordance over their own floor.
   *
   * Slug mapping:
   *   - 'iris' | 'mia' | 'leo' — matched against `recruits` by slug
   *     column (defaults seeded at signup carry their slug).
   *   - 'recruited-N'          — N-th custom (non-default) teammate.
   *
   * Trial users have an empty `recruits` array (no DB rows), so the
   * lookup misses and the API call is silently skipped — the visual
   * poke animation in OfficeScene still plays.
   */
  function handleTeammatePoke(charSlug: string) {
    let target: ServerRecruit | undefined
    if (charSlug.startsWith('recruited-')) {
      const idx = parseInt(charSlug.slice('recruited-'.length), 10)
      if (Number.isNaN(idx)) return
      target = recruits.filter(r => !r.isDefault)[idx]
    } else {
      target = recruits.find(r => r.slug === charSlug)
    }
    if (!target) return
    // Skip trial-only client-side rows — they have no DB id to bump.
    if (target.id.startsWith('trial-')) return

    // Optimistic increment so the rank pill / MySquad pokes view bumps
    // immediately. Revert on API failure.
    setRecruits(prev =>
      prev.map(t => (t.id === target!.id ? { ...t, pokes: (t.pokes ?? 0) + 1 } : t))
    )
    fetch(`/api/poke/${target.id}`, { method: 'POST' })
      .then(r => (r.ok ? r.json() : null))
      .then(j => {
        if (j && typeof j.pokes === 'number') {
          // Sync to server-authoritative count (covers concurrent
          // pokes from other viewers).
          setRecruits(prev =>
            prev.map(t => (t.id === target!.id ? { ...t, pokes: j.pokes } : t))
          )
        }
      })
      .catch(() => {
        // Network failure — revert the optimistic bump.
        setRecruits(prev =>
          prev.map(t =>
            t.id === target!.id ? { ...t, pokes: Math.max(0, (t.pokes ?? 1) - 1) } : t,
          ),
        )
      })
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
      // Anonymous user — trial state is the source of truth, persist
      // via localStorage. No server round-trip needed.
      persist({ ...trial, teamName: next })
      return
    }
    // Signed-in: optimistic local update + PATCH /api/user/team-name
    // so the rename survives reloads. Server trims + 60-char caps the
    // value (matching the trialTeamName treatment in /api/auth/signup)
    // and returns the canonical persisted version, which we mirror
    // back to local state in case the server normalised it (e.g.
    // empty → null).
    const previousName = serverState.teamName
    setServerState(prev => ({ ...prev, teamName: next }))
    fetch('/api/user/team-name', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ teamName: next }),
    })
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((j: { teamName: string | null }) => {
        setServerState(prev => ({ ...prev, teamName: j.teamName }))
      })
      .catch(() => {
        // Revert + toast so the user knows the rename didn't stick.
        setServerState(prev => ({ ...prev, teamName: previousName }))
        pushToast({ title: 'Could not save team name', tone: 'warn' })
      })
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

  // ─── Onboarding modal sequencing ─────────────────────────────────
  // Each step transition reveals (or keeps) a character on the floor.
  // We delay the modal so the character has time to land — without
  // this, the modal pops up the same frame the character mounts and
  // the "Hi, I'm Iris" anchor isn't visible yet.
  //
  //   iris        → new character (Iris)        → 1200 ms reveal
  //   mia         → new character (Mia)         → 1200 ms reveal
  //   mia-info    → SAME character (Mia)        →  200 ms reveal
  //   leo         → new character (Leo)         → 1200 ms reveal
  const [onboardingModalVisible, setOnboardingModalVisible] = useState(false)
  useEffect(() => {
    if (!isTrial || activeStep === 'done') {
      setOnboardingModalVisible(false)
      return
    }
    setOnboardingModalVisible(false)
    const isSameCharacter = activeStep === 'mia-info'
    const delay = isSameCharacter ? 200 : 1200
    const t = setTimeout(() => setOnboardingModalVisible(true), delay)
    return () => clearTimeout(t)
  }, [activeStep, isTrial])
  const emailCaptured = !!(isTrial ? trial.email : null)
  // The 3 default NPCs (Iris/Mia/Leo) now live in the same recruits
  // array as user-added teammates (DB-backed, with pokes). Split them
  // so the OfficeScene + slot math only treat user-recruited rows as
  // "recruited" — defaults are still rendered via characters.config
  // visuals.
  // Shared helpers — see lib/floors.ts. `customRecruits` excludes the
  // 3 default NPCs from the DB-backed list so OfficeScene doesn't
  // double-render them (Iris/Mia/Leo are already drawn from
  // CHARACTERS config visuals).
  const customRecruits = filterCustomTeammates(recruits)
  // Live max-teammates from /api/floors. The "slots available" math is
  // inlined here (used to live in lib/floors → getRecruitSlotsAvailable)
  // so we read straight off the API data without a sync fallback wrapper.
  const maxTeammates = useMaxTeammates(effective.currentFloor)
  const slotsAvailable = Math.max(0, maxTeammates - DEFAULT_NPC_COUNT - customRecruits.length)

  // Mia's role override for the in-scene NameBadge. Signed-in users
  // read it off their `RecruitedTeammate(slug='mia').role` row (which
  // /api/job-summary keeps in sync with the Diaflow recommendation);
  // anonymous trial users fall back to `trial.recommendedRole`. Empty
  // string / null → OfficeScene uses the hard-coded default
  // ("Assistant") from characters.config.
  const miaRole = props.signedIn
    ? recruits.find(r => r.slug === 'mia')?.role ?? null
    : trial.recommendedRole

  // ─── Owner's own floor stats — feed the MySquad "Your floor" pill.
  // `observe` mode polls /api/floor/[code]/visitors WITHOUT registering
  // the owner as a visitor of themselves, so they get a clean count
  // of guests currently on their floor. Total pokes is just a sum of
  // pokes across teammates the server already includes in `recruits`.
  // Anonymous / trial users have no referralCode → useFloorPresence
  // returns 0; we suppress the pill entirely in that case.
  const ownerViewerCount = useFloorPresence({
    code: props.signedIn ? props.referralCode : null,
    mode: 'observe',
  })
  const ownerTotalPokes = recruits.reduce((sum, t) => sum + (t.pokes ?? 0), 0)

  return (
    <main className="fixed inset-0 overflow-hidden">
      <Header
        signedIn={props.signedIn}
        currentFloor={effective.currentFloor}
        totalInvites={effective.totalInvites}
        referralCode={props.referralCode}
        onOpenSignup={isTrial ? () => setShowSignupModal(true) : undefined}
        // Tower view is now a dedicated route — see /tower. Button navigates
        // there instead of toggling an overlay.
        showTower={false}
        onToggleTower={
          onboardingComplete
            ? () => {
                setIsNavigating(true)
                router.push('/tower')
              }
            : undefined
        }
        teammateCount={computeTeammateCount(recruits)}
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
        itemPositionOverrides={itemPositions}
        onFloorClick={() => {}}
        onNpcClick={slug => {
          // Iris used to open MySquadDrawer; now opens the dedicated
          // hire-or-share recruiting prompt (IrisHireModal). Other
          // NPCs (Mia, Leo) still route to their own modals.
          if (slug === 'iris') setIrisModalOpen(true)
          else setActiveNpcModal(slug)
        }}
        onTeammateClick={idx => {
          const t = customRecruits[idx]
          if (t) setEditingTeammate(t)
        }}
        // Drag → poke. OfficeScene fires this whenever the user drags
        // a teammate by > 0.2 units; we map the slug to the DB row
        // and bump the poke counter (server-side + optimistic local).
        // Works for anyone, signed-in or not — the /api/poke/[id]
        // endpoint has no auth gate.
        onTeammatePoke={handleTeammatePoke}
        // Override Mia's hard-coded "Assistant" label with whatever
        // role is stored for her (Diaflow recommendation when set).
        miaRole={miaRole}
        resetSignal={resetSignal}
      />

      <MySquadFloatingButton visible={onboardingComplete} onClick={() => setSquadOpen(true)} />

      {onboardingComplete && (
        <MobileBottomBar
          slotsAvailable={slotsAvailable}
          showTower={false}
          onOpenSquad={() => setSquadOpen(true)}
          onAddTeammates={slotsAvailable > 0 ? () => setBulkAddOpen(true) : undefined}
          onToggleTower={() => {
            setIsNavigating(true)
            router.push('/tower')
          }}
        />
      )}

      {/* Tower navigation overlay — see useState comment above. */}
      {isNavigating && <ViewTransitionOverlay label="Loading tower view…" />}

      {/* Arrange-your-room overlay — fullscreen edit mode launched
          from the MySquadDrawer button. Persists positions via PATCH
          /api/user/item-positions on Save; restores the pre-edit
          snapshot on Cancel. Signed-in users only — trial sessions
          don't have a DB row to persist into. */}
      {props.signedIn && (
        <RoomArranger
          open={arrangeMode}
          currentFloor={effective.currentFloor}
          companyName={effective.teamName}
          positions={itemPositions}
          onChange={setItemPositions}
          onSave={handleSaveArrange}
          onCancel={handleCancelArrange}
          saving={arrangeSaving}
        />
      )}

      {/* Onboarding modals — only render once the per-step delay has
          elapsed (see `onboardingModalVisible` effect above) so the
          newly-mounted character has a moment to land on the floor
          before the modal anchors over it. The modals are full-screen
          centered cards (ModalShell), NOT bottom-anchored bubbles, so
          the previous `flex items-end` wrapper is gone. */}
      {isTrial && onboardingModalVisible && activeStep === 'iris' && (
        <IrisBubble onSubmit={handleIrisSubmit} onSkip={handleIrisSkip} />
      )}
      {isTrial && onboardingModalVisible && activeStep === 'mia' && (
        <MiaBubble onSubmit={handleMiaSubmit} onSkip={handleMiaSkip} />
      )}
      {isTrial && onboardingModalVisible && activeStep === 'mia-info' && (
        <MiaInfoBubble
          recommendedRole={trial.recommendedRole}
          reason={trial.reason}
          loading={jobSummaryLoading}
          onNext={handleMiaInfoNext}
        />
      )}
      {isTrial && onboardingModalVisible && activeStep === 'leo' && (
        <LeoBubble onContinue={handleLeoDone} />
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
        // Owner-side floor stats — only meaningful once they have a
        // referralCode (i.e., signed-in). `ownerName: null` triggers
        // the drawer's "Your floor" header instead of "Visiting <x>".
        visiting={
          props.signedIn && props.referralCode
            ? {
                ownerName: null,
                viewerCount: ownerViewerCount,
                totalPokes: ownerTotalPokes,
              }
            : undefined
        }
        rank={rank}
        emailVerified={props.signedIn ? emailVerified : undefined}
        userEmail={props.userEmail}
        onVerifyEmail={props.signedIn && !emailVerified ? () => setEmailVerifyOpen(true) : undefined}
        publicVisible={publicVisible}
        onTogglePublic={props.signedIn ? handleTogglePublic : undefined}
        onLogout={props.signedIn ? handleLogout : undefined}
        // Arrange-your-room launcher — only offered for signed-in
        // users since trial sessions can't persist to the User row.
        onArrangeRoom={props.signedIn ? handleStartArrange : undefined}
      />

      <TeammateEditModal
        open={!!editingTeammate}
        teammate={editingTeammate}
        onClose={() => setEditingTeammate(null)}
        onSave={handleTeammateUpdate}
        onDelete={handleTeammateDelete}
        onResetPosition={handleResetTeammatePosition}
        // Float next to the teammate in the scene. OfficeScene labels
        // each recruited character with `recruited-${index}` — match
        // that here. Falls back to centered when the teammate isn't
        // in the customRecruits list (defensive: shouldn't happen).
        anchorSlug={(() => {
          if (!editingTeammate) return null
          const idx = customRecruits.findIndex(r => r.id === editingTeammate.id)
          return idx >= 0 ? `recruited-${idx}` : null
        })()}
      />

      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      {/* MiaInfoCard re-uses the Diaflow recommendation so clicking
          Mia anywhere in the office surfaces the same assistant-match
          copy collected during onboarding. Signed-in users read from
          the server-fetched User columns; trial users read from the
          live trial state (populated by /api/job-summary). */}
      <MiaInfoCard
        open={activeNpcModal === 'mia'}
        onClose={() => setActiveNpcModal(null)}
        anchorSlug="mia"
        recommendedRole={
          props.signedIn ? props.serverRecommendedRole : trial.recommendedRole
        }
        reason={props.signedIn ? props.serverReason : trial.reason}
        // True while either the trial-onboarding job-summary call OR
        // the signed-in backfill is in flight — the modal swaps to a
        // spinner so clicking Mia mid-call shows progress instead of
        // the stale default skills list.
        loading={jobSummaryLoading || signedInBackfillLoading}
      />

      {/* Click-Leo modal — video-only (no email form). The drawer
          file name is kept (LeoEmailDrawer) so existing imports
          don't break, even though it no longer captures email. */}
      <LeoEmailDrawer
        open={activeNpcModal === 'leo'}
        onClose={() => setActiveNpcModal(null)}
        anchorSlug="leo"
      />

      {/* Floor-upgrade celebration — never rendered for anonymous
          visitors, regardless of any stale `celebrationFloor` state.
          `props.signedIn` is true only when the server-side session
          JWT validates inside page.tsx → readSession(), so this also
          enforces the "valid token" gate the product requires. */}
      {props.signedIn && celebrationFloor != null && (
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
              // Same slot math as the per-render `slotsAvailable` above —
              // post-climb we re-check against the new floor's cap.
              const nextSlots = Math.max(0, maxTeammates - DEFAULT_NPC_COUNT - recruits.length)
              if (nextSlots > 0) setBulkAddOpen(true)
            }
          }}
          onOpenSignup={isTrial ? () => setShowSignupModal(true) : undefined}
        />
      )}

      <BulkAddTeammatesModal
        open={bulkAddOpen}
        slotsAvailable={slotsAvailable}
        currentFloor={effective.currentFloor}
        onClose={() => setBulkAddOpen(false)}
        onAdd={handleBulkAdd}
      />

      {/* Iris recruiting prompt — opens from `onNpcClick('iris')`
          above. Either nudges the user to share (packed floor) or
          opens BulkAddTeammatesModal (open slot). */}
      <IrisHireModal
        open={irisModalOpen}
        onClose={() => setIrisModalOpen(false)}
        // Float next to Iris in the 3D scene instead of centering.
        anchorSlug="iris"
        currentFloor={effective.currentFloor}
        totalInvites={effective.totalInvites}
        slotsAvailable={slotsAvailable}
        inviteUrl={
          props.signedIn && props.referralCode && origin
            ? `${origin}/floor/${props.referralCode}`
            : null
        }
        onAddTeammate={() => setBulkAddOpen(true)}
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
