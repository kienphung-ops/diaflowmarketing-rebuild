/**
 * PATCH /api/user/visibility
 *
 * Toggles `User.publicVisible`. Body: { publicVisible: boolean }.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { readSession } from '@/lib/auth'

export const runtime = 'nodejs'

export async function PATCH(req: NextRequest) {
  const session = await readSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const next = typeof body.publicVisible === 'boolean' ? body.publicVisible : null
  if (next === null) {
    return NextResponse.json({ error: 'publicVisible boolean required' }, { status: 400 })
  }

  await prisma.user.update({
    where: { id: session.userId },
    data: { publicVisible: next },
  })

  return NextResponse.json({ success: true, publicVisible: next })
}
