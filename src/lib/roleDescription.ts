/**
 * Role → description cache layer.
 *
 * Wraps the Diaflow process API (`fetchRoleTaskDescription`) with a
 * Postgres-backed cache keyed by the lowercased role string. Two
 * teammates with the same role share one cached row, so the upstream
 * API gets billed once per unique role across the entire user base.
 *
 * Lifecycle:
 *   1. `resolveRoleDescription(role)` first probes `role_descriptions`
 *      for an existing row. Cache HIT → return that row's description.
 *   2. Cache MISS → call `fetchRoleTaskDescription(role)`. On success,
 *      `upsert` the row and return the description.
 *   3. API failure / null description → return `null` and skip the
 *      write. The next call will retry, which is fine because the
 *      cache is best-effort UX, not a correctness guarantee.
 *
 * The helper NEVER throws — failures map to `null` so the caller can
 * proceed without the bubble copy.
 *
 * Concurrent calls for the same role race: two parallel cache MISSes
 * each fire one API call, then both `upsert` the same row. The second
 * upsert no-ops at the SQL level. This is fine because the API
 * call is idempotent and the cost is bounded by the bulk-add size,
 * not by global concurrency.
 */

import { prisma } from './prisma'
import { fetchRoleTaskDescription } from './diaflowRoleApi'

/** Canonicalise a role string for use as the cache key. */
function cacheKey(role: string): string {
  return role.trim().toLowerCase()
}

/**
 * Look up — or fetch + cache — the description for `role`.
 * Returns `null` if the role is empty OR if the API failed.
 */
export async function resolveRoleDescription(role: string): Promise<string | null> {
  const key = cacheKey(role)
  if (!key) return null

  // ── 1. Cache probe ─────────────────────────────────────────────
  try {
    const hit = await prisma.roleDescription.findUnique({
      where: { role: key },
      select: { description: true },
    })
    if (hit) return hit.description
  } catch (err) {
    // Soft-fail: if the cache read errors we still try the API. A
    // single failed read shouldn't block the recruit flow.
    console.warn('[roleDescription] cache read error:', err)
  }

  // ── 2. API fetch ───────────────────────────────────────────────
  const result = await fetchRoleTaskDescription(role)
  if (!result.success || !result.description) {
    return null
  }
  const description = result.description

  // ── 3. Cache write (best effort) ───────────────────────────────
  try {
    await prisma.roleDescription.upsert({
      where: { role: key },
      // displayRole captures the original casing of the FIRST role
      // text we saw — handy for analytics. We don't overwrite it on
      // subsequent hits even though `update: { ... }` could; the
      // cached description doesn't change, and the displayRole
      // doesn't really need versioning.
      create: { role: key, displayRole: role.trim(), description },
      update: { description },
    })
  } catch (err) {
    console.warn('[roleDescription] cache write error:', err)
  }

  return description
}

/**
 * Synchronous cache probe — for callers that want to avoid an API
 * round-trip when no cached row exists (e.g. bulk-add returning
 * immediately and queueing the API work for a background tick).
 *
 * Returns `null` on miss OR error. Never throws.
 */
export async function probeRoleDescription(role: string): Promise<string | null> {
  const key = cacheKey(role)
  if (!key) return null
  try {
    const hit = await prisma.roleDescription.findUnique({
      where: { role: key },
      select: { description: true },
    })
    return hit?.description ?? null
  } catch (err) {
    console.warn('[roleDescription] probe error:', err)
    return null
  }
}
