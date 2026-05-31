'use client'

/**
 * /signup — dedicated email + password sign-up page.
 *
 * Mirrors the visual + interaction model of /login. The same flow lives
 * inside `<SignupModal>` for trial-mode upgrades on the home page; this
 * page exists so visitors arriving from /login's "Start your tower" CTA
 * (or any external "Sign up" link) have a self-contained route instead
 * of being dropped onto the marketing landing page and left to hunt for
 * the modal.
 *
 * On success the signup API (`/api/auth/signup`) sets an HttpOnly
 * session cookie and we `router.replace('/')` so the home page renders
 * already-signed-in.
 */

import Link from 'next/link'
import { useState } from 'react'
import { clearTrialState, readTrialState } from '@/lib/trial'
import { trackEvent } from '@/lib/tracking'
import { PasswordInput } from '@/components/PasswordInput'
import { InlineSpinner } from '@/components/ViewTransitionOverlay'

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

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
      // Pick up any pending referral code stashed by the home page
      // (`useEffect` that reads `?ref=` and writes to localStorage), so
      // the new account is credited correctly. Trial state is migrated
      // for team-name / purpose continuity.
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
          // Carry Diaflow role recommendation across signup — keeps
          // the personalised Mia copy intact for the new account.
          trialRecommendedRole: trial?.recommendedRole ?? undefined,
          trialReason: trial?.reason ?? undefined,
        }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error ?? 'Sign up failed')
      // Successful signup — session cookie is set server-side. Clear
      // local trial state + pending ref so a fresh account starts
      // cleanly, then redirect to the office view.
      clearTrialState()
      trackEvent('signup_complete', { method: 'email' })
      try {
        // Flag that we already tracked this signup so TowerLanding
        // doesn't double-fire a google signup_complete if it ever
        // sees `?just_signed_up=1` on the incoming redirect.
        window.sessionStorage.setItem('signup_tracked', '1')
      } catch {
        /* ignore */
      }
      try {
        window.localStorage.removeItem('diaflow_pending_ref')
      } catch {
        /* ignore */
      }
      // FULL page reload so the home page's server component
      // re-runs with the freshly-set session cookie. router.replace
      // alone keeps the pre-auth RSC payload and leaves the user
      // dropped back into onboarding until they manually reload.
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
          // desktop. Mirrors the /login page + SignupModal so all
          // three auth surfaces share a single visual shape.
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
          <h1 className="text-lg font-semibold tracking-wide">Start your tower</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <p className="text-sm text-tower-cream/70">
            Create an account to save your team and start climbing.
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
            {busy ? 'Saving your team…' : 'Save Your Team →'}
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
    </main>
  )
}
