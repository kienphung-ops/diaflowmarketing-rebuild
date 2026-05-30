import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { readSession } from '@/lib/auth'
import { resolveRoleDescription } from '@/lib/roleDescription'

type RouteContext = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, ctx: RouteContext) {
  const session = await readSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await ctx.params
  try {
    const body = await req.json().catch(() => ({}))
    const data: { name?: string; role?: string; description?: string | null } = {}
    if (typeof body.name === 'string') data.name = body.name.trim().slice(0, 40)
    if (typeof body.role === 'string') data.role = body.role.trim().slice(0, 60)
    if (!data.name && !data.role) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
    }

    // Verify ownership + reject mutations on the 3 seeded NPCs
    // (Iris/Mia/Leo) — defaults are immutable so the share-floor
    // experience is consistent across users.
    const existing = await prisma.recruitedTeammate.findUnique({
      where: { id },
      select: { userId: true, isDefault: true, role: true },
    })
    if (!existing || existing.userId !== session.userId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    if (existing.isDefault) {
      return NextResponse.json(
        { error: 'Default teammates can\'t be renamed' },
        { status: 403 }
      )
    }

    // If the role text actually changed, re-resolve the description
    // (cache → API). The cache layer makes this near-free for already-
    // seen roles, so renaming a teammate to "CEO" the second time
    // doesn't spend a credit. We compare AFTER trim so "  Assistant "
    // vs "Assistant" doesn't trigger a refetch. A role-unchanged
    // PATCH (e.g. user only renames the teammate) keeps the existing
    // description untouched.
    if (data.role !== undefined && data.role !== existing.role) {
      data.description = await resolveRoleDescription(data.role)
    }

    const updated = await prisma.recruitedTeammate.update({
      where: { id },
      data,
      select: { id: true, name: true, role: true, description: true, createdAt: true },
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
      select: { userId: true, isDefault: true },
    })
    if (!existing || existing.userId !== session.userId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    if (existing.isDefault) {
      return NextResponse.json(
        { error: 'Default teammates can\'t be removed' },
        { status: 403 }
      )
    }
    await prisma.recruitedTeammate.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[recruit:delete]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
