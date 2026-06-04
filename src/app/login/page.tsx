'use client'

import Link from 'next/link'
import { useState } from 'react'
import { ForgotPasswordModal } from '@/components/ForgotPasswordModal'
import { PasswordInput } from '@/components/PasswordInput'
import { InlineSpinner } from '@/components/ViewTransitionOverlay'
import { InAppBrowserNotice } from '@/components/InAppBrowserNotice'
import { useIsInAppBrowser } from '@/hooks/useIsInAppBrowser'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [forgotOpen, setForgotOpen] = useState(false)
  // In social-media in-app browsers Google blocks OAuth — hide the
  // button and show a "reopen in browser" notice instead.
  const isInAppBrowser = useIsInAppBrowser()

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
      // FULL page reload so the server component re-runs with the
      // just-set session cookie. Matches the SignupModal post-submit.
      window.location.assign('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setBusy(false)
    }
  }

  function handleGoogleSignIn() {
    // The OAuth start route reads the trial state cookie (if any) so
    // a returning user who's been kicking the tires while logged out
    // still keeps their progress on sign-in. No trial-state query
    // params here — the login page assumes the user already has an
    // account, so the carryover logic in the callback is a no-op.
    window.location.href = '/api/auth/oauth/google'
  }

  return (
    <main className="fixed inset-0 flex items-end md:items-center justify-center bg-night-deep md:px-4">
      <div
        className={
          'w-full bg-night-mid border border-white/10 text-tower-cream shadow-2xl ' +
          'rounded-t-3xl md:rounded-2xl md:max-w-sm ' +
          'max-h-[92dvh] overflow-y-auto ' +
          'pt-3 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] md:p-6'
        }
      >
        {/* Mobile sheet grip */}
        <div className="md:hidden flex justify-center pb-2" aria-hidden>
          <div className="w-9 h-1 rounded-full bg-white/20" />
        </div>

        {/* Small label header — mirrors the SignupModal chrome so
            the two surfaces feel like a matched pair. */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-[12px] font-semibold text-tower-cream/55 tracking-wide">
            Sign in
          </span>
          <Link
            href="/"
            aria-label="Close"
            className="w-7 h-7 rounded-full bg-white/5 text-tower-cream/60 hover:text-tower-cream hover:bg-white/10 transition flex items-center justify-center text-lg leading-none"
          >
            ×
          </Link>
        </div>

        {/* Title row — Diaflow D mark + welcome headline. */}
        <div className="flex items-start gap-2.5 mb-4">
          <span
            className="shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-lg bg-white text-night-deep font-black text-base"
            style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
            aria-hidden
          >
            D
          </span>
          <div>
            <h1 className="text-[18px] md:text-[20px] font-extrabold leading-tight tracking-tight">
              Welcome back
            </h1>
            <p className="text-[13px] text-tower-cream/65 mt-0.5">
              Sign in to keep leveling up.
            </p>
          </div>
        </div>

        {/* Google OAuth — first option, mirrors the signup flow. Hidden
            inside in-app browsers (Google blocks OAuth there); we show a
            "open in browser" notice instead. */}
        {isInAppBrowser ? (
          <InAppBrowserNotice />
        ) : (
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={busy}
            className="w-full flex items-center justify-center gap-2.5 px-4 py-3 rounded-xl bg-white/[0.06] border border-white/15 text-tower-cream font-semibold text-[14px] hover:bg-white/[0.1] disabled:opacity-60 disabled:cursor-not-allowed transition mb-4"
          >
            <GoogleGlyph />
            <span>Continue with Google</span>
          </button>
        )}

        <div className="flex items-center gap-2.5 my-3 text-[10.5px] font-bold uppercase tracking-[0.1em] text-tower-cream/40">
          <span className="flex-1 h-px bg-white/10" />
          <span>or use email</span>
          <span className="flex-1 h-px bg-white/10" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-2.5">
          <label className="block">
            <span className="block text-[11px] font-bold uppercase tracking-[0.06em] text-purple-300 mb-1.5">
              Email
            </span>
            <input
              type="email"
              required
              autoFocus
              autoComplete="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-3.5 py-3 rounded-xl bg-night-deep/80 border border-white/10 focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-500/25 text-[14.5px] text-tower-cream placeholder:text-tower-cream/35"
            />
          </label>
          <label className="block">
            <span className="block text-[11px] font-bold uppercase tracking-[0.06em] text-purple-300 mb-1.5">
              Password
            </span>
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
            className="w-full mt-2 px-4 py-3.5 rounded-xl bg-gradient-to-b from-purple-300 to-purple-400 text-night-deep font-extrabold text-[15px] shadow-[0_8px_24px_rgba(168,117,255,0.4)] hover:shadow-[0_12px_28px_rgba(168,117,255,0.5)] transition disabled:opacity-60 disabled:cursor-not-allowed disabled:shadow-none flex items-center justify-center gap-2"
          >
            {busy && <InlineSpinner />}
            {busy ? 'Signing in…' : 'Sign in →'}
          </button>
          {error && <p className="text-xs text-red-300 mt-1">{error}</p>}
          <div className="text-right">
            <button
              type="button"
              onClick={() => setForgotOpen(true)}
              className="text-[11px] text-tower-cream/55 hover:text-purple-300 underline-offset-2 hover:underline"
            >
              Forgot password?
            </button>
          </div>
        </form>

        <div className="mt-4 pt-4 border-t border-white/5 text-center text-[12.5px] text-tower-cream/60">
          New here?{' '}
          <Link href="/" className="text-purple-300 font-semibold hover:underline">
            Meet your Diaflow teammate →
          </Link>
        </div>
      </div>

      <ForgotPasswordModal
        open={forgotOpen}
        defaultEmail={email}
        onClose={() => setForgotOpen(false)}
      />
    </main>
  )
}

function GoogleGlyph() {
  return (
    <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-white">
      <svg width="14" height="14" viewBox="0 0 48 48" aria-hidden>
        <path
          fill="#EA4335"
          d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
        />
        <path
          fill="#4285F4"
          d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
        />
        <path
          fill="#FBBC05"
          d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
        />
        <path
          fill="#34A853"
          d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
        />
      </svg>
    </span>
  )
}
