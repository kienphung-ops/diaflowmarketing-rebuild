'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { SpinWheel, type SpinWheelHandle, type WheelWedge } from './SpinWheel'
import {
  SHARE_DWELL_SECONDS,
  SPIN_CREDIT_CAP_CENTS,
  formatCents,
  type Wedge,
} from '@/lib/spin/constants'

// ── Wedge def — DB row threaded through the spin API response ───────
// Kept loose (string fields) on the client so admins can add new wedge
// keys / reward types in the DB without an immediate code change. The
// client only needs label + amount + color + type to render and
// describe a result; behaviour is server-decided.
interface SpinWedgeDef extends WheelWedge {
  amount: number
}

// ── Shared result shape (mirrors the API) ───────────────────────────
interface SpinOutcome {
  wedge: Wedge
  cashCents: number
  isRespin: boolean
  capped: boolean
}
interface TaskState {
  key: string
  label: string
  platform: 'linkedin' | 'x'
  completed: boolean
}
interface SpinState {
  tokens: number
  creditCents: number
  capReached: boolean
  daily: { available: boolean; nextClaimAt: string | null }
  tasks: TaskState[]
  wedges: SpinWedgeDef[]
}

/** Find a wedge def by key. Returns `null` rather than throwing so the
 *  UI can render a graceful placeholder if the cache hasn't loaded yet
 *  or the wedge was retired between the spin and the result panel. */
function findWedgeDef(wedges: SpinWedgeDef[], key: string): SpinWedgeDef | null {
  return wedges.find(w => w.key === key) ?? null
}

/** Empty default — the wheel renders a single grey blank until the API
 *  response lands. The CTA stays disabled while wedges is empty, so the
 *  user can't kick off a spin against a bogus catalogue. */
const EMPTY_WEDGES: SpinWedgeDef[] = []

interface Props {
  open: boolean
  onClose: () => void
  /** 'auth' = signed-in real spins; 'anon' = the one free teaser spin. */
  mode: 'auth' | 'anon'
  /** The user's personal referral link — used by the share tasks (auth)
   *  and shown post-win. Null when unavailable. */
  inviteUrl: string | null
  /** anon-only — assembled teammate count for the save hook + the
   *  "Save my team" CTA handler. */
  teammateCount?: number
  onSaveTeam?: () => void
  /** auth-only — opens the ShareModal (used by the "Refer a friend"
   *  row in the recurring tasks section). Decoupled from `onSaveTeam`
   *  so anon mode keeps routing to signup while signed-in users land
   *  on the share-link surface. The parent typically closes the spin
   *  modal in the handler before opening ShareModal so the two don't
   *  stack visually. */
  onOpenShare?: () => void
  /** auth-only — bubble the new balance/token count up so the in-room
   *  badge + top-bar pill can refresh without a full reload. */
  onStateChange?: (s: { tokens: number; creditCents: number }) => void
  /** auth-only — the parent's live spinTokens count. Used to sync the
   *  modal's local `state.tokens` when the value changes externally
   *  (e.g. SSE delivered an invite-accepted while the modal was
   *  already open). Without this the modal sticks on the count from
   *  the last /api/spin fetch and shows stale numbers until the user
   *  closes + reopens. */
  currentSpinTokens?: number
}

// Phase state machine for one spin attempt:
//   idle         → showing the wheel + SPIN button, user hasn't clicked yet.
//   spinning     → wheel is animating to a server-decided wedge.
//   respin_ready → first wheel landed on a spin-type wedge; the bonus
//                  spin is paused waiting for the user to claim it
//                  with a fresh button click (no auto-chain).
//   result       → terminal — the result panel is showing.
type Phase = 'idle' | 'spinning' | 'respin_ready' | 'result'

export function SpinModal({
  open,
  onClose,
  mode,
  inviteUrl,
  teammateCount = 0,
  onSaveTeam,
  onOpenShare,
  currentSpinTokens,
  onStateChange,
}: Props) {
  const [state, setState] = useState<SpinState | null>(null)
  // Anon GET also returns the wedges; we keep them separately so anon
  // mode still has a wheel definition before/without setting `state`.
  const [anonWedges, setAnonWedges] = useState<SpinWedgeDef[]>(EMPTY_WEDGES)
  const [phase, setPhase] = useState<Phase>('idle')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Wheel control — imperative handle drives startSpin / lockTo / reset
  // directly. We previously held `spinToken` + `wheelTarget` as React
  // state and let SpinWheel diff them, but under React 18 batching the
  // two props would land in the same commit on a fast-API path and the
  // wheel skipped the free-spin phase entirely. The imperative API
  // makes the ordering deterministic: startSpin() runs synchronously on
  // click, lockTo() runs later when the API response lands.
  const wheelRef = useRef<SpinWheelHandle>(null)
  // The full server-decided sequence (1 or 2 outcomes for a spin_again
  // chain). `seqIdx` tracks which one the wheel is currently resolving.
  const seqRef = useRef<SpinOutcome[]>([])
  const seqIdxRef = useRef(0)
  const [shownOutcome, setShownOutcome] = useState<SpinOutcome | null>(null)
  const [respinFlash, setRespinFlash] = useState(false)

  // anon-only result
  const [anonResult, setAnonResult] = useState<SpinOutcome | null>(null)

  // Task share dwell tracking — key → seconds remaining.
  const [pendingTask, setPendingTask] = useState<string | null>(null)

  // Briefly flagged when the user's banked credit goes UP — drives a
  // single bump-and-glow animation on the balance text. Replaces the
  // old "+$X" sparkle result panel so the modal stays minimal after a
  // spin (auth mode only; anon mode still uses ResultPanel for the
  // save-team CTA).
  const [creditFlash, setCreditFlash] = useState(false)
  // Floating "+$X" indicator that rises above the balance row and
  // fades over 3 s. The `id` re-mounts the element on consecutive
  // wins so the keyframe restarts cleanly mid-animation (a stale
  // setTimeout from the prior win can't wipe a fresher one). The
  // delta is stored in CENTS — formatCents at render time.
  const [floatingCredit, setFloatingCredit] = useState<{ delta: number; id: number } | null>(null)
  const triggerCreditFlash = useCallback((deltaCents: number) => {
    setCreditFlash(true)
    setTimeout(() => setCreditFlash(false), 950)
    if (deltaCents > 0) {
      const id = Date.now()
      setFloatingCredit({ delta: deltaCents, id })
      setTimeout(() => {
        setFloatingCredit(curr => (curr?.id === id ? null : curr))
      }, 3000)
    }
  }, [])

  // External-token sync — when the parent's `spinTokens` changes
  // (typically from an SSE invite-accepted event while the modal is
  // already open) patch the modal's local `state.tokens` so the SPIN
  // button label / balance row catch up without a close-and-reopen.
  // Guarded on `mode === 'auth'` because anon mode doesn't have a
  // server-backed token balance.
  useEffect(() => {
    if (mode !== 'auth' || typeof currentSpinTokens !== 'number') return
    setState(prev => {
      if (!prev || prev.tokens === currentSpinTokens) return prev
      return { ...prev, tokens: currentSpinTokens }
    })
  }, [mode, currentSpinTokens])

  // ── Escape to close ───────────────────────────────────────────────
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // ── Load state on open ────────────────────────────────────────────
  useEffect(() => {
    if (!open) return
    setError(null)
    setPhase('idle')
    setShownOutcome(null)
    setAnonResult(null)
    // Reset the wheel so a fresh open never replays the prior spin's
    // animation. The imperative API guarantees the wheel sits idle at
    // 0deg until the user clicks SPIN (SpinWheel is also unmounted by
    // `if (!open) return null`, so the ref starts fresh each open —
    // this call is belt-and-suspenders for HMR / fast re-open).
    wheelRef.current?.reset()
    setRespinFlash(false)
    seqRef.current = []
    seqIdxRef.current = 0
    finalNumbersRef.current = null
    if (mode === 'auth') {
      fetch('/api/spin', { cache: 'no-store' })
        .then(r => (r.ok ? r.json() : null))
        .then((s: SpinState | null) => {
          if (s) setState(s)
        })
        .catch(() => {})
    } else {
      // Anon — surface a prior teaser spin if this browser already used it.
      fetch('/api/spin/anon', { cache: 'no-store' })
        .then(r => (r.ok ? r.json() : null))
        .then(
          (
            j: {
              spun: boolean
              result: { wedge: Wedge; cashCents: number } | null
              wedges?: SpinWedgeDef[]
            } | null,
          ) => {
            if (j?.wedges) setAnonWedges(j.wedges)
            if (j?.spun && j.result) {
              setAnonResult({ ...j.result, isRespin: false, capped: false })
              setPhase('result')
            }
          },
        )
        .catch(() => {})
    }
  }, [open, mode])

  // ── Auth spin ─────────────────────────────────────────────────────
  const startAuthSpin = useCallback(async () => {
    if (loading || phase === 'spinning') return
    setError(null)
    setLoading(true)
    // OPTIMISTIC: flip phase + START THE WHEEL IMMEDIATELY in free-spin
    // mode (no target yet). The wheel rotates at a steady fast pace
    // while the API call is in flight; once the server returns the
    // chosen wedge we call `lockTo(wedge)` and the wheel brakes into
    // that wedge. Hides API latency completely from the user — no
    // more "click, wait, then wheel finally spins" gap on flaky
    // connections. The imperative call here runs synchronously before
    // the await, so the rAF loop is already pushing the wheel forward
    // by the time the network request leaves the browser.
    setPhase('spinning')
    wheelRef.current?.startSpin()
    try {
      const r = await fetch('/api/spin', { method: 'POST' })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) {
        setError(j.error ?? 'Spin failed')
        setLoading(false)
        setPhase('idle')
        return
      }
      const results = (j.results ?? []) as SpinOutcome[]
      if (results.length === 0) {
        setError('Spin failed')
        setLoading(false)
        setPhase('idle')
        return
      }
      // Stash the server numbers for the result panel + bubble the
      // new token / credit count up to the PARENT immediately. The
      // arcade badge ("N spins ready") needs to reflect the
      // post-spin balance NOW — if we wait until the wheel lands,
      // closing the modal mid-animation leaves the badge showing a
      // stale count until the next /api/spin GET (or a reload).
      finalNumbersRef.current = { tokens: j.tokens, creditCents: j.creditCents, capReached: j.capReached }
      onStateChange?.({ tokens: j.tokens, creditCents: j.creditCents })
      seqRef.current = results
      seqIdxRef.current = 0
      // Engage the brake — the rAF loop transitions from constant
      // free-spin speed to cubic-ease-out into the target wedge with
      // matched initial velocity (no visible discontinuity).
      wheelRef.current?.lockTo(results[0].wedge)
    } catch {
      setError('Network error — try again')
      setLoading(false)
      setPhase('idle')
    }
  }, [loading, phase])

  const finalNumbersRef = useRef<{ tokens: number; creditCents: number; capReached: boolean } | null>(null)

  // ── Anon spin ─────────────────────────────────────────────────────
  const startAnonSpin = useCallback(async () => {
    if (loading || phase === 'spinning') return
    setError(null)
    setLoading(true)
    // Same optimistic flow as the auth spin — wheel starts free-spinning
    // immediately, brakes onto the server-returned wedge when the
    // /api/spin/anon response arrives.
    setPhase('spinning')
    wheelRef.current?.startSpin()
    try {
      const r = await fetch('/api/spin/anon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teammateCount }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) {
        // Already spun on this browser — show the prior result.
        if (j.result) {
          setAnonResult({ ...j.result, isRespin: false, capped: false })
          setPhase('result')
        } else {
          setError(j.error ?? 'Spin failed')
          setPhase('idle')
        }
        setLoading(false)
        return
      }
      const result = j.result as { wedge: Wedge; cashCents: number }
      seqRef.current = [{ ...result, isRespin: false, capped: false }]
      seqIdxRef.current = 0
      setAnonResult({ ...result, isRespin: false, capped: false })
      // Wheel is already free-spinning — engaging the brake here
      // transitions the rAF loop from constant-speed to ease-out.
      wheelRef.current?.lockTo(result.wedge)
    } catch {
      setError('Network error — try again')
      setLoading(false)
      setPhase('idle')
    }
  }, [loading, phase, teammateCount])

  // ── Wheel landed ──────────────────────────────────────────────────
  const handleLanded = useCallback(() => {
    const seq = seqRef.current
    const idx = seqIdxRef.current
    const landed = seq[idx]
    if (!landed) {
      setPhase('result')
      setLoading(false)
      return
    }
    // Spin-again chain — DO NOT auto-trigger the bonus spin. We sit on
    // the spin_again wedge with the "↻ Spin again!" flash visible and
    // hand control back to the user via the SPIN button (re-purposed
    // by the `respin_ready` phase below). Clicking the button calls
    // `claimRespin` which animates the wheel to the already-resolved
    // bonus wedge in `seq[idx + 1]`. Server has already credited the
    // bonus, so closing the modal here just forfeits the animation
    // (the money is safely in the user's balance either way).
    if (landed.wedge === 'spin_again' && seq[idx + 1]) {
      setRespinFlash(true)
      setPhase('respin_ready')
      setLoading(false)
      return
    }
    // Final outcome.
    setLoading(false)
    if (mode === 'auth' && finalNumbersRef.current) {
      const f = finalNumbersRef.current
      const prevCredit = state?.creditCents ?? 0
      setState(prev =>
        prev ? { ...prev, tokens: f.tokens, creditCents: f.creditCents, capReached: f.capReached } : prev,
      )
      onStateChange?.({ tokens: f.tokens, creditCents: f.creditCents })
      // Auth mode skips the celebratory ResultPanel — go straight
      // back to idle so the SPIN button + Balance row stay onscreen,
      // and animate the balance to acknowledge the credit bump. The
      // "+$X" sparkle popup felt cluttered after every spin; the
      // bump-and-glow on the existing balance is the only feedback
      // the user needs.
      setPhase('idle')
      setShownOutcome(null)
      if (f.creditCents > prevCredit) triggerCreditFlash(f.creditCents - prevCredit)
    } else if (mode === 'anon') {
      // Anon mode still uses the ResultPanel — that surface owns the
      // "Save my team to climb" conversion CTA which is critical for
      // pre-signup users and not redundant with the balance row.
      setShownOutcome(landed)
      setPhase('result')
      // Tell the parent the free teaser spin is spent so the arcade
      // badge flips off "FREE SPIN" (parent sets anonSpun = true).
      onStateChange?.({ tokens: 0, creditCents: 0 })
    }
  }, [mode, onStateChange, state?.creditCents, triggerCreditFlash])

  // ── Claim the queued bonus spin ───────────────────────────────────
  // Called when the user clicks the SPIN button while we're sitting on
  // a spin_again wedge (phase === 'respin_ready'). The bonus wedge is
  // already in seqRef.current[idx + 1] — server resolved both outcomes
  // up front — so this just advances the seq pointer and re-triggers
  // the wheel animation. No new API call.
  const claimRespin = useCallback(() => {
    const idx = seqIdxRef.current
    const next = seqRef.current[idx + 1]
    if (!next) return
    setRespinFlash(false)
    seqIdxRef.current = idx + 1
    setPhase('spinning')
    // We already know the target wedge (server pre-resolved both
    // outcomes), so we go straight into the lock animation from the
    // wheel's current resting angle. The 4-turns-min brake gives the
    // user a satisfying spin even though there's no free phase.
    wheelRef.current?.lockTo(next.wedge)
  }, [])

  // ── Daily claim ───────────────────────────────────────────────────
  const claimDaily = useCallback(async () => {
    try {
      const r = await fetch('/api/spin/daily', { method: 'POST' })
      const j = await r.json().catch(() => ({}))
      if (r.ok) {
        setState(prev => (prev ? { ...prev, tokens: j.tokens, daily: { available: false, nextClaimAt: null } } : prev))
        onStateChange?.({ tokens: j.tokens, creditCents: state?.creditCents ?? 0 })
      }
    } catch {
      /* ignore */
    }
  }, [onStateChange, state?.creditCents])

  // ── Share task (3s dwell → grant) ─────────────────────────────────
  const runShareTask = useCallback(
    (task: TaskState) => {
      if (!inviteUrl || pendingTask) return
      const text = `I'm building my AI dream team on Diaflow Tower. Join me 👉`
      const shareUrl =
        task.platform === 'linkedin'
          ? `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(inviteUrl)}`
          : `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(inviteUrl)}`
      window.open(shareUrl, '_blank', 'noopener,noreferrer,width=600,height=640')
      setPendingTask(task.key)
      // Honor-system dwell: after SHARE_DWELL_SECONDS, claim the spin.
      setTimeout(async () => {
        try {
          const r = await fetch('/api/spin/task', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ taskKey: task.key }),
          })
          const j = await r.json().catch(() => ({}))
          if (r.ok) {
            setState(prev =>
              prev
                ? {
                    ...prev,
                    tokens: j.tokens,
                    tasks: prev.tasks.map(t => (t.key === task.key ? { ...t, completed: true } : t)),
                  }
                : prev,
            )
            onStateChange?.({ tokens: j.tokens, creditCents: state?.creditCents ?? 0 })
          } else {
            // Already done — just mark it ticked.
            setState(prev =>
              prev ? { ...prev, tasks: prev.tasks.map(t => (t.key === task.key ? { ...t, completed: true } : t)) } : prev,
            )
          }
        } finally {
          setPendingTask(null)
        }
      }, SHARE_DWELL_SECONDS * 1000)
    },
    [inviteUrl, pendingTask, onStateChange, state?.creditCents],
  )

  if (!open) return null

  const tokens = mode === 'auth' ? state?.tokens ?? 0 : anonResult ? 0 : 1
  const wedges = mode === 'auth' ? state?.wedges ?? EMPTY_WEDGES : anonWedges
  // Disable the spin CTA until the wedge catalogue has loaded — without
  // it the wheel can't animate to the server's chosen target.
  const canSpin = mode === 'auth' ? tokens > 0 && wedges.length > 0 : !anonResult && wedges.length > 0
  const finalOutcome = mode === 'auth' ? shownOutcome : anonResult

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Spin wheel"
      className="fixed inset-0 z-40 flex items-end md:items-center justify-center bg-black/75 backdrop-blur-sm md:px-4"
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        className={
          // Modal shell is a flex column capped at 94 dvh — the OUTER
          // container no longer scrolls. The wheel + header are pinned
          // (shrink-0), and only the "Earn more spins" panel below
          // scrolls when it overflows. Keeps the wheel visible at all
          // times even on short viewports.
          'w-full bg-night-mid border border-white/10 text-tower-cream shadow-2xl ' +
          'rounded-t-3xl md:rounded-2xl md:max-w-md ' +
          'max-h-[94dvh] flex flex-col ' +
          'pt-3 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] md:p-6'
        }
      >
        {/* Mobile grip */}
        <div className="md:hidden flex justify-center pb-2 shrink-0" aria-hidden>
          <div className="w-9 h-1 rounded-full bg-white/20" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between mb-3 shrink-0">
          <span className="text-[12px] font-semibold text-tower-gold tracking-wide flex items-center gap-1.5">
            🎰 Tower Arcade
          </span>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-7 h-7 rounded-full bg-white/5 text-tower-cream/60 hover:text-tower-cream hover:bg-white/10 transition flex items-center justify-center text-lg leading-none"
          >
            ×
          </button>
        </div>

        {/* ── Wheel area ─────────────────────────────────────────── */}
        <div className="flex flex-col items-center shrink-0">
          <div className="relative">
            <SpinWheel
              ref={wheelRef}
              onLanded={handleLanded}
              wedges={wedges}
              size={260}
            />
            {respinFlash && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span className="px-4 py-2 rounded-full bg-tower-gold text-night-deep font-extrabold text-sm shadow-lg animate-pulse">
                  ↻ Spin again!
                </span>
              </div>
            )}
          </div>

          {/* ── Post-wheel area ─────────────────────────────────────
              `w-full` keeps the children centring against the modal
              column. Height shrinks to fit the SPIN button + balance
              row so the task section below sits as close to the
              wheel as possible (no large empty gap). The
              anti-layout-shift concern that justified an earlier
              `min-h-[150px]` here is gone now that auth mode skips
              the ResultPanel entirely — both the idle and the
              post-spin states render the same SPIN button +
              balance, so the wheel stays anchored without any
              reserved padding. */}
          <div className="mt-4 w-full flex flex-col items-center relative">
          {phase === 'result' && finalOutcome ? (
            <ResultPanel
              outcome={finalOutcome}
              wedgeDef={findWedgeDef(wedges, finalOutcome.wedge)}
              mode={mode}
              teammateCount={teammateCount}
              onSaveTeam={onSaveTeam}
              capReached={mode === 'auth' ? state?.capReached ?? false : false}
              onSpinAgain={mode === 'auth' && tokens > 0 ? () => { setPhase('idle'); setShownOutcome(null) } : undefined}
              tokens={tokens}
            />
          ) : (
            <>
              {/* SPIN button — same affordance whether the user is
                  starting a fresh spin (idle) or claiming the queued
                  bonus from a spin-again landing (respin_ready). In
                  respin_ready it doesn't consume a token (server
                  already settled the chain) and the label flips to
                  "↻ SPIN AGAIN" so the action reads as the user
                  taking ownership of the animation, not an auto-play. */}
              <button
                type="button"
                onClick={
                  phase === 'respin_ready'
                    ? claimRespin
                    : mode === 'auth'
                      ? startAuthSpin
                      : startAnonSpin
                }
                disabled={
                  phase === 'spinning' ||
                  loading ||
                  (phase !== 'respin_ready' && !canSpin)
                }
                className="w-full max-w-[260px] px-6 py-3.5 rounded-xl bg-gradient-to-b from-tower-gold to-amber-500 text-night-deep font-extrabold text-base shadow-[0_8px_24px_rgba(251,191,36,0.45)] hover:shadow-[0_12px_28px_rgba(251,191,36,0.55)] transition disabled:opacity-50 disabled:shadow-none disabled:cursor-not-allowed"
              >
                {phase === 'spinning'
                  ? 'Spinning…'
                  : phase === 'respin_ready'
                    ? '↻ SPIN AGAIN'
                    : mode === 'anon'
                      ? 'SPIN — it’s free 🎁'
                      : tokens > 0
                        ? `SPIN  ·  ${tokens} ${tokens === 1 ? 'spin' : 'spins'} left`
                        : 'No spins left'}
              </button>
              {mode === 'auth' && (
                <p className="mt-2 text-[11px] text-tower-cream/55 relative">
                  Balance{' '}
                  <strong
                    className={
                      'inline-block text-tower-gold tabular-nums origin-center ' +
                      (creditFlash ? 'animate-credit-bump' : '')
                    }
                  >
                    {formatCents(state?.creditCents ?? 0)}
                  </strong>{' '}
                  / {formatCents(SPIN_CREDIT_CAP_CENTS)}
                  {state?.capReached && <span className="ml-1 text-emerald-300">· cap reached</span>}
                  {/* Floating "+$X" reward indicator. Anchored above the
                      balance number; `animate-credit-rise` floats it up
                      + fades over 3 s. `pointer-events-none` so it
                      never blocks clicks on the SPIN button beneath. */}
                  {/* Floating "+$X" reward indicator. Anchored above
                      the balance number; `animate-credit-rise` floats
                      it up + fades over 3 s. `pointer-events-none` so
                      it never blocks clicks on the SPIN button below. */}
                  {floatingCredit && (
                    <span
                      key={floatingCredit.id}
                      aria-hidden
                      className="absolute left-1/2 -top-2 -translate-x-1/2 text-[18px] font-extrabold text-tower-gold drop-shadow-[0_0_8px_rgba(168,117,255,0.6)] pointer-events-none whitespace-nowrap animate-credit-rise"
                    >
                      +{formatCents(floatingCredit.delta)}
                    </span>
                  )}
                </p>
              )}
              {error && <p className="mt-2 text-xs text-red-300">{error}</p>}
            </>
          )}
          </div>
        </div>

        {/* ── Earn-more / tasks panel (auth) ─────────────────────────
            Stays mounted across EVERY phase (idle / spinning /
            respin_ready / result) so the modal's height doesn't pop
            in/out when the wheel starts spinning — the previous
            `phase !== 'spinning'` guard caused a visible "shrink +
            re-expand" flicker that made the modal feel jumpy.
            Only this section scrolls. `min-h-0` lets the flex parent
            actually shrink it instead of overflowing the modal;
            `pr-1.5 -mr-1.5` insets the content so the thin scrollbar
            doesn't clip the row pills against the right edge.
            Custom thin scrollbar via arbitrary variants — minimal
            chrome (~5 px wide track, rounded translucent thumb) that
            stays out of the way until you actually need to scroll. */}
        {mode === 'auth' && state && (
          <div
            className={
              'mt-5 pt-4 border-t border-white/10 ' +
              'flex-1 min-h-0 overflow-y-auto pr-1.5 -mr-1.5 ' +
              '[scrollbar-gutter:stable] ' +
              '[&::-webkit-scrollbar]:w-1.5 ' +
              '[&::-webkit-scrollbar-track]:bg-transparent ' +
              '[&::-webkit-scrollbar-thumb]:bg-white/15 ' +
              '[&::-webkit-scrollbar-thumb]:rounded-full ' +
              '[&::-webkit-scrollbar-thumb:hover]:bg-white/30 ' +
              '[scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.15)_transparent]'
            }
          >
            {/* ── Recurring ────────────────────────────────────────
                Tasks that pay out repeatedly — daily reset + the
                unlimited-uses referral. Split out from the one-time
                section so users can see the "always-available" earn
                paths at a glance. */}
            <h3 className="text-[11px] font-bold uppercase tracking-[0.1em] text-tower-cream/55 mb-2">
              Recurring
            </h3>

            <EarnRow
              icon="📅"
              title="Daily spin"
              subtitle={
                state.daily.available
                  ? 'Claim your free spin for today'
                  : 'Come back tomorrow for another'
              }
              actionLabel={state.daily.available ? 'Claim +1' : 'Claimed'}
              done={!state.daily.available}
              onAction={state.daily.available ? claimDaily : undefined}
            />

            {/* "Refer a friend" opens the share-link modal (ShareModal /
                MobileShareSheet), NOT the signup modal — auth-mode
                users already have an account; we just need to surface
                their invite URL + the social share buttons. */}
            <EarnRow
              icon="👥"
              title="Refer a friend"
              subtitle="+1 spin per successful signup · unlimited"
              actionLabel="Invite"
              done={false}
              onAction={onOpenShare}
            />

            {/* ── One-time tasks ──────────────────────────────────
                Tasks that pay out at most ONCE per user (server-
                enforced via the TaskCompletion unique constraint).
                The "(N of M available)" caption counts the ones the
                user hasn't completed yet — clearer than just
                listing the rows without a progress hint. */}
            {state.tasks.length > 0 && (
              <h3 className="text-[11px] font-bold uppercase tracking-[0.1em] text-tower-cream/55 mt-4 mb-2">
                One-time tasks{' '}
                <span className="text-tower-cream/35 font-bold normal-case tracking-normal">
                  ({state.tasks.filter(t => !t.completed).length} of {state.tasks.length} available)
                </span>
              </h3>
            )}

            {state.tasks.map(task => (
              <EarnRow
                key={task.key}
                icon={task.platform === 'linkedin' ? 'in' : '𝕏'}
                title={task.label}
                subtitle={task.completed ? 'Completed' : '+1 spin · one-time only'}
                actionLabel={
                  task.completed ? 'Done' : pendingTask === task.key ? 'Waiting…' : 'Do it'
                }
                done={task.completed}
                disabled={!inviteUrl || !!pendingTask}
                onAction={!task.completed ? () => runShareTask(task) : undefined}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Result / win sub-panel ──────────────────────────────────────────
function ResultPanel({
  outcome,
  wedgeDef,
  mode,
  teammateCount,
  onSaveTeam,
  capReached,
  onSpinAgain,
  tokens,
}: {
  outcome: SpinOutcome
  /** Catalogue entry for the landed wedge. `null` if the row was retired
   *  between the spin and the result render — we fall back to the raw
   *  outcome.cashCents for the headline number. */
  wedgeDef: SpinWedgeDef | null
  mode: 'auth' | 'anon'
  teammateCount: number
  onSaveTeam?: () => void
  capReached: boolean
  onSpinAgain?: () => void
  tokens: number
}) {
  const isJackpot = outcome.wedge === 'jackpot'
  const won = outcome.cashCents > 0
  // Face value = the wedge's full cents BEFORE the cap; falls back to
  // the realised credit if the def is gone (no cap info lost — the
  // outcome already encodes "added" + "capped").
  const faceValue = wedgeDef?.type === 'credit' ? wedgeDef.amount : outcome.cashCents

  return (
    <div className="w-full text-center">
      <div className={'text-4xl mb-1 ' + (isJackpot ? 'animate-bounce' : '')}>
        {isJackpot ? '🎉' : won ? '✨' : '🎁'}
      </div>
      <div className="text-2xl font-extrabold text-tower-gold">
        {faceValue > 0 ? `+${formatCents(faceValue)}` : 'Nice try!'}
        {isJackpot && ' JACKPOT'}
      </div>
      {outcome.capped && (
        <p className="mt-1 text-[11px] text-emerald-300">
          You’ve hit the {formatCents(SPIN_CREDIT_CAP_CENTS)} cap — recorded for the books 🎉
        </p>
      )}

      {mode === 'anon' ? (
        <div className="mt-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-400/30 text-emerald-200 text-[12px] font-semibold">
            🔒 {teammateCount} {teammateCount === 1 ? 'teammate' : 'teammates'} locked in
          </div>
          <div className="mt-3 rounded-xl border border-amber-400/30 bg-amber-400/[0.07] px-4 py-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-amber-300/90">Not saved yet</p>
            <p className="mt-1 text-[12.5px] text-tower-cream/80 leading-relaxed">
              Save your team for launch. Free — just an email. Your{' '}
              <strong className="text-tower-cream">{formatCents(faceValue)} credit</strong> + {teammateCount}{' '}
              {teammateCount === 1 ? 'teammate' : 'teammates'} wait for you when AI Teammate ships this summer.
            </p>
          </div>
          <button
            type="button"
            onClick={onSaveTeam}
            className="mt-3 w-full px-4 py-3.5 rounded-xl bg-gradient-to-b from-purple-300 to-purple-400 text-night-deep font-extrabold text-[15px] shadow-[0_8px_24px_rgba(168,117,255,0.4)] hover:shadow-[0_12px_28px_rgba(168,117,255,0.5)] transition"
          >
            Save my team →
          </button>
          <p className="mt-2 text-[11px] text-tower-cream/45">+ unlock more spins through tasks after signup</p>
        </div>
      ) : (
        <div className="mt-4 flex flex-col items-center gap-2">
          {capReached && (
            <p className="text-[11px] text-tower-cream/55">
              Cap reached — the wheel still spins for fun.
            </p>
          )}
          {onSpinAgain ? (
            <button
              type="button"
              onClick={onSpinAgain}
              className="w-full max-w-[260px] px-6 py-3 rounded-xl bg-gradient-to-b from-tower-gold to-amber-500 text-night-deep font-extrabold shadow-[0_8px_24px_rgba(251,191,36,0.45)] transition"
            >
              SPIN again · {tokens} left
            </button>
          ) : (
            <p className="text-[12px] text-tower-cream/55">
              Out of spins — earn more below 👇
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ── Earn-more row ───────────────────────────────────────────────────
function EarnRow({
  icon,
  title,
  subtitle,
  actionLabel,
  done,
  disabled,
  onAction,
}: {
  icon: string
  title: string
  subtitle: string
  actionLabel: string
  done: boolean
  disabled?: boolean
  onAction?: () => void
}) {
  return (
    <div className="flex items-center gap-3 py-2">
      <span
        className={
          'shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold ' +
          (done ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/5 text-tower-cream/80')
        }
        aria-hidden
      >
        {done ? '✓' : icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-semibold text-tower-cream truncate">{title}</div>
        <div className="text-[11px] text-tower-cream/55 truncate">{subtitle}</div>
      </div>
      <button
        type="button"
        onClick={onAction}
        disabled={done || disabled || !onAction}
        className={
          'shrink-0 px-3 py-1.5 rounded-lg text-[12px] font-bold transition ' +
          (done
            ? 'bg-emerald-500/15 text-emerald-300 cursor-default'
            : 'bg-tower-gold/90 text-night-deep hover:bg-tower-gold disabled:opacity-40 disabled:cursor-not-allowed')
        }
      >
        {actionLabel}
      </button>
    </div>
  )
}

