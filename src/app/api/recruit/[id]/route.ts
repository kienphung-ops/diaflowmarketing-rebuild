import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { readSession } from '@/lib/auth'

type RouteContext = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, ctx: RouteContext) {
  const session = await readSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await ctx.params
  try {
    const body = await req.json().catch(() => ({}))
    const data: { name?: string; role?: string } = {}
    if (typeof body.name === 'string') data.name = body.name.trim().slice(0, 40)
    if (typeof body.role === 'string') data.role = body.role.trim().slice(0, 60)
    if (!data.name && !data.role) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
    }

    // Verify ownership.
    const existing = await prisma.recruitedTeammate.findUnique({
      where: { id },
      select: { userId: true },
    })
    if (!existing || existing.userId !== session.userId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const updated = await prisma.recruitedTeammate.update({
      where: { id },
      data,
      select: { id: true, name: true, role: true, createdAt: true },
    })
    return NextResponse.json({ teammate: updated })
  } catch (err) {
    console.error('[recruit:patch]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  const session = await readSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await ctx.params
  try {
    const existing = await prisma.recruitedTeammate.findUnique({
      where: { id },
      select: { userId: true },
    })
    if (!existing || existing.userId !== session.userId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    await prisma.recruitedTeammate.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[recruit:delete]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
