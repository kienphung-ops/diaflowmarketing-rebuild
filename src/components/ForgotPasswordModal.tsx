'use client'

/**
 * Forgot-password modal — opened from the /login page.
 *
 * POSTs to /api/auth/password-reset/request, which always returns 200
 * (to prevent enumeration). Dev mode returns a `devResetUrl` we render
 * inline so local testing doesn't need a real inbox.
 */

import { useEffect, useState } from 'react'

interface Props {
  open: boolean
  defaultEmail?: string
  onClose: () => void
}

export function ForgotPasswordModal({ open, defaultEmail, onClose }: Props) {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [devUrl, setDevUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setEmail(defaultEmail ?? '')
    setSent(false)
    setDevUrl(null)
    setError(null)
  }, [open, defaultEmail])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!email.includes('@')) {
      setError('Enter a valid email')
      return
    }
    setBusy(true)
    try {
      const r = await fetch('/api/auth/password-reset/request', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) {
        setError(j.error ?? 'Request failed')
        return
      }
      setSent(true)
      if (typeof j.devResetUrl === 'string') setDevUrl(j.devResetUrl)
    } catch {
      setError('Network error — try again')
    } finally {
      setBusy(false)
    }
  }

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
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
              Forgot password
            </div>
            <h2 className="text-lg font-bold">Reset your password</h2>
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

        {!sent ? (
          <>
            <p className="text-xs text-tower-cream/60 mb-3">
              We&apos;ll email you a reset link. It expires in 30 minutes.
            </p>
            <label className="block">
              <span className="text-[10px] uppercase tracking-wider text-tower-cream/50">
                Email
              </span>
              <input
                type="email"
                autoFocus
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="mt-1 w-full px-3 py-2 rounded-md bg-night-deep border border-white/10 focus:border-tower-gold focus:outline-none text-sm"
              />
            </label>

            {error && (
              <div className="mt-3 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="mt-4 w-full px-4 py-2 rounded-md bg-tower-gold text-night-deep font-semibold text-sm disabled:opacity-60"
            >
              {busy ? 'Sending…' : 'Send reset link'}
            </button>
          </>
        ) : (
          <>
            <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-3 text-sm text-emerald-200">
              ✓ If an account exists for <span className="font-mono">{email}</span>,
              we&apos;ve sent a reset link. Check your inbox.
            </div>
            {devUrl && (
              <div className="mt-3 rounded-md border border-purple-500/30 bg-purple-500/10 px-3 py-2 text-[11px] text-purple-200">
                <div className="font-semibold mb-1">Dev preview link</div>
                <a href={devUrl} className="underline break-all text-purple-100">
                  {devUrl}
                </a>
              </div>
            )}
            <button
              type="button"
              onClick={onClose}
              className="mt-4 w-full px-4 py-2 rounded-md bg-night-deep/60 border border-white/10 text-tower-cream font-semibold text-sm hover:border-tower-gold/40"
            >
              Close
            </button>
          </>
        )}
      </form>
    </div>
  )
}
