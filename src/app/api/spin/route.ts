/**
 * GET  /api/spin  → the signed-in user's spin state (tokens, credit,
 *                   daily availability, task completion).
 * POST /api/spin  → consume one token and resolve a spin. Returns the
 *                   server-decided result(s) the client animates to.
 *
 * Auth-gated: anonymous teaser spins live at /api/spin/anon.
 */
import { NextResponse } from 'next/server'
import { readSession } from '@/lib/auth'
import { getSpinState, playSpin } from '@/lib/spin/service'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await readSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const state = await getSpinState(session.userId)
  if (!state) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json(state)
}

export async function POST() {
  const session = await readSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const r = await playSpin(session.userId)
    if (!r.ok) {
      if (r.reason === 'no_tokens') {
        return NextResponse.json({ error: 'No spins available' }, { status: 409 })
      }
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({
      results: r.results,
      tokens: r.tokens,
      creditCents: r.creditCents,
      capReached: r.capReached,
    })
  } catch (err) {
    console.error('[spin]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
