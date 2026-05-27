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
import { useAnchorPosition } from '@/lib/anchorPositions'
import { useIsDesktop } from '@/hooks/useIsDesktop'

/**
 * Shared card chrome. Renders the green "online" dot + X close + a
 * fade-in pop animation so the modal feels like it lands on the
 * character rather than appearing instantly.
 */
function ModalShell({
  onClose,
  wide,
  statusPill,
  step,
  totalSteps = 4,
  anchorSlug,
  children,
}: {
  onClose: () => void
  wide?: boolean
  /** Optional small pill rendered top-left (replaces the original
   *  unexplained green dot). Desktop-only — mobile mockup omits it
   *  in favour of the step-dot indicator at the top of the sheet. */
  statusPill?: string
  /** 1-indexed step number. When set, mobile renders a grip + dot
   *  progress strip at the top of the sheet (Section 1 mockup). */
  step?: number
  /** Total step count for the dot strip. Defaults to 4 (the current
   *  iris → mia → mia-info → leo flow). */
  totalSteps?: number
  /** Character slug to anchor beside on DESKTOP (iris / mia / leo).
   *  When set, the desktop card floats next to the live 3D character
   *  position (following it every frame) instead of sitting centered.
   *  Mobile always keeps the bottom-sheet layout — a per-frame
   *  transform would fight the sheet's bottom-edge position. */
  anchorSlug?: string | null
  children: React.ReactNode
}) {
  // Live character-anchor only on desktop. `useAnchorPosition` returns
  // a ref the rAF loop writes `translate3d(...)` onto every frame.
  // Edge-aware mode: the hook owns the full placement — it parks the
  // card to the RIGHT of the character, but flips to the LEFT (and
  // clamps vertically) when the right side would clip off-screen. This
  // is what keeps a right-edge character like Leo from overflowing.
  const isDesktop = useIsDesktop()
  const anchorRef = useAnchorPosition(
    anchorSlug && isDesktop ? anchorSlug : null,
    { flipEdge: true, vCenter: true, gap: 28 },
  )
  const anchored = !!anchorSlug && isDesktop

  return (
    <div
      role="dialog"
      aria-modal="true"
      className={
        'fixed inset-0 z-30 flex items-end md:items-center justify-center bg-black/55 backdrop-blur-sm md:px-4 ' +
        // When anchored on desktop, drop the dim backdrop so the office
        // scene + the character the bubble points at stay visible.
        (anchored ? 'md:bg-transparent md:backdrop-blur-0' : '')
      }
      onClick={onClose}
    >
      {/* Anchor wrapper — absolutely positioned at the viewport origin
          on desktop when anchored; the rAF loop transforms it to the
          character's screen pixel. On mobile (or unanchored desktop)
          it's an inert pass-through. */}
      <div
        ref={anchored ? anchorRef : undefined}
        onClick={e => e.stopPropagation()}
        className={
          'w-full md:w-auto ' +
          (anchored ? 'md:absolute md:top-0 md:left-0 md:pointer-events-none' : '')
        }
        style={anchored ? { willChange: 'transform' } : undefined}
      >
      <div
        className={
          'relative w-full bg-night-mid border border-white/10 text-tower-cream shadow-2xl animate-onboarding-pop ' +
          // Mobile: bottom sheet with grip — full width, rounded top
          // only, anchored to bottom. Desktop: rounded card.
          'rounded-t-3xl md:rounded-2xl ' +
          (anchored
            ? // Anchored desktop card — fixed comfortable width beside
              // the character. Re-enable pointer events the wrapper
              // dropped so the card stays interactive.
              'md:pointer-events-auto ' +
              (wide
                ? 'md:w-[min(520px,calc(100vw-32px))] '
                : 'md:w-[min(420px,calc(100vw-32px))] ')
            : // Centered fallback.
              (wide ? 'md:max-w-2xl md:mx-auto ' : 'md:max-w-md md:mx-auto '))
        }
        style={{
          boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        {/* Mobile grip + step dots — replaces the green dot for mobile
            users (Section 1 mockup). Hidden on desktop where the
            centered modal doesn't read as a draggable sheet. */}
        {typeof step === 'number' && (
          <div className="md:hidden flex flex-col items-center pt-2.5 pb-1" aria-hidden>
            <div className="w-9 h-1 rounded-full bg-white/20" />
            <div className="flex items-center gap-1.5 mt-2">
              {Array.from({ length: totalSteps }).map((_, i) => (
                <span
                  key={i}
                  className={
                    'rounded-full transition-colors ' +
                    (i + 1 === step
                      ? 'w-4 h-1.5 bg-purple-400'
                      : 'w-1.5 h-1.5 bg-white/20')
                  }
                />
              ))}
            </div>
          </div>
        )}

        {/* Desktop-only status pill — top-left of the card. */}
        {statusPill && (
          <span
            className="hidden md:inline-flex absolute top-3 left-3 items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-400/10 border border-emerald-400/25 text-emerald-300 text-[10px] font-bold uppercase tracking-[0.08em]"
          >
            <span
              aria-hidden
              className="w-1.5 h-1.5 rounded-full bg-emerald-400"
              style={{ boxShadow: '0 0 6px rgba(52, 211, 153, 0.7)' }}
            />
            {statusPill}
          </span>
        )}

        {/* × close — hidden on mobile (the mockup relies on grip-drag
            / backdrop tap), shown on desktop where there's no grip. */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="hidden md:flex absolute top-3 right-3 p-1.5 rounded-md text-tower-cream/60 hover:text-tower-cream hover:bg-white/5 transition"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        <div
          className={
            // Mobile: tighter top padding since the grip+dots already
            // occupy that space. Desktop: room for the pill / close.
            (typeof step === 'number' ? 'pt-3 ' : 'pt-12 ') +
            (statusPill ? 'md:pt-14 ' : 'md:pt-12 ') +
            'px-6 pb-6'
          }
        >
          {children}
        </div>
      </div>
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
    <ModalShell onClose={onSkip} step={1} anchorSlug="iris">
      {/* Alignment splits by breakpoint:
            mobile  → centered (matches the bottom-sheet onboarding)
            desktop → left-aligned bubble (matches the Option-B mockup),
                      with the 🤝 inline before the headline. */}
      <div className="text-center md:text-left">
        {/* Emoji — own line + centered on mobile; inline before the
            headline on desktop (the md:inline copy lives inside the
            <h2> below). */}
        <div className="text-3xl mb-2.5 md:hidden" aria-hidden>🤝</div>
        <h2 className="text-[24px] md:text-[26px] font-extrabold leading-tight tracking-tight mb-3">
          <span className="hidden md:inline mr-2.5" aria-hidden>🤝</span>
          Hire your AI team — for free.
        </h2>
        <p className="text-[14px] text-tower-cream/70 leading-relaxed mb-2.5">
          Diaflow is launching{' '}
          <strong className="text-tower-cream font-semibold">AI Teammate</strong>{' '}
          this summer — real AI workers, not just chat.
        </p>
        <p className="text-[14px] text-tower-cream/85 font-semibold leading-relaxed mb-4">
          Every teammate you earn is yours at launch.
        </p>
        <form
          onSubmit={e => {
            e.preventDefault()
            if (value.trim()) onSubmit(value.trim())
          }}
        >
          <label
            htmlFor="iris-company-name"
            className="block text-[11px] font-bold uppercase tracking-[0.06em] text-purple-300 mb-1.5"
          >
            Name your office
          </label>
          <input
            id="iris-company-name"
            type="text"
            autoFocus
            value={value}
            onChange={e => setValue(e.target.value.slice(0, 40))}
            placeholder="e.g. Acme Co, Midnight Dev"
            // Placeholder + typed value centre on mobile, left-align on
            // desktop to match the surrounding left-aligned layout.
            className="w-full px-4 py-3 mb-3 rounded-xl bg-night-deep/80 border border-white/10 focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-500/25 text-[15px] text-center md:text-left"
          />
          <button
            type="submit"
            disabled={!value.trim()}
            className="w-full px-4 py-3.5 rounded-xl bg-gradient-to-b from-purple-300 to-purple-400 text-night-deep font-extrabold text-[15px] shadow-[0_8px_24px_rgba(168,117,255,0.4)] hover:shadow-[0_12px_28px_rgba(168,117,255,0.5)] transition disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
          >
            Build my team →
          </button>
        </form>
        {/* Footer stays centered on both breakpoints — matches the
            mockup where the "Log in" line sits centred under the CTA. */}
        <p className="mt-4 text-center text-[13px] text-tower-cream/55">
          Already saved?{' '}
          <Link href="/login" className="text-purple-300 font-semibold hover:underline">
            Log in
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
    <ModalShell onClose={onSkip} step={2} anchorSlug="mia">
      <div className="text-center">
        <div className="text-3xl mb-2" aria-hidden>💁</div>
        <h2 className="text-[22px] md:text-[24px] font-extrabold leading-tight tracking-tight mb-2">
          Hi, I&apos;m Mia —{' '}
          <span className="bg-gradient-to-r from-purple-300 to-purple-400 bg-clip-text text-transparent">
            your AI teammate.
          </span>
        </h2>
        <p className="text-[14px] text-tower-cream/70 leading-relaxed mb-4">
          Tell me what you do and I&apos;ll specialize for your role.
        </p>
        <form
          onSubmit={e => {
            e.preventDefault()
            if (value.trim()) onSubmit(value.trim())
          }}
        >
          <input
            type="text"
            autoFocus
            value={value}
            onChange={e => setValue(e.target.value.slice(0, 80))}
            placeholder="Your role"
            className="w-full px-4 py-3 mb-3 rounded-xl bg-night-deep/80 border border-white/10 focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-500/25 text-[15px] text-center"
          />
          <button
            type="submit"
            disabled={!value.trim()}
            className="w-full px-4 py-3.5 rounded-xl bg-gradient-to-b from-purple-300 to-purple-400 text-night-deep font-extrabold text-[15px] shadow-[0_8px_24px_rgba(168,117,255,0.4)] hover:shadow-[0_12px_28px_rgba(168,117,255,0.5)] transition disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
          >
            Match me →
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
  /** Raw role string the user typed in the previous step. Used to
   *  personalise the loading headline ("Building your {role}
   *  teammate…") so the morph feels addressed to them, not generic. */
  userRole?: string | null
  /** Advance to Leo step. */
  onNext: () => void
}

export function MiaInfoBubble({ recommendedRole, reason, loading, userRole, onNext }: MiaInfoProps) {
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
  // Trim + truncate the user's typed role so it fits inside the
  // morph headline without breaking layout. Empty string falls back to
  // the generic "your" copy so the headline still parses.
  const headlineRole = (userRole ?? '').trim().slice(0, 40) || 'your'
  return (
    <ModalShell onClose={onNext} step={showLoading ? 3 : 3} anchorSlug="mia">
      <div>
        {/* Each branch owns its own avatar:
              loading      → ringed MorphAvatar (sells the morph)
              personalised → simple 💁 above the combined headline
              default      → simple 💁 above the generic pitch
            so there's no duplicate when branches stack. */}

        {showLoading ? (
          // ── Mia morph / specializing state ────────────────────────
          // Replaces the previous spinner-card with the choreographed
          // morph from Section 1 / step 2 mockup: ringed avatar, role
          // label, "Building your {role} teammate…" headline,
          // adapting sub-line, progress bar, and a 2-item check list.
          // The CTA is suppressed (hidden below) so users can't skip
          // out of the ~2s morph mid-animation.
          <div className="text-center">
            <MorphAvatar />
            <div className="text-[10.5px] uppercase tracking-[0.1em] font-bold text-purple-300 mb-1.5">
              Specializing Mia for your role
            </div>
            <h2 className="text-[22px] md:text-[24px] font-extrabold leading-tight tracking-tight mb-2">
              Building your{' '}
              <span className="bg-gradient-to-r from-purple-300 to-purple-400 bg-clip-text text-transparent">
                {headlineRole}
              </span>{' '}
              teammate…
            </h2>
            <p className="text-[13.5px] text-tower-cream/65 mb-5">
              Mia is adapting to the way you work.
            </p>
            <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden mb-5">
              <div className="h-full w-3/4 bg-gradient-to-r from-purple-400 to-purple-300 rounded-full animate-morph-progress" />
            </div>
            <ul className="text-left text-[13px] space-y-2">
              <li className="flex items-center gap-2.5 text-tower-cream/80">
                <span className="text-emerald-400 font-extrabold leading-none" aria-hidden>✓</span>
                <span>Calibrating to your role</span>
              </li>
              <li className="flex items-center gap-2.5 text-tower-cream/55">
                <MorphSpinnerDot />
                <span>Matching to your role…</span>
              </li>
            </ul>
          </div>
        ) : hasReason ? (
          // Diaflow returned a real rationale. Single combined headline
          // ("Hi, I'm Mia — your <role>. I'm on your team the day AI
          // Teammate launches:") with the role in purple gradient,
          // followed by a purple-bordered card containing the bullet
          // list (mockup Section 1 / step 3). Leading bullet glyphs
          // from the upstream are stripped so we can supply our own
          // (visual consistency between Mia surfaces).
          <div className="text-center">
            <div className="text-3xl mb-2.5" aria-hidden>💁</div>
            <h2 className="text-[19px] md:text-[20px] font-extrabold leading-snug tracking-tight mb-4">
              Hi, I&apos;m Mia —{' '}
              <span className="bg-gradient-to-r from-purple-300 to-purple-400 bg-clip-text text-transparent">
                your {recommendedRole ?? 'AI teammate'}.
              </span>{' '}
              I&apos;m on your team the day AI Teammate launches:
            </h2>
            <div className="text-left rounded-xl border border-purple-500/25 bg-purple-500/[0.04] px-4 py-3 mb-5">
              <ul className="space-y-2">
                {reason!
                  .split('\n')
                  .map(line => line.replace(/^[-•·*]\s*/, '').trim())
                  .filter(line => line.length > 0)
                  .map((line, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-[14px]">
                      <span className="text-purple-300 mt-1 leading-none" aria-hidden>•</span>
                      <span className="text-tower-cream/85">{line}</span>
                    </li>
                  ))}
              </ul>
            </div>
          </div>
        ) : (
          // Default fallback — Diaflow not configured / upstream
          // failed / no loading flag. Shows the generic pitch so the
          // modal isn't blank for users without a personalised
          // recommendation.
          <>
            <div className="text-3xl mb-2.5 text-center md:text-left" aria-hidden>💁</div>
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

        {!showLoading && (
          <button
            type="button"
            onClick={onNext}
            className="w-full px-4 py-3.5 rounded-xl bg-gradient-to-b from-purple-300 to-purple-400 text-night-deep font-extrabold text-[15px] shadow-[0_8px_24px_rgba(168,117,255,0.4)] hover:shadow-[0_12px_28px_rgba(168,117,255,0.5)] transition"
          >
            Meet the rest →
          </button>
        )}
      </div>
    </ModalShell>
  )
}

/** Circular "morph" avatar — 💁 emoji wrapped in a spinning purple
 *  arc ring. Used by the Mia loading state to sell the ~2s
 *  "specializing" transformation as something happening, not theater.
 *  Two concentric arcs spin in opposite directions for visual depth. */
function MorphAvatar() {
  return (
    <div className="relative w-[88px] h-[88px] mx-auto mb-4">
      {/* Soft purple glow background */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background:
            'radial-gradient(circle, rgba(168,117,255,0.35) 0%, transparent 70%)',
        }}
      />
      {/* Outer ring — slower, reverse direction */}
      <div
        className="absolute -inset-2 rounded-full border-2 border-purple-400/40 animate-spin"
        style={{
          borderTopColor: 'transparent',
          animationDuration: '1.8s',
          animationDirection: 'reverse',
        }}
      />
      {/* Inner ring — faster, forward direction */}
      <div
        className="absolute inset-0 rounded-full border-2 border-purple-400 animate-spin"
        style={{
          borderTopColor: 'transparent',
          animationDuration: '1.2s',
        }}
      />
      {/* Emoji center — gently pulses */}
      <div className="absolute inset-0 flex items-center justify-center text-[56px] leading-none animate-morph-pulse">
        <span aria-hidden>💁</span>
      </div>
    </div>
  )
}

/** Pending-step dot used inside the morph check list. A small ring
 *  with an open top arc that spins — visually matches the "in progress"
 *  state from the mockup without needing a separate svg. */
function MorphSpinnerDot() {
  return (
    <span
      aria-hidden
      className="inline-block w-3.5 h-3.5 rounded-full border-[1.5px] border-tower-cream/40 animate-spin shrink-0"
      style={{ borderTopColor: 'transparent', animationDuration: '0.9s' }}
    />
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
  // Resolve YouTube URL from env. Embed URL is the only flavour needed
  // now — the "Watch on YouTube" link was removed per the Section 1 /
  // step 4 mockup (the inline play button covers the same path).
  const video = youtubeEmbedUrl(process.env.NEXT_PUBLIC_YOUTUBE_URL)

  return (
    <ModalShell onClose={onContinue} wide step={4} anchorSlug="leo">
      <div>
        {/* Embedded YouTube iframe driven by NEXT_PUBLIC_YOUTUBE_URL.
            16:9 aspect ratio + purple glow underneath so the video
            doesn't look pasted onto the dark surface. */}
        <div className="relative mb-4">
          <div
            aria-hidden
            className="absolute -inset-2 rounded-2xl opacity-50 blur-2xl"
            style={{
              background:
                'radial-gradient(circle at 50% 70%, rgba(168,117,255,0.35), transparent 65%)',
            }}
          />
          <div className="relative rounded-xl overflow-hidden border border-white/10 aspect-video bg-black">
            <iframe
              src={video.embed}
              title="Diaflow intro"
              allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              className="w-full h-full"
            />
          </div>
        </div>

        {/* Leo's one-liner — purple gradient highlights his specialised
            role (mirrors the "your AI Pair Programmer" treatment Mia
            uses one step earlier). */}
        <p className="text-center text-[14px] text-tower-cream leading-relaxed mb-4">
          <span aria-hidden>🚀</span> Hi, I&apos;m Leo —{' '}
          <span className="bg-gradient-to-r from-purple-300 to-purple-400 bg-clip-text text-transparent font-semibold">
            your AI Demo Specialist.
          </span>{' '}
          60-sec tour of your office.
        </p>

        {/* Purple-tinted promise reminder — third and final beat of
            the "keep it" promise from Iris → Mia → Leo. Matches the
            purple accent used throughout the rest of the onboarding. */}
        <div className="flex items-center justify-center gap-2 rounded-xl border-y border-purple-400/25 bg-purple-500/[0.05] px-3 py-2.5 mb-4 text-[12.5px] font-semibold text-purple-300">
          <span aria-hidden>🔒</span>
          <span>Every teammate is yours at launch.</span>
        </div>

        <button
          type="button"
          onClick={onContinue}
          className="w-full px-4 py-3.5 rounded-xl bg-gradient-to-b from-purple-300 to-purple-400 text-night-deep font-extrabold text-[15px] shadow-[0_8px_24px_rgba(168,117,255,0.4)] hover:shadow-[0_12px_28px_rgba(168,117,255,0.5)] transition"
        >
          Let&apos;s climb →
        </button>
      </div>
    </ModalShell>
  )
}
