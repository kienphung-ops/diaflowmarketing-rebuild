/**
 * POST /api/auth/password-reset/verify
 *
 * Body: { token: string, newPassword: string }
 *
 * Consumes a PASSWORD_RESET token (one-time-use) and updates the
 * user's passwordHash. On success, the response sets the session
 * cookie so the user is logged in immediately — saving an extra
 * "sign in with new password" step.
 */

import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import {
  attachSessionCookie,
  createSessionJwt,
  hashToken,
} from '@/lib/auth'
import { TOKEN_TYPES } from '@/lib/authToken'

export const runtime = 'nodejs'

const BCRYPT_ROUNDS = 10
const MIN_PASSWORD_LEN = 6

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const token = typeof body.token === 'string' ? body.token : ''
    const newPassword = typeof body.newPassword === 'string' ? body.newPassword : ''

    if (!token) {
      return NextResponse.json({ error: 'Missing token' }, { status: 400 })
    }
    if (newPassword.length < MIN_PASSWORD_LEN) {
      return NextResponse.json(
        { error: `Password must be at least ${MIN_PASSWORD_LEN} characters` },
        { status: 400 }
      )
    }

    const tokenHash = hashToken(token)
    const tokenRow = await prisma.authToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    })

    if (!tokenRow || tokenRow.type !== TOKEN_TYPES.PASSWORD_RESET) {
      return NextResponse.json({ error: 'Invalid reset link' }, { status: 400 })
    }
    if (tokenRow.usedAt) {
      return NextResponse.json({ error: 'Reset link already used' }, { status: 400 })
    }
    if (tokenRow.expiresAt < new Date()) {
      return NextResponse.json({ error: 'Reset link expired — request a new one' }, { status: 400 })
    }

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS)

    await prisma.$transaction([
      prisma.authToken.update({
        where: { id: tokenRow.id },
        data: { usedAt: new Date() },
      }),
      prisma.user.update({
        where: { id: tokenRow.userId },
        data: { passwordHash },
      }),
    ])

    // Auto-login so the user doesn't have to re-enter the password
    // they just chose.
    const jwt = await createSessionJwt(tokenRow.userId)
    const res = NextResponse.json({ success: true })
    attachSessionCookie(res, jwt)
    return res
  } catch (err) {
    console.error('[auth/password-reset/verify]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
