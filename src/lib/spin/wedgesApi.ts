/**
 * Spin wedge catalogue — server-side multi-tier cache.
 *
 * Reads only — admins edit via Prisma Studio / SQL / `npx prisma db seed`
 * and the next request picks up the new rows within ~60 s (or call
 * `invalidateSpinWedges()` to bust immediately).
 *
 * Hot path:
 *   1. In-process memo (per Node worker, 60 s TTL).
 *   2. Redis (shared across workers, 60 s TTL).
 *   3. Postgres (Prisma) — single SELECT, ~20 rows worst case.
 *
 * Mirrors `lib/floorsApi.ts` deliberately — same caching contract, same
 * `invalidate*` shape — so the two admin-tunable catalogues behave
 * identically from the API surface up.
 *
 * IMPORTANT: do not import from client components — pulls in Prisma +
 * ioredis. Client code receives the wedges through the spin API
 * response payload.
 */

import { prisma } from '@/lib/prisma'
import { getRedis } from '@/lib/redis'

/** Shape returned to API callers + the picker. Mirrors SpinWedge minus
 *  the audit timestamps the wheel doesn't care about. */
export interface SpinWedgeConfig {
  key: string
  label: string
  /** Reward category. V1: "credit" | "spin". Future types are valid
   *  as long as both the picker and outcome resolver learn them. */
  type: string
  /** Generic reward amount, interpreted per `type`. */
  amount: number
  /** Default pick weight — used for every spin AFTER the first.
   *  Normalised at pick time, so any positive integer is valid. */
  weight: number
  /** First-spin override weight. When `null`, the picker falls back
   *  to `weight`. Applied to every anon teaser + the very first
   *  authenticated spin (no prior SpinResult rows for the user). */
  firstWeight: number | null
  /** Hex fill for the SVG wedge segment. */
  color: string
  /** Visual position on the wheel (0-based, clockwise from 12 o'clock). */
  sortOrder: number
}

const CACHE_KEY = 'spin:wedges:v1'
const REDIS_TTL_SECONDS = 60
const PROCESS_TTL_MS = 60 * 1000

let processCache: { data: SpinWedgeConfig[]; expiresAt: number } | null = null

/**
 * Returns the enabled wedge set, sorted by sortOrder. Disabled wedges
 * are silently dropped here so the picker never sees them — keeping a
 * wedge in the DB but `enabled=false` is the soft-retire path that
 * preserves historical ledger joins.
 */
export async function getSpinWedges(): Promise<SpinWedgeConfig[]> {
  const now = Date.now()
  if (processCache && processCache.expiresAt > now) return processCache.data

  const redis = getRedis()
  if (redis) {
    try {
      const cached = await redis.get(CACHE_KEY)
      if (cached) {
        const data = JSON.parse(cached) as SpinWedgeConfig[]
        processCache = { data, expiresAt: now + PROCESS_TTL_MS }
        return data
      }
    } catch (err) {
      console.warn('[wedgesApi] redis read failed:', err)
    }
  }

  const rows = await prisma.spinWedge.findMany({
    where: { enabled: true },
    orderBy: { sortOrder: 'asc' },
    select: {
      key: true,
      label: true,
      type: true,
      amount: true,
      weight: true,
      firstWeight: true,
      color: true,
      sortOrder: true,
    },
  })

  if (redis) {
    try {
      await redis.set(CACHE_KEY, JSON.stringify(rows), 'EX', REDIS_TTL_SECONDS)
    } catch (err) {
      console.warn('[wedgesApi] redis write failed:', err)
    }
  }
  processCache = { data: rows, expiresAt: now + PROCESS_TTL_MS }
  return rows
}

/** Bust both cache tiers — call after any admin write to spin_wedges. */
export async function invalidateSpinWedges(): Promise<void> {
  processCache = null
  const redis = getRedis()
  if (redis) {
    try {
      await redis.del(CACHE_KEY)
    } catch (err) {
      console.warn('[wedgesApi] redis del failed:', err)
    }
  }
}

// ── Pure helpers (no I/O) ───────────────────────────────────────────

/** Find a wedge by key. Throws if missing — the caller has already
 *  validated the key against the same wedge list. */
export function wedgeByKey(wedges: SpinWedgeConfig[], key: string): SpinWedgeConfig {
  const w = wedges.find(x => x.key === key)
  if (!w) throw new Error(`[wedgesApi] unknown wedge key: ${key}`)
  return w
}

/** True when this wedge resolves to "an extra spin" (the re-spin
 *  outcome). Driven by the `type` field so future wedge keys with the
 *  same intent (e.g. `bonus_spin`) need no code change. */
export function isRespinWedge(w: SpinWedgeConfig): boolean {
  return w.type === 'spin'
}

/** Cash credit (in cents) that this wedge would add at face value, or
 *  0 for non-credit wedges. Cap logic is applied separately. */
export function creditCentsForWedge(w: SpinWedgeConfig): number {
  return w.type === 'credit' ? w.amount : 0
}
