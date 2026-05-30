/**
 * Server-side per-floor preview for `/tower-view/[floor]`.
 *
 * The route is fully public (no auth, no per-user data) — anyone can
 * browse what any floor looks like at its fully-decorated state. The
 * teammates and items are seeded deterministically from the floor
 * number so the same URL always renders identical content for everyone
 * (good for sharing + marketing).
 *
 * Numbers now come from the DB-backed catalogue (`lib/floorsApi`), so
 * admin edits to floor labels / thresholds / item lists / max
 * teammates flow through without touching code:
 *   - 3 default NPCs (Iris/Mia/Leo) are always rendered.
 *   - The remaining slots are filled with placeholder teammates drawn
 *     from PLACEHOLDER_NAMES + PLACEHOLDER_ROLES.
 *   - Items: union of every floor ≤ N's configured items, deduped by key.
 */

import { DEFAULT_NPC_COUNT } from './floors'
import { getAllFloorsConfig } from './floorsApi'

const PLACEHOLDER_NAMES = [
  'Sam', 'Alex', 'Jordan', 'Riley', 'Casey',
  'Morgan', 'Taylor', 'Avery', 'Cameron', 'Drew',
  'Quinn', 'Sage', 'Reese', 'Parker', 'Skyler',
]

const PLACEHOLDER_ROLES = [
  'Engineer', 'Designer', 'PM',
  'Marketer', 'Analyst', 'Researcher',
  'Strategist', 'Ops', 'Sales',
  'Customer Success', 'Coordinator', 'Editor',
]

export interface PlaceholderTeammate {
  name: string
  role: string
}

/** Seeded LCG so the same floor number always picks the same names. */
function pickPlaceholder(seed: number, count: number): PlaceholderTeammate[] {
  let s = seed * 9301 + 49297
  const out: PlaceholderTeammate[] = []
  for (let i = 0; i < count; i++) {
    s = (s * 1103515245 + 12345) & 0x7fffffff
    const nameIdx = s % PLACEHOLDER_NAMES.length
    s = (s * 1103515245 + 12345) & 0x7fffffff
    const roleIdx = s % PLACEHOLDER_ROLES.length
    out.push({
      name: PLACEHOLDER_NAMES[nameIdx],
      role: PLACEHOLDER_ROLES[roleIdx],
    })
  }
  return out
}

/**
 * Resolve the full preview for a given floor. Async because it consults
 * the DB-backed floor catalogue (`getAllFloorsConfig`), but the catalogue
 * is cached in Redis + in-process, so the hot path is sub-ms.
 */
export async function getFloorPreview(floorParam: string | number) {
  const all = await getAllFloorsConfig()
  const maxFloor = all.length || 20
  const raw = typeof floorParam === 'string' ? parseInt(floorParam, 10) : floorParam
  const floor =
    Number.isFinite(raw) && raw >= 1 && raw <= maxFloor
      ? Math.floor(raw)
      : 1

  const cfg = all.find(f => f.id === floor)
  const max = cfg?.maxTeammates ?? 4
  const placeholderCount = Math.max(0, max - DEFAULT_NPC_COUNT)
  const teammates = pickPlaceholder(floor, placeholderCount)

  // Per-floor items: each floor's row in floor_items is authoritative
  // for what shows on that floor (no cumulative union — see the
  // matching change in FloorItems.tsx).
  const unlockedItemKeys = cfg?.items.map(it => it.key) ?? []

  return {
    floor,
    floorLabel: cfg?.label ?? `Floor ${floor}`,
    invitesRequired: cfg?.invitesRequired ?? 0,
    maxTeammates: max,
    teammates,
    unlockedItemKeys,
    companyName: 'Acme Team',
    totalFloors: maxFloor,
  }
}

export type FloorPreview = Awaited<ReturnType<typeof getFloorPreview>>
