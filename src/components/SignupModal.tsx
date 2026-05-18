'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { clearTrialState, readTrialState } from '@/lib/trial'

type Stage = 'email' | 'code' | 'verifying'

interface Props {
  onClose: () => void
}

interface DevHint {
  magicLinkUrl: string
  otp: string
}

export function SignupModal({ onClose }: Props) {
  const router = useRouter()
  const [stage, setStage] = useState<Stage>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [devHint, setDevHint] = useState<DevHint | null>(null)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function submitEmail(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const ref =
        typeof window !== 'undefined'
          ? window.localStorage.getItem('diaflow_pending_ref') ?? undefined
          : undefined
      const trial = readTrialState()
      const res = await fetch('/api/auth/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          ref,
          trialTeamName: trial?.teamName ?? undefined,
          trialTeamPurpose: trial?.teamPurpose ?? undefined,
        }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(j.error ?? 'Failed to send code')
      }
      if (j?.devMagicLinkUrl && j?.devOtp) {
        setDevHint({ magicLinkUrl: j.devMagicLinkUrl, otp: j.devOtp })
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
      // Trial was an educational preview — discard now that we have a real account.
      clearTrialState()
      try {
        window.localStorage.removeItem('diaflow_pending_ref')
      } catch {
        // ignore
      }
      router.refresh()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      setStage('code')
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
            <h2 className="text-lg font-semibold tracking-wide">Sign up to keep climbing</h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-tower-cream/50 hover:text-tower-cream"
          >
            ×
          </button>
        </div>

        {stage === 'email' && (
          <form onSubmit={submitEmail} className="space-y-3">
            <p className="text-sm text-tower-cream/70">
              You&apos;re trying the tower. Sign up and the invites you actually send will unlock real floors.
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
              {busy ? 'Sending…' : 'Send sign-in code'}
            </button>
          </form>
        )}

        {(stage === 'code' || stage === 'verifying') && (
          <form onSubmit={submitCode} className="space-y-3">
            <p className="text-sm text-tower-cream/70">
              We sent a 6-digit code to <span className="text-tower-gold">{email}</span>.
            </p>

            {devHint && (
              <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs space-y-2">
                <div className="font-semibold text-amber-300">Dev helper (email not delivered)</div>
                <div>
                  <div className="opacity-60 mb-0.5">OTP</div>
                  <div className="font-mono text-base text-amber-200 tracking-[0.4em]">{devHint.otp}</div>
                </div>
                <div>
                  <div className="opacity-60 mb-0.5">Magic link</div>
                  <a
                    href={devHint.magicLinkUrl}
                    className="font-mono text-amber-200 underline break-all"
                  >
                    {devHint.magicLinkUrl}
                  </a>
                </div>
              </div>
            )}
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
    </div>
  )
}
