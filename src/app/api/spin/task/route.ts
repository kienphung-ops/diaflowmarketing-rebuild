/**
 * POST /api/spin/task  { taskKey } — mark a one-time task complete and
 * grant +1 spin. The 3-second share-dialog dwell is enforced client-side
 * (honor system per V1 scope); this route enforces the one-per-user
 * guarantee via the TaskCompletion unique constraint.
 */
import { NextRequest, NextResponse } from 'next/server'
import { readSession } from '@/lib/auth'
import { completeSpinTask } from '@/lib/spin/service'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const session = await readSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json().catch(() => ({}))
    const taskKey = typeof body.taskKey === 'string' ? body.taskKey : ''

    const r = await completeSpinTask(session.userId, taskKey)
    if (!r.ok) {
      if (r.reason === 'invalid_task') {
        return NextResponse.json({ error: 'Unknown task' }, { status: 400 })
      }
      return NextResponse.json({ error: 'Task already completed' }, { status: 409 })
    }
    return NextResponse.json({ tokens: r.tokens })
  } catch (err) {
    console.error('[spin/task]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
