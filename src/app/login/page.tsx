'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Stage = 'email' | 'code' | 'verifying'

export default function LoginPage() {
  const router = useRouter()
  const [stage, setStage] = useState<Stage>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submitEmail(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const ref =
        typeof window !== 'undefined'
          ? window.localStorage.getItem('diaflow_pending_ref') ?? undefined
          : undefined
      const res = await fetch('/api/auth/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), ref }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error ?? 'Failed to send code')
      }
      setStage('code')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setBusy(false)
    }
  }

  async function submitCode(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    setStage('verifying')
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), code: code.trim() }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error ?? 'Invalid code')
      }
      try {
        window.localStorage.removeItem('diaflow_pending_ref')
      } catch {
        // ignore
      }
      router.replace('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      setStage('code')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="fixed inset-0 flex items-center justify-center bg-night-deep px-4">
      <div className="w-full max-w-sm bg-night-mid/80 backdrop-blur-md rounded-2xl border border-white/10 p-8 text-tower-cream">
        <div className="flex items-center gap-2 mb-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/diaflow-logo.jpg" alt="Diaflow" width={32} height={32} className="rounded-md" />
          <h1 className="text-lg font-semibold tracking-wide">Diaflow Tower</h1>
        </div>

        {stage === 'email' && (
          <form onSubmit={submitEmail} className="space-y-3">
            <p className="text-sm text-tower-cream/70">
              Sign in with your email — we&apos;ll send a link and a 6-digit code.
            </p>
            <input
              type="email"
              required
              autoFocus
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-3 py-2 rounded-md bg-night-deep border border-white/10 focus:border-tower-gold focus:outline-none text-sm"
            />
            <button
              type="submit"
              disabled={busy}
              className="w-full px-3 py-2 rounded-md bg-tower-gold text-night-deep font-semibold text-sm disabled:opacity-50"
            >
              {busy ? 'Sending…' : 'Send sign-in link'}
            </button>
          </form>
        )}

        {(stage === 'code' || stage === 'verifying') && (
          <form onSubmit={submitCode} className="space-y-3">
            <p className="text-sm text-tower-cream/70">
              We sent a 6-digit code to <span className="text-tower-gold">{email}</span>.
            </p>
            <input
              inputMode="numeric"
              pattern="\d{6}"
              required
              autoFocus
              value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="123456"
              className="w-full px-3 py-2 rounded-md bg-night-deep border border-white/10 focus:border-tower-gold focus:outline-none text-center text-lg font-mono tracking-[0.4em]"
            />
            <button
              type="submit"
              disabled={busy || code.length !== 6}
              className="w-full px-3 py-2 rounded-md bg-tower-gold text-night-deep font-semibold text-sm disabled:opacity-50"
            >
              {busy ? 'Verifying…' : 'Sign in'}
            </button>
            <button
              type="button"
              onClick={() => {
                setStage('email')
                setCode('')
                setError(null)
              }}
              className="w-full text-xs text-tower-cream/50 hover:text-tower-cream/80"
            >
              Use a different email
            </button>
          </form>
        )}

        {error && <p className="mt-3 text-xs text-red-300">{error}</p>}
      </div>
    </main>
  )
}
