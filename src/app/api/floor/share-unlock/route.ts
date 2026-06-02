/**
 * POST /api/floor/share-unlock  { source }
 *
 * Credits a share action toward a SHARE-gated floor (e.g. F2). Used by the
 * Copy-invite buttons — copying the link counts as a share for unlocking
 * the floor, but (unlike the X / LinkedIn spin tasks) grants no spin token.
 *
 * Server enforces the rule: it only saves the task + advances the user
 * when the NEXT floor actually requires a share (see creditShareUnlock).
 * X / LinkedIn keep going through /api/spin/task (they also pay a spin).
 */
import { NextRequest, NextResponse } from 'next/server'
import { readSession } from '@/lib/auth'
import { creditShareUnlock, type ShareSource } from '@/lib/floorProgress'

export const dynamic = 'force-dynamic'

const VALID_SOURCES: ShareSource[] = ['x', 'linkedin', 'copy']

export async function POST(req: NextRequest) {
  const session = await readSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json().catch(() => ({}))
    const source = VALID_SOURCES.includes(body.source) ? (body.source as ShareSource) : 'copy'
    const result = await creditShareUnlock(session.userId, source)
    return NextResponse.json(result)
  } catch (err) {
    console.error('[floor/share-unlock]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
