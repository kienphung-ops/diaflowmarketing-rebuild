'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { clearTrialState, readTrialState } from '@/lib/trial'
import { trackEvent } from '@/lib/tracking'
import { PasswordInput } from './PasswordInput'
import { InlineSpinner } from './ViewTransitionOverlay'
import { InAppBrowserNotice } from './InAppBrowserNotice'
import { useIsInAppBrowser } from '@/hooks/useIsInAppBrowser'

interface Props {
  onClose: () => void
}

/**
 * "Save my team" sign-up modal — Section 5 mockup.
 *
 * Three layers stacked top-to-bottom:
 *
 *   1. Header chrome     — small "Save my team" label + × close,
 *                          Diaflow D logo + big headline, team preview
 *                          card with the user's three starter avatars
 *                          + "N teammates waiting at launch" promise.
 *   2. Auth body         — Google OAuth button, "OR USE EMAIL"
 *                          divider, email + password fields, primary
 *                          "Save my team →" CTA, Terms microcopy.
 *   3. Footer            — "Already saved? Sign in" link to /login.
 *
 * The Google OAuth click hits `GET /api/auth/oauth/google` which
 * stores the trial state in a short-lived cookie and redirects to
 * Google's consent screen. The callback route reconciles the trial
 * carryover the same way the email signup handler does.
 */
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

  // Pull the team preview from trial state. Falls back to friendly
  // defaults so the modal still renders coherently if the user opens
  // it before completing any onboarding (which shouldn't happen, but
  // worth covering — empty preview > broken layout).
  // In social-media in-app browsers Google blocks OAuth — hide the
  // Google button and show a "reopen in browser" notice instead.
  const isInAppBrowser = useIsInAppBrowser()
  const trial = useMemo(() => readTrialState(), [])
  const previewTeamName = trial?.teamName?.trim() || 'your team'
  const previewFloor = trial?.currentFloor ?? 1
  // Three starter NPCs the user just met in onboarding. Colours mirror
  // the in-game avatars (Iris pink, Mia purple, Leo blue) so the
  // preview reads as "those teammates you just hired".
  const previewTeammates = [
    { initial: 'I', color: 'bg-[#f0a8c5]', label: 'Iris' },
    { initial: 'M', color: 'bg-purple-400', label: 'Mia' },
    { initial: 'L', color: 'bg-sky-400', label: 'Leo' },
  ]

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
      // Re-read trial state AT SUBMIT TIME, not at modal mount. The
      // `trial` variable above is a useMemo snapshot from when the
      // modal first opened — if the Mia onboarding's `/api/job-summary`
      // call landed AFTER the modal opened, that snapshot still has
      // `recommendedRole: null` even though localStorage has the
      // fresh value. Reading here picks up whatever finished between
      // mount and submit, so User.recommendedRole gets persisted on
      // signup instead of relying on the post-signup backfill effect.
      const latestTrial =
        typeof window !== 'undefined' ? readTrialState() : trial
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          password,
          ref,
          trialTeamName: latestTrial?.teamName ?? undefined,
          trialTeamPurpose: latestTrial?.teamPurpose ?? undefined,
          // Carry the Diaflow role recommendation across signup so the
          // new account inherits the personalised copy and doesn't
          // need to re-call the upstream on first load.
          trialRecommendedRole: latestTrial?.recommendedRole ?? undefined,
          trialReason: latestTrial?.reason ?? undefined,
        }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(j.error ?? 'Sign up failed')
      }
      clearTrialState()
      trackEvent('signup_complete', { method: 'email' })
      try {
        // Flag that we already tracked this signup so TowerLanding
        // doesn't double-fire a google signup_complete when it sees
        // `?just_signed_up=1` on the incoming redirect.
        window.sessionStorage.setItem('signup_tracked', '1')
      } catch {
        /* ignore */
      }
      try {
        window.localStorage.removeItem('diaflow_pending_ref')
      } catch {
        /* ignore */
      }
      // `?just_signed_up=1` triggers the SaveSuccessModal on the home
      // page (TowerLanding reads the query, opens the modal, then
      // strips the param so a refresh doesn't replay it).
      window.location.assign('/?just_signed_up=1')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setBusy(false)
    }
  }

  /**
   * Kicks the user into the Google OAuth2 dance. We do a full top-level
   * navigation rather than a popup so the post-consent redirect lands
   * back in the same window (avoids COOP / opener-null issues on iOS).
   * Any trial state / referral code is captured server-side by the
   * `start` route via a short-lived signed cookie.
   */
  function handleGoogleSignIn() {
    const ref =
      typeof window !== 'undefined'
        ? window.localStorage.getItem('diaflow_pending_ref') ?? ''
        : ''
    // Re-read trial state at click time — the modal's `trial` useMemo
    // snapshot is taken at mount, but the user may have clicked Google
    // before the Mia onboarding's job-summary API call resolved.
    // Reading here picks up the latest localStorage values so the
    // recommendedRole + reason actually survive the round-trip.
    const latestTrial =
      typeof window !== 'undefined' ? readTrialState() : trial
    const params = new URLSearchParams()
    if (ref) params.set('ref', ref)
    // Pass the trial fields as query params — the start route then
    // bakes them into the OAuth `state` cookie so they survive the
    // round-trip to Google.
    if (latestTrial?.teamName) params.set('teamName', latestTrial.teamName)
    if (latestTrial?.teamPurpose) params.set('teamPurpose', latestTrial.teamPurpose)
    if (latestTrial?.recommendedRole)
      params.set('recommendedRole', latestTrial.recommendedRole)
    if (latestTrial?.reason) params.set('reason', latestTrial.reason)
    const qs = params.toString()
    trackEvent('signup_click', { source: 'onboarding' })
    window.location.href = `/api/auth/oauth/google${qs ? `?${qs}` : ''}`
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-30 flex items-end md:items-center justify-center bg-black/70 backdrop-blur-sm md:px-4"
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        className={
          'w-full bg-night-mid border border-white/10 text-tower-cream shadow-2xl ' +
          'rounded-t-3xl md:rounded-2xl md:max-w-sm ' +
          'max-h-[92dvh] overflow-y-auto ' +
          'pt-3 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] md:p-6'
        }
      >
        {/* Mobile grip — hidden on desktop. */}
        <div className="md:hidden flex justify-center pb-2" aria-hidden>
          <div className="w-9 h-1 rounded-full bg-white/20" />
        </div>

        {/* Header row — small "Save my team" label + × close. */}
        <div className="flex items-end justify-end mb-3">
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-7 h-7 rounded-full bg-white/5 text-tower-cream/60 hover:text-tower-cream hover:bg-white/10 transition flex items-center justify-center text-lg leading-none"
          >
            ×
          </button>
        </div>

        {/* Title row — Diaflow D mark + big headline. */}
        <div className="flex items-start gap-2.5 mb-3">
          <span
            className="shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-lg bg-white text-night-deep font-black text-base"
            style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
            aria-hidden
          >
            D
          </span>
          <h2 className="text-[18px] md:text-[20px] font-extrabold leading-tight tracking-tight pt-0.5">
            Save your team for launch day
          </h2>
        </div>

        {/* Team preview card — avatars + name + Floor + waiting line. */}
        <div className="rounded-xl border border-purple-500/30 bg-purple-500/[0.06] px-3 py-2.5 mb-3 flex items-center gap-3">
          <div className="flex -space-x-2 shrink-0" aria-hidden>
            {previewTeammates.map(t => (
              <span
                key={t.label}
                className={`w-8 h-8 rounded-md border-2 border-night-mid inline-flex items-center justify-center text-night-deep text-[12px] font-extrabold ${t.color}`}
                title={t.label}
              >
                {t.initial}
              </span>
            ))}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-bold text-tower-cream truncate">
              {previewTeamName} <span className="text-tower-cream/55 font-medium">· Floor {previewFloor}</span>
            </div>
            <div className="text-[11.5px] text-emerald-300 font-semibold flex items-center gap-1">
              <strong className="tabular-nums">{previewTeammates.length}</strong> teammates waiting at launch
            </div>
          </div>
        </div>

        {/* Body copy — value prop. */}
        <p className="text-[13px] text-tower-cream/75 leading-relaxed mb-4">
          Free. Takes 10 seconds.{' '}
          <strong className="text-tower-cream font-semibold">
            Your office and AI teammates wait for you
          </strong>{' '}
          when AI Teammate ships this summer.
        </p>

        {/* Google OAuth — primary alternative to email signup. Hidden
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

        {/* "OR USE EMAIL" divider */}
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
              autoComplete="new-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="at least 6 characters"
            />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="w-full mt-2 px-4 py-3.5 rounded-xl bg-gradient-to-b from-purple-300 to-purple-400 text-night-deep font-extrabold text-[15px] shadow-[0_8px_24px_rgba(168,117,255,0.4)] hover:shadow-[0_12px_28px_rgba(168,117,255,0.5)] transition disabled:opacity-60 disabled:cursor-not-allowed disabled:shadow-none flex items-center justify-center gap-2"
          >
            {busy && <InlineSpinner />}
            {busy ? 'Saving your team…' : 'Save my team →'}
          </button>
          {error && <p className="text-xs text-red-300 mt-1">{error}</p>}
        </form>

        <p className="mt-3 text-center text-[11px] text-tower-cream/45 leading-relaxed">
          By continuing, you agree to our{' '}
          <Link href="https://docs.diaflow.io/compliance-center/general/terms-and-conditions" className="text-tower-cream/65 underline-offset-2 hover:underline">
            Terms &amp; Privacy Policy
          </Link>
          .
        </p>

        <div className="mt-4 pt-4 border-t border-white/5 text-center text-[12.5px] text-tower-cream/60">
          Already saved?{' '}
          <Link href="/login" className="text-purple-300 font-semibold hover:underline">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  )
}

/**
 * Inline Google "G" mark — colour-faithful version that doesn't need
 * an external image asset. Wrapped in a white pill so the colours
 * stay readable on the dark button background.
 */
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
