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
import { youtubeEmbedUrl } from '@/lib/youtubeUrl'

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
        <p className="text-sm text-tower-cream/70 mb-5 leading-relaxed">
          Welcome to Diaflow Tower. Our AI teammates launch soon — meanwhile,
          build your team, climb the tower, and the top floors win free usage
          at launch. Every great team needs a name. What&apos;s yours called?
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
        <p className="text-sm text-tower-cream/70 mb-5">What's your title/position in a company?</p>
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
  // Render priority:
  //   1. loading  → spinner + "matching…" — Diaflow API in flight
  //   2. reason   → personalised heading + reason (whitespace-pre-line)
  //   3. neither  → generic "12 hours back" pitch
  //
  // Showing the loading state INSTEAD of the default copy means the
  // user doesn't see the generic pitch flash + then swap to the
  // personalised one when the API responds — a single coherent
  // "finding your match" experience.
  const hasReason = !!(reason && reason.trim())
  const showLoading = !!loading && !hasReason
  return (
    <ModalShell onClose={onNext}>
      <div>
        <div className="text-4xl mb-3" aria-hidden>💁</div>

        {showLoading ? (
          // Loading state — Diaflow API hasn't returned yet. Replaces
          // both the personalised + default content so there's only
          // ever one "phase" visible at a time. The CTA below stays
          // enabled so the user can skip ahead if they don't want to
          // wait (clicking advances to Leo regardless).
          <>
            <div className="text-[10px] uppercase tracking-[0.18em] text-purple-300/80 mb-1">
              Matching your AI teammate
            </div>
            <h2 className="text-xl font-bold mb-4">
              Finding the right fit…
            </h2>
            <div className="flex items-start gap-3 py-4 mb-5 rounded-lg border border-purple-500/25 bg-purple-500/5 px-4">
              <MiaSpinner />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-purple-200">
                  Analyzing your role…
                </p>
                <p className="text-xs text-tower-cream/60 mt-0.5 leading-relaxed">
                  We&apos;re picking the perfect AI teammate for what you do.
                  This usually takes a couple of seconds.
                </p>
              </div>
            </div>
          </>
        ) : hasReason ? (
          // Diaflow returned a real rationale — surface the role as
          // the heading and the reason as a styled bullet list. The
          // upstream returns bullet-style text separated by `\n`, so
          // we split on newlines and render each non-empty line as a
          // <li> inside the same purple-bordered card the MiaInfoCard
          // uses. Leading bullet characters are stripped so we can
          // supply our own glyph (visual consistency between the two
          // Mia surfaces).
          <>
            <div className="text-[10px] uppercase tracking-[0.18em] text-purple-300/80 mb-1">
              Your AI assistant match
            </div>
            <h2 className="text-xl font-bold mb-3">
              {recommendedRole ?? 'Hi, I’m Mia — your Assistant.'}
            </h2>
            <div className="rounded-lg border border-purple-500/25 bg-purple-500/5 px-4 py-3 mb-5">
              <p className="text-[10px] uppercase tracking-[0.18em] text-purple-300/80 mb-2">
                What Mia will do for you
              </p>
              <ul className="space-y-2">
                {reason!
                  .split('\n')
                  .map(line => line.replace(/^[-•·*]\s*/, '').trim())
                  .filter(line => line.length > 0)
                  .map((line, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <span className="text-purple-300 mt-0.5 leading-none" aria-hidden>•</span>
                      <span className="text-tower-cream/85">{line}</span>
                    </li>
                  ))}
              </ul>
            </div>
          </>
        ) : (
          // Default fallback — Diaflow not configured / upstream
          // failed / no loading flag. Shows the generic pitch so the
          // modal isn't blank for users without a personalised
          // recommendation.
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
                That&apos;s 12 hours back in your week.
              </p>
            </div>
          </>
        )}

        <button
          type="button"
          onClick={onNext}
          className="w-full px-4 py-3 rounded-lg bg-tower-gold text-night-deep font-bold text-sm hover:bg-tower-gold/90 transition"
        >
          {showLoading ? 'Skip & meet your next teammate →' : 'Meet your next teammate →'}
        </button>
      </div>
    </ModalShell>
  )
}

/** Purple loading spinner used by MiaInfoBubble while the Diaflow
 *  job-summary API is in flight. Tailwind's `animate-spin` keeps the
 *  whole svg rotating; the masked arc gives it visible motion. */
function MiaSpinner() {
  return (
    <svg
      className="animate-spin text-purple-300 shrink-0"
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeOpacity="0.25"
        strokeWidth="3"
      />
      <path
        d="M22 12a10 10 0 0 1-10 10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  )
}

/* ── 4. Leo — YouTube video (waitlist email was removed) ─────────
 *
 * Leo used to capture an email for a separate waitlist list. That
 * collection now happens implicitly at signup — the signup route
 * writes the user's email into both `User` and `EmailCapture`. Leo's
 * job in onboarding is to play the intro video and hand control off
 * to the final office scene.
 */

interface LeoProps {
  /** Fired when the user dismisses the modal (X close, backdrop
   *  click, or the "Got it" CTA). Advances `onboardingStep` to
   *  `done` so the office unlocks. */
  onContinue: () => void
}

export function LeoBubble({ onContinue }: LeoProps) {
  // Resolve YouTube URL from env. Both embed + watch flavours of the
  // same ID are returned so the iframe can play in-place AND the
  // "Watch on YouTube" button can deep-link to youtube.com.
  const video = youtubeEmbedUrl(process.env.NEXT_PUBLIC_YOUTUBE_URL)

  return (
    <ModalShell onClose={onContinue} wide>
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
          <p className="text-sm font-semibold text-tower-cream">
            🚀 Hi, I&apos;m Leo — here&apos;s a quick tour of what we&apos;re building.
          </p>
          <a
            href={video.watch}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-night-deep/80 border border-white/10 text-xs text-tower-cream/80 hover:bg-night-deep hover:text-tower-cream transition whitespace-nowrap"
          >
            ▶ Watch on YouTube
          </a>
        </div>

        <button
          type="button"
          onClick={onContinue}
          className="w-full px-4 py-3 rounded-lg bg-tower-gold text-night-deep font-bold text-sm hover:bg-tower-gold/90 transition"
        >
          Got it — let&apos;s climb →
        </button>
      </div>
    </ModalShell>
  )
}
