'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { clearTrialState, readTrialState } from '@/lib/trial'
import { PasswordInput } from './PasswordInput'
import { InlineSpinner } from './ViewTransitionOverlay'

interface Props {
  onClose: () => void
}

export function SignupModal({ onClose }: Props) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

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
      const ref =
        typeof window !== 'undefined'
          ? window.localStorage.getItem('diaflow_pending_ref') ?? undefined
          : undefined
      const trial = readTrialState()
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          password,
          ref,
          trialTeamName: trial?.teamName ?? undefined,
          trialTeamPurpose: trial?.teamPurpose ?? undefined,
          // Carry the Diaflow role recommendation across signup so the
          // new account inherits the personalised copy and doesn't
          // need to re-call the upstream on first load.
          trialRecommendedRole: trial?.recommendedRole ?? undefined,
          trialReason: trial?.reason ?? undefined,
        }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(j.error ?? 'Sign up failed')
      }
      clearTrialState()
      try {
        window.localStorage.removeItem('diaflow_pending_ref')
      } catch {
        /* ignore */
      }
      // FULL page reload (not router.refresh) so the server
      // component re-runs against the freshly-set session cookie.
      // router.refresh works most of the time but has been observed
      // racing the cookie write — the safe pattern is a hard nav,
      // same as the logout flow in MySquadDrawer.
      window.location.assign('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      // Mobile: bottom-anchored sheet. Desktop: centered modal. The
      // backdrop is identical in both modes; only the alignment + the
      // card's geometry change at the md breakpoint.
      className="fixed inset-0 z-30 flex items-end md:items-center justify-center bg-black/70 backdrop-blur-sm md:px-4"
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        className={
          // Card shell — bottom sheet on mobile, centered card on
          // desktop. We pad the bottom by safe-area on mobile so
          // the primary CTA doesn't sit under the iOS home indicator.
          'w-full bg-night-mid border border-white/10 text-tower-cream shadow-2xl ' +
          'rounded-t-3xl md:rounded-2xl md:max-w-sm md:border md:border-white/10 ' +
          'pt-6 px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] md:p-8'
        }
      >
        {/* Mobile sheet grip — hidden on desktop where the centered
            modal doesn't need a swipe affordance. */}
        <div className="md:hidden flex justify-center -mt-3 mb-3" aria-hidden>
          <div className="w-9 h-1 rounded-full bg-white/20" />
        </div>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/diaflow-logo.jpg" alt="Diaflow" width={32} height={32} className="rounded-md" />
            <h2 className="text-lg font-semibold tracking-wide">Create your account</h2>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-tower-cream/50 hover:text-tower-cream text-xl">
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <p className="text-sm text-tower-cream/70">
            We&apos;ll save your team name and progress against this email.
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
              autoComplete="new-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="at least 6 characters"
            />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="w-full px-3 py-2 rounded-md bg-tower-gold text-night-deep font-semibold text-sm disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {busy && <InlineSpinner />}
            {busy ? 'Creating account…' : 'Create account'}
          </button>
          {error && <p className="text-xs text-red-300">{error}</p>}
        </form>

        <p className="mt-4 text-xs text-tower-cream/60 text-center">
          Already have an account?{' '}
          <Link href="/login" className="text-tower-gold hover:underline">
            Sign in →
          </Link>
        </p>
      </div>
    </div>
  )
}
