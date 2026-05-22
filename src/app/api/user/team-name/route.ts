/**
 * PATCH /api/user/team-name
 *
 * Persist `User.teamName`. Used by the MySquadDrawer rename action so
 * the team name picked / edited in the UI survives across sessions
 * (signed-in users — anonymous trial users update localStorage).
 *
 * Body: `{ teamName: string }` — trimmed server-side, capped at 60
 * characters (same cap signup uses for `trialTeamName`). Empty
 * strings collapse to `null` so an empty team name renders as
 * "untitled" in the drawer rather than a literal "".
 *
 * Mirrors the pattern in `/api/user/visibility`: requires a session,
 * returns the persisted value so the client can mirror it without a
 * re-fetch.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { readSession } from '@/lib/auth'

export const runtime = 'nodejs'

const MAX_TEAM_NAME_LEN = 60

export async function PATCH(req: NextRequest) {
  const session = await readSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  if (typeof body.teamName !== 'string') {
    return NextResponse.json({ error: 'teamName string required' }, { status: 400 })
  }

  // Trim + cap. Empty after trim → store NULL so the column matches
  // the "no team name" state new accounts have on signup.
  const trimmed = body.teamName.trim().slice(0, MAX_TEAM_NAME_LEN)
  const next: string | null = trimmed.length > 0 ? trimmed : null

  await prisma.user.update({
    where: { id: session.userId },
    data: { teamName: next },
  })

  return NextResponse.json({ success: true, teamName: next })
}
