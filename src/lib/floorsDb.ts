/**
 * Server-side floor + item helpers backed by the DB.
 *
 * Replaces the previous per-user `UnlockedItem` table. Items are now
 * read from the `FloorItem` join PER FLOOR: a user on floor N sees
 * exactly the items configured for floor N (non-cumulative — admins
 * curate each floor independently in the floor_items table).
 *
 * The matching client-side constants in `src/lib/floors.ts` are kept
 * as a sync fallback for client bundles, anonymous trial state, and
 * the tower-view previews — they mirror the DB seed and act as the
 * source-of-truth shape, but the DB is authoritative for live reads.
 */
import { prisma } from '@/lib/prisma'

export interface UnlockedItemRecord {
  itemKey: string
  /** Floor this item is configured on (matches `currentFloor`). */
  floor: number
}

/**
 * Items configured for the floor the user is currently on. NOT cumulative
 * — each row in floor_items defines what that specific floor "owns",
 * so a user on F5 sees only F5's items, not F1..F5's union.
 *
 * Returns the same `{ itemKey, floor }[]` shape that the old
 * `User.unlockedItems` select produced so downstream consumers
 * (useFloorPolling, the SSE stream, the public /floor/[code] route)
 * don't need their data shape touched.
 */
export async function getUnlockedItemsForFloor(
  currentFloor: number,
): Promise<UnlockedItemRecord[]> {
  const rows = await prisma.floorItem.findMany({
    where: { floorId: currentFloor },
    select: { floorId: true, item: { select: { key: true } } },
    orderBy: { itemId: 'asc' },
  })
  return rows.map(r => ({ itemKey: r.item.key, floor: r.floorId }))
}

/**
 * Floor config (invitesRequired, label, maxTeammates) for a single floor.
 * Returns null when the floor row doesn't exist (e.g. corrupted user
 * data pointing at a deleted floor — should not happen due to FK).
 */
export async function getFloorFromDb(id: number) {
  return prisma.floor.findUnique({
    where: { id },
    select: {
      id: true,
      invitesRequired: true,
      label: true,
      maxTeammates: true,
    },
  })
}
