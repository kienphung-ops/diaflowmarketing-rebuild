'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { clearTrialState, readTrialState } from '@/lib/trial'
import { PasswordInput } from './PasswordInput'

interface Props {
  onClose: () => void
}

export function SignupModal({ onClose }: Props) {
  const router = useRouter()
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
      router.refresh()
      onClose()
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
      className="fixed inset-0 z-30 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="w-full max-w-sm bg-night-mid border border-white/10 rounded-2xl p-8 text-tower-cream shadow-2xl"
      >
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
            className="w-full px-3 py-2 rounded-md bg-tower-gold text-night-deep font-semibold text-sm disabled:opacity-50"
          >
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
