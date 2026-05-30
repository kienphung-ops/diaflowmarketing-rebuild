import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const source = typeof body.source === 'string' ? body.source.trim() : 'unknown'

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Valid email required' }, { status: 400 })
    }

    if (process.env.NODE_ENV !== 'production') {
      console.log(`[capture-email] ${email} (${source})`)
    }

    try {
      await prisma.emailCapture.create({ data: { email, source } })
    } catch (err) {
      // DB unavailable — log only. Waitlist capture is best-effort.
      console.error('[capture-email] db error', err)
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[capture-email]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
