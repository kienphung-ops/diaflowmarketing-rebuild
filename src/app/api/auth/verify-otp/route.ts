import { NextRequest, NextResponse } from 'next/server'
import { attachSessionCookie, createSessionJwt } from '@/lib/auth'
import { AuthVerifyError, consumeAuthToken } from '@/lib/authVerify'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const code = typeof body.code === 'string' ? body.code.trim() : ''

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Valid email required' }, { status: 400 })
    }
    if (!/^\d{6}$/.test(code)) {
      return NextResponse.json({ error: 'Code must be 6 digits' }, { status: 400 })
    }

    const result = await consumeAuthToken(code, 'OTP', email)
    const jwt = await createSessionJwt(result.userId)
    const res = NextResponse.json({ success: true })
    attachSessionCookie(res, jwt)
    return res
  } catch (err) {
    if (err instanceof AuthVerifyError) {
      const status = err.message.toLowerCase().includes('expired') ? 410 : 400
      return NextResponse.json({ error: err.message }, { status })
    }
    console.error('[auth/verify-otp]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
