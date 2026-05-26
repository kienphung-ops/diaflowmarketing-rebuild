import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { readSession } from '@/lib/auth'
import { resolveRoleDescription } from '@/lib/roleDescription'

export async function GET() {
  const session = await readSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const teammates = await prisma.recruitedTeammate.findMany({
    where: { userId: session.userId },
    select: { id: true, name: true, role: true, description: true, createdAt: true },
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

    // Synchronously resolve the role description (cache → API). Single
    // add is interactive — the user just clicked Save and is waiting
    // for the speech bubble to be ready, so blocking on the upstream
    // call (≈1–3s typical) gives a noticeably nicer experience than
    // a "loading bubble" UI. Bulk add uses the /api/recruit/bulk
    // endpoint instead, which fires this off in the background.
    //
    // `resolveRoleDescription` never throws and returns null on any
    // failure — the teammate row is still created with description=null
    // in that case so the user isn't blocked by an upstream outage.
    const description = await resolveRoleDescription(role)

    const created = await prisma.recruitedTeammate.create({
      data: { userId: session.userId, name, role, description },
      select: { id: true, name: true, role: true, description: true, createdAt: true },
    })
    return NextResponse.json({ teammate: created })
  } catch (err) {
    console.error('[recruit]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
