/**
 * Hard-coded per-floor preview data for `/tower-view/[floor]`.
 *
 * The route is fully public (no auth, no DB) — anyone can browse what
 * any floor looks like at its fully-decorated state. The teammates and
 * items are seeded deterministically from the floor number so the same
 * URL always renders identical content for everyone (good for sharing
 * + marketing).
 *
 * Numbers come from `FLOOR_MAX_TEAMMATES` and `FLOOR_CONFIG`:
 *   - 3 default NPCs (Iris/Mia/Leo) are always rendered.
 *   - The remaining slots are filled with placeholder teammates drawn
 *     from PLACEHOLDER_NAMES + PLACEHOLDER_ROLES.
 *   - Items: every floor ≤ N has its unlock item visible.
 */

import {
  DEFAULT_NPC_COUNT,
  FLOOR_CONFIG,
  getMaxTeammates,
  getUnlockedItemKeysForFloor,
} from './floors'

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
 * Resolve the full preview for a given floor.
 *  - `currentFloor`: clamped to 1..20
 *  - `unlockedItemKeys`: every item from floor 1 up to N
 *  - `teammates`: max-allowed for this floor, minus 3 default NPCs
 *  - `floorLabel`: the unlock-decor label (e.g. "Floor lamp")
 *  - `companyName`: a generic placeholder so the picture frame isn't blank
 */
export function getFloorPreview(floorParam: string | number) {
  const raw = typeof floorParam === 'string' ? parseInt(floorParam, 10) : floorParam
  const floor =
    Number.isFinite(raw) && raw >= 1 && raw <= FLOOR_CONFIG.length
      ? Math.floor(raw)
      : 1

  const max = getMaxTeammates(floor)
  const placeholderCount = Math.max(0, max - DEFAULT_NPC_COUNT)
  const teammates = pickPlaceholder(floor, placeholderCount)
  const unlockedItemKeys = getUnlockedItemKeysForFloor(floor).map(u => u.itemKey)
  const cfg = FLOOR_CONFIG.find(c => c.floor === floor)
  return {
    floor,
    floorLabel: cfg?.label ?? `Floor ${floor}`,
    invitesRequired: cfg?.invitesRequired ?? 0,
    maxTeammates: max,
    teammates,
    unlockedItemKeys,
    companyName: 'Acme Team',
  }
}

export type FloorPreview = ReturnType<typeof getFloorPreview>
