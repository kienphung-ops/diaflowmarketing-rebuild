import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { readSession } from '@/lib/auth'

export async function GET() {
  const session = await readSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      email: true,
      emailVerified: true,
      referralCode: true,
      totalInvites: true,
      currentFloor: true,
      unlockedItems: { select: { itemKey: true, floor: true, unlockedAt: true } },
    },
  })

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return NextResponse.json(user)
}
