/**
 * POST /api/poke/[id]
 *
 * Increment the poke counter for a teammate. Open to all callers —
 * once invite + share URLs were unified, every /floor/<code> page is
 * reachable, so the poke endpoint follows suit. Returns the new
 * total so the client can echo it back immediately without waiting
 * for the next poll.
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const id = params.id
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const teammate = await prisma.recruitedTeammate.findUnique({
    where: { id },
    select: { id: true, userId: true },
  })
  if (!teammate) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Privacy gate dropped — every /floor/<code> URL is reachable now
  // that invite + share are the same link. The owner can also poke
  // their own teammates (just for the visual reaction).

  const updated = await prisma.recruitedTeammate.update({
    where: { id },
    data: { pokes: { increment: 1 } },
    select: { id: true, pokes: true },
  })

  return NextResponse.json({ id: updated.id, pokes: updated.pokes })
}
