'use client'

import { useEffect, useRef, useState } from 'react'
import { WEDGE_DEFS, type Wedge } from '@/lib/spin/constants'

/**
 * The prize wheel — 7 EQUAL visual segments (the odds are NOT
 * telegraphed by segment size; the server's weighted RNG decides the
 * landing). The wheel only ever animates to a result the server already
 * picked, so a tampered client can't fake a win.
 *
 * Controlled by `spinToken`: bump it (with `target` set) to trigger a
 * spin to that wedge. `onLanded` fires when the animation settles.
 */

const SEG = WEDGE_DEFS.length // 7
const SEG_ANGLE = 360 / SEG
const SPIN_DURATION_MS = 4200
const FULL_SPINS = 5 // whole rotations before settling, for drama

interface Props {
  /** Bump this (monotonic) to start a spin. 0 = idle, never spun. */
  spinToken: number
  /** The wedge the wheel must land on (server-decided). */
  target: Wedge | null
  onLanded?: () => void
  /** Diameter in px. */
  size?: number
}

function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180
  return { x: cx + r * Math.sin(rad), y: cy - r * Math.cos(rad) }
}

export function SpinWheel({ spinToken, target, onLanded, size = 280 }: Props) {
  const [rotation, setRotation] = useState(0)
  const [spinning, setSpinning] = useState(false)
  const prevToken = useRef(0)

  useEffect(() => {
    if (spinToken === prevToken.current) return
    prevToken.current = spinToken
    if (!target) return

    const idx = WEDGE_DEFS.findIndex(d => d.key === target)
    if (idx < 0) return

    // Segment i spans [i*SEG_ANGLE, (i+1)*SEG_ANGLE] clockwise from top.
    // Its center sits at center_i; we rotate the wheel by -center_i so
    // that center lands under the fixed top pointer. A tiny in-segment
    // jitter makes repeated wins feel less mechanical.
    const center = idx * SEG_ANGLE + SEG_ANGLE / 2
    const jitter = (Math.random() - 0.5) * (SEG_ANGLE * 0.5)
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
        {WEDGE_DEFS.map((d, i) => {
          const start = i * SEG_ANGLE
          const end = (i + 1) * SEG_ANGLE
          const p1 = polar(cx, cy, r, start)
          const p2 = polar(cx, cy, r, end)
          const mid = polar(cx, cy, r * 0.62, start + SEG_ANGLE / 2)
          const labelRot = start + SEG_ANGLE / 2
          const isJackpot = d.key === 'jackpot'
          return (
            <g key={d.key}>
              <path
                d={`M ${cx} ${cy} L ${p1.x} ${p1.y} A ${r} ${r} 0 0 1 ${p2.x} ${p2.y} Z`}
                fill={d.color}
                stroke="#0b0d24"
                strokeWidth={1.5}
              />
              <text
                x={mid.x}
                y={mid.y}
                fill={isJackpot ? '#1f2147' : '#fdf6e3'}
                fontSize={d.key === 'spin_again' ? 8.5 : isJackpot ? 9 : 11}
                fontWeight={isJackpot ? 900 : 700}
                textAnchor="middle"
                dominantBaseline="middle"
                transform={`rotate(${labelRot}, ${mid.x}, ${mid.y})`}
                style={{ pointerEvents: 'none' }}
              >
                {d.key === 'spin_again' ? '↻ AGAIN' : d.label}
              </text>
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
