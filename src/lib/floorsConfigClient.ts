'use client'

/**
 * Client-side accessor for the floor catalogue.
 *
 * - Fetches `/api/floors` exactly once per browser session and caches
 *   the result in a module-level singleton. Subsequent `useFloorsConfig`
 *   calls return the cached array synchronously.
 * - While the fetch is in flight, callers receive the static
 *   `FLOOR_CONFIG_FALLBACK` derived from `lib/floors.ts` so the first
 *   paint doesn't show "loading…" placeholders. The instant the API
 *   response lands, components re-render with live DB values.
 * - `loadFloorsConfig()` is also exported for non-React callers
 *   (e.g. tower-view preview generators) that need an awaitable handle.
 */

import { useEffect, useState } from 'react'
import {
  FLOOR_CONFIG,
  FLOOR_MAX_TEAMMATES,
  getMaxTeammates as getMaxTeammatesFallback,
} from '@/lib/floors'
import type {
  FloorConfigEntry,
  FloorItemConfig,
} from '@/lib/floorsConfigTypes'

export type { FloorConfigEntry, FloorItemConfig } from '@/lib/floorsConfigTypes'

/**
 * Fallback derived from the static `FLOOR_CONFIG` constants. Used until
 * the live API response arrives. Items quantity defaults to 1; the live
 * DB row may differ (e.g. basic_chair_desk × 3 on some floor).
 */
const FALLBACK: FloorConfigEntry[] = FLOOR_CONFIG.map(c => ({
  id: c.floor,
  invitesRequired: c.invitesRequired,
  label: c.label,
  maxTeammates: FLOOR_MAX_TEAMMATES[c.floor] ?? 4,
  productReward: null,
  unlockItems: null,
  items: [{ key: c.unlockKey, label: c.label, quantity: 1 }],
}))

let cache: FloorConfigEntry[] | null = null
let pending: Promise<FloorConfigEntry[]> | null = null

export async function loadFloorsConfig(): Promise<FloorConfigEntry[]> {
  if (cache) return cache
  if (pending) return pending
  // `no-store` skips the browser HTTP cache so a hard-refresh after a
  // DB edit always picks up the fresh response. The module-level
  // `cache` variable below still dedupes within a single page session,
  // so this only adds ONE extra request per page load.
  pending = fetch('/api/floors', { cache: 'no-store' })
    .then(r => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      return r.json() as Promise<{ floors: FloorConfigEntry[] }>
    })
    .then(d => {
      cache = d.floors
      pending = null
      return cache!
    })
    .catch(err => {
      pending = null
      throw err
    })
  return pending
}

/**
 * React hook returning the live floor catalogue. Falls back to the
 * static FLOOR_CONFIG snapshot until the API responds, so callers can
 * render synchronously without a loading branch.
 */
export function useFloorsConfig(): FloorConfigEntry[] {
  const [data, setData] = useState<FloorConfigEntry[]>(cache ?? FALLBACK)
  useEffect(() => {
    if (cache) {
      // Already loaded — make sure state reflects it (covers the case
      // where another component loaded the cache before this mount).
      if (data !== cache) setData(cache)
      return
    }
    let mounted = true
    loadFloorsConfig()
      .then(d => {
        if (mounted) setData(d)
      })
      .catch(() => {
        // Stick with fallback on error — better than a blank UI.
      })
    return () => {
      mounted = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return data
}

/** Single floor (or null if not yet loaded / unknown id). */
export function useFloor(floorId: number): FloorConfigEntry | undefined {
  const floors = useFloorsConfig()
  return floors.find(f => f.id === floorId)
}

/** Convenience: just the maxTeammates for a floor, with static fallback. */
export function useMaxTeammates(floorId: number): number {
  const f = useFloor(floorId)
  return f?.maxTeammates ?? getMaxTeammatesFallback(floorId)
}

/**
 * Items configured for the user's CURRENT floor only — non-cumulative.
 * Each row in floor_items is an authoritative per-floor decoration list
 * (with quantities), so a user on F5 sees F5's items, not F1..F5's union.
 */
export function useFloorItems(currentFloor: number): FloorItemConfig[] {
  const floors = useFloorsConfig()
  const f = floors.find(x => x.id === currentFloor)
  return f?.items ?? []
}

/** @deprecated — use `useFloorItems`. Kept as an alias for any straggler. */
export const useUnlockedItems = useFloorItems

/**
 * Total floor count (used by progress bars and "X of Y" displays). Falls
 * back to the static FLOOR_CONFIG length until the live data arrives.
 */
export function useFloorCount(): number {
  const floors = useFloorsConfig()
  return floors.length
}
