'use client'

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react'

/**
 * The prize wheel — N EQUAL visual segments (the odds are NOT
 * telegraphed by segment size; the server's weighted RNG decides the
 * landing). The wheel only ever animates to a result the server already
 * picked, so a tampered client can't fake a win.
 *
 * Driven by an imperative ref API (`startSpin` / `lockTo` / `reset`)
 * rather than React prop diffing. A SINGLE rAF loop owns the rotation
 * value at every phase — free-spin (constant linear speed) or lock
 * (cubic ease-out into the target wedge). The SVG transform is updated
 * every frame from JS state; CSS transitions are NEVER used.
 *
 * Why imperative instead of prop-driven: the previous design used
 * `spinToken` + `target` props with a `useEffect([spinToken])` to start
 * free-spin and a `useEffect([target])` to start lock. Under React 18
 * batching + fast API responses, both props would land in the SAME
 * commit, so the effect saw `target` already set on the first run and
 * skipped the free phase. Worse, the matrix-decomposition of a CSS
 * transition between e.g. `rotate(40deg)` and `rotate(1080deg)` short-
 * paths backwards. The combo produced the "spin, stop, reverse" glitch
 * the user reported. The ref API guarantees `startSpin` ALWAYS runs
 * before `lockTo`, and the unified rAF loop means rotation is always
 * a monotonically-increasing scalar (no matrix interpolation involved).
 *
 * Wedge data (label / color / order) is passed in from the parent — the
 * authoritative source is the `spin_wedges` DB table, threaded through
 * the spin API response.
 */

/** Minimal wedge shape the wheel needs to render — wider DB row trimmed
 *  to the fields the SVG cares about. */
export interface WheelWedge {
  key: string
  label: string
  color: string
  /** Reward type — used for special label rendering only (e.g. the
   *  "↻ AGAIN" label on a spin-type wedge). */
  type: string
}

/** Imperative API the parent (`SpinModal`) drives the wheel through. */
export interface SpinWheelHandle {
  /** Start the free-spin loop immediately (no target yet). Idempotent —
   *  safe to call repeatedly; if the wheel is already spinning or
   *  locking, this is a no-op. */
  startSpin: () => void
  /** Engage the brake. Animates the wheel from its CURRENT angle to the
   *  given wedge's centre over a duration calibrated to match the
   *  free-spin speed at lock-start (so there's no velocity jump). */
  lockTo: (targetKey: string) => void
  /** Force the wheel back to 0 degrees with no animation. Used when the
   *  parent needs a clean baseline (e.g. after a sequence reset). */
  reset: () => void
}

interface Props {
  onLanded?: () => void
  /** Wedge catalogue, ordered for display. The wheel renders one
   *  equal-angle segment per entry (in array order, clockwise). */
  wedges: WheelWedge[]
  /** Diameter in px. */
  size?: number
}

/** ~2 turns / second during the open-ended free-spin phase. Picked so
 *  the wheel reads as "really spinning" while staying short of the
 *  motion-blur threshold where individual wedges become unreadable. */
const FREE_SPEED_DEG_PER_MS = 720 / 1000
/** Minimum brake travel (in degrees) from the wheel's current angle to
 *  the final wedge centre. 4 turns gives the ease-out enough room to
 *  read as a real deceleration without snapping. */
const LOCK_MIN_BRAKE_DEG = 4 * 360

function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180
  return { x: cx + r * Math.sin(rad), y: cy - r * Math.cos(rad) }
}

/** Cubic ease-out (1 - (1-t)^3). Picked so the initial velocity of the
 *  brake matches the free-spin speed for any delta — the derivative at
 *  t=0 is 3, and we size LOCK_MS dynamically as `3 * delta / speed` so
 *  d/dt × LOCK_MS at t=0 equals `delta × 3 / LOCK_MS = speed`. Result:
 *  the transition from free to lock looks like one continuous motion. */
function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3)
}

export const SpinWheel = forwardRef<SpinWheelHandle, Props>(function SpinWheel(
  { onLanded, wedges, size = 280 },
  ref,
) {
  const seg = Math.max(1, wedges.length)
  const segAngle = 360 / seg

  const [rotation, setRotation] = useState(0)

  // ── rAF animation state ───────────────────────────────────────────
  // Everything that the rAF tick reads lives in refs, so the tick
  // never has stale closure values and we don't re-render needlessly
  // (rotation is the only piece of React state that drives paint).
  const rafRef = useRef<number | null>(null)
  type Mode = 'free' | 'lock' | null
  const modeRef = useRef<Mode>(null)
  // Live mirror of `rotation` so `lockTo` (called from outside the
  // React render cycle) can read the exact current visual angle.
  const currentRotRef = useRef(0)

  // Free-phase anchors
  const freeStartTimeRef = useRef(0)
  const freeStartRotRef = useRef(0)
  // Lock-phase anchors
  const lockStartTimeRef = useRef(0)
  const lockStartRotRef = useRef(0)
  const lockTargetRotRef = useRef(0)
  const lockDurationRef = useRef(0)
  // Guards onLanded against double-fire (e.g. if a stray timer races
  // the rAF completion frame).
  const landedFiredRef = useRef(false)

  // Keep callback + wedge catalogue refs fresh so the rAF loop and the
  // imperative methods always see the latest values without remounting.
  const onLandedRef = useRef(onLanded)
  onLandedRef.current = onLanded
  const wedgesRef = useRef(wedges)
  wedgesRef.current = wedges

  function tick(now: number) {
    const mode = modeRef.current
    if (mode === 'free') {
      const elapsed = now - freeStartTimeRef.current
      const next = freeStartRotRef.current + elapsed * FREE_SPEED_DEG_PER_MS
      currentRotRef.current = next
      setRotation(next)
      rafRef.current = requestAnimationFrame(tick)
      return
    }
    if (mode === 'lock') {
      const elapsed = now - lockStartTimeRef.current
      const t = Math.min(1, elapsed / lockDurationRef.current)
      const eased = easeOutCubic(t)
      const next =
        lockStartRotRef.current +
        (lockTargetRotRef.current - lockStartRotRef.current) * eased
      currentRotRef.current = next
      setRotation(next)
      if (t >= 1) {
        modeRef.current = null
        rafRef.current = null
        if (!landedFiredRef.current) {
          landedFiredRef.current = true
          onLandedRef.current?.()
        }
        return
      }
      rafRef.current = requestAnimationFrame(tick)
      return
    }
    // mode === null — nothing to drive.
    rafRef.current = null
  }

  useImperativeHandle(
    ref,
    () => ({
      startSpin() {
        // Idempotent: don't reset a running free-spin, and refuse to
        // hijack a lock animation mid-brake (that would visibly snap
        // the wheel back to free speed).
        if (modeRef.current === 'free' || modeRef.current === 'lock') return
        landedFiredRef.current = false
        modeRef.current = 'free'
        freeStartTimeRef.current = performance.now()
        freeStartRotRef.current = currentRotRef.current
        if (rafRef.current === null) {
          rafRef.current = requestAnimationFrame(tick)
        }
      },
      lockTo(targetKey: string) {
        const list = wedgesRef.current
        const idx = list.findIndex(d => d.key === targetKey)
        if (idx < 0) return
        const segA = 360 / list.length
        // Segment i spans [i*segA, (i+1)*segA] clockwise from top. Its
        // centre sits at center_i; we rotate the wheel by -center_i so
        // that centre lands under the fixed top pointer. A tiny
        // in-segment jitter makes repeated wins feel less mechanical.
        const center = idx * segA + segA / 2
        const jitter = (Math.random() - 0.5) * (segA * 0.5)
        const wedgeOffset = 360 - center - jitter // canonical 0..360

        const current = currentRotRef.current
        // Strict forward jump: find the smallest k * 360 + wedgeOffset
        // that is >= current + LOCK_MIN_BRAKE_DEG. Guarantees the wheel
        // never reverses direction at lock-start.
        const minTarget = current + LOCK_MIN_BRAKE_DEG
        const k = Math.ceil((minTarget - wedgeOffset) / 360)
        const finalRot = k * 360 + wedgeOffset
        const delta = finalRot - current
        // duration = 3 × delta / freeSpeed → easeOutCubic's initial
        // velocity exactly matches the free-spin speed (see comment on
        // easeOutCubic). Result: the lock blends seamlessly into the
        // free phase even though it's a different math function.
        const duration = (3 * delta) / FREE_SPEED_DEG_PER_MS

        modeRef.current = 'lock'
        lockStartTimeRef.current = performance.now()
        lockStartRotRef.current = current
        lockTargetRotRef.current = finalRot
        lockDurationRef.current = duration
        landedFiredRef.current = false
        if (rafRef.current === null) {
          rafRef.current = requestAnimationFrame(tick)
        }
      },
      reset() {
        modeRef.current = null
        if (rafRef.current !== null) {
          cancelAnimationFrame(rafRef.current)
          rafRef.current = null
        }
        currentRotRef.current = 0
        landedFiredRef.current = false
        setRotation(0)
      },
    }),
    // ref methods don't depend on any reactive value — refs and
    // setState are stable. Empty deps means the handle is created once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  // Clean up the rAF loop on unmount so we don't keep ticking after the
  // modal closes (SpinModal unmounts the wheel via `if (!open) return null`).
  useEffect(
    () => () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    },
    [],
  )

  const cx = 110
  const cy = 110
  const r = 104

  return (
    <div className="relative" style={{ width: size, height: size }}>
      {/* Fixed pointer at the top, pointing down into the wheel. */}
      <div
        className="absolute left-1/2 -translate-x-1/2 z-20"
        style={{ top: -6 }}
        aria-hidden
      >
        <svg width="30" height="30" viewBox="0 0 30 30">
          <path
            d="M15 26 L4 6 L26 6 Z"
            fill="#fbbf24"
            stroke="#1f2147"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      <svg
        viewBox="0 0 220 220"
        width={size}
        height={size}
        // `transform` is updated EVERY frame by the rAF tick — no CSS
        // transition is ever applied, so the browser never interpolates
        // between two values (which is what caused the matrix short-
        // path reverse-direction bug). `will-change: transform` is a
        // hint for the compositor to keep the layer on its own GPU
        // texture so the per-frame angle update doesn't trigger paint.
        style={{
          transform: `rotate(${rotation}deg)`,
          transition: 'none',
          willChange: 'transform',
          filter: 'drop-shadow(0 10px 30px rgba(0,0,0,0.45))',
        }}
      >
        {/* Outer rim */}
        <circle cx={cx} cy={cy} r={108} fill="#10122e" />
        {wedges.map((d, i) => {
          const start = i * segAngle
          const end = (i + 1) * segAngle
          const p1 = polar(cx, cy, r, start)
          const p2 = polar(cx, cy, r, end)
          const mid = polar(cx, cy, r * 0.62, start + segAngle / 2)
          const labelRot = start + segAngle / 2
          const isJackpot = d.key === 'jackpot'
          const isRespin = d.type === 'spin'
          return (
            <g key={d.key}>
              <path
                d={`M ${cx} ${cy} L ${p1.x} ${p1.y} A ${r} ${r} 0 0 1 ${p2.x} ${p2.y} Z`}
                fill={d.color}
                stroke="#0b0d24"
                strokeWidth={1.5}
              />
              {/* Auto-wrap long labels (anything with a space, e.g.
                  "JACKPOT $25") onto two tspans so the text stays
                  inside the wedge instead of bleeding into the rim.
                  Single-token labels render inline as before. */}
              {(() => {
                const raw = isRespin ? '↻ AGAIN' : d.label
                const parts = raw.includes(' ') ? raw.split(/\s+/) : [raw]
                const multiline = parts.length > 1
                // Slightly smaller font when wrapped so 2 lines still
                // fit comfortably within the pie slice.
                const fontSize = multiline
                  ? isJackpot
                    ? 9
                    : 9.5
                  : isRespin
                    ? 8.5
                    : isJackpot
                      ? 9
                      : 11
                const lineHeight = fontSize * 1.05
                // Centre the multi-line block on `mid.y` by shifting
                // the first tspan up by half the total height.
                const y0 = multiline
                  ? mid.y - (lineHeight * (parts.length - 1)) / 2
                  : mid.y
                return (
                  <text
                    fill={isJackpot ? '#1f2147' : '#fdf6e3'}
                    fontSize={fontSize}
                    fontWeight={isJackpot ? 900 : 700}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    transform={`rotate(${labelRot}, ${mid.x}, ${mid.y})`}
                    style={{ pointerEvents: 'none' }}
                  >
                    {parts.map((part, idx) => (
                      <tspan key={idx} x={mid.x} y={y0 + idx * lineHeight}>
                        {part}
                      </tspan>
                    ))}
                  </text>
                )
              })()}
            </g>
          )
        })}
        {/* Hub */}
        <circle
          cx={cx}
          cy={cy}
          r={16}
          fill="#fbbf24"
          stroke="#1f2147"
          strokeWidth={3}
        />
        <circle cx={cx} cy={cy} r={5} fill="#1f2147" />
      </svg>
    </div>
  )
})
