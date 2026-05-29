'use client'

import { useEffect, useRef, useState } from 'react'
import type { Wedge } from '@/lib/spin/constants'

/**
 * The prize wheel — N EQUAL visual segments (the odds are NOT
 * telegraphed by segment size; the server's weighted RNG decides the
 * landing). The wheel only ever animates to a result the server already
 * picked, so a tampered client can't fake a win.
 *
 * Controlled by `spinToken`: bump it (with `target` set) to trigger a
 * spin to that wedge. `onLanded` fires when the animation settles.
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

const SPIN_DURATION_MS = 4200
const FULL_SPINS = 5 // whole rotations before settling, for drama

interface Props {
  /** Bump this (monotonic) to start a spin. 0 = idle, never spun. */
  spinToken: number
  /** The wedge key the wheel must land on (server-decided). */
  target: Wedge | null
  onLanded?: () => void
  /** Wedge catalogue, ordered for display. The wheel renders one
   *  equal-angle segment per entry (in array order, clockwise). */
  wedges: WheelWedge[]
  /** Diameter in px. */
  size?: number
}

function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180
  return { x: cx + r * Math.sin(rad), y: cy - r * Math.cos(rad) }
}

export function SpinWheel({ spinToken, target, onLanded, wedges, size = 280 }: Props) {
  const seg = Math.max(1, wedges.length)
  const segAngle = 360 / seg

  const [rotation, setRotation] = useState(0)
  const [spinning, setSpinning] = useState(false)
  // `null` on first render so the very first effect run treats whatever
  // `spinToken` the parent passed in as the baseline (no animation). Past
  // that, every bump triggers an animation as normal. This is what
  // prevents the modal from auto-replaying the last spin when the user
  // closes + reopens the wheel — the parent's `spinToken` may still hold
  // the previous session's value, and a naive `useRef(0)` would diff
  // against 0 and fire the animation before the parent's reset effect
  // got a chance to run.
  const prevToken = useRef<number | null>(null)

  useEffect(() => {
    if (prevToken.current === null) {
      // First render — record the baseline and bail without animating.
      prevToken.current = spinToken
      return
    }
    if (spinToken === prevToken.current) return
    prevToken.current = spinToken
    if (!target) return

    const idx = wedges.findIndex(d => d.key === target)
    if (idx < 0) return

    // Segment i spans [i*segAngle, (i+1)*segAngle] clockwise from top.
    // Its center sits at center_i; we rotate the wheel by -center_i so
    // that center lands under the fixed top pointer. A tiny in-segment
    // jitter makes repeated wins feel less mechanical.
    const center = idx * segAngle + segAngle / 2
    const jitter = (Math.random() - 0.5) * (segAngle * 0.5)
    // Always rotate forward past the current rotation by a whole number
    // of turns so the wheel never visually rewinds.
    const base = rotation - (rotation % 360)
    const targetRot = base + FULL_SPINS * 360 + (360 - center) - jitter

    setSpinning(true)
    // rAF so the transition picks up the new rotation value.
    requestAnimationFrame(() => setRotation(targetRot))

    const t = setTimeout(() => {
      setSpinning(false)
      onLanded?.()
    }, SPIN_DURATION_MS + 60)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spinToken])

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
          <path d="M15 26 L4 6 L26 6 Z" fill="#fbbf24" stroke="#1f2147" strokeWidth="2" strokeLinejoin="round" />
        </svg>
      </div>

      <svg
        viewBox="0 0 220 220"
        width={size}
        height={size}
        style={{
          transform: `rotate(${rotation}deg)`,
          transition: spinning
            ? `transform ${SPIN_DURATION_MS}ms cubic-bezier(0.17, 0.67, 0.16, 1)`
            : 'none',
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
                const y0 = multiline ? mid.y - (lineHeight * (parts.length - 1)) / 2 : mid.y
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
        <circle cx={cx} cy={cy} r={16} fill="#fbbf24" stroke="#1f2147" strokeWidth={3} />
        <circle cx={cx} cy={cy} r={5} fill="#1f2147" />
      </svg>
    </div>
  )
}
