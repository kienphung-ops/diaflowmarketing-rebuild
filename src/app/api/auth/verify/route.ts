import { NextRequest, NextResponse } from 'next/server'
import { attachSessionCookie, createSessionJwt } from '@/lib/auth'
import { AuthVerifyError, consumeAuthToken } from '@/lib/authVerify'

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const token = url.searchParams.get('token')
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? url.origin

  if (!token) {
    return NextResponse.redirect(`${appUrl}/?auth=missing`)
  }

  try {
    const result = await consumeAuthToken(token, 'MAGIC_LINK')
    const jwt = await createSessionJwt(result.userId)
    const res = NextResponse.redirect(`${appUrl}/?auth=ok`)
    attachSessionCookie(res, jwt)
    return res
  } catch (err) {
    if (err instanceof AuthVerifyError) {
      const reason = err.message.toLowerCase().includes('expired') ? 'expired' : 'invalid'
      return NextResponse.redirect(`${appUrl}/?auth=${reason}`)
    }
    console.error('[auth/verify]', err)
    return NextResponse.redirect(`${appUrl}/?auth=error`)
  }
}
