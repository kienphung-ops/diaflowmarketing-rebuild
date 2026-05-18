import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { readSession } from '@/lib/auth'

export async function GET() {
  const session = await readSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const teammates = await prisma.recruitedTeammate.findMany({
    where: { userId: session.userId },
    select: { id: true, name: true, role: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  })
  return NextResponse.json({ teammates })
}

export async function POST(req: NextRequest) {
  const session = await readSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const body = await req.json().catch(() => ({}))
    const name = typeof body.name === 'string' ? body.name.trim().slice(0, 40) : ''
    const role = typeof body.role === 'string' ? body.role.trim().slice(0, 60) : 'Operations Assistant'
    if (!name) {
      return NextResponse.json({ error: 'Name required' }, { status: 400 })
    }
    const created = await prisma.recruitedTeammate.create({
      data: { userId: session.userId, name, role },
      select: { id: true, name: true, role: true, createdAt: true },
    })
    return NextResponse.json({ teammate: created })
  } catch (err) {
    console.error('[recruit]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
