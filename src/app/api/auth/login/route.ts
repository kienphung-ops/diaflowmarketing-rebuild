import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { attachSessionCookie, createSessionJwt } from '@/lib/auth'

const MIN_PASSWORD_LEN = 6

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const password = typeof body.password === 'string' ? body.password : ''

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Valid email required' }, { status: 400 })
    }
    if (password.length < MIN_PASSWORD_LEN) {
      return NextResponse.json({ error: 'Wrong password' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      return NextResponse.json({ error: 'No account with that email' }, { status: 404 })
    }
    if (!user.passwordHash) {
      // Legacy magic-link account with no password — refuse login, ask to sign up
      // (which will bind a password if email matches existing). To keep behaviour
      // simple and predictable: explicit "set up password" message.
      return NextResponse.json(
        { error: 'This account has no password yet. Please sign up to set one.' },
        { status: 409 }
      )
    }
    const ok = await bcrypt.compare(password, user.passwordHash)
    if (!ok) {
      return NextResponse.json({ error: 'Wrong password' }, { status: 401 })
    }

    const jwt = await createSessionJwt(user.id)
    const res = NextResponse.json({ success: true })
    attachSessionCookie(res, jwt)
    return res
  } catch (err) {
    console.error('[auth/login]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
