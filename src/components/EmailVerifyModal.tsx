'use client'

/**
 * Email verification modal.
 *
 * Opens from MySquadDrawer's "Verify email" CTA. On mount it kicks off
 * /api/auth/send-verification (which mails a 6-digit OTP). The user
 * types the OTP and we POST /api/auth/verify-email to flip
 * User.emailVerified.
 *
 * Dev mode: if the API returns `devOtp` (Diaflow API not configured),
 * we show it inline so local testing works without an inbox.
 */

import { useEffect, useRef, useState } from 'react'

interface Props {
  open: boolean
  onClose: () => void
  email: string | null
  onVerified: () => void
}

export function EmailVerifyModal({ open, onClose, email, onVerified }: Props) {
  const [otp, setOtp] = useState('')
  const [sending, setSending] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [devOtp, setDevOtp] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  // AbortController scoped to the current open() lifecycle — closing
  // the modal mid-fetch aborts the request so its setState doesn't
  // fire on an unmounted form.
  const abortRef = useRef<AbortController | null>(null)

  // Send OTP when modal opens. Re-sends are user-driven via the
  // "Resend code" button so we don't spam Diaflow on re-renders.
  useEffect(() => {
    if (!open) return
    setOtp('')
    setError(null)
    setMessage(null)
    setDevOtp(null)
    abortRef.current = new AbortController()
    void requestSend()
    return () => {
      abortRef.current?.abort()
      abortRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  async function requestSend() {
    const signal = abortRef.current?.signal
    setSending(true)
    setError(null)
    try {
      const r = await fetch('/api/auth/send-verification', { method: 'POST', signal })
      const j = await r.json().catch(() => ({}))
      if (signal?.aborted) return
      if (!r.ok) {
        setError(j.error ?? 'Failed to send code')
        return
      }
      if (j.alreadyVerified) {
        setMessage('Email already verified ✓')
        onVerified()
        return
      }
      setMessage('We just sent you a 6-digit code. Check your inbox.')
      if (typeof j.devOtp === 'string') setDevOtp(j.devOtp)
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      setError('Network error — try again in a moment')
    } finally {
      if (!signal?.aborted) setSending(false)
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!/^\d{6}$/.test(otp)) {
      setError('Enter the 6-digit code')
      return
    }
    const signal = abortRef.current?.signal
    setVerifying(true)
    setError(null)
    try {
      const r = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ otp }),
        signal,
      })
      const j = await r.json().catch(() => ({}))
      if (signal?.aborted) return
      if (!r.ok) {
        setError(j.error ?? 'Invalid code')
        return
      }
      onVerified()
      onClose()
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      setError('Network error — try again')
    } finally {
      if (!signal?.aborted) setVerifying(false)
    }
  }

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Verify your email"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-md px-4"
    >
      <form
        onClick={e => e.stopPropagation()}
        onSubmit={submit}
        className="w-full max-w-sm rounded-2xl bg-night-mid border border-tower-gold/40 p-6 text-tower-cream shadow-2xl"
      >
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-tower-gold/80 mb-1">
              Verify email
            </div>
            <h2 className="text-lg font-bold">Check your inbox</h2>
            {email && (
              <p className="text-xs text-tower-cream/55 mt-1 break-all">{email}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-tower-cream/60 hover:text-tower-cream text-xl leading-none"
          >
            ×
          </button>
        </div>

        <label className="block mt-4">
          <span className="text-[10px] uppercase tracking-wider text-tower-cream/50">
            6-digit code
          </span>
          <input
            autoFocus
            inputMode="numeric"
            pattern="\d{6}"
            maxLength={6}
            value={otp}
            onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="000000"
            className="mt-1 w-full px-3 py-2.5 rounded-md bg-night-deep border border-white/10 focus:border-tower-gold focus:outline-none text-xl font-mono tracking-[0.4em] text-center"
          />
        </label>

        {devOtp && (
          <div className="mt-3 rounded-md border border-purple-500/30 bg-purple-500/10 px-3 py-2 text-[11px] text-purple-200">
            <div className="font-semibold mb-0.5">Dev preview</div>
            Code: <span className="font-mono tracking-widest">{devOtp}</span>
          </div>
        )}

        {error && (
          <div className="mt-3 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
            {error}
          </div>
        )}
        {!error && message && (
          <div className="mt-3 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
            {message}
          </div>
        )}

        <div className="mt-4 flex items-center gap-2">
          <button
            type="submit"
            disabled={verifying || sending}
            className="flex-1 px-4 py-2 rounded-md bg-tower-gold text-night-deep font-semibold text-sm disabled:opacity-60"
          >
            {verifying ? 'Verifying…' : 'Verify'}
          </button>
          <button
            type="button"
            onClick={requestSend}
            disabled={sending}
            className="px-3 py-2 rounded-md text-xs text-tower-cream/70 border border-white/10 hover:border-tower-gold/40 disabled:opacity-60"
          >
            {sending ? 'Sending…' : 'Resend code'}
          </button>
        </div>
      </form>
    </div>
  )
}
