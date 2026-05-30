'use client'

/**
 * /reset-password?token=xxx — landing page for the password-reset
 * email link. Form lets the user pick a new password, POSTs it
 * + the token to /api/auth/password-reset/verify. On success the
 * server already sets the session cookie, so we just redirect home.
 */

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { PasswordInput } from '@/components/PasswordInput'

function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token') ?? ''
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!token) setError('Missing reset token in URL.')
  }, [token])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }
    if (password !== confirm) {
      setError('Passwords don\'t match')
      return
    }
    setBusy(true)
    try {
      const r = await fetch('/api/auth/password-reset/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token, newPassword: password }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) {
        setError(j.error ?? 'Reset failed')
        return
      }
      setDone(true)
      // Auto-redirect after a short pause so user sees the success state.
      setTimeout(() => router.replace('/'), 1500)
    } catch {
      setError('Network error — try again')
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
          <h1 className="text-lg font-semibold tracking-wide">Reset password</h1>
        </div>

        {done ? (
          <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-3 text-sm text-emerald-200">
            ✓ Password updated. Signing you in…
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <p className="text-sm text-tower-cream/70">
              Pick a fresh password for your account.
            </p>
            <label className="block space-y-1">
              <span className="text-xs uppercase tracking-wider text-tower-cream/50">
                New password
              </span>
              <PasswordInput
                required
                minLength={6}
                autoFocus
                autoComplete="new-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="at least 6 characters"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs uppercase tracking-wider text-tower-cream/50">
                Confirm password
              </span>
              <PasswordInput
                required
                minLength={6}
                autoComplete="new-password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="re-type it"
              />
            </label>
            <button
              type="submit"
              disabled={busy || !token}
              className="w-full px-3 py-2 rounded-md bg-tower-gold text-night-deep font-semibold text-sm disabled:opacity-50"
            >
              {busy ? 'Updating…' : 'Update password'}
            </button>
            {error && <p className="text-xs text-red-300">{error}</p>}
          </form>
        )}

        <p className="mt-4 text-xs text-tower-cream/60 text-center">
          <Link href="/login" className="text-tower-gold hover:underline">
            ← Back to sign in
          </Link>
        </p>
      </div>
    </main>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  )
}
