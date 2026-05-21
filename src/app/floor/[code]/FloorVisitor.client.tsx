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
import { MySquadDrawer } from '@/components/MySquadDrawer'
import { MySquadFloatingButton } from '@/components/MySquadFloatingButton'
import { SignupModal } from '@/components/SignupModal'
import { EmailVerifyModal } from '@/components/EmailVerifyModal'
import { CelebrationModal } from '@/components/CelebrationModal'
import { ToastStack, type ToastMessage } from '@/components/Toast'
import { useFloorPresence } from '@/hooks/useFloorPresence'
import { useRealtimeFloor } from '@/hooks/useRealtimeFloor'
import {
  computeTeammateCount,
  filterCustomTeammates,
  DEFAULT_NPC_COUNT,
} from '@/lib/floors'
import { useMaxTeammates } from '@/lib/floorsConfigClient'
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
      const floorClimbed = data.currentFloor - liveVisitorFloor
      const invitesDelta = data.totalInvites - liveVisitorInvites
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
      setLiveVisitorFloor(data.currentFloor)
      setLiveVisitorInvites(data.totalInvites)
    },
    onFloorUp: data => {
      const climbed = Math.max(1, data.currentFloor - liveVisitorFloor)
      setCelebrationFloorsClimbed(climbed)
      setCelebrationFloor(data.currentFloor)
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
        onToggleTower={() => router.push('/tower')}
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
      <div
        className="absolute top-14 md:top-16 left-3 md:left-4 z-20 px-4 py-2.5 rounded-2xl bg-black/65 backdrop-blur-md border border-white/15 max-w-[80vw] md:max-w-[260px]"
        style={{ boxShadow: '0 12px 40px rgba(0,0,0,0.5)' }}
      >
        <div className="text-[10px] text-amber-300/80 uppercase tracking-[0.18em] mb-0.5">
          Visiting
        </div>
        <div className="text-lg md:text-xl font-bold text-amber-300 leading-tight truncate">
          {ownerName}
        </div>
        <div className="text-[11px] text-white/70 mt-0.5">
          Floor <span className="text-amber-200 font-semibold">{props.currentFloor}</span>
          <span className="opacity-40 mx-1.5">·</span>
          Tap a teammate to poke them
        </div>
      </div>

      {/* Pokes leaderboard panel — right side on desktop, hidden on
          mobile (visitor can still poke via the scene). Top offset
          bumped so the standard Header clears it. */}
      <PokesPanel teammates={teammates} pokingId={pokingId} onPoke={poke} />

      {/* Visitors CAN drag teammates — the drop triggers a poke API
          call (see pokeBySlug). Position changes themselves stay
          client-side; only the poke counter is persisted. */}
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
      />

      {/* MySquad — visitor's OWN squad, not the owner's. Right-edge
          floating button + slide-in drawer, same component the office
          + tower views use so the user has a consistent way to
          inspect / share their own progress from anywhere. */}
      <MySquadFloatingButton visible onClick={() => setSquadOpen(true)} />

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
          onClose={() => setCelebrationFloor(null)}
          onOpenSquad={() => setSquadOpen(true)}
        />
      )}

      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      {/* Unlogged-visitor CTA — bottom-center, redirects into the
          referral signup flow with the owner's code so they show up
          as a credited invite the moment they create an account. */}
      {!props.visitorSignedIn && (
        <a
          href={`/?ref=${encodeURIComponent(props.code)}`}
          className="fixed bottom-5 left-1/2 -translate-x-1/2 z-30 max-w-[92vw] whitespace-nowrap px-5 md:px-7 py-3 md:py-3.5 rounded-xl bg-gradient-to-r from-tower-gold to-amber-300 text-night-deep text-sm md:text-base shadow-2xl flex items-center gap-2 hover:from-amber-200 hover:to-tower-gold transition group"
          style={{ boxShadow: '0 18px 50px rgba(0,0,0,0.55)' }}
        >
          <span className="opacity-80">Like what you see?</span>
          <span className="font-bold">Build your own office in 30 seconds</span>
          <span className="text-lg font-bold group-hover:translate-x-0.5 transition-transform">→</span>
        </a>
      )}
    </main>
  )
}

/** Right-side pokes leaderboard with a per-teammate poke button. */
function PokesPanel({
  teammates,
  pokingId,
  onPoke,
}: {
  teammates: Teammate[]
  pokingId: string | null
  onPoke: (id: string) => void
}) {
  return (
    <aside className="hidden md:flex absolute top-32 right-12 z-20 w-[240px] max-h-[70vh] flex-col rounded-2xl bg-black/65 backdrop-blur-md border border-white/15 overflow-hidden">
      <div className="px-4 py-3 border-b border-white/10">
        <div className="text-[10px] uppercase tracking-[0.18em] text-tower-gold/80">
          Squad
        </div>
        <div className="text-sm font-semibold text-tower-cream mt-0.5">
          Poke a teammate
        </div>
      </div>
      <ul className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
        {teammates.map(t => (
          <li
            key={t.id}
            className="flex items-center gap-2 px-2 py-2 rounded-md hover:bg-white/5 transition"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-semibold truncate text-tower-cream">
                  {t.name}
                </span>
                {t.isDefault && (
                  <span className="shrink-0 text-[8px] uppercase tracking-wider px-1 py-0.5 rounded bg-purple-500/20 text-purple-300 font-bold">
                    NPC
                  </span>
                )}
              </div>
              <div className="text-[10px] text-tower-cream/50 truncate">
                {t.role}
              </div>
            </div>
            <div className="shrink-0 text-[11px] text-amber-300 font-bold tabular-nums w-8 text-right">
              ★ {t.pokes}
            </div>
            <button
              onClick={() => onPoke(t.id)}
              disabled={pokingId === t.id}
              className="shrink-0 px-2.5 py-1 rounded-md bg-tower-gold text-night-deep text-xs font-bold hover:bg-amber-200 disabled:opacity-60 transition"
            >
              Poke
            </button>
          </li>
        ))}
      </ul>
    </aside>
  )
}
