'use client'

import Link from 'next/link'
import { useState } from 'react'
import { ForgotPasswordModal } from '@/components/ForgotPasswordModal'
import { PasswordInput } from '@/components/PasswordInput'
import { InlineSpinner } from '@/components/ViewTransitionOverlay'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [forgotOpen, setForgotOpen] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!email.includes('@')) {
      setError('Enter a valid email')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }
    setBusy(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error ?? 'Sign in failed')
      // FULL page reload — `router.replace('/')` keeps the RSC
      // payload that was rendered with the pre-auth cookie, so the
      // home page would re-mount in trial / onboarding mode until
      // the user manually reloaded. window.location.assign forces a
      // fresh server render with the just-set session cookie.
      window.location.assign('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="fixed inset-0 flex items-end md:items-center justify-center bg-night-deep md:px-4">
      <div
        className={
          // Card shell — bottom sheet on mobile, centered card on
          // desktop. Same pattern as SignupModal so the inline
          // (modal) and dedicated (page) signup flows share a shape.
          'w-full bg-night-mid/80 backdrop-blur-md text-tower-cream ' +
          'rounded-t-3xl md:rounded-2xl ' +
          'border-t md:border border-white/10 ' +
          'pt-6 px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] md:p-8 md:max-w-sm'
        }
      >
        {/* Mobile sheet grip — hidden on desktop. */}
        <div className="md:hidden flex justify-center -mt-3 mb-3" aria-hidden>
          <div className="w-9 h-1 rounded-full bg-white/20" />
        </div>
        <div className="flex items-center gap-2 mb-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/diaflow-logo.jpg" alt="Diaflow" width={32} height={32} className="rounded-md" />
          <h1 className="text-lg font-semibold tracking-wide">Welcome back</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <p className="text-sm text-tower-cream/70">
            Sign in to keep climbing your tower.
          </p>
          <label className="block space-y-1">
            <span className="text-xs uppercase tracking-wider text-tower-cream/50">Email</span>
            <input
              type="email"
              required
              autoFocus
              autoComplete="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-3 py-2 rounded-md bg-night-deep border border-white/10 focus:border-tower-gold focus:outline-none text-sm"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs uppercase tracking-wider text-tower-cream/50">Password</span>
            <PasswordInput
              required
              minLength={6}
              autoComplete="current-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="your password"
            />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="w-full px-3 py-2 rounded-md bg-tower-gold text-night-deep font-semibold text-sm disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {busy && <InlineSpinner />}
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
          {error && <p className="text-xs text-red-300">{error}</p>}
          <div className="text-right">
            <button
              type="button"
              onClick={() => setForgotOpen(true)}
              className="text-[11px] text-tower-cream/60 hover:text-tower-gold underline-offset-2 hover:underline"
            >
              Forgot password?
            </button>
          </div>
        </form>

        <p className="mt-4 text-xs text-tower-cream/60 text-center">
          Don&apos;t have an account?{' '}
          <Link href="/signup" className="text-tower-gold hover:underline">
            Start your tower →
          </Link>
        </p>
      </div>

      <ForgotPasswordModal
        open={forgotOpen}
        defaultEmail={email}
        onClose={() => setForgotOpen(false)}
      />
    </main>
  )
}
