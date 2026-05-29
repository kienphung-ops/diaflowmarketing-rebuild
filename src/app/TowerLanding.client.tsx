'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { useRouter, useSearchParams } from 'next/navigation'
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
import { TeammateBubble } from '@/components/TeammateBubble'
import { BulkAddTeammatesModal } from '@/components/BulkAddTeammatesModal'
import { MobileBottomNav } from '@/components/mobile/MobileBottomNav'
import { MobileCounterChips } from '@/components/mobile/MobileCounterChips'
import { MobileShareSheet } from '@/components/mobile/MobileShareSheet'
import { ShareModal } from '@/components/ShareModal'
import { SaveSuccessModal } from '@/components/SaveSuccessModal'
import { SpinModal } from '@/components/spin/SpinModal'
import {
  RECRUIT_BODY_COLORS,
  RECRUIT_HAIR_COLORS,
  RECRUIT_SKIN_COLORS,
} from '@/components/scene2d/Mobile2DScene'
import { MiaWelcomeBubble } from '@/components/mobile/MiaWelcomeBubble'
import { DesktopWelcomeBubble } from '@/components/DesktopWelcomeBubble'
import { useIsDesktop } from '@/hooks/useIsDesktop'
import { Mobile2DScene } from '@/components/scene2d/Mobile2DScene'
import { EmailVerifyModal } from '@/components/EmailVerifyModal'
import { ToastStack, type ToastMessage } from '@/components/Toast'
import { useRealtimeFloor } from '@/hooks/useRealtimeFloor'
import { useFloorPresence } from '@/hooks/useFloorPresence'
import {
  computeTeammateCount,
  filterCustomTeammates,
  DEFAULT_NPC_COUNT,
} from '@/lib/floors'
import { useMaxTeammates, useFloor } from '@/lib/floorsConfigClient'
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
  /** "Launch-day promise" — Diaflow-API-generated sentence shown in
   *  the speech bubble. May be null while the bulk-add background
   *  fetch is still resolving; UI falls back to a generic line. */
  description?: string | null
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
  /** Separate per-user layout for the mobile 2D scene
   *  (`User.itemPositions2D`). */
  serverItemPositions2D: Record<string, [number, number, number]>
}

export default function TowerLanding(props: Props) {
  const isTrial = !props.signedIn
  const router = useRouter()
  // Query-param trigger: /tower's MySquadDrawer routes the user back
  // here with `?arrange=1` when they hit "Arrange your room", so we
  // auto-enter arrange mode on mount. One-shot via a ref so a stale
  // query on later renders doesn't reopen the toolbar.
  const searchParams = useSearchParams()
  const arrangeAutoTriggeredRef = useRef(false)
  // SaveSuccess popup — fired once when the user lands back here with
  // `?just_signed_up=1` (email signup or new-account Google OAuth).
  const [saveSuccessOpen, setSaveSuccessOpen] = useState(false)
  const saveSuccessTriggeredRef = useRef(false)

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
  // The "Step 2" speech-bubble shown next to a recruited teammate the
  // user just clicked. Holds the same row shape as editingTeammate so
  // we can hand it straight to the edit modal when the pencil is
  // clicked. Defaults (Iris/Mia/Leo) skip this and go to their own
  // dedicated modals (IrisHireModal / MiaInfoCard / activeNpcModal).
  const [bubbleTeammate, setBubbleTeammate] = useState<ServerRecruit | null>(null)
  // Mobile share bottom-sheet — opened by the hero "Invite to climb"
  // CTA on MobileBottomNav. Lives at TowerLanding level so it works
  // whether the user taps it from Office or from anywhere else that
  // mounts the nav.
  const [mobileShareOpen, setMobileShareOpen] = useState(false)
  // Desktop centered share modal — opened by the header "Share to climb"
  // button (same surface as the floor-preview CTA).
  const [shareModalOpen, setShareModalOpen] = useState(false)
  const [bulkAddOpen, setBulkAddOpen] = useState(false)
  // Per-recruit "greeting" nonce. Keyed by the recruit's index in
  // customRecruits; bumping an index makes that minifigure pop a
  // "Hi, I'm <name>!" speech bubble above its head once. Used by a
  // BULK add (≥2 teammates) so each new face introduces itself in the
  // scene. (A single add opens the richer TeammateBubble instead.)
  const [recruitGreetSignals, setRecruitGreetSignals] = useState<Record<number, number>>({})
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
  // Breakpoint — desktop arranges the 3D scene (RoomArranger), mobile
  // arranges the 2D scene in place. Declared early so the arrange
  // handlers below can branch on it.
  const isDesktop = useIsDesktop()
  // Arrange-your-room feature. `itemPositions` is the live map driving
  // the scene (initially seeded from the server, mutated by the
  // arrange-mode drag handler). `arrangeMode` is the boolean toggle
  // that opens the toolbar + enables item drag. `arrangeSnapshot` is
  // the pre-edit copy so Cancel can revert cleanly.
  const [itemPositions, setItemPositions] = useState<Record<string, [number, number, number]>>(
    () => ({ ...props.serverItemPositions }),
  )
  // Separate layout for the mobile 2D scene — desktop arranges the 3D
  // map above; mobile arranges this one (the two scenes share a
  // coordinate system but use different default framing).
  const [itemPositions2D, setItemPositions2D] = useState<Record<string, [number, number, number]>>(
    () => ({ ...props.serverItemPositions2D }),
  )
  const [arrangeMode, setArrangeMode] = useState(false)
  const arrangeSnapshotRef = useRef<Record<string, [number, number, number]>>({})
  const arrangeSnapshot2DRef = useRef<Record<string, [number, number, number]>>({})
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
  // The SSR-seeded `props.currentFloor` can lag the user's TRUE floor,
  // so the first SSE snapshot (authoritative) would look like an
  // "upgrade" over a stale baseline and re-fire the celebration on
  // every mount. We therefore let the FIRST snapshot establish the
  // real baseline silently — no celebration / invite toast on it.
  const sawFirstSnapshotRef = useRef(false)

  const pushToast = useCallback((msg: Omit<ToastMessage, 'id'>) => {
    // Dedup by title within a 3 s window — referrals fire BOTH the
    // SSE `invite-accepted` event and a near-immediate snapshot on
    // reconnect, and dev-mode HMR can also accumulate leaked
    // EventSource listeners. Without this guard the same +1 toast
    // shows two-or-more times.
    setToasts(prev => {
      const now = Date.now()
      const dup = prev.find(t => t.title === msg.title && now - parseInt(t.id.split('-')[1] || '0', 10) < 3000)
      if (dup) return prev
      return [...prev, { ...msg, id: `t-${now}-${Math.random()}` }]
    })
  }, [])

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  // Arrange-your-room handlers. Order matters — these depend on
  // pushToast above, which is declared with useCallback so it stays
  // stable across renders.
  const handleStartArrange = useCallback(() => {
    if (!props.signedIn) return
    // Snapshot BOTH layouts so Cancel reverts whichever surface the
    // user ends up editing (desktop = 3D map, mobile = 2D map).
    arrangeSnapshotRef.current = { ...itemPositions }
    arrangeSnapshot2DRef.current = { ...itemPositions2D }
    setArrangeMode(true)
    setSquadOpen(false) // close the drawer so the room is visible
  }, [props.signedIn, itemPositions, itemPositions2D])

  // Auto-arrange trigger from `/tower → /?arrange=1`. Runs once when the
  // query is present + the user is signed in; we then strip the query
  // (history.replaceState) so a refresh doesn't reopen the toolbar.
  useEffect(() => {
    if (arrangeAutoTriggeredRef.current) return
    if (!props.signedIn) return
    if (searchParams.get('arrange') !== '1') return
    arrangeAutoTriggeredRef.current = true
    handleStartArrange()
    try {
      window.history.replaceState({}, '', '/')
    } catch {
      /* ignore — older browsers / non-standard history APIs */
    }
  }, [searchParams, props.signedIn, handleStartArrange])

  // Post-signup congrats popup. Triggered by `?just_signed_up=1` set by
  // the SignupModal redirect + the Google OAuth callback (new account
  // branch only). Strips the query after firing so refresh doesn't
  // replay it.
  useEffect(() => {
    if (saveSuccessTriggeredRef.current) return
    if (!props.signedIn) return
    if (searchParams.get('just_signed_up') !== '1') return
    saveSuccessTriggeredRef.current = true
    setSaveSuccessOpen(true)
    try {
      window.history.replaceState({}, '', '/')
    } catch {
      /* ignore */
    }
  }, [searchParams, props.signedIn])

  const handleCancelArrange = useCallback(() => {
    setItemPositions({ ...arrangeSnapshotRef.current })
    setItemPositions2D({ ...arrangeSnapshot2DRef.current })
    setArrangeMode(false)
  }, [])

  // Live drag update from the mobile 2D arranger.
  const handleItemMove2D = useCallback(
    (uid: string, world: [number, number, number]) => {
      setItemPositions2D(prev => ({ ...prev, [uid]: world }))
    },
    [],
  )

  const handleSaveArrange = useCallback(async () => {
    setArrangeSaving(true)
    // Save whichever surface is active: desktop edits the 3D map,
    // mobile edits the 2D map (routed via `surface: '2d'`).
    const body = isDesktop
      ? { positions: itemPositions }
      : { surface: '2d', positions: itemPositions2D }
    try {
      const r = await fetch('/api/user/item-positions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
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
  }, [isDesktop, itemPositions, itemPositions2D, pushToast])

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
      // Sync spin tokens on EVERY snapshot (initial + reconnects). This
      // catches the referral grant case where a friend signed up while
      // this user's SSE stream was disconnected — the next snapshot has
      // the bumped spinTokens and we apply it silently.
      if (typeof data.spinTokens === 'number') setSpinTokens(data.spinTokens)
      // First snapshot of this mount = authoritative baseline. Commit
      // it silently (no celebration / no invite toast) so a stale SSR
      // floor can't masquerade as a fresh climb on every mount.
      if (!sawFirstSnapshotRef.current) {
        sawFirstSnapshotRef.current = true
        baselineFloorRef.current = data.currentFloor
        setServerState(prev => ({
          ...prev,
          currentFloor: data.currentFloor,
          totalInvites: data.totalInvites,
          unlockedItemKeys: data.unlockedItemKeys,
        }))
        return
      }
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
      // Referral grants +1 spin in the same signup transaction —
      // surface it on the arcade badge + top-bar pill immediately
      // alongside the +1 invite toast. The server payload carries the
      // post-grant total so the client doesn't have to math it out.
      if (typeof data.spinTokens === 'number') setSpinTokens(data.spinTokens)
      pushToast({
        title: data.delta === 1 ? '+1 invite accepted' : `+${data.delta} invites accepted`,
        body: 'A new teammate slot is waiting — add them to your squad.',
        tone: 'success',
      })
    },
    // Standalone token-change event — covers daily-claim / task
    // completion from another tab, anon-spin migration, and is also a
    // fallback if `invite-accepted` is missed (the server fires both).
    onSpinTokens: data => {
      setSpinTokens(data.spinTokens)
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
  // Iris onboarding gate — the team name is required to advance past
  // this step. × / backdrop CLOSE the bubble but DO NOT advance the
  // step (boss feedback: only a real submission counts). The bubble
  // re-opens on the next page load because `trial.onboardingStep`
  // hasn't moved, so a dismissed step isn't permanently skippable.
  const handleIrisSkip = useCallback(() => {
    setOnboardingModalVisible(false)
  }, [])

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
  // Same gate as handleIrisSkip — × / backdrop close but don't
  // advance past 'mia'. User must submit the job role to proceed.
  const handleMiaSkip = useCallback(() => {
    setOnboardingModalVisible(false)
  }, [])

  // Mia's intro card has no input — clicking "Meet your next teammate"
  // (or the X close) advances to Leo. Same handler for both.
  const handleMiaInfoNext = useCallback(() => {
    persist({ ...trial, onboardingStep: nextOnboardingStep('mia-info') })
  }, [trial])

  // Leo's onboarding modal is now video-only (the waitlist email
  // capture moved to signup itself). A single handler advances the
  // step regardless of whether the user clicked "Got it" or X-closed
  // — both mean "I'm done watching, let me into the office".
  //
  // We also flip `showMiaWelcomeBubble` on so the post-Leo white speech
  // bubble fades in over the office canvas for ~3s. The bubble owns its
  // own auto-dismiss timer; we just need to fire the initial signal.
  // Breakpoint gate — the post-Leo nudge diverges by platform:
  //   mobile  → floating MiaWelcomeBubble + a pulsing Tower button in
  //             the bottom nav ("go see what you're climbing").
  //   desktop → Mia speech bubble over the office + the MySquadDrawer
  //             slides open so the user picks their next move (tour /
  //             rewards / save). No Tower-button pulse on desktop.
  //             (`isDesktop` is declared near the top of the component.)

  const handleLeoDone = useCallback(() => {
    persist({ ...trial, onboardingStep: 'done' })
    if (isDesktop) {
      setShowDesktopWelcome(true)
      setSquadOpen(true)
    } else {
      setShowMiaWelcomeBubble(true)
      setAttentionTower(true)
    }
  }, [trial, isDesktop])

  // Post-Leo welcome bubble — mobile-only nudge that appears the
  // instant onboarding completes. State lives here (not in the bubble
  // itself) so the timer keeps running even if the bubble re-mounts
  // mid-fade, and so other call sites could trigger it later if needed.
  const [showMiaWelcomeBubble, setShowMiaWelcomeBubble] = useState(false)
  // Desktop counterpart — persistent Mia bubble shown alongside the
  // opened MySquadDrawer. Dismissed by clicking the bubble.
  const [showDesktopWelcome, setShowDesktopWelcome] = useState(false)

  // ── Spin wheel (GRO-5) ───────────────────────────────────────────
  // `spinOpen` toggles the wheel modal. `spinTokens` drives the arcade
  // badge + top-bar pill (signed-in). `anonSpun` tracks whether this
  // browser already used its one free teaser spin (anonymous only).
  const [spinOpen, setSpinOpen] = useState(false)
  const [spinTokens, setSpinTokens] = useState(0)
  const [anonSpun, setAnonSpun] = useState(false)

  // Load the spin entry-point state once per mount.
  //   signed-in → GET /api/spin for the live token count.
  //   anonymous → GET /api/spin/anon to know if the free spin is spent.
  useEffect(() => {
    const ac = new AbortController()
    if (props.signedIn) {
      fetch('/api/spin', { cache: 'no-store', signal: ac.signal })
        .then(r => (r.ok ? r.json() : null))
        .then((s: { tokens?: number } | null) => {
          if (!ac.signal.aborted && s && typeof s.tokens === 'number') setSpinTokens(s.tokens)
        })
        .catch(() => {})
    } else {
      fetch('/api/spin/anon', { cache: 'no-store', signal: ac.signal })
        .then(r => (r.ok ? r.json() : null))
        .then((j: { spun?: boolean } | null) => {
          if (!ac.signal.aborted && j?.spun) setAnonSpun(true)
        })
        .catch(() => {})
    }
    return () => ac.abort()
  }, [props.signedIn])

  // Personal invite link — used by the spin modal's share tasks + the
  // anonymous save hook. Mirrors the ShareModal/MobileShareSheet derivation.
  const spinInviteUrl =
    props.signedIn && props.referralCode && origin
      ? `${origin}/floor/${props.referralCode}`
      : null

  // Post-Leo Tower attention pulse — once onboarding finishes we want
  // the user's next move to be "open the tower and see what you're
  // climbing." MobileBottomNav paints a pulsing ring around the Tower
  // slot while this is true. Cleared the moment the user actually taps
  // Tower (or after they explicitly dismiss the welcome bubble).
  const [attentionTower, setAttentionTower] = useState(false)

  function handleTeammateUpdate(id: string, patch: { name?: string; role?: string }) {
    // Optimistic local rename — apply the new name/role immediately so
    // the scene + drawer don't lag the user's edit. The description
    // STAYS stale until the server confirms; if the role changed the
    // PATCH response carries the newly-resolved description (from the
    // role cache or a fresh Diaflow API call) and we patch it in.
    setRecruits(prev =>
      prev.map(t => (t.id === id ? { ...t, name: patch.name ?? t.name, role: patch.role ?? t.role } : t))
    )
    if (!isTrial && !id.startsWith('trial-')) {
      fetch(`/api/recruit/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
        .then(r => (r.ok ? r.json() : null))
        .then(j => {
          // Reconcile with the server's canonical row — important
          // because the role-change branch refetches the description,
          // which the optimistic update above couldn't have known.
          if (j?.teammate) {
            setRecruits(prev =>
              prev.map(t => (t.id === id ? { ...t, ...j.teammate } : t))
            )
          }
        })
        .catch(() => {})
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

  // After teammates land in the scene, decide how to celebrate them:
  //   • exactly 1  → open the rich TeammateBubble for that teammate
  //                  (so the user can read its launch-day promise + edit).
  //   • 2 or more  → pop a lightweight "Hi, I'm <name>!" speech bubble
  //                  above each new minifigure's head (both scenes).
  // `startIdx` is the recruit's index in customRecruits BEFORE the add,
  // so the appended rows occupy startIdx … startIdx + added.length - 1.
  function celebrateAdded(added: ServerRecruit[], startIdx: number) {
    if (added.length === 0) return
    if (added.length === 1) {
      setBubbleTeammate(added[0])
      return
    }
    setRecruitGreetSignals(prev => {
      const next = { ...prev }
      added.forEach((_, i) => {
        const idx = startIdx + i
        next[idx] = (next[idx] ?? 0) + 1
      })
      return next
    })
    pushToast({
      title: `Added ${added.length} teammates`,
      tone: 'success',
    })
  }

  function handleBulkAdd(drafts: { name: string; role: string }[]) {
    if (drafts.length === 0) return
    // Index where the new rows will land (count of existing customs).
    const startIdx = customRecruits.length
    if (isTrial) {
      const newRows: ServerRecruit[] = drafts.map((d, i) => ({
        id: `trial-bulk-${Date.now()}-${i}`,
        name: d.name,
        role: d.role,
      }))
      setRecruits(prev => [...prev, ...newRows])
      celebrateAdded(newRows, startIdx)
      return
    }
    // Signed-in: single POST to /api/recruit/bulk. That endpoint
    // probes the role-description cache synchronously, creates every
    // teammate in one Postgres transaction, then kicks off the upstream
    // Diaflow API calls for any roles that missed the cache. The user
    // sees their full team in the room immediately; the speech-bubble
    // copy populates as background fetches resolve (next page load).
    fetch('/api/recruit/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ drafts }),
    })
      .then(r => (r.ok ? r.json() : null))
      .then(j => {
        const added = (j?.teammates ?? []) as ServerRecruit[]
        if (added.length > 0) {
          setRecruits(prev => [...prev, ...added])
          celebrateAdded(added, startIdx)
        }
      })
      .catch(() => {})
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

  // Invites needed for the next floor — used to fill in the post-Leo
  // Mia welcome bubble ("N invite to Floor M ↓"). `useFloor` falls back
  // to the static snapshot before the API responds, so the bubble
  // never flashes a stale "0 invites".
  const welcomeBubbleNextFloor = useFloor(effective.currentFloor + 1)
  const welcomeBubbleInvitesToNext = welcomeBubbleNextFloor
    ? Math.max(0, welcomeBubbleNextFloor.invitesRequired - effective.totalInvites)
    : null

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
        // Post-onboarding pulse — desktop mirror of the mobile bottom
        // nav. Drops on mobile (Header's Tower button is md+ only) so
        // there's no double-pulse with MobileBottomNav.
        attentionTower={attentionTower}
        onToggleTower={
          onboardingComplete
            ? () => {
                setAttentionTower(false)
                setIsNavigating(true)
                router.push('/tower')
              }
            : undefined
        }
        teammateCount={computeTeammateCount(recruits)}
        maxTeammates={maxTeammates}
        slotsAvailable={slotsAvailable}
        onAddTeammates={onboardingComplete && slotsAvailable > 0 ? () => setBulkAddOpen(true) : undefined}
        // Mobile-only — taps on the header "Invite" pill now open
        // the share bottom sheet instead of copying. The bottom-nav
        // hero is reserved for My Squad.
        onMobileInvite={
          props.signedIn ? () => setMobileShareOpen(true) : undefined
        }
        // Desktop "Share to climb" → centered ShareModal. Signed-in only.
        onShareClimb={props.signedIn ? () => setShareModalOpen(true) : undefined}
        // Spin token count in the desktop stats pill (signed-in only).
        spinTokens={props.signedIn ? spinTokens : undefined}
      />

      {/* Mobile-only counter chip strip. Slides in directly below the
          header for sub-md viewports where the header's compact pill
          was either truncating the stats or overflowing the row. */}
      {onboardingComplete && (
        <div className="md:hidden fixed top-[52px] inset-x-0 z-10">
          <MobileCounterChips
            currentFloor={effective.currentFloor}
            totalInvites={effective.totalInvites}
            teammateCount={computeTeammateCount(recruits)}
            maxTeammates={maxTeammates}
            rank={rank}
          />
        </div>
      )}

      {/* Desktop: 3D React Three Fiber scene. Hidden on mobile —
          touch interaction on the 3D canvas was awkward (drag-rotate
          collides with page scroll, characters are tiny relative to
          the canvas, performance is variable on mid-tier phones).
          Mobile gets the 2D <Mobile2DScene> immediately below. */}
      <div className="hidden md:block">
        <SceneCanvas
          onboardingStep={activeStep}
          companyName={effective.teamName ?? null}
          recruitedCharacters={customRecruits.map(r => ({ name: r.name, role: r.role }))}
          currentFloor={effective.currentFloor}
          unlockedItemKeys={effective.unlockedItemKeys}
          itemPositionOverrides={itemPositions}
          onFloorClick={() => {}}
          onNpcClick={slug => {
            // During onboarding, clicking the ACTIVE-step character
            // reopens the bubble if the user dismissed it with × /
            // backdrop (the close path doesn't advance the step, so
            // they need a way back to the prompt). Non-active NPCs
            // during onboarding do nothing (they shouldn't be visible
            // until their step anyway). Post-onboarding falls through
            // to the regular hire / info modals.
            if (isTrial && activeStep !== 'done') {
              const stepCharacter = activeStep === 'mia-info' ? 'mia' : activeStep
              if (slug === stepCharacter) setOnboardingModalVisible(true)
              return
            }
            if (slug === 'iris') setIrisModalOpen(true)
            else setActiveNpcModal(slug)
          }}
          onTeammateClick={idx => {
            // Click → open the speech bubble (Step 2 of the design)
            // rather than jumping straight to the edit modal. The
            // bubble's pencil button is what opens the edit modal
            // (Step 3), keeping the heavier surface one extra click
            // away.
            const t = customRecruits[idx]
            if (t) setBubbleTeammate(t)
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
          // Open-slot count drives Iris's "👋 ready to hire…" head nudge
          // (desktop parity with the mobile 2D scene).
          slotsAvailable={slotsAvailable}
          // Per-recruit greeting nonces — bumped on a BULK add so each
          // new minifigure pops "Hi, I'm <name>!" above its head.
          recruitGreetSignals={recruitGreetSignals}
          resetSignal={resetSignal}
          // Spin arcade — in-room interactive object (front lounge).
          onArcadeClick={onboardingComplete ? () => setSpinOpen(true) : undefined}
          spinTokens={spinTokens}
          spinTeaser={!props.signedIn && !anonSpun}
        />
      </div>

      {/* Mobile: lightweight front-elevation 2D scene with the same
          item parity (desks, chairs, plants, fridge, arcade, ...) and
          the same character click flow. No drag-to-poke yet — the
          touch-affordance can be added in a follow-up; clicking a
          teammate still opens the bubble + edit modal path. */}
      <Mobile2DScene
        companyName={effective.teamName ?? null}
        recruitedCharacters={customRecruits.map(r => ({ name: r.name, role: r.role }))}
        currentFloor={effective.currentFloor}
        miaRole={miaRole}
        slotsAvailable={slotsAvailable}
        // Bulk-add greeting nonces — same map the 3D scene uses.
        greetSignals={recruitGreetSignals}
        onNpcClick={slug => {
          // Mobile 2D — same onboarding reopen logic as the 3D scene.
          if (isTrial && activeStep !== 'done') {
            const stepCharacter = activeStep === 'mia-info' ? 'mia' : activeStep
            if (slug === stepCharacter) setOnboardingModalVisible(true)
            return
          }
          if (slug === 'iris') setIrisModalOpen(true)
          else setActiveNpcModal(slug)
        }}
        onTeammateClick={idx => {
          const t = customRecruits[idx]
          if (t) setBubbleTeammate(t)
        }}
        // Drag-drop on the 2D scene → poke. Slugs come through in
        // the same shape the 3D drag handler uses ('iris', 'mia',
        // 'leo', or 'recruited-N'), so the existing
        // handleTeammatePoke does the right thing for both
        // breakpoints.
        onTeammatePoke={handleTeammatePoke}
        // Per-user 2D layout + in-place arrange (mobile only — desktop
        // uses the 3D RoomArranger overlay below).
        itemPositionOverrides={itemPositions2D}
        arrangeMode={arrangeMode && !isDesktop}
        onItemMove={handleItemMove2D}
        // Spin arcade — always-on interactive item (front-left corner).
        onArcadeClick={onboardingComplete ? () => setSpinOpen(true) : undefined}
        spinTokens={spinTokens}
        spinTeaser={!props.signedIn && !anonSpun}
      />

      <MySquadFloatingButton visible={onboardingComplete} onClick={() => setSquadOpen(true)} />

      <SpinModal
        open={spinOpen}
        onClose={() => setSpinOpen(false)}
        mode={props.signedIn ? 'auth' : 'anon'}
        inviteUrl={spinInviteUrl}
        teammateCount={computeTeammateCount(recruits)}
        // Live parent token count — keeps the modal in sync when SSE
        // delivers a token change while the modal is already open.
        currentSpinTokens={props.signedIn ? spinTokens : undefined}
        onSaveTeam={() => {
          setSpinOpen(false)
          setShowSignupModal(true)
        }}
        // Auth-mode "Refer a friend" CTA — opens the share-link modal
        // ON TOP of the spin modal (no close). Spin modal stays mounted
        // behind so the user can resume their wheel state immediately
        // after closing the share modal. Both backdrops use z-40 and
        // ShareModal portals to body, so its backdrop sits on top and
        // catches dismiss clicks before they reach SpinModal.
        onOpenShare={
          props.signedIn ? () => setShareModalOpen(true) : undefined
        }
        onStateChange={s => {
          setSpinTokens(s.tokens)
          if (!props.signedIn) setAnonSpun(true)
        }}
      />

      {/* Mobile shell — replaces the old MobileBottomBar with the
          mockup's three-slot nav + a floating progress pill that
          surfaces the next-reward goal one tap above the nav. Both
          render only on sub-md viewports; desktop keeps using the
          header chrome. */}
      {onboardingComplete && (
        <>
          {/* Post-Leo Mia welcome bubble — fires the moment trial
              onboarding flips to `done`. Auto-dismisses after 3s
              (timer owned by the component) so it doesn't linger
              over the office. Mobile-only — desktop already shows
              the MySquad drawer with the same nudge inline. */}
          <MiaWelcomeBubble
            visible={showMiaWelcomeBubble}
            onDismiss={() => setShowMiaWelcomeBubble(false)}
            miaRole={trial.recommendedRole}
            invitesToNext={welcomeBubbleInvitesToNext}
            nextFloorId={effective.currentFloor + 1}
          />

          {/* Desktop counterpart — Mia greets over the office while the
              MySquadDrawer (opened in handleLeoDone) lets the user pick
              their next move. Persistent; click to dismiss. hidden on
              mobile internally. */}
          <DesktopWelcomeBubble
            visible={showDesktopWelcome}
            onDismiss={() => setShowDesktopWelcome(false)}
            miaRole={miaRole}
          />

          {/* MobileProgressPill ("🎁 Floor lamp · Floor 2 · 1 invite
              away") used to live here. Removed across both Office +
              Tower views per user feedback — the same "next reward"
              info is already in the rightmost counter chip ("Next: 💡
              Floor lamp"), and the floating pill was covering the
              teammates' feet on the 2D office canvas. */}
          <MobileBottomNav
            active="office"
            onGoOffice={() => {
              /* already here — close any open sheets as a gentle ack */
              setSquadOpen(false)
              setMobileShareOpen(false)
            }}
            onGoTower={() => {
              // Clear the post-onboarding attention pulse as soon as
              // the user takes the bait. The bubble's auto-dismiss
              // timer is unaffected — it can finish naturally.
              setAttentionTower(false)
              setIsNavigating(true)
              router.push('/tower')
            }}
            onOpenSquad={() => setSquadOpen(true)}
            // Hero CTA in the middle slot — label swaps with login:
            //   trial    → "Save my team"   → signup modal
            //   signed-in → "Invite to climb" → share sheet
            heroMode={props.signedIn ? 'invite' : 'save'}
            onHero={() => {
              if (props.signedIn) setMobileShareOpen(true)
              else setShowSignupModal(true)
            }}
            attentionTower={attentionTower}
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
            onSignupNudge={isTrial ? () => setShowSignupModal(true) : undefined}
          />
        </>
      )}

      {/* Tower navigation overlay — see useState comment above. */}
      {isNavigating && <ViewTransitionOverlay label="Loading tower view…" />}

      {/* Desktop "Share to climb" modal — centered "Share to reach Floor
          N" surface opened from the header button. (Renders via portal,
          so placement here is fine.) */}
      <ShareModal
        open={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        inviteUrl={
          props.signedIn && props.referralCode && origin
            ? `${origin}/floor/${props.referralCode}`
            : null
        }
        currentFloor={effective.currentFloor}
        totalInvites={effective.totalInvites}
      />

      {/* Arrange-your-room — DESKTOP uses the fullscreen 3D RoomArranger
          overlay. MOBILE arranges the 2D scene in place (items draggable
          via Mobile2DScene above) + a bottom toolbar below. Persists via
          PATCH /api/user/item-positions on Save; restores the pre-edit
          snapshot on Cancel. Signed-in users only — trial sessions don't
          have a DB row to persist into. */}
      {props.signedIn && (
        <RoomArranger
          open={arrangeMode && isDesktop}
          currentFloor={effective.currentFloor}
          companyName={effective.teamName}
          positions={itemPositions}
          onChange={setItemPositions}
          onSave={handleSaveArrange}
          onCancel={handleCancelArrange}
          saving={arrangeSaving}
        />
      )}

      {/* Mobile 2D arrange toolbar — top banner (instructions) + bottom
          Save/Cancel bar. Shown only while arranging on a phone; the
          items themselves are dragged on the 2D scene above. */}
      {props.signedIn && arrangeMode && !isDesktop && (
        <div className="md:hidden">
          <div
            className="fixed inset-x-0 top-0 z-40 bg-night-mid/95 backdrop-blur-md border-b border-white/10 px-4 py-2.5 text-center"
            style={{ paddingTop: 'max(0.625rem, env(safe-area-inset-top))' }}
          >
            <div className="text-[13px] font-bold text-tower-cream">Arrange your room</div>
            <div className="text-[11px] text-tower-cream/60 mt-0.5">
              Drag any item to move it. Save when you’re happy.
            </div>
          </div>
          <div
            className="fixed inset-x-0 bottom-0 z-40 bg-night-mid/95 backdrop-blur-md border-t border-white/10 px-4 pt-3 flex items-center gap-3"
            style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
          >
            <button
              type="button"
              onClick={handleCancelArrange}
              disabled={arrangeSaving}
              className="flex-1 px-4 py-3 rounded-xl border border-white/15 text-tower-cream/85 font-semibold text-sm disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveArrange}
              disabled={arrangeSaving}
              className="flex-1 px-4 py-3 rounded-xl bg-tower-gold text-night-deep font-extrabold text-sm shadow-[0_8px_20px_rgba(251,191,36,0.35)] disabled:opacity-60"
            >
              {arrangeSaving ? 'Saving…' : 'Save layout'}
            </button>
          </div>
        </div>
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
          userRole={trial.teamPurpose}
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

      {/* Step 2 — speech bubble that appears on first click. Auto-
          dismisses on outside click. Pencil button promotes to the
          edit modal (Step 3). */}
      <TeammateBubble
        open={!!bubbleTeammate}
        teammate={bubbleTeammate}
        anchorSlug={(() => {
          if (!bubbleTeammate) return null
          const idx = customRecruits.findIndex(r => r.id === bubbleTeammate.id)
          return idx >= 0 ? `recruited-${idx}` : null
        })()}
        // Same palette the 2D minifigure on the floor uses — index by
        // recruit position so the portrait at the top of the bubble
        // matches the character the user just tapped.
        {...(() => {
          if (!bubbleTeammate) return {}
          const idx = customRecruits.findIndex(r => r.id === bubbleTeammate.id)
          if (idx < 0) return {}
          return {
            bodyColor: RECRUIT_BODY_COLORS[idx % RECRUIT_BODY_COLORS.length],
            hairColor: RECRUIT_HAIR_COLORS[idx % RECRUIT_HAIR_COLORS.length],
            skinColor: RECRUIT_SKIN_COLORS[idx % RECRUIT_SKIN_COLORS.length],
          }
        })()}
        onClose={() => setBubbleTeammate(null)}
        onEdit={() => {
          if (bubbleTeammate) setEditingTeammate(bubbleTeammate)
        }}
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
        signedIn={props.signedIn}
        onAddTeammate={() => setBulkAddOpen(true)}
        onOpenSignup={() => setShowSignupModal(true)}
      />

      {showSignupModal && <SignupModal onClose={() => setShowSignupModal(false)} />}

      {/* Post-signup congrats — opens once when the user lands here
          with `?just_signed_up=1`. Closing it ("Back to my office")
          drops the user into their saved scene. */}
      <SaveSuccessModal
        open={saveSuccessOpen}
        onClose={() => setSaveSuccessOpen(false)}
        teamName={effective.teamName ?? null}
        teammates={recruits.map(r => ({ name: r.name, role: r.role, slug: r.slug ?? null }))}
        currentFloor={effective.currentFloor}
        totalInvites={effective.totalInvites}
        nextFloor={
          welcomeBubbleNextFloor
            ? {
                id: welcomeBubbleNextFloor.id,
                invitesRequired: welcomeBubbleNextFloor.invitesRequired,
              }
            : null
        }
        inviteUrl={spinInviteUrl}
      />

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
