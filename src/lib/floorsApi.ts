/**
 * Server-side floor catalogue with multi-tier caching.
 *
 * Hot path order:
 *   1. In-process memo (per Node worker, 1-hour TTL) — sub-microsecond.
 *   2. Redis (shared across all workers, 1-hour TTL) — single round-trip.
 *   3. Postgres (Prisma) — single SELECT with join.
 *
 * Floor + item config rarely changes (it's seeded via prisma/seed.mjs and
 * tweaked manually). The aggressive 1-hour cache means a typical workload
 * makes ~1 DB read per worker per hour. Admins editing the catalogue
 * should call `invalidateFloorsConfig()` to force a refresh; otherwise
 * stale data clears within ~1 hour.
 *
 * IMPORTANT: do not import this file from client components — it pulls in
 * Prisma + ioredis. Use `lib/floorsConfigClient.ts` on the client.
 */

import { prisma } from '@/lib/prisma'
import { getRedis } from '@/lib/redis'
import type { FloorConfigEntry } from '@/lib/floorsConfigTypes'

export type { FloorConfigEntry, FloorItemConfig } from '@/lib/floorsConfigTypes'

const CACHE_KEY = 'floors:v1:all'
// Redis still holds for an hour — admins call `invalidateFloorsConfig()`
// to force a refresh after edits, so most reads are bursts inside that
// window. The in-process memo is intentionally MUCH shorter (60 s) so
// a manual DB tweak via `npx prisma db seed` propagates within a
// minute even if `invalidateFloorsConfig()` wasn't called.
const REDIS_TTL_SECONDS = 60 * 60
const PROCESS_TTL_MS = 60 * 1000

let processCache: { data: FloorConfigEntry[]; expiresAt: number } | null = null

/**
 * Returns the full floor catalogue (all 20 floors with their items +
 * quantities). Cached aggressively — see file-header.
 */
export async function getAllFloorsConfig(): Promise<FloorConfigEntry[]> {
  const now = Date.now()
  if (processCache && processCache.expiresAt > now) return processCache.data

  const redis = getRedis()
  if (redis) {
    try {
      const cached = await redis.get(CACHE_KEY)
      if (cached) {
        const data = JSON.parse(cached) as FloorConfigEntry[]
        processCache = { data, expiresAt: now + PROCESS_TTL_MS }
        return data
      }
    } catch (err) {
      console.warn('[floorsApi] redis read failed:', err)
    }
  }

  const rows = await prisma.floor.findMany({
    orderBy: { id: 'asc' },
    select: {
      id: true,
      invitesRequired: true,
      label: true,
      maxTeammates: true,
      product_reward: true,
      unlock_items: true,
      items: {
        select: {
          quantity: true,
          item: { select: { key: true, label: true } },
        },
        orderBy: { itemId: 'asc' },
      },
    },
  })

  const data: FloorConfigEntry[] = rows.map(f => ({
    id: f.id,
    invitesRequired: f.invitesRequired,
    label: f.label,
    maxTeammates: f.maxTeammates,
    productReward: f.product_reward,
    unlockItems: f.unlock_items,
    items: f.items.map(it => ({
      key: it.item.key,
      label: it.item.label,
      quantity: it.quantity,
    })),
  }))

  if (redis) {
    try {
      await redis.set(CACHE_KEY, JSON.stringify(data), 'EX', REDIS_TTL_SECONDS)
    } catch (err) {
      console.warn('[floorsApi] redis write failed:', err)
    }
  }
  processCache = { data, expiresAt: now + PROCESS_TTL_MS }
  return data
}

/** Single floor by id — convenience wrapper over getAllFloorsConfig. */
export async function getFloorConfigById(id: number): Promise<FloorConfigEntry | null> {
  const all = await getAllFloorsConfig()
  return all.find(f => f.id === id) ?? null
}

/**
 * Bust both caches. Call after any admin edit to Floor / Item / FloorItem
 * so the next request re-reads from Postgres.
 */
export async function invalidateFloorsConfig(): Promise<void> {
  processCache = null
  const redis = getRedis()
  if (redis) {
    try {
      await redis.del(CACHE_KEY)
    } catch (err) {
      console.warn('[floorsApi] redis del failed:', err)
    }
  }
}

/**
 * Item keys configured for the user's current floor. PER-FLOOR (not
 * cumulative) — the floor_items table directly defines what each floor
 * "owns" and the renderer trusts that authoritative list.
 */
export async function getUnlockedItemKeysFromConfig(
  currentFloor: number,
): Promise<string[]> {
  const all = await getAllFloorsConfig()
  const f = all.find(x => x.id === currentFloor)
  if (!f) return []
  return f.items.map(it => it.key)
}
