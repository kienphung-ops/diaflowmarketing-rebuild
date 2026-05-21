'use client'

/**
 * Onboarding modals — centered cards that appear AFTER each character
 * has had a moment to land on the floor (the delay is owned by
 * TowerLanding.client → modalVisible state).
 *
 * Visual model: a dark rounded card centered over a dim backdrop,
 * with a green "live" dot in the top-left and an X close in the
 * top-right. The close button advances the onboarding step (skip).
 *
 * Four modals, in order:
 *   1. IrisBubble    — team name input
 *   2. MiaBubble     — user's job role input
 *   3. MiaInfoBubble — Mia's "what I'll do" intro card (no input)
 *   4. LeoBubble     — video + waitlist email form
 */

import Link from 'next/link'
import { useState } from 'react'

/**
 * Convert any common YouTube URL form into the embed URL the iframe
 * needs. Accepts:
 *   - https://www.youtube.com/watch?v=ID
 *   - https://youtu.be/ID
 *   - https://www.youtube-nocookie.com/embed/ID
 * Falls back to the legacy Diaflow intro video when the env var is
 * missing or malformed.
 */
const FALLBACK_VIDEO_ID = 'KmigxFKQ3XE'
function youtubeEmbedUrl(raw: string | undefined): { embed: string; watch: string } {
  const fallback = {
    embed: `https://www.youtube-nocookie.com/embed/${FALLBACK_VIDEO_ID}?rel=0&modestbranding=1`,
    watch: `https://www.youtube.com/watch?v=${FALLBACK_VIDEO_ID}`,
  }
  if (!raw) return fallback
  const m =
    raw.match(/[?&]v=([^&]+)/) ??
    raw.match(/youtu\.be\/([^?]+)/) ??
    raw.match(/embed\/([^?]+)/)
  const id = m?.[1]
  if (!id) return fallback
  return {
    embed: `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1`,
    watch: `https://www.youtube.com/watch?v=${id}`,
  }
}

/**
 * Shared card chrome. Renders the green "online" dot + X close + a
 * fade-in pop animation so the modal feels like it lands on the
 * character rather than appearing instantly.
 */
function ModalShell({
  onClose,
  wide,
  children,
}: {
  onClose: () => void
  wide?: boolean
  children: React.ReactNode
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-30 flex items-center justify-center bg-black/55 backdrop-blur-sm px-4"
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        className={`relative ${wide ? 'max-w-2xl' : 'max-w-md'} w-full bg-night-mid border border-white/10 rounded-2xl text-tower-cream shadow-2xl animate-onboarding-pop`}
        style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.6)' }}
      >
        {/* Green "live" indicator — pinned top-left, mirrors the
            screenshots. Glow ring is purely cosmetic. */}
        <span
          aria-hidden
          className="absolute top-4 left-4 inline-block w-3 h-3 rounded-full bg-emerald-400"
          style={{ boxShadow: '0 0 12px rgba(52, 211, 153, 0.6)' }}
        />
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-3 p-1.5 rounded-md text-tower-cream/60 hover:text-tower-cream hover:bg-white/5 transition"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
        <div className="px-6 pt-12 pb-6">{children}</div>
      </div>
    </div>
  )
}

/* ── 1. Iris — team name ───────────────────────────────────────── */

interface IrisProps {
  onSubmit: (companyName: string) => void
  /** Skip this step (e.g. user closes the modal). Advances to Mia. */
  onSkip: () => void
}

export function IrisBubble({ onSubmit, onSkip }: IrisProps) {
  const [value, setValue] = useState('')
  return (
    <ModalShell onClose={onSkip}>
      <div className="text-center">
        <div className="text-4xl mb-3" aria-hidden>🤝</div>
        <h2 className="text-xl font-bold mb-1">Hi, I&apos;m Iris</h2>
        <p className="text-sm text-tower-cream/70 mb-5">
          Every great team needs a name. What&apos;s yours called?
        </p>
        <form
          onSubmit={e => {
            e.preventDefault()
            if (value.trim()) onSubmit(value.trim())
          }}
          className="space-y-3"
        >
          <input
            type="text"
            autoFocus
            value={value}
            onChange={e => setValue(e.target.value.slice(0, 40))}
            placeholder="e.g. Midnight Dev, Caffeine HR…"
            className="w-full px-4 py-2.5 rounded-lg bg-night-deep/80 border border-white/10 focus:border-tower-gold focus:outline-none text-sm text-center"
          />
          <button
            type="submit"
            disabled={!value.trim()}
            className="w-full px-4 py-3 rounded-lg bg-tower-gold text-night-deep font-bold text-sm hover:bg-tower-gold/90 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Let&apos;s go →
          </button>
        </form>
        <p className="mt-4 text-xs text-tower-cream/50">
          Already have an office?{' '}
          <Link href="/login" className="text-tower-gold hover:underline">
            Log in →
          </Link>
        </p>
      </div>
    </ModalShell>
  )
}

/* ── 2. Mia step 1 — user's job role ───────────────────────────── */

interface MiaProps {
  onSubmit: (jobRole: string) => void
  /** Skip with no value (X close) — advances to mia-info. */
  onSkip: () => void
}

export function MiaBubble({ onSubmit, onSkip }: MiaProps) {
  const [value, setValue] = useState('')
  return (
    <ModalShell onClose={onSkip}>
      <div className="text-center">
        <div className="text-4xl mb-3" aria-hidden>💁</div>
        <h2 className="text-xl font-bold mb-1">Hi, I&apos;m Mia</h2>
        <p className="text-sm text-tower-cream/70 mb-5">What do you do for work?</p>
        <form
          onSubmit={e => {
            e.preventDefault()
            if (value.trim()) onSubmit(value.trim())
          }}
          className="space-y-3"
        >
          <input
            type="text"
            autoFocus
            value={value}
            onChange={e => setValue(e.target.value.slice(0, 80))}
            placeholder="e.g. CEO, Developer, Designer…"
            className="w-full px-4 py-2.5 rounded-lg bg-night-deep/80 border border-white/10 focus:border-tower-gold focus:outline-none text-sm text-center"
          />
          <button
            type="submit"
            disabled={!value.trim()}
            className="w-full px-4 py-3 rounded-lg bg-tower-gold text-night-deep font-bold text-sm hover:bg-tower-gold/90 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Let&apos;s see →
          </button>
        </form>
      </div>
    </ModalShell>
  )
}

/* ── 3. Mia step 2 — assistant intro card ──────────────────────── */

interface MiaInfoProps {
  /** Diaflow-derived recommended role (e.g. "Executive Strategy Chief
   *  of Staff"). When set alongside `reason`, the modal renders the
   *  personalised copy. Falls back to the generic "40+ inbox threads /
   *  6 weekly meetings" pitch when null. */
  recommendedRole?: string | null
  /** Diaflow-derived rationale that accompanies the role. Same
   *  null-fallback rules as `recommendedRole`. */
  reason?: string | null
  /** True while the upstream Diaflow call is still in flight after
   *  the user submitted their job — swaps in a "Hang on…" hint so the
   *  modal doesn't read like a frozen default. */
  loading?: boolean
  /** Advance to Leo step. */
  onNext: () => void
}

export function MiaInfoBubble({ recommendedRole, reason, loading, onNext }: MiaInfoProps) {
  const personalised = !!(recommendedRole && reason)
  return (
    <ModalShell onClose={onNext}>
      <div>
        <div className="text-4xl mb-3" aria-hidden>💁</div>

        {personalised ? (
          // Diaflow returned a real recommendation — surface the role
          // as the heading and the reason as the body. The generic
          // "12 hours back" pitch is suppressed in favour of the
          // role-specific copy.
          <>
            <div className="text-[10px] uppercase tracking-[0.18em] text-purple-300/80 mb-1">
              Your AI assistant match
            </div>
            <h2 className="text-xl font-bold mb-3">{recommendedRole}</h2>
            <p className="text-sm text-tower-cream/80 leading-relaxed mb-5">
              {reason}
            </p>
          </>
        ) : (
          // Default fallback — Diaflow not configured, upstream
          // failure, or still loading. The footer line swaps to a
          // "Hang on…" hint while `loading` is true so the user knows
          // the modal isn't stuck.
          <>
            <h2 className="text-xl font-bold mb-3">
              Hi, I&apos;m Mia — your Assistant.
            </h2>
            <p className="text-sm text-tower-cream/80 leading-relaxed mb-4">
              AI Teammates are launching soon. When Mia launches, she&apos;ll triage
              your <span className="font-semibold">40+ inbox threads</span>, draft your
              investor updates, and summarize your <span className="font-semibold">6 weekly meetings</span>{' '}
              before you even open your laptop.
            </p>
            <div className="border-t border-white/10 pt-3 mb-5">
              <p className="text-sm font-bold text-purple-300">
                {loading
                  ? 'Hang on — matching you with the right teammate…'
                  : "That's 12 hours back in your week."}
              </p>
            </div>
          </>
        )}

        <button
          type="button"
          onClick={onNext}
          className="w-full px-4 py-3 rounded-lg bg-tower-gold text-night-deep font-bold text-sm hover:bg-tower-gold/90 transition"
        >
          Meet your next teammate →
        </button>
      </div>
    </ModalShell>
  )
}

/* ── 4. Leo — waitlist email + YouTube video ───────────────────── */

interface LeoProps {
  onSubmit: (email: string) => void
  onSkip: () => void
}

export function LeoBubble({ onSubmit, onSkip }: LeoProps) {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Resolve YouTube URL from env. Both embed + watch flavours of the
  // same ID are returned so the iframe can play in-place AND the
  // "Watch on YouTube" button can deep-link to youtube.com.
  const video = youtubeEmbedUrl(process.env.NEXT_PUBLIC_YOUTUBE_URL)

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
      // Network failure — still close the modal so the user isn't
      // stuck. The capture endpoint already logs server-side.
      onSubmit(email.trim().toLowerCase())
    } finally {
      setBusy(false)
    }
  }

  return (
    <ModalShell onClose={onSkip} wide>
      <div>
        {/* Video — embedded YouTube iframe driven by NEXT_PUBLIC_YOUTUBE_URL */}
        <div className="rounded-lg overflow-hidden border border-white/10 aspect-video bg-black mb-4 relative">
          <iframe
            src={video.embed}
            title="Diaflow intro"
            allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            className="w-full h-full"
          />
        </div>

        <div className="flex items-center justify-between mb-4 gap-3">
          <a
            href={video.watch}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-night-deep/80 border border-white/10 text-xs text-tower-cream/80 hover:bg-night-deep hover:text-tower-cream transition"
          >
            ▶ Watch on YouTube
          </a>
        </div>

        <div className="border-t border-white/10 pt-4">
          <p className="text-sm font-semibold mb-3">
            🚀 Hi, I&apos;m Leo — join the waitlist to get early access
          </p>
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              type="email"
              autoFocus
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="flex-1 px-3 py-2.5 rounded-lg bg-night-deep/80 border border-white/10 focus:border-tower-gold focus:outline-none text-sm"
            />
            <button
              type="submit"
              disabled={busy}
              className="px-5 py-2.5 rounded-lg bg-tower-gold text-night-deep font-bold text-sm hover:bg-tower-gold/90 transition disabled:opacity-50 whitespace-nowrap"
            >
              {busy ? 'Saving…' : 'Join waitlist'}
            </button>
          </form>
          {error && <p className="mt-2 text-xs text-red-300">{error}</p>}
        </div>
      </div>
    </ModalShell>
  )
}
