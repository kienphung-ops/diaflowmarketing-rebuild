'use client'

import { useState } from 'react'

/**
 * HTML overlay versions of the 3-step onboarding bubbles. Anchored via fixed
 * screen positioning (vs R3F Html) — keeps interaction simple and avoids
 * camera-tracking jank. The active NPC's character body in the canvas
 * provides the visual anchor.
 */

function Shell({
  role,
  name,
  children,
  wide,
}: {
  role: string
  name: string
  children: React.ReactNode
  wide?: boolean
}) {
  return (
    <div
      className={`${wide ? 'w-[480px]' : 'w-80'} bg-night-mid/95 border border-tower-gold/40 rounded-xl p-4 text-tower-cream shadow-2xl backdrop-blur-md`}
    >
      <div className="text-[10px] uppercase tracking-widest text-tower-gold/80">{role}</div>
      <div className="text-base font-bold mb-2">{name}</div>
      {children}
    </div>
  )
}

interface IrisProps {
  onSubmit: (companyName: string) => void
}

export function IrisBubble({ onSubmit }: IrisProps) {
  const [value, setValue] = useState('')
  return (
    <Shell role="AI Recruiter" name="Hi, I'm Iris 👋">
      <p className="text-sm text-tower-cream/80 mb-3">
        Welcome to Diaflow Tower! Every great team needs a name. What&apos;s yours called?
      </p>
      <form
        onSubmit={e => {
          e.preventDefault()
          if (value.trim()) onSubmit(value.trim())
        }}
        className="space-y-2"
      >
        <input
          type="text"
          autoFocus
          value={value}
          onChange={e => setValue(e.target.value.slice(0, 40))}
          placeholder="e.g. Midnight Dev, Caffeine HR…"
          className="w-full px-3 py-2 rounded-md bg-night-deep border border-white/10 focus:border-tower-gold focus:outline-none text-sm"
        />
        <button
          type="submit"
          disabled={!value.trim()}
          className="w-full px-3 py-2 rounded-md bg-tower-gold text-night-deep font-semibold text-sm disabled:opacity-50"
        >
          Let&apos;s go →
        </button>
      </form>
    </Shell>
  )
}

interface MiaProps {
  companyName: string
  onSubmit: (teamPurpose: string) => void
}

export function MiaBubble({ companyName, onSubmit }: MiaProps) {
  const [value, setValue] = useState('')
  return (
    <Shell role="Onboarding" name="Mia">
      <p className="text-xs uppercase tracking-wider text-tower-cream/50 mb-1">
        Tell me about {companyName}
      </p>
      <p className="text-sm font-semibold text-tower-gold mb-2">What does your team build?</p>
      <p className="text-sm text-tower-cream/70 mb-3">
        One sentence is fine — I&apos;ll match you with the right AI teammates from there.
      </p>
      <form
        onSubmit={e => {
          e.preventDefault()
          if (value.trim()) onSubmit(value.trim())
        }}
        className="space-y-2"
      >
        <textarea
          autoFocus
          value={value}
          onChange={e => setValue(e.target.value.slice(0, 200))}
          placeholder="e.g. We build AI-powered support chatbots for SaaS companies."
          rows={3}
          className="w-full px-3 py-2 rounded-md bg-night-deep border border-white/10 focus:border-tower-gold focus:outline-none text-sm resize-none"
        />
        <button
          type="submit"
          disabled={!value.trim()}
          className="w-full px-3 py-2 rounded-md bg-tower-gold text-night-deep font-semibold text-sm disabled:opacity-50"
        >
          Got it →
        </button>
      </form>
    </Shell>
  )
}

interface LeoProps {
  onSubmit: (email: string) => void
  onSkip: () => void
}

export function LeoBubble({ onSubmit, onSkip }: LeoProps) {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.includes('@')) {
      setError('Enter a valid email')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await fetch('/api/capture-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), source: 'onboarding-leo' }),
      })
      onSubmit(email.trim().toLowerCase())
    } catch {
      onSubmit(email.trim().toLowerCase())
    } finally {
      setBusy(false)
    }
  }

  return (
    <Shell role="Waitlist Coach" name="Leo" wide>
      <div className="mb-3 rounded-md overflow-hidden border border-white/10 aspect-video bg-black">
        <iframe
          src="https://www.youtube-nocookie.com/embed/KmigxFKQ3XE?rel=0&modestbranding=1"
          title="Diaflow Tower intro"
          allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          className="w-full h-full"
        />
      </div>
      <p className="text-sm text-tower-cream/80 mb-3">
        That&apos;s how it works. Want early access? Drop your email and I&apos;ll keep you posted.
      </p>
      <form onSubmit={handleSubmit} className="space-y-2">
        <input
          type="email"
          autoFocus
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full px-3 py-2 rounded-md bg-night-deep border border-white/10 focus:border-tower-gold focus:outline-none text-sm"
        />
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={busy}
            className="flex-1 px-3 py-2 rounded-md bg-tower-gold text-night-deep font-semibold text-sm disabled:opacity-50"
          >
            {busy ? 'Sending…' : 'Join waitlist'}
          </button>
          <button
            type="button"
            onClick={onSkip}
            className="px-3 py-2 rounded-md text-xs text-tower-cream/60 hover:text-tower-cream"
          >
            Skip
          </button>
        </div>
        {error && <p className="text-xs text-red-300">{error}</p>}
      </form>
    </Shell>
  )
}
