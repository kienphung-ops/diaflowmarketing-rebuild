/**
 * POST /api/spin/daily — claim the once-per-20h daily spin token.
 */
import { NextResponse } from 'next/server'
import { readSession } from '@/lib/auth'
import { claimDailySpin } from '@/lib/spin/service'

export const dynamic = 'force-dynamic'

export async function POST() {
  const session = await readSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const r = await claimDailySpin(session.userId)
    if (!r.ok) {
      if (r.reason === 'cooldown') {
        return NextResponse.json(
          { error: 'Daily spin not ready yet', nextClaimAt: r.nextClaimAt },
          { status: 409 },
        )
      }
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ tokens: r.tokens })
  } catch (err) {
    console.error('[spin/daily]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
