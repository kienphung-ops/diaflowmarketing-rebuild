import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { readSession } from '@/lib/auth'
import { resolveRoleDescription, probeRoleDescription } from '@/lib/roleDescription'

interface Draft {
  name: string
  role: string
}

/**
 * Bulk-create teammates for the signed-in user.
 *
 * The single-add POST `/api/recruit` synchronously waits on the
 * Diaflow API so the user gets an immediately-populated speech
 * bubble. That's a fine trade-off for one teammate (≈1–3 s wait)
 * but rapidly degrades for N teammates added at once — each call
 * costs an upstream credit AND blocks the response for its own
 * 1–3 s round-trip.
 *
 * Bulk-add instead:
 *   1. PROBES the role-description cache for every draft (zero
 *      upstream cost). Cache hits populate `description` immediately.
 *   2. Creates all teammate rows in a single Postgres round-trip
 *      via `createManyAndReturn` — the user sees their team in the
 *      room instantly.
 *   3. For drafts whose role was a cache MISS, fires a fire-and-
 *      forget background task (via `void resolveRoleDescription(...)`)
 *      that calls the upstream API + writes both the cache and the
 *      teammate's `description` once it returns. The user's next
 *      page load picks up the populated value; until then the
 *      speech bubble falls back to a generic line.
 *
 * Concurrent bulk-adds of the SAME role across users share the cache
 * — the second one's probe will hit even if the first one is still
 * waiting on the API. We deliberately don't try to dedupe in-flight
 * requests; the worst case is N parallel API calls for the same role
 * during a tight burst, and the cache makes the next call free.
 */
export async function POST(req: NextRequest) {
  const session = await readSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const body = await req.json().catch(() => ({}))
    if (!Array.isArray(body.drafts) || body.drafts.length === 0) {
      return NextResponse.json({ error: 'drafts[] required' }, { status: 400 })
    }
    // Bound the batch to a sane size so a malicious client can't
    // schedule thousands of upstream API calls in one shot. The
    // BulkAddTeammatesModal caps at the user's available slots
    // (typically ≤ 20) anyway.
    const raw = body.drafts as unknown[]
    if (raw.length > 25) {
      return NextResponse.json({ error: 'Too many drafts (max 25)' }, { status: 400 })
    }
    const drafts: Draft[] = []
    for (const d of raw) {
      if (!d || typeof d !== 'object') continue
      const obj = d as Record<string, unknown>
      const name = typeof obj.name === 'string' ? obj.name.trim().slice(0, 40) : ''
      const role = typeof obj.role === 'string'
        ? obj.role.trim().slice(0, 60)
        : 'Operations Assistant'
      if (!name) continue
      drafts.push({ name, role })
    }
    if (drafts.length === 0) {
      return NextResponse.json({ error: 'No valid drafts' }, { status: 400 })
    }

    // ── 1. Cache probe (free) ───────────────────────────────────
    // Map role → cached description so we only probe once per
    // unique role even if the user added 5 "Assistant"s in a row.
    const uniqueRoles = Array.from(new Set(drafts.map(d => d.role)))
    const cacheHits = new Map<string, string | null>()
    await Promise.all(
      uniqueRoles.map(async role => {
        cacheHits.set(role, await probeRoleDescription(role))
      }),
    )

    // ── 2. Bulk insert with whatever descriptions we already have ─
    // Prisma's createManyAndReturn isn't available on all adapters;
    // fall back to a transaction of individual creates so the rows
    // come back with their generated ids. The user's bulk add is
    // bounded to ≤25 so this round-trip cost stays small.
    const created = await prisma.$transaction(
      drafts.map(d =>
        prisma.recruitedTeammate.create({
          data: {
            userId: session.userId,
            name: d.name,
            role: d.role,
            description: cacheHits.get(d.role) ?? null,
          },
          select: { id: true, name: true, role: true, description: true, createdAt: true },
        }),
      ),
    )

    // ── 3. Fire-and-forget API fetch for cache-miss roles ───────
    // We DON'T await this. The serverless function will keep the
    // node alive for these promises via `waitUntil` semantics on
    // Vercel (best-effort — if the platform aborts early the work
    // resumes on the next user action that PATCHes the row).
    const missingRoles = uniqueRoles.filter(role => cacheHits.get(role) == null)
    if (missingRoles.length > 0) {
      void backfillDescriptions(missingRoles, session.userId)
    }

    return NextResponse.json({ teammates: created })
  } catch (err) {
    console.error('[recruit:bulk]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * Background task — for each role that missed the cache, call the
 * upstream Diaflow API (which `resolveRoleDescription` does, with a
 * cache write on success), then patch every teammate of this user
 * with that role so the bubble copy lights up.
 *
 * `void`-called from POST above so the response can return without
 * waiting on these. Errors are swallowed — the next role-edit will
 * retry the lookup.
 */
async function backfillDescriptions(roles: string[], userId: string): Promise<void> {
  for (const role of roles) {
    try {
      const description = await resolveRoleDescription(role)
      if (!description) continue
      // Patch every teammate of this user that still has description=null
      // for this role. updateMany doesn't return ids — the user picks
      // them up on the next SSE snapshot / page refresh.
      await prisma.recruitedTeammate.updateMany({
        where: { userId, role, description: null },
        data: { description },
      })
    } catch (err) {
      console.warn('[recruit:bulk:backfill] role failed:', role, err)
    }
  }
}
