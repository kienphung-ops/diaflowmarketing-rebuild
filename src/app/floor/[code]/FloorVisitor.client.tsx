'use client'

/**
 * /floor/[code] — public visitor view.
 *
 * Renders the OWNER's office scene as a "guest" page. The visitor can
 * click any teammate to poke them — each poke POSTs to /api/poke/[id],
 * which increments the counter server-side. Every 2 seconds the page
 * re-fetches /api/floor/[code] so multiple visitors on the same floor
 * see each other's pokes update in near-real-time.
 *
 * On top of the owner's scene we render the visitor's OWN chrome — the
 * standard Header (their floor / invites / teammates / invite-link
 * copy) and the MySquad floating button + drawer. Combined with the
 * SSE realtime hook, this means a visitor staring at someone else's
 * floor still sees their own credits land live and can copy their own
 * referral link without leaving the page.
 */

import { useCallback, useEffect, useState, useRef } from 'react'
import dynamicImport from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { SceneSkeleton } from '@/components/fallback/SceneSkeleton'
import { Header } from '@/components/Header'
import { ViewTransitionOverlay } from '@/components/ViewTransitionOverlay'
import { MySquadDrawer } from '@/components/MySquadDrawer'
import { MySquadFloatingButton } from '@/components/MySquadFloatingButton'
import { SignupModal } from '@/components/SignupModal'
import { EmailVerifyModal } from '@/components/EmailVerifyModal'
import { CelebrationModal } from '@/components/CelebrationModal'
import { HowItWorksModal } from '@/components/HowItWorksModal'
import { ToastStack, type ToastMessage } from '@/components/Toast'
import { useFloorPresence } from '@/hooks/useFloorPresence'
import { useOrigin } from '@/hooks/useOrigin'
import { useRealtimeFloor } from '@/hooks/useRealtimeFloor'
import { useIsDesktop } from '@/hooks/useIsDesktop'
import {
  computeTeammateCount,
  filterCustomTeammates,
  DEFAULT_NPC_COUNT,
} from '@/lib/floors'
import { useMaxTeammates } from '@/lib/floorsConfigClient'
import { Mobile2DScene } from '@/components/scene2d/Mobile2DScene'
import type { InviterInfo } from '@/lib/inviter'

const SceneCanvas = dynamicImport(
  () => import('@/components/scene/SceneCanvas').then(m => ({ default: m.SceneCanvas })),
  { ssr: false, loading: () => <SceneSkeleton /> }
)

interface Teammate {
  id: string
  slug?: string | null
  name: string
  role: string
  pokes: number
  isDefault: boolean
}

interface VisitorRecruit {
  id: string
  name: string
  role: string
  slug?: string | null
  isDefault?: boolean
  pokes?: number
}

interface Props {
  /** Owner referral code (route param, already upper-cased). */
  code: string
  /** Owner's team name — null if not set. */
  teamName: string | null
  /** Owner's current floor — drives scene rendering. */
  currentFloor: number
  /** Owner's total invites — used for the floor-context pill. */
  totalInvites: number
  /** Items on the owner's current floor — passed to SceneCanvas. */
  unlockedItemKeys: string[]
  /** Owner's teammates — used by PokesPanel + scene character list. */
  teammates: Teammate[]

  /** True when the visitor has a valid session cookie. Drives the
   *  bottom-center "Build your own office" CTA — unlogged visitors
   *  get the upsell, signed-in users don't. */
  visitorSignedIn: boolean

  // ─── Visitor's own profile (signed-in only; trial defaults
  //     otherwise) — fed into Header + MySquadDrawer so the visitor
  //     still sees their own progress over someone else's scene.
  visitorCurrentFloor: number
  visitorTotalInvites: number
  visitorTeamName: string | null
  visitorReferralCode: string | null
  visitorRecruits: VisitorRecruit[]
  visitorInviter: InviterInfo | null
  visitorEmail: string | null
  visitorEmailVerified: boolean
}

const POLL_INTERVAL_MS = 2_000

export default function FloorVisitorClient(props: Props) {
  const router = useRouter()
  const [teammates, setTeammates] = useState<Teammate[]>(props.teammates)
  const [pokingId, setPokingId] = useState<string | null>(null)
  const seenPokes = useRef(new Map<string, number>())

  // Warm the routes a visitor is most likely to navigate to next:
  //   - signed-in: their own /office (the Tower-view header button)
  //   - anonymous: /signup (the bottom-center "Build your own office"
  //                CTA carries the owner's ref code, points at /?ref=)
  // /tower is also a common click from the header so prefetch it for
  // everyone.
  useEffect(() => {
    router.prefetch('/')
    router.prefetch('/tower')
    if (!props.visitorSignedIn) router.prefetch('/signup')
  }, [router, props.visitorSignedIn])

  // Referral capture: any NOT-signed-in visitor who opens an invite link
  // is treated as referred by that floor's owner. We persist the code to
  // localStorage so it survives navigation (e.g. tapping the logo back to
  // home) and a later return visit — signup reads it. LAST inviter wins
  // (overwrite). Signed-in users are skipped (can't be re-referred); the
  // code is cleared on successful signup/login (see signup + login flows).
  useEffect(() => {
    if (props.visitorSignedIn) return
    try {
      window.localStorage.setItem('diaflow_pending_ref', props.code.toUpperCase())
    } catch {
      /* ignore — private mode / storage disabled */
    }
  }, [props.code, props.visitorSignedIn])
  // Lifecycle AbortController — pokes (user-triggered fetches) reuse
  // this signal so they abort cleanly on navigation away. The polling
  // useEffect below uses its own per-effect AbortController instead.
  const pokeAbortRef = useRef<AbortController | null>(null)
  useEffect(() => {
    pokeAbortRef.current = new AbortController()
    return () => pokeAbortRef.current?.abort()
  }, [])
  // Live count of other visitors on this floor — server heartbeats us
  // in via /api/floor/[code]/visitors every 5s.
  const visitorCount = useFloorPresence({ code: props.code, mode: 'visit' })

  // ─── Visitor-side state (their own squad / progress) ─────────────
  // Mirrors what TowerPage.client + TowerLanding.client do — keeps
  // the visitor's own Header/MySquad in sync with SSE events even
  // while they're looking at someone else's floor.
  const [squadOpen, setSquadOpen] = useState(false)
  const [signupOpen, setSignupOpen] = useState(false)
  const [emailVerifyOpen, setEmailVerifyOpen] = useState(false)
  // "What is Diaflow AI Teammates?" → opens the rewards/how-it-works modal.
  const [howItWorksOpen, setHowItWorksOpen] = useState(false)
  const origin = useOrigin()
  // Covers the visited floor with a spinner while /tower loads. See the
  // TowerLanding.client.tsx note for the full rationale.
  const [isNavigating, setIsNavigating] = useState(false)
  const [emailVerified, setEmailVerified] = useState(props.visitorEmailVerified)
  const [rank, setRank] = useState<number | null>(null)
  // Live overrides for the visitor's own stats, fed by the SSE stream.
  // Initial values come from the server props; the snapshot/floor-up/
  // invite-accepted handlers below push deltas.
  const [liveVisitorFloor, setLiveVisitorFloor] = useState(props.visitorCurrentFloor)
  const [liveVisitorInvites, setLiveVisitorInvites] = useState(props.visitorTotalInvites)
  // Toasts + celebration modal — same UX as office / tower.
  const [toasts, setToasts] = useState<ToastMessage[]>([])
  const [celebrationFloor, setCelebrationFloor] = useState<number | null>(null)
  const [celebrationFloorsClimbed, setCelebrationFloorsClimbed] = useState(0)
  // Highest visitor floor we've observed during this mount. See the
  // matching comment in TowerLanding / TowerPage: initialised from
  // the SSR prop so the first SSE snapshot — which always replays
  // the current floor on every reconnect AND on every page-to-page
  // remount — is a baseline, not an upgrade trigger.
  const baselineFloorRef = useRef(props.visitorCurrentFloor)
  // The SSR-seeded floor can lag the visitor's TRUE floor, so the first
  // SSE snapshot would look like an "upgrade" and re-fire the
  // celebration on every mount. Let the FIRST snapshot establish the
  // real baseline silently.
  const sawFirstSnapshotRef = useRef(false)

  const pushToast = useCallback((msg: Omit<ToastMessage, 'id'>) => {
    setToasts(prev => [...prev, { ...msg, id: `t-${Date.now()}-${Math.random()}` }])
  }, [])
  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  // Initialise the "last seen" map with server values so the first
  // poll doesn't trigger a "+1" flash for every teammate.
  useEffect(() => {
    teammates.forEach(t => seenPokes.current.set(t.id, t.pokes))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Poll owner's floor for live updates (pokes). Stops when tab is
  // hidden + aborts the in-flight fetch on unmount so navigating away
  // mid-request doesn't resolve into setState on an unmounted component.
  useEffect(() => {
    const ac = new AbortController()
    async function tick() {
      if (ac.signal.aborted || document.hidden) return
      try {
        const r = await fetch(`/api/floor/${props.code}`, {
          cache: 'no-store',
          signal: ac.signal,
        })
        if (!r.ok) return
        const j = await r.json()
        if (ac.signal.aborted) return
        if (Array.isArray(j.teammates)) {
          setTeammates(j.teammates)
        }
      } catch (err) {
        // AbortError on unmount — expected. Other errors swallowed
        // because polling will retry on the next tick.
        if ((err as Error).name !== 'AbortError') { /* ignore */ }
      }
    }
    const interval = setInterval(tick, POLL_INTERVAL_MS)
    return () => {
      clearInterval(interval)
      ac.abort()
    }
  }, [props.code])

  // ─── SSE — visitor's own invite credits propagate while watching
  // someone else's floor. Mirrors TowerPage.client.tsx exactly.
  useRealtimeFloor({
    enabled: props.visitorSignedIn,
    onSnapshot: data => {
      // First snapshot of this mount = authoritative baseline; commit
      // it silently so a stale SSR floor can't masquerade as a fresh
      // climb and re-fire the celebration on every mount.
      if (!sawFirstSnapshotRef.current) {
        sawFirstSnapshotRef.current = true
        baselineFloorRef.current = data.currentFloor
        setLiveVisitorFloor(data.currentFloor)
        setLiveVisitorInvites(data.totalInvites)
        return
      }
      // Celebration gate via ref baseline — see baselineFloorRef
      // comment. Compares against the highest seen floor, NOT the
      // closure'd liveVisitorFloor (stale across reconnects + remounts).
      if (data.currentFloor > baselineFloorRef.current) {
        setCelebrationFloorsClimbed(data.currentFloor - baselineFloorRef.current)
        setCelebrationFloor(data.currentFloor)
        baselineFloorRef.current = data.currentFloor
      }
      const invitesDelta = data.totalInvites - liveVisitorInvites
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
      setLiveVisitorFloor(data.currentFloor)
      setLiveVisitorInvites(data.totalInvites)
    },
    onFloorUp: data => {
      // Same defensive ref-gate as onSnapshot — server only emits
      // floor-up on strict increase, but a duplicate event from a
      // reconnected stream shouldn't be able to replay the modal.
      if (data.currentFloor > baselineFloorRef.current) {
        setCelebrationFloorsClimbed(data.currentFloor - baselineFloorRef.current)
        setCelebrationFloor(data.currentFloor)
        baselineFloorRef.current = data.currentFloor
      }
      setLiveVisitorFloor(data.currentFloor)
      setLiveVisitorInvites(data.totalInvites)
    },
    onInviteAccepted: data => {
      setLiveVisitorInvites(data.totalInvites)
      pushToast({
        title: data.delta === 1 ? '+1 invite accepted' : `+${data.delta} invites accepted`,
        body: 'A new teammate slot is waiting — add them to your squad.',
        tone: 'success',
      })
    },
  })

  // Leaderboard rank for the visitor's pill in MySquad — refetched
  // whenever their live invite count moves so the rank stays current.
  useEffect(() => {
    if (!props.visitorSignedIn) {
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
  }, [props.visitorSignedIn, liveVisitorInvites])

  async function handleLogout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } catch {/* fall through */}
    window.location.href = '/'
  }

  async function poke(teammateId: string) {
    if (pokingId) return // simple debounce
    setPokingId(teammateId)
    // Optimistic increment so the badge bumps instantly.
    setTeammates(prev =>
      prev.map(t => (t.id === teammateId ? { ...t, pokes: t.pokes + 1 } : t))
    )
    const signal = pokeAbortRef.current?.signal
    try {
      const r = await fetch(`/api/poke/${teammateId}`, { method: 'POST', signal })
      const j = await r.json().catch(() => ({}))
      if (signal?.aborted) return
      if (r.ok && typeof j.pokes === 'number') {
        setTeammates(prev =>
          prev.map(t => (t.id === teammateId ? { ...t, pokes: j.pokes } : t))
        )
      } else {
        // Revert optimistic on failure.
        setTeammates(prev =>
          prev.map(t => (t.id === teammateId ? { ...t, pokes: Math.max(0, t.pokes - 1) } : t))
        )
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      // Other errors: revert optimistic increment.
      setTeammates(prev =>
        prev.map(t => (t.id === teammateId ? { ...t, pokes: Math.max(0, t.pokes - 1) } : t))
      )
    } finally {
      if (!signal?.aborted) setPokingId(null)
    }
  }

  /**
   * Map a Character.slug to the corresponding teammate row.
   *
   * OfficeScene fires drag-drop signals with one of:
   *   - 'iris' | 'mia' | 'leo' — default NPCs, matched by slug column
   *   - 'recruited-N' — Nth custom teammate (index into the
   *     non-default subset, in the same order it was passed in)
   *
   * Returns null when the slug doesn't resolve (e.g. owner has fewer
   * custom teammates than expected) — caller no-ops gracefully.
   */
  function pokeBySlug(charSlug: string) {
    if (charSlug.startsWith('recruited-')) {
      const idx = parseInt(charSlug.slice('recruited-'.length), 10)
      if (Number.isNaN(idx)) return
      const customs = teammates.filter(t => !t.isDefault)
      const target = customs[idx]
      if (target) void poke(target.id)
      return
    }
    const target = teammates.find(t => t.slug === charSlug)
    if (target) void poke(target.id)
  }

  // Visitor's own teammate count (for Header stats) — when not signed
  // in, fall back to the 3 default NPCs as a trial preview.
  const visitorTeammateCount = props.visitorSignedIn
    ? computeTeammateCount(props.visitorRecruits)
    : DEFAULT_NPC_COUNT
  const visitorMaxTeammates = useMaxTeammates(liveVisitorFloor)
  const visitorCustomCount = filterCustomTeammates(props.visitorRecruits).length
  const visitorSlotsAvailable = Math.max(
    0,
    visitorMaxTeammates - DEFAULT_NPC_COUNT - visitorCustomCount,
  )

  const totalPokes = teammates.reduce((sum, t) => sum + t.pokes, 0)
  const ownerName = props.teamName || 'this team'
  // On desktop we want a clean "just visiting" view — hide the visitor's
  // own My Squad sidebar + the header Tower-view button so the focus is
  // the owner's floor. Mobile keeps the My Squad pill.
  const isDesktop = useIsDesktop()

  return (
    <main className="fixed inset-0 overflow-hidden bg-[#04040d]">
      {/* Standard Header — drives the VISITOR's own stats so this view
          feels just like /office, only the scene below belongs to
          someone else. */}
      <Header
        signedIn={props.visitorSignedIn}
        currentFloor={liveVisitorFloor}
        totalInvites={liveVisitorInvites}
        referralCode={props.visitorReferralCode}
        teammateCount={visitorTeammateCount}
        maxTeammates={visitorMaxTeammates}
        slotsAvailable={visitorSlotsAvailable}
        showTower={false}
        // Tower-view button hidden while visiting another user's floor
        // on desktop (cleaner "just visiting" chrome). The button is
        // desktop-only anyway, so omitting onToggleTower removes it.
        onToggleTower={isDesktop ? undefined : () => {
          setIsNavigating(true)
          router.push('/tower')
        }}
        // No header "Claim your team" button while visiting someone
        // else's floor — the bottom-center "Build your own office"
        // CTA already funnels unlogged visitors into signup with the
        // owner's ref code attached, so a duplicate top-right button
        // is just clutter.
        hideAuthCta
      />

      {/* Top-left card identifying who you're visiting + the owner's
          floor. Viewer count + total pokes now live inside the
          MySquadDrawer "Visiting" pill (see the `visiting` prop below)
          to keep the on-scene chrome minimal. */}
      {/* Desktop-only visiting card — wider layout with the
          "Tap a teammate to poke them" hint. Hidden on mobile
          (md:block) so the new MOBILE visiting pill below takes
          over there with its chip-style stats. */}
      <div
        className="hidden md:block absolute top-16 left-4 z-20 px-4 py-3 rounded-2xl bg-night-deep/85 backdrop-blur-md border border-white/10 max-w-[280px]"
        style={{ boxShadow: '0 12px 40px rgba(0,0,0,0.5)' }}
      >
        <div className="text-[10px] uppercase tracking-[0.1em] font-extrabold text-tower-gold mb-0.5">
          ⭐ Visiting
        </div>
        <div className="text-xl font-extrabold text-tower-cream leading-tight mb-1.5 truncate">
          {ownerName}
        </div>
        {/* Floor + total-pokes chips — mirrors the mobile visiting pill. */}
        <div className="flex gap-1.5 flex-wrap">
          <span className="rounded-full px-2.5 py-1 text-[11px] font-bold bg-tower-gold/15 text-tower-gold border border-tower-gold/30">
            {props.currentFloor >= 20 ? '👑' : '🏢'} Level {props.currentFloor}
          </span>
          <span className="rounded-full px-2.5 py-1 text-[11px] font-bold bg-purple-500/15 text-purple-200 border border-purple-400/30">
            ⭐ {totalPokes} {totalPokes === 1 ? 'poke' : 'pokes'}
          </span>
        </div>
        <div className="text-[11px] text-tower-cream/55 mt-2">
          Drag a teammate to poke them
        </div>
        {/* Explicit back-to-office button — only for signed-in visitors
            (anonymous visitors have no office to return to). Not every
            visitor realises the header logo links home. */}
        {props.visitorSignedIn && (
          <button
            type="button"
            onClick={() => {
              setIsNavigating(true)
              router.push('/')
            }}
            className="mt-3 w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-purple-500/20 border border-purple-400/40 text-purple-100 hover:bg-purple-500/30 text-[12px] font-bold py-2 transition"
          >
            <span aria-hidden>←</span> Back to my office
          </button>
        )}
      </div>

      {/* The right-side "Squad / Poke a teammate" panel was removed on
          desktop — visitors now poke the same way as on mobile: by
          dragging a teammate in the scene (onTeammatePoke). The left
          "Visiting" card carries the "tap a teammate to poke" hint. */}

      {/* Desktop: 3D scene. Visitors CAN drag teammates — the drop
          triggers a poke API call (see pokeBySlug). Position changes
          themselves stay client-side; only the poke counter is
          persisted. Hidden on mobile, where the 2D scene below
          handles rendering. */}
      <div className="hidden md:block">
        <SceneCanvas
          onboardingStep="done"
          companyName={props.teamName ?? null}
          recruitedCharacters={teammates
            .filter(t => !t.isDefault)
            .map(t => ({ name: t.name, role: t.role }))}
          currentFloor={props.currentFloor}
          unlockedItemKeys={props.unlockedItemKeys}
          onFloorClick={() => {}}
          onTeammatePoke={pokeBySlug}
          // Show the OWNER's Mia role (server-stored Diaflow recommendation)
          // above her head when visiting their floor. Falls back to the
          // OfficeScene default when the row isn't present (legacy
          // accounts that pre-date the Diaflow integration).
          miaRole={teammates.find(t => t.slug === 'mia')?.role ?? null}
        />
      </div>

      {/* Mobile: 2D front-elevation visitor preview. Tapping a
          teammate fires the same poke handler the desktop drag-drop
          uses, so visitors get poke parity across breakpoints
          (without the desktop-only drag affordance). */}
      <Mobile2DScene
        companyName={props.teamName ?? null}
        recruitedCharacters={teammates
          .filter(t => !t.isDefault)
          .map(t => ({ name: t.name, role: t.role }))}
        currentFloor={props.currentFloor}
        miaRole={teammates.find(t => t.slug === 'mia')?.role ?? null}
        // Drag-drop → poke, matching the desktop 3D drag-drop
        // behaviour and the owner's office view. Tap (no movement)
        // is intentionally a no-op for visitors — they shouldn't be
        // opening edit modals on someone else's floor.
        onTeammatePoke={pokeBySlug}
      />

      {/* Mobile-only "Visiting <owner>" pill anchored under the
          header chrome. Tells the visitor whose office they're
          looking at + the owner's floor / total-pokes status at a
          glance. Mirrors mockup screen 16. Hidden on desktop where
          the standard Header already has a wider visiting label. */}
      <div
        className="md:hidden fixed left-3 z-[11] rounded-2xl border border-white/10 bg-night-deep/85 backdrop-blur-md px-3 py-2.5 max-w-[75%] pointer-events-none"
        style={{
          top: 'calc(env(safe-area-inset-top, 0px) + 56px)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
        }}
      >
        <div className="text-[9px] uppercase tracking-[0.1em] font-extrabold text-tower-gold mb-0.5">
          ⭐ Visiting
        </div>
        <div className="text-[14px] font-extrabold text-tower-cream leading-tight mb-1 truncate">
          {ownerName}
        </div>
        <div className="flex gap-1 flex-wrap">
          <span className="rounded-full px-2 py-0.5 text-[9.5px] font-bold bg-tower-gold/15 text-tower-gold border border-tower-gold/30">
            {props.currentFloor >= 20 ? '👑' : '🏢'} Floor{' '}
            {props.currentFloor}
          </span>
          <span className="rounded-full px-2 py-0.5 text-[9.5px] font-bold bg-purple-500/15 text-purple-200 border border-purple-400/30">
            ⭐ {totalPokes} {totalPokes === 1 ? 'poke' : 'pokes'}
          </span>
        </div>
        {/* Explicit back-to-office button — signed-in visitors only
            (anonymous visitors have no office). pointer-events-auto so
            it's tappable even though the pill wrapper ignores pointers. */}
        {props.visitorSignedIn && (
          <button
            type="button"
            onClick={() => {
              setIsNavigating(true)
              router.push('/')
            }}
            className="pointer-events-auto mt-2 w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-purple-500/25 border border-purple-400/45 text-purple-50 text-[11px] font-bold py-1.5 active:scale-[0.98] transition"
          >
            <span aria-hidden>←</span> Back to my office
          </button>
        )}
      </div>

      {/* MySquad — visitor's OWN squad, not the owner's. Right-edge
          floating button + slide-in drawer. Hidden on DESKTOP while
          visiting another user's floor (cleaner view); kept on mobile
          so the visitor can still reach their own squad/share. */}
      <MySquadFloatingButton visible={!isDesktop} onClick={() => setSquadOpen(true)} />

      <MySquadDrawer
        open={squadOpen}
        onClose={() => setSquadOpen(false)}
        teamName={props.visitorTeamName}
        referralCode={props.visitorReferralCode}
        totalInvites={liveVisitorInvites}
        currentFloor={liveVisitorFloor}
        emailCaptured={props.visitorSignedIn}
        teammates={props.visitorRecruits}
        inviter={props.visitorInviter}
        onOpenSignup={!props.visitorSignedIn ? () => setSignupOpen(true) : undefined}
        onLogout={props.visitorSignedIn ? handleLogout : undefined}
        emailVerified={props.visitorSignedIn ? emailVerified : undefined}
        userEmail={props.visitorEmail}
        onVerifyEmail={
          props.visitorSignedIn && !emailVerified ? () => setEmailVerifyOpen(true) : undefined
        }
        rank={rank}
        // Pass the owner-side "Visiting" stats — the drawer renders a
        // compact pill (viewer count + total pokes) near the top so
        // those numbers have a permanent home without crowding the
        // floor-page chrome.
        visiting={{
          ownerName: props.teamName,
          viewerCount: visitorCount,
          totalPokes,
        }}
      />

      {/* "What is Diaflow AI Teammates?" helper — bottom-left. Collapsed to a
          "?" circle; expands to the full label on hover (desktop). Tap
          opens the How-it-works / rewards modal. Lifted above the
          anonymous "Build your own office" bottom card on mobile so they
          don't overlap. */}
      <button
        type="button"
        onClick={() => setHowItWorksOpen(true)}
        aria-label="What is Diaflow AI Teammates?"
        className={
          'group fixed left-4 z-30 flex items-center rounded-full bg-night-mid/90 border border-white/15 backdrop-blur-md text-tower-cream/80 hover:text-tower-cream shadow-lg transition-all ' +
          (props.visitorSignedIn ? 'bottom-4' : 'bottom-[6.5rem] md:bottom-4')
        }
        style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.45)' }}
      >
        <span className="w-10 h-10 flex items-center justify-center rounded-full text-lg font-bold shrink-0">
          ?
        </span>
        <span className="max-w-0 group-hover:max-w-[220px] overflow-hidden whitespace-nowrap opacity-0 group-hover:opacity-100 transition-all duration-200 text-[13px] font-semibold">
          <span className="pr-4">What is Diaflow AI Teammates?</span>
        </span>
      </button>

      <HowItWorksModal
        open={howItWorksOpen}
        onClose={() => setHowItWorksOpen(false)}
        inviteUrl={
          props.visitorSignedIn && props.visitorReferralCode && origin
            ? `${origin}/floor/${props.visitorReferralCode}`
            : null
        }
        currentFloor={liveVisitorFloor}
        totalInvites={liveVisitorInvites}
        // A NEW visitor (no trial state) can't go straight into SignupModal
        // — it expects an onboarding/trial snapshot they don't have. Send
        // them through the SAME funnel as the bottom "Build your own
        // office" CTA: navigate home with this room's ref code, which runs
        // the Iris/Mia/Leo onboarding first, then signup.
        onOpenSignup={
          !props.visitorSignedIn
            ? () => {
                setIsNavigating(true)
                router.push(`/?ref=${encodeURIComponent(props.code)}`)
              }
            : undefined
        }
        // Visitor has no trial team yet → frame the CTA as "build your
        // own office" (matches the bottom CTA) instead of "save my team".
        signupEyebrow="Like what you see?"
        signupHint="Build your own AI office — free, takes 30 seconds."
        signupLabel="Build your own office →"
      />

      {signupOpen && <SignupModal onClose={() => setSignupOpen(false)} />}

      <EmailVerifyModal
        open={emailVerifyOpen}
        onClose={() => setEmailVerifyOpen(false)}
        email={props.visitorEmail}
        onVerified={() => setEmailVerified(true)}
      />

      {/* Floor-up celebration — same gate as office/tower (signed-in
          only). Fires from the SSE handler above when the visitor's
          own floor advances. */}
      {props.visitorSignedIn && celebrationFloor != null && (
        <CelebrationModal
          floor={celebrationFloor}
          totalInvites={liveVisitorInvites}
          trialMode={false}
          floorsClimbed={celebrationFloorsClimbed}
          rank={rank}
          onClose={() => setCelebrationFloor(null)}
        />
      )}

      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      {/* Unlogged-visitor CTA. Two flavours of the same call-to-
          action, gated on viewport so each gets a layout that fits
          its constraints:

           Desktop (md+): single-line gold pill bottom-centre, same
             as before. Plenty of horizontal space → no need for the
             two-line eyebrow + headline stack.
           Mobile  (< md): full-width gold→purple gradient card with
             eyebrow ("Like what you see?") above the headline
             ("Build your AI team in 30 sec"), per mockup screen 16.
             Same `?ref=<code>` deep-link in both. */}
      {!props.visitorSignedIn && (
        <>
          {/* Desktop / wider viewports — keep the established pill. */}
          <a
            href={`/?ref=${encodeURIComponent(props.code)}`}
            className="hidden md:inline-flex fixed bottom-5 left-1/2 -translate-x-1/2 z-30 max-w-[92vw] whitespace-nowrap px-7 py-3.5 rounded-xl bg-gradient-to-r from-tower-gold to-amber-300 text-night-deep text-base shadow-2xl items-center gap-2 hover:from-amber-200 hover:to-tower-gold transition group"
            style={{ boxShadow: '0 18px 50px rgba(0,0,0,0.55)' }}
          >
            <span className="opacity-80">Like what you see?</span>
            <span className="font-bold">Build your own office in 30 seconds</span>
            <span className="text-lg font-bold group-hover:translate-x-0.5 transition-transform">→</span>
          </a>

          {/* Mobile — full-width gradient card anchored above the
              safe-area inset. Two-line copy + chunky arrow on the
              right. Lifts higher than the iOS home indicator so the
              tap target stays reachable. */}
          <a
            href={`/?ref=${encodeURIComponent(props.code)}`}
            className="md:hidden fixed inset-x-4 z-30 rounded-2xl px-4 py-3 flex items-center gap-3 shadow-[0_18px_50px_rgba(168,117,255,0.4)]"
            style={{
              bottom: 'max(1rem, env(safe-area-inset-bottom))',
              background: 'linear-gradient(135deg, #c4a3ff 0%, #fbbf24 100%)',
              color: '#0a0b14',
            }}
          >
            <div className="flex-1 min-w-0">
              <div className="text-[10.5px] font-bold leading-tight opacity-75">
                Like what you see?
              </div>
              <div className="text-[14px] font-extrabold leading-tight mt-0.5">
                Build your AI team in 30 sec
              </div>
            </div>
            <div className="text-xl font-extrabold shrink-0">→</div>
          </a>
        </>
      )}

      {/* Tower navigation overlay — covers the visited floor while
          /tower's RSC loads. Unmounts naturally when the page swaps. */}
      {isNavigating && <ViewTransitionOverlay label="Loading tower view…" />}
    </main>
  )
}

