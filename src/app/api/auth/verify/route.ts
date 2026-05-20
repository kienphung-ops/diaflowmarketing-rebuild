import { NextRequest, NextResponse } from 'next/server'
import { attachSessionCookie, createSessionJwt } from '@/lib/auth'
import { AuthVerifyError, consumeAuthToken } from '@/lib/authVerify'

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const token = url.searchParams.get('token')
  // The email link was built using the visitor's browser origin (see
  // /api/auth/request → getBrowserOrigin) so url.origin here is already
  // the public-facing domain. No NEXT_PUBLIC_APP_URL needed.
  const appUrl = url.origin

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
