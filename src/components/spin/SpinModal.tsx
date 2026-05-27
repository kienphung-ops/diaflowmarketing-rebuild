'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { SpinWheel } from './SpinWheel'
import {
  SHARE_DWELL_SECONDS,
  SPIN_CREDIT_CAP_CENTS,
  formatCents,
  wedgeDef,
  type Wedge,
} from '@/lib/spin/constants'

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
}

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
  /** auth-only — bubble the new balance/token count up so the in-room
   *  badge + top-bar pill can refresh without a full reload. */
  onStateChange?: (s: { tokens: number; creditCents: number }) => void
}

type Phase = 'idle' | 'spinning' | 'result'

export function SpinModal({
  open,
  onClose,
  mode,
  inviteUrl,
  teammateCount = 0,
  onSaveTeam,
  onStateChange,
}: Props) {
  const [state, setState] = useState<SpinState | null>(null)
  const [phase, setPhase] = useState<Phase>('idle')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Wheel control
  const [spinToken, setSpinToken] = useState(0)
  const [wheelTarget, setWheelTarget] = useState<Wedge | null>(null)
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
        .then((j: { spun: boolean; result: { wedge: Wedge; cashCents: number } | null } | null) => {
          if (j?.spun && j.result) {
            setAnonResult({ ...j.result, isRespin: false, capped: false })
            setPhase('result')
          }
        })
        .catch(() => {})
    }
  }, [open, mode])

  // ── Auth spin ─────────────────────────────────────────────────────
  const startAuthSpin = useCallback(async () => {
    if (loading || phase === 'spinning') return
    setError(null)
    setLoading(true)
    try {
      const r = await fetch('/api/spin', { method: 'POST' })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) {
        setError(j.error ?? 'Spin failed')
        setLoading(false)
        return
      }
      const results = (j.results ?? []) as SpinOutcome[]
      if (results.length === 0) {
        setError('Spin failed')
        setLoading(false)
        return
      }
      // Optimistically reflect the new balance once the wheel settles
      // (we stash the server numbers and apply them on the final land).
      finalNumbersRef.current = { tokens: j.tokens, creditCents: j.creditCents, capReached: j.capReached }
      seqRef.current = results
      seqIdxRef.current = 0
      setPhase('spinning')
      setWheelTarget(results[0].wedge)
      setSpinToken(t => t + 1)
    } catch {
      setError('Network error — try again')
      setLoading(false)
    }
  }, [loading, phase])

  const finalNumbersRef = useRef<{ tokens: number; creditCents: number; capReached: boolean } | null>(null)

  // ── Anon spin ─────────────────────────────────────────────────────
  const startAnonSpin = useCallback(async () => {
    if (loading || phase === 'spinning') return
    setError(null)
    setLoading(true)
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
        }
        setLoading(false)
        return
      }
      const result = j.result as { wedge: Wedge; cashCents: number }
      seqRef.current = [{ ...result, isRespin: false, capped: false }]
      seqIdxRef.current = 0
      setAnonResult({ ...result, isRespin: false, capped: false })
      setPhase('spinning')
      setWheelTarget(result.wedge)
      setSpinToken(t => t + 1)
    } catch {
      setError('Network error — try again')
      setLoading(false)
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
    // Spin-again chain: flash "Spin again!" then animate to the next.
    if (landed.wedge === 'spin_again' && seq[idx + 1]) {
      setRespinFlash(true)
      setTimeout(() => {
        setRespinFlash(false)
        seqIdxRef.current = idx + 1
        setWheelTarget(seq[idx + 1].wedge)
        setSpinToken(t => t + 1)
      }, 900)
      return
    }
    // Final outcome.
    setShownOutcome(landed)
    setPhase('result')
    setLoading(false)
    if (mode === 'auth' && finalNumbersRef.current) {
      const f = finalNumbersRef.current
      setState(prev =>
        prev ? { ...prev, tokens: f.tokens, creditCents: f.creditCents, capReached: f.capReached } : prev,
      )
      onStateChange?.({ tokens: f.tokens, creditCents: f.creditCents })
    } else if (mode === 'anon') {
      // Tell the parent the free teaser spin is spent so the arcade
      // badge flips off "FREE SPIN" (parent sets anonSpun = true).
      onStateChange?.({ tokens: 0, creditCents: 0 })
    }
  }, [mode, onStateChange])

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
  const canSpin = mode === 'auth' ? tokens > 0 : !anonResult
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
          'w-full bg-night-mid border border-white/10 text-tower-cream shadow-2xl ' +
          'rounded-t-3xl md:rounded-2xl md:max-w-md ' +
          'max-h-[94dvh] overflow-y-auto ' +
          'pt-3 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] md:p-6'
        }
      >
        {/* Mobile grip */}
        <div className="md:hidden flex justify-center pb-2" aria-hidden>
          <div className="w-9 h-1 rounded-full bg-white/20" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between mb-3">
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
        <div className="flex flex-col items-center">
          <div className="relative">
            <SpinWheel spinToken={spinToken} target={wheelTarget} onLanded={handleLanded} size={260} />
            {respinFlash && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span className="px-4 py-2 rounded-full bg-tower-gold text-night-deep font-extrabold text-sm shadow-lg animate-pulse">
                  ↻ Spin again!
                </span>
              </div>
            )}
          </div>

          {/* ── Result / win state ──────────────────────────────── */}
          {phase === 'result' && finalOutcome ? (
            <ResultPanel
              outcome={finalOutcome}
              mode={mode}
              teammateCount={teammateCount}
              onSaveTeam={onSaveTeam}
              capReached={mode === 'auth' ? state?.capReached ?? false : false}
              onSpinAgain={mode === 'auth' && tokens > 0 ? () => { setPhase('idle'); setShownOutcome(null) } : undefined}
              tokens={tokens}
            />
          ) : (
            <>
              {/* SPIN button */}
              <button
                type="button"
                onClick={mode === 'auth' ? startAuthSpin : startAnonSpin}
                disabled={!canSpin || phase === 'spinning' || loading}
                className="mt-4 w-full max-w-[260px] px-6 py-3.5 rounded-xl bg-gradient-to-b from-tower-gold to-amber-500 text-night-deep font-extrabold text-base shadow-[0_8px_24px_rgba(251,191,36,0.45)] hover:shadow-[0_12px_28px_rgba(251,191,36,0.55)] transition disabled:opacity-50 disabled:shadow-none disabled:cursor-not-allowed"
              >
                {phase === 'spinning'
                  ? 'Spinning…'
                  : mode === 'anon'
                    ? 'SPIN — it’s free 🎁'
                    : tokens > 0
                      ? `SPIN  ·  ${tokens} ${tokens === 1 ? 'spin' : 'spins'} left`
                      : 'No spins left'}
              </button>
              {mode === 'auth' && (
                <p className="mt-2 text-[11px] text-tower-cream/55">
                  Balance{' '}
                  <strong className="text-tower-gold tabular-nums">{formatCents(state?.creditCents ?? 0)}</strong>{' '}
                  / {formatCents(SPIN_CREDIT_CAP_CENTS)}
                  {state?.capReached && <span className="ml-1 text-emerald-300">· cap reached</span>}
                </p>
              )}
              {error && <p className="mt-2 text-xs text-red-300">{error}</p>}
            </>
          )}
        </div>

        {/* ── Earn-more / tasks panel (auth, idle only) ──────────── */}
        {mode === 'auth' && phase !== 'spinning' && state && (
          <div className="mt-5 pt-4 border-t border-white/10">
            <h3 className="text-[12px] font-bold uppercase tracking-[0.08em] text-tower-cream/55 mb-2.5">
              Earn more spins
            </h3>

            {/* Daily */}
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

            {/* Share tasks */}
            {state.tasks.map(task => (
              <EarnRow
                key={task.key}
                icon={task.platform === 'linkedin' ? 'in' : '𝕏'}
                title={task.label}
                subtitle={task.completed ? 'Completed' : 'Share your office link · +1 spin'}
                actionLabel={
                  task.completed ? 'Done' : pendingTask === task.key ? 'Waiting…' : 'Share +1'
                }
                done={task.completed}
                disabled={!inviteUrl || !!pendingTask}
                onAction={!task.completed ? () => runShareTask(task) : undefined}
              />
            ))}

            <EarnRow
              icon="👥"
              title="Refer a friend"
              subtitle="Every friend who signs up = +1 spin"
              actionLabel="Invite"
              done={false}
              onAction={onSaveTeam}
            />
          </div>
        )}
      </div>
    </div>
  )
}

// ── Result / win sub-panel ──────────────────────────────────────────
function ResultPanel({
  outcome,
  mode,
  teammateCount,
  onSaveTeam,
  capReached,
  onSpinAgain,
  tokens,
}: {
  outcome: SpinOutcome
  mode: 'auth' | 'anon'
  teammateCount: number
  onSaveTeam?: () => void
  capReached: boolean
  onSpinAgain?: () => void
  tokens: number
}) {
  const def = wedgeDef(outcome.wedge)
  const isJackpot = outcome.wedge === 'jackpot'
  const won = outcome.cashCents > 0
  const faceValue = def.cashCents

  return (
    <div className="mt-4 w-full text-center">
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
