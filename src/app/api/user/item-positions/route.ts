/**
 * GET / PATCH /api/user/item-positions
 *
 * Per-user item position overrides for the "Arrange your room" feature.
 * Shape:
 *
 *   Record<string, [number, number, number]>
 *
 * Keys are either the canonical item key (`couch`, `floor_lamp`) or
 * `${itemKey}_${index}` for multi-instance items
 * (`basic_chair_desk_0`, `_1`, `_2`). The renderer in FloorItems.tsx
 * looks up the per-instance key first, then falls back to the bare
 * key, then to its canonical defaults.
 *
 * Both endpoints require a session — anonymous trial users can't
 * persist arrangements (their state is volatile by definition).
 *
 * Room bounds are enforced server-side as a defence-in-depth measure
 * even though the client-side drag already clamps to these values.
 * Anything outside gets clamped on save rather than rejected so
 * the UX never silently fails.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { readSession } from '@/lib/auth'

export const runtime = 'nodejs'

// Floor extent + a tiny margin. Wall-mounted items sit near z = -5.4
// so the lower-Z bound has to be permissive; the floor planks run
// from z ≈ -5 to z ≈ 6 and x ∈ [-7.15, 7.15].
const X_MIN = -7.5
const X_MAX = 7.5
const Y_MIN = -1.0
const Y_MAX = 5.5
const Z_MIN = -5.6
const Z_MAX = 6.5

type Triple = [number, number, number]
type PositionMap = Record<string, Triple>

function clamp(value: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, value))
}

/** Coerce arbitrary JSON into a clean PositionMap. Drops any entry
 *  that isn't a 3-tuple of finite numbers; clamps the rest to room
 *  bounds. Anything weird from a malicious client just gets pruned. */
function sanitize(input: unknown): PositionMap {
  if (!input || typeof input !== 'object') return {}
  const out: PositionMap = {}
  for (const [rawKey, rawVal] of Object.entries(input as Record<string, unknown>)) {
    // Keys must be short identifier-ish strings to avoid abuse.
    if (typeof rawKey !== 'string' || rawKey.length === 0 || rawKey.length > 64) continue
    if (!Array.isArray(rawVal) || rawVal.length !== 3) continue
    const [x, y, z] = rawVal
    if (
      typeof x !== 'number' || !Number.isFinite(x) ||
      typeof y !== 'number' || !Number.isFinite(y) ||
      typeof z !== 'number' || !Number.isFinite(z)
    ) continue
    out[rawKey] = [
      clamp(x, X_MIN, X_MAX),
      clamp(y, Y_MIN, Y_MAX),
      clamp(z, Z_MIN, Z_MAX),
    ]
  }
  return out
}

export async function GET() {
  const session = await readSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const u = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { itemPositions: true },
  })
  return NextResponse.json({ positions: (u?.itemPositions as PositionMap | null) ?? {} })
}

export async function PATCH(req: NextRequest) {
  const session = await readSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  // Two call patterns are supported:
  //   { positions: {...} }  → REPLACE the whole map
  //   { merge: {...} }      → MERGE into the existing map (lets the
  //                            client save one item at a time without
  //                            shipping the full set every time)
  const replace = body.positions !== undefined
  const merge = body.merge !== undefined
  if (!replace && !merge) {
    return NextResponse.json(
      { error: 'positions or merge required' },
      { status: 400 },
    )
  }

  let next: PositionMap
  if (replace) {
    next = sanitize(body.positions)
  } else {
    const u = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { itemPositions: true },
    })
    const existing = (u?.itemPositions as PositionMap | null) ?? {}
    next = { ...existing, ...sanitize(body.merge) }
  }

  await prisma.user.update({
    where: { id: session.userId },
    data: { itemPositions: next },
  })

  return NextResponse.json({ success: true, positions: next })
}
