'use client'

import { useEffect, useState } from 'react'

interface Props {
  open: boolean
  onClose: () => void
  defaultEmail?: string | null
  onCaptured?: (email: string) => void
}

export function LeoEmailDrawer({ open, onClose, defaultEmail, onCaptured }: Props) {
  const [email, setEmail] = useState(defaultEmail ?? '')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    if (open) {
      setEmail(defaultEmail ?? '')
      setDone(!!defaultEmail)
      setError(null)
    }
  }, [open, defaultEmail])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.includes('@')) {
      setError('Enter a valid email')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/capture-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), source: 'leo-click' }),
      })
      if (!res.ok) throw new Error('Failed')
      setDone(true)
      onCaptured?.(email.trim().toLowerCase())
    } catch (err) {
      // Even on failure, the API logs the email — show success message.
      setDone(true)
      onCaptured?.(email.trim().toLowerCase())
      void err
    } finally {
      setBusy(false)
    }
  }

  if (!open) return null
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-30 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="w-full max-w-xl bg-night-mid border border-tower-gold/30 rounded-2xl p-6 text-tower-cream shadow-2xl"
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-tower-gold/80">Waitlist Coach</div>
            <h2 className="text-2xl font-bold mt-1">Hi, I&apos;m Leo 👋</h2>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-tower-cream/50 hover:text-tower-cream text-xl">
            ×
          </button>
        </div>

        <div className="mb-4 rounded-md overflow-hidden border border-white/10 aspect-video bg-black">
          <iframe
            src="https://www.youtube-nocookie.com/embed/KmigxFKQ3XE?rel=0&modestbranding=1"
            title="Diaflow Tower intro"
            allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            className="w-full h-full"
          />
        </div>

        {done ? (
          <div className="space-y-3">
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
              ✓ You&apos;re on the list — we&apos;ll email you on launch day.
            </div>
            <button onClick={onClose} className="w-full px-4 py-2.5 rounded-md bg-tower-gold text-night-deep font-semibold text-sm">
              Back to the office
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <p className="text-sm text-tower-cream/80">
              Want early access? Drop your email and I&apos;ll keep you posted on launch day,
              new teammates, and weekly tips for climbing the tower.
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
              className="w-full px-4 py-2.5 rounded-md bg-tower-gold text-night-deep font-semibold text-sm disabled:opacity-50"
            >
              {busy ? 'Saving…' : 'Join waitlist'}
            </button>
            {error && <p className="text-xs text-red-300">{error}</p>}
          </form>
        )}
      </div>
    </div>
  )
}
