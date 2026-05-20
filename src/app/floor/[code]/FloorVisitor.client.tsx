'use client'

/**
 * /floor/[code] — public visitor view.
 *
 * Renders the owner's office scene as a "guest" page. The visitor can
 * click any teammate to poke them — each poke POSTs to
 * /api/poke/[id], which increments the counter server-side. Every 2
 * seconds the page re-fetches /api/floor/[code] so multiple visitors
 * on the same floor see each other's pokes update in near-real-time.
 *
 * No scene drag, no edit, no NPC modals — interactions are limited to
 * pokes. Header has a back link to the visitor's own home page.
 */

import { useEffect, useState, useRef } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { SceneSkeleton } from '@/components/fallback/SceneSkeleton'
import { useFloorPresence } from '@/hooks/useFloorPresence'

const SceneCanvas = dynamic(
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

interface Props {
  code: string
  teamName: string | null
  currentFloor: number
  totalInvites: number
  unlockedItemKeys: string[]
  teammates: Teammate[]
}

const POLL_INTERVAL_MS = 2_000

export default function FloorVisitorClient(props: Props) {
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

  // Initialise the "last seen" map with server values so the first
  // poll doesn't trigger a "+1" flash for every teammate.
  useEffect(() => {
    teammates.forEach(t => seenPokes.current.set(t.id, t.pokes))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Poll for live updates. Stops when tab is hidden + aborts the
  // in-flight fetch on unmount so navigating away mid-request doesn't
  // resolve into setState on an unmounted component.
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

  const totalPokes = teammates.reduce((sum, t) => sum + t.pokes, 0)
  const ownerName = props.teamName || 'this team'

  return (
    <main className="fixed inset-0 overflow-hidden bg-[#04040d]">
      {/* Header — back link + floor stats. Mirrors /tower-view/[floor]
          chrome so the visitor experience feels consistent. */}
      <header className="fixed top-0 inset-x-0 z-10 flex items-center justify-between px-3 md:px-4 py-2.5 pointer-events-none">
        <div className="pointer-events-auto flex items-center gap-2">
          <Link
            href="/"
            className="px-2.5 md:px-3 py-1.5 rounded-md bg-night-mid/70 border border-white/10 text-tower-cream text-xs md:text-sm hover:bg-night-mid transition flex items-center gap-1.5"
          >
            <span aria-hidden>←</span>
            <span className="hidden sm:inline">Back home</span>
            <span className="sm:hidden">Back</span>
          </Link>
        </div>
        <div className="pointer-events-auto flex items-center gap-2">
          {/* Eye icon + live viewer count. Includes the current
              visitor (you), so 1 = solo, 2+ = others online too. */}
          <div
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-night-mid/60 border border-tower-gold/30 text-[11px] text-tower-gold"
            title={`${visitorCount} ${visitorCount === 1 ? 'viewer' : 'viewers'} online`}
          >
            <EyeIcon />
            <span className="font-semibold tabular-nums">{visitorCount}</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-night-mid/60 border border-white/5 text-[11px] text-tower-cream/80">
            <span>Floor</span>
            <span className="text-tower-gold font-semibold">{props.currentFloor}</span>
            <span className="opacity-40">·</span>
            <span className="text-tower-gold font-semibold">{totalPokes}</span>
            <span>pokes</span>
          </div>
        </div>
      </header>

      {/* Top-left card identifying who you're visiting. */}
      <div
        className="absolute top-16 left-3 md:left-4 z-20 px-4 py-2.5 rounded-2xl bg-black/65 backdrop-blur-md border border-white/15 max-w-[80vw] md:max-w-[280px]"
        style={{ boxShadow: '0 12px 40px rgba(0,0,0,0.5)' }}
      >
        <div className="text-[10px] text-amber-300/80 uppercase tracking-[0.18em] mb-0.5">
          Visiting
        </div>
        <div className="text-lg md:text-xl font-bold text-amber-300 leading-tight truncate">
          {ownerName}
        </div>
        <div className="text-[11px] text-white/70 mt-0.5">
          Tap a teammate to poke them
        </div>
      </div>

      {/* Pokes leaderboard panel — right side on desktop, hidden on
          mobile (visitor can still poke via the scene). */}
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
    </main>
  )
}

/** Minimal eye SVG — used for the "👁 N viewing" presence pill. */
function EyeIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
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
    <aside className="hidden md:flex absolute top-16 right-3 z-20 w-[260px] max-h-[78vh] flex-col rounded-2xl bg-black/65 backdrop-blur-md border border-white/15 overflow-hidden">
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
