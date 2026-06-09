import { NextRequest, NextResponse } from 'next/server'
import { getAppConfig, setAppConfig } from '@/lib/appConfig'
import { WALL_ROLES_KEY } from '@/lib/wall'
import { requireApiKey } from '@/lib/apiKey'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * "Who's building" — the role/teamPurpose ratio shown on /wall.
 *
 * This is NOT computed from the DB on the fly. The team refreshes it
 * daily: export the raw purposes via GET /api/wall/team-purposes, run
 * them through AI to get clean buckets + percentages, then PUT the
 * result here. It's persisted in app_config (key `wall_role_breakdown`).
 *
 * Stored shape (also the GET/PUT body shape):
 *   { roles: [{ name: string, pct: number }], updatedAt?: string }
 *
 *   - GET  → public read for the page (returns { roles, updatedAt }).
 *   - PUT  → x-api-key protected write (you / your cron job).
 */

// `type` (not `interface`) so the payload is structurally assignable to
// Prisma.InputJsonValue when written via setAppConfig — interfaces lack
// the implicit index signature Prisma's JSON type requires.
type RoleSlice = {
  name: string
  pct: number
}
type RoleBreakdown = {
  roles: RoleSlice[]
  updatedAt: string
}

export async function GET() {
  const stored = await getAppConfig<RoleBreakdown>(WALL_ROLES_KEY)
  const roles = Array.isArray(stored?.roles) ? stored!.roles : []
  return NextResponse.json(
    { roles, updatedAt: stored?.updatedAt ?? null },
    { headers: { 'cache-control': 'public, max-age=300' } },
  )
}

export async function PUT(req: NextRequest) {
  const denied = requireApiKey(req)
  if (denied) return denied

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // Accept either { roles: [...] } or a bare [...] array for convenience.
  const rawRoles = Array.isArray(body)
    ? body
    : (body as { roles?: unknown })?.roles
  if (!Array.isArray(rawRoles)) {
    return NextResponse.json(
      { error: 'Body must be an array of { name, pct } or { roles: [...] }' },
      { status: 400 },
    )
  }

  // Normalise + validate each slice. Drops malformed entries rather than
  // failing the whole write, but rejects if nothing valid remains.
  const roles: RoleSlice[] = rawRoles
    .map((r): RoleSlice | null => {
      const name = typeof (r as RoleSlice)?.name === 'string' ? (r as RoleSlice).name.trim() : ''
      const pctNum = Number((r as RoleSlice)?.pct)
      if (!name || !Number.isFinite(pctNum)) return null
      return { name, pct: Math.max(0, Math.round(pctNum)) }
    })
    .filter((r): r is RoleSlice => r !== null)

  if (roles.length === 0) {
    return NextResponse.json({ error: 'No valid { name, pct } entries' }, { status: 400 })
  }

  const payload: RoleBreakdown = { roles, updatedAt: new Date().toISOString() }
  await setAppConfig(WALL_ROLES_KEY, payload)

  return NextResponse.json({ ok: true, ...payload }, { headers: { 'cache-control': 'no-store' } })
}
