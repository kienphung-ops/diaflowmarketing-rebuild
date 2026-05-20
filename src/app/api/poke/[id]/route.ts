/**
 * POST /api/poke/[id]
 *
 * Increment the poke counter for a teammate. Open to anonymous
 * callers — anyone visiting a shared public floor can poke. We just
 * gate by the teammate's owner being `publicVisible=true` (or the
 * poker being the owner themselves).
 *
 * Returns the new total so the client can echo it back immediately
 * without waiting for the next poll.
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { readSession } from '@/lib/auth'

export const runtime = 'nodejs'

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const id = params.id
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const teammate = await prisma.recruitedTeammate.findUnique({
    where: { id },
    select: {
      id: true,
      userId: true,
      user: { select: { publicVisible: true } },
    },
  })
  if (!teammate) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Permission: either the floor owner is poking (their own scene) OR
  // the floor is public.
  const session = await readSession()
  const isOwner = session?.userId === teammate.userId
  if (!isOwner && !teammate.user.publicVisible) {
    return NextResponse.json({ error: 'This floor is private' }, { status: 403 })
  }

  const updated = await prisma.recruitedTeammate.update({
    where: { id },
    data: { pokes: { increment: 1 } },
    select: { id: true, pokes: true },
  })

  return NextResponse.json({ id: updated.id, pokes: updated.pokes })
}
