/**
 * "The Wall" (/wall) — public community stats surface.
 *
 * Each section of the page has its own API route (so the client fetches
 * them independently rather than blocking SSR). The heavy DB reads are
 * funnelled through here behind a short Redis cache (graceful Postgres
 * fallback when Redis is down — mirrors lib/leaderboard.ts). A marketing
 * wall doesn't need second-fresh numbers, so a ~2-minute TTL keeps the
 * DB load near zero even under a traffic spike.
 *
 * "Who's building" (the role/teamPurpose breakdown) is NOT computed here
 * — it's a curated ratio the team refreshes daily with AI and stores in
 * the `app_config` table (key `wall_role_breakdown`). See
 * /api/wall/roles (read) + /api/wall/team-purposes (raw export for the
 * AI step).
 */

import { prisma } from '@/lib/prisma'
import { getRedis } from '@/lib/redis'

/** app_config key holding the curated "Who's building" ratio. */
export const WALL_ROLES_KEY = 'wall_role_breakdown'

/** "Reached Level N" milestone shown in the hero stats. */
const MILESTONE_LEVEL = 3
const WEEK_MS = 7 * 24 * 60 * 60 * 1000

// Cache keys + TTL. Bump the `:vN` suffix if a payload shape changes so
// stale JSON from an old deploy is never deserialised into the new type.
const TTL_SEC = 120
const KEY_STATS = 'wall:stats:v1'
const KEY_BOARD = 'wall:board:v1'
const KEY_POKED = 'wall:poked:v1'

/** Redis-backed memoiser: return cached JSON when present, else compute,
 *  cache (best-effort) and return. Redis errors degrade to a direct
 *  compute so the wall never hard-fails on a cache outage. */
async function cached<T>(key: string, ttlSec: number, compute: () => Promise<T>): Promise<T> {
  const redis = getRedis()
  if (redis) {
    try {
      const hit = await redis.get(key)
      if (hit) return JSON.parse(hit) as T
    } catch (err) {
      console.warn('[wall] redis read miss:', (err as Error).message)
    }
  }
  const fresh = await compute()
  if (redis) {
    try {
      await redis.set(key, JSON.stringify(fresh), 'EX', ttlSec)
    } catch (err) {
      console.warn('[wall] redis write skipped:', (err as Error).message)
    }
  }
  return fresh
}

export interface WallStats {
  /** Total registered users. */
  teamsBuilding: number
  /** Total rows in recruited_teammates (per spec: every teammate ever
   *  created, including the 3 default NPCs each office starts with). To
   *  count only user-hired teammates instead, add `where: { isDefault:
   *  false }` to the count below. */
  teammatesHired: number
  /** Users who signed up in the last 7 days. */
  joinedThisWeek: number
  /** Users whose current level is ≥ 3 (free-beta milestone). */
  reachedLevel3: number
}

export async function getWallStats(): Promise<WallStats> {
  return cached(KEY_STATS, TTL_SEC, async () => {
    const weekAgo = new Date(Date.now() - WEEK_MS)
    const [teamsBuilding, teammatesHired, joinedThisWeek, reachedLevel3] = await Promise.all([
      prisma.user.count(),
      prisma.recruitedTeammate.count(),
      prisma.user.count({ where: { createdAt: { gte: weekAgo } } }),
      prisma.user.count({ where: { currentFloor: { gte: MILESTONE_LEVEL } } }),
    ])
    return { teamsBuilding, teammatesHired, joinedThisWeek, reachedLevel3 }
  })
}

export interface WallLeaderEntry {
  rank: number
  teamName: string | null
  /** User's current level (currentFloor). */
  level: number
  /** What the office does — teamPurpose, falling back to the AI-suggested
   *  role, then null. Shown as the sub-line under the office name. */
  role: string | null
  referralCode: string
}

/** Top 50 offices by invite count (tie-break: earlier signup ranks
 *  higher) — the same ordering as the main leaderboard, but the wall
 *  needs level + role per row so it gets its own query + cache key. */
export async function getWallLeaderboard(): Promise<WallLeaderEntry[]> {
  return cached(KEY_BOARD, TTL_SEC, async () => {
    const users = await prisma.user.findMany({
      orderBy: [{ totalInvites: 'desc' }, { createdAt: 'asc' }],
      take: 50,
      select: {
        teamName: true,
        currentFloor: true,
        teamPurpose: true,
        recommendedRole: true,
        referralCode: true,
      },
    })
    return users.map((u, i) => ({
      rank: i + 1,
      teamName: u.teamName,
      level: u.currentFloor,
      role: u.teamPurpose ?? u.recommendedRole ?? null,
      referralCode: u.referralCode,
    }))
  })
}

export interface WallViewerEntry {
  teamName: string | null
  level: number
  role: string | null
  referralCode: string
}

/** The signed-in viewer's own office row, for the "50+" footer line when
 *  they're outside the top 50. Per-user, so it's NOT cached (the shared
 *  top-50 cache must not carry one user's row to everyone). Cheap single
 *  lookup. Returns null when the user no longer exists. */
export async function getWallViewerEntry(userId: string): Promise<WallViewerEntry | null> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      teamName: true,
      currentFloor: true,
      teamPurpose: true,
      recommendedRole: true,
      referralCode: true,
    },
  })
  if (!u) return null
  return {
    teamName: u.teamName,
    level: u.currentFloor,
    role: u.teamPurpose ?? u.recommendedRole ?? null,
    referralCode: u.referralCode,
  }
}

export interface WallPokedEntry {
  teamName: string | null
  pokes: number
}

/** Top 5 offices by total pokes received across all their teammates.
 *  Pokes live per-RecruitedTeammate, so we sum by userId then resolve
 *  team names. Offices with zero pokes are excluded. */
export async function getWallMostPoked(): Promise<WallPokedEntry[]> {
  return cached(KEY_POKED, TTL_SEC, async () => {
    const grouped = await prisma.recruitedTeammate.groupBy({
      by: ['userId'],
      _sum: { pokes: true },
      orderBy: { _sum: { pokes: 'desc' } },
      take: 5,
    })

    const ranked = grouped
      .map(g => ({ userId: g.userId, pokes: g._sum.pokes ?? 0 }))
      .filter(g => g.pokes > 0)

    if (ranked.length === 0) return []

    const users = await prisma.user.findMany({
      where: { id: { in: ranked.map(r => r.userId) } },
      select: { id: true, teamName: true },
    })
    const nameById = new Map(users.map(u => [u.id, u.teamName]))

    return ranked.map(r => ({ teamName: nameById.get(r.userId) ?? null, pokes: r.pokes }))
  })
}

/** Bust the wall caches (e.g. after a manual data correction). Time-based
 *  expiry already keeps staleness ≤ TTL, so this is just for "refresh
 *  now". Safe no-op when Redis is absent. */
export async function invalidateWallCache(): Promise<void> {
  const redis = getRedis()
  if (!redis) return
  try {
    await redis.del(KEY_STATS, KEY_BOARD, KEY_POKED)
  } catch (err) {
    console.warn('[wall] redis del skipped:', (err as Error).message)
  }
}
