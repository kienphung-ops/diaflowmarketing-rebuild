/**
 * Leaderboard — top-50 by invite count, with per-user rank.
 *
 * Reads cache from Redis when available (60s TTL); falls back to a
 * direct Postgres query if Redis is missing or unreachable. Cache
 * invalidation is purely time-based — we don't fan out writes on every
 * invite verify, since the leaderboard updates within a minute is fine
 * for a marketing display.
 *
 * Tie-break: when two users have the same `totalInvites`, the one who
 * signed up earlier (`createdAt` ASC) ranks higher.
 */

import { prisma } from '@/lib/prisma'
import { getRedis } from '@/lib/redis'

const CACHE_KEY_TOP50 = 'lb:top50:v1'
const CACHE_KEY_RANK = (userId: string) => `lb:rank:${userId}:v1`
// 60-second TTL is a safety net — under normal flow the cache is
// invalidated immediately when an invite is credited (see
// invalidateLeaderboard, called from authVerify + signup routes). TTL
// catches edge cases (Redis flush, missed invalidate) so the worst-case
// staleness is 60s rather than indefinite.
const CACHE_TTL_SEC = 60

export interface LeaderboardEntry {
  rank: number
  teamName: string | null
  totalInvites: number
  country: string | null
  referralCode: string
}

export async function getTop50(): Promise<LeaderboardEntry[]> {
  const redis = getRedis()
  if (redis) {
    try {
      const cached = await redis.get(CACHE_KEY_TOP50)
      if (cached) return JSON.parse(cached) as LeaderboardEntry[]
    } catch (err) {
      // Redis down — fall through to Postgres.
      console.warn('[leaderboard] redis read miss:', (err as Error).message)
    }
  }

  const users = await prisma.user.findMany({
    orderBy: [
      { totalInvites: 'desc' },
      { createdAt: 'asc' },
    ],
    take: 50,
    select: {
      teamName: true,
      totalInvites: true,
      country: true,
      referralCode: true,
    },
  })

  const entries: LeaderboardEntry[] = users.map((u, i) => ({
    rank: i + 1,
    teamName: u.teamName,
    totalInvites: u.totalInvites,
    country: u.country,
    referralCode: u.referralCode,
  }))

  if (redis) {
    try {
      await redis.set(CACHE_KEY_TOP50, JSON.stringify(entries), 'EX', CACHE_TTL_SEC)
    } catch (err) {
      console.warn('[leaderboard] redis write skipped:', (err as Error).message)
    }
  }

  return entries
}

/**
 * Returns the current user's leaderboard rank (1-indexed) — or null
 * when the user doesn't exist. "Rank" is computed as the count of
 * users strictly ranked higher, plus one. Tie-break on createdAt.
 *
 * Capped at 51+ for callers that only need to know "in top 50 or not":
 * any rank >= 51 is returned as 51. Saves DB work on long tails.
 */
export async function getUserRank(userId: string): Promise<number | null> {
  const redis = getRedis()
  const key = CACHE_KEY_RANK(userId)

  if (redis) {
    try {
      const cached = await redis.get(key)
      if (cached) return parseInt(cached, 10)
    } catch (err) {
      console.warn('[leaderboard] redis rank read miss:', (err as Error).message)
    }
  }

  const me = await prisma.user.findUnique({
    where: { id: userId },
    select: { totalInvites: true, createdAt: true },
  })
  if (!me) return null

  const betterCount = await prisma.user.count({
    where: {
      OR: [
        { totalInvites: { gt: me.totalInvites } },
        { totalInvites: me.totalInvites, createdAt: { lt: me.createdAt } },
      ],
    },
  })
  const rank = Math.min(51, betterCount + 1) // cap at 51 for "50+" display

  if (redis) {
    try {
      await redis.set(key, String(rank), 'EX', CACHE_TTL_SEC)
    } catch (err) {
      console.warn('[leaderboard] redis rank write skipped:', (err as Error).message)
    }
  }

  return rank
}

/**
 * Invalidate cache entries that become stale after an invite event.
 *
 * Callers (signup route, authVerify) should fire this immediately after
 * committing the invite credit so the next /api/leaderboard call sees
 * fresh data without waiting for TTL expiry.
 *
 *   - top50          — always cleared (any rank change can shuffle it)
 *   - rank:<inviter> — inviter's rank changed (totalInvites +1)
 *   - rank:<invitee> — invitee is a brand-new user → no cached row yet,
 *                      but we delete defensively in case it was probed
 *
 * Errors are swallowed — Redis being down must never block an invite
 * from being credited.
 */
export async function invalidateLeaderboard(
  ...userIds: Array<string | null | undefined>
): Promise<void> {
  const redis = getRedis()
  if (!redis) return
  const keys = [CACHE_KEY_TOP50]
  for (const id of userIds) {
    if (id) keys.push(CACHE_KEY_RANK(id))
  }
  try {
    await redis.del(...keys)
  } catch (err) {
    console.warn('[leaderboard] redis del skipped:', (err as Error).message)
  }
}
