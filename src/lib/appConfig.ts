/**
 * App-wide key/value config store (the `app_config` table).
 *
 * One row per setting; `value` is a JSONB column, so it holds any JSON
 * shape natively (bool, number, string, object, array) — no manual
 * parse/stringify. Use this for feature flags, tunables, copy toggles,
 * etc. — anything you want to flip without a redeploy.
 *
 * Reads are cached in-process for a short TTL so hot paths don't hit the
 * DB on every call; writes bust the cache immediately. Server-only (pulls
 * in Prisma) — never import from a client component.
 *
 *   const enabled = await getAppConfig<boolean>('share_floor_enabled')
 *   const copy    = await getAppConfigOr('hero_copy', { title: 'Build your AI office' })
 *   await setAppConfig('daily_spin_bonus', 2)
 */

import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

/** Well-known config keys. Add new app_config keys here so call sites
 *  share one source of truth (no stringly-typed drift). */
export const LEO_YOUTUBE_ID_KEY = 'leo_youtube_id'

const CACHE_TTL_MS = 60 * 1000

// Whole-table snapshot cache. The config table is tiny, so caching the
// full map (rather than per-key) keeps `getAll` cheap and lets a single
// DB read serve every key lookup within the TTL window.
let cache: { data: Map<string, Prisma.JsonValue>; expiresAt: number } | null = null

async function loadAll(now: number): Promise<Map<string, Prisma.JsonValue>> {
  if (cache && cache.expiresAt > now) return cache.data
  const rows = await prisma.appConfig.findMany({ select: { key: true, value: true } })
  const data = new Map(rows.map(r => [r.key, r.value]))
  cache = { data, expiresAt: now + CACHE_TTL_MS }
  return data
}

/** Parsed JSON value for `key`, or `null` if unset. `T` is unchecked —
 *  it's the caller's contract for what was stored under this key. */
export async function getAppConfig<T = unknown>(key: string): Promise<T | null> {
  const data = await loadAll(Date.now())
  const v = data.get(key)
  return v === undefined ? null : (v as T)
}

/** Parsed JSON value for `key`, or `fallback` when unset. */
export async function getAppConfigOr<T>(key: string, fallback: T): Promise<T> {
  const v = await getAppConfig<T>(key)
  return v === null ? fallback : v
}

/** All config as a plain object (cached). */
export async function getAllAppConfig(): Promise<Record<string, Prisma.JsonValue>> {
  const data = await loadAll(Date.now())
  return Object.fromEntries(data)
}

/**
 * Upsert a single setting. `value` is stored as JSONB verbatim — pass a
 * bool / number / string / object / array directly. Busts the in-process
 * cache so the next read reflects the change immediately.
 */
export async function setAppConfig(key: string, value: Prisma.InputJsonValue): Promise<void> {
  await prisma.appConfig.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  })
  cache = null
}

/** Delete a setting. Busts the cache. */
export async function deleteAppConfig(key: string): Promise<void> {
  await prisma.appConfig.deleteMany({ where: { key } })
  cache = null
}

/** Force the next read to hit the DB (e.g. after an external/admin edit). */
export function invalidateAppConfigCache(): void {
  cache = null
}
