import { createHash, randomBytes, randomInt } from 'crypto'
import { cookies } from 'next/headers'
import { SignJWT, jwtVerify } from 'jose'
import type { NextResponse } from 'next/server'

const SESSION_COOKIE = 'diaflow_session'
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30 // 30 days
const REFERRAL_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

function getSecretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET
  if (!secret || secret.length < 16) {
    throw new Error('AUTH_SECRET is not set (must be at least 16 chars)')
  }
  return new TextEncoder().encode(secret)
}

export function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex')
}

// Salt OTP with email so two users with the same 6-digit code don't collide on tokenHash @unique.
export function hashOtpForEmail(email: string, code: string): string {
  return hashToken(`${email.toLowerCase()}:${code}`)
}

export function generateReferralCode(): string {
  const bytes = randomBytes(8)
  let out = ''
  for (let i = 0; i < 8; i++) {
    out += REFERRAL_ALPHABET[bytes[i] % REFERRAL_ALPHABET.length]
  }
  return out
}

export function generateMagicLinkToken(): { raw: string; hash: string } {
  const raw = randomBytes(32).toString('base64url')
  return { raw, hash: hashToken(raw) }
}

export function generateOtpCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0')
}

export interface SessionPayload {
  userId: string
}

export async function createSessionJwt(userId: string): Promise<string> {
  return await new SignJWT({ userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(getSecretKey())
}

export async function verifySessionJwt(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey())
    if (typeof payload.userId !== 'string') return null
    return { userId: payload.userId }
  } catch {
    return null
  }
}

export async function readSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  if (!token) return null
  return await verifySessionJwt(token)
}

export function attachSessionCookie(res: NextResponse, jwt: string): void {
  res.cookies.set(SESSION_COOKIE, jwt, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  })
}

export function clearSessionCookie(res: NextResponse): void {
  res.cookies.set(SESSION_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })
}

export const SESSION_COOKIE_NAME = SESSION_COOKIE
export const TOKEN_TTL_MINUTES = 15
