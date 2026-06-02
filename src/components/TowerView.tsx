'use client'

/**
 * TowerView — image-based "look at the whole tower" overlay.
 *
 * Renders `/public/tower.png` (an isometric night-time tower) full-screen
 * with a glowing "YOU" marker positioned at the user's current floor.
 *
 * Auth gating: the YOU marker (and the floor-specific info footer) only
 * renders when `signedIn=true`. Anonymous visitors see the tower image and
 * a "Sign in to see your floor" CTA — they're not given a position until
 * they create an account, so the marker can't be spoofed via localStorage.
 *
 * Calibration: marker position is computed by linear interpolation between
 * BOTTOM_TOP_PCT (floor 1) and TOP_TOP_PCT (floor 20). If the tower image
 * is swapped, tweak only the four CALIBRATION constants below.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ViewTransitionOverlay } from './ViewTransitionOverlay'

interface TowerViewProps {
  /** Whether the visitor has a valid session. Drives YOU marker visibility. */
  signedIn: boolean
  /** Current floor (1..20). Ignored when `signedIn=false`. */
  currentFloor: number
  totalInvites: number
  teamName: string | null
  onClose: () => void
  /** Called when an anonymous visitor clicks the "Sign in" CTA. */
  onSignIn?: () => void
}

const TOTAL_FLOORS = 20

// ─── CALIBRATION — tweak after dropping in a new tower image ─────────────
// tower.png contains exactly 20 visible floors with numeric labels on
// the right side. The wrapper around the image now matches its 768/1376
// aspect ratio exactly (see <img> markup below), so positions in
// percent map 1:1 onto the bitmap.
//
//   Floor  1 label  ≈ 94% from image top
//   Floor 20 label  ≈ 12% from image top
//
// Linear interpolation is good enough — the original quadratic fit was
// compensating for a letterboxing bug that no longer exists. The
// bottom anchor was re-measured against the baked-in floor numbers
// (was 90% — slightly too high, which left the lower hover frames
// drifting above their number; 94% lines every floor up 1:1).
const BOTTOM_TOP_PCT  = 94
const TOP_TOP_PCT     = 12
const BOTTOM_LEFT_PCT = 50
const TOP_LEFT_PCT    = 54

// ─── Per-floor calibration table ────────────────────────────────────────
// The tower is an ISOMETRIC render — the floor labels are NOT evenly
// spaced (upper floors are taller, the base is compressed), so a 2-point
// linear fit always drifts in the middle. This table holds the measured
// vertical centre (% from image top) of each floor's number, so every
// hover frame lines up 1:1 with its number regardless of spacing.
//
// Populate it with the in-app calibrator: open /tower?calibrate=1 and
// click each floor's number from 1 → 20. The overlay prints the array to
// paste here. Any floor missing from the table falls back to the linear
// fit below, so partial tables still work.
const FLOOR_TOP_PCT: Partial<Record<number, number>> = {
  // floor: topPct  — filled in via the calibrator
}

// ─── Per-floor frame geometry — the precise, INDEPENDENT layer ──────────
// Each floor owns its WHOLE frame shape, so adjusting one floor never
// touches another (this replaced a model where the width/chevron were
// shared across floors and dragging one moved the rest). Hand-drawn via
// /tower?draw=1.
//   left / right : building silhouette x (% width)
//   center       : front vertical edge x — the chevron point
//   chevron      : how far the floor line dips at the centre (% height)
//   top / bottom : the floor's upper / lower edge y (% height, at sides)
interface FrameGeom {
  left: number
  right: number
  center: number
  chevron: number
  top: number
  bottom: number
}

const FLOOR_FRAMES: Partial<Record<number, FrameGeom>> = {
  1:  { left: 21, right: 79, center: 50.5, chevron: 7.9, top: 80.7,  bottom: 85.52 },
  2:  { left: 21, right: 79, center: 50.5, chevron: 8,   top: 76.53, bottom: 80.59 },
  3:  { left: 21, right: 79, center: 50.5, chevron: 8,   top: 73.03, bottom: 77.08 },
  4:  { left: 21, right: 79, center: 50.5, chevron: 8,   top: 69.52, bottom: 73.25 },
  5:  { left: 21, right: 79, center: 50.5, chevron: 8.1, top: 65.25, bottom: 69.2  },
  6:  { left: 21, right: 79, center: 50.5, chevron: 8,   top: 61.64, bottom: 65.8  },
  7:  { left: 21, right: 79, center: 50.5, chevron: 8,   top: 57.7,  bottom: 62.08 },
  8:  { left: 21, right: 79, center: 50.5, chevron: 8,   top: 54.3,  bottom: 58.13 },
  9:  { left: 21, right: 79, center: 50.5, chevron: 8,   top: 50.25, bottom: 53.97 },
  10: { left: 21, right: 79, center: 50.5, chevron: 7.8, top: 46.85, bottom: 50.36 },
  11: { left: 21, right: 79, center: 50.5, chevron: 7.4, top: 42.91, bottom: 46.74 },
  12: { left: 21, right: 79, center: 50.5, chevron: 7,   top: 39.62, bottom: 43.35 },
  13: { left: 21, right: 79, center: 50.5, chevron: 7.1, top: 35.57, bottom: 39.29 },
  14: { left: 21, right: 79, center: 50.5, chevron: 7,   top: 31.63, bottom: 34.91 },
  15: { left: 21, right: 79, center: 50.5, chevron: 6.8, top: 27.46, bottom: 31.85 },
  16: { left: 21, right: 79, center: 50.5, chevron: 6.8, top: 23.63, bottom: 27.68 },
  17: { left: 21, right: 79, center: 50.5, chevron: 6.8, top: 19.58, bottom: 23.74 },
  18: { left: 21, right: 79, center: 50.5, chevron: 6.1, top: 16.29, bottom: 20.24 },
  19: { left: 21, right: 79, center: 50.5, chevron: 5.9, top: 12.02, bottom: 16.4  },
  20: { left: 21, right: 79, center: 50.5, chevron: 5.5, top: 7.75,  bottom: 12.35 },
}

function linearTopPct(floor: number): number {
  const f = Math.max(1, Math.min(TOTAL_FLOORS, floor))
  const t = (f - 1) / (TOTAL_FLOORS - 1)
  return BOTTOM_TOP_PCT - t * (BOTTOM_TOP_PCT - TOP_TOP_PCT)
}

/** A floor's full frame geometry — its own hand-drawn entry when present,
 *  otherwise a default derived from the linear fit + shared silhouette. */
function floorFrame(floor: number): FrameGeom {
  const explicit = FLOOR_FRAMES[floor]
  if (explicit) return explicit
  const c = linearTopPct(floor)
  const up =
    floor < TOTAL_FLOORS ? linearTopPct(floor + 1) : c - (linearTopPct(floor - 1) - c)
  const down = floor > 1 ? linearTopPct(floor - 1) : c + (c - linearTopPct(floor + 1))
  return {
    left: BUILDING_LEFT_PCT,
    right: BUILDING_RIGHT_PCT,
    center: BUILDING_CENTER_PCT,
    chevron: FLOOR_CHEVRON_PCT,
    top: (c + up) / 2,
    bottom: (c + down) / 2,
  }
}

/** Vertical centre of a floor — used by hover/view affordances that
 *  anchor on the chevron polygon itself (e.g. the "View F<N>" pill that
 *  floats next to a hovered chevron). */
function floorTopPct(floor: number): number {
  const idx = Math.max(1, Math.min(TOTAL_FLOORS, floor))
  const g = FLOOR_FRAMES[idx]
  if (g) return (g.top + g.bottom) / 2
  const measured = FLOOR_TOP_PCT[idx]
  if (typeof measured === 'number') return measured
  return linearTopPct(floor)
}

/** Y-position for the YOU marker — centered in the chevron polygon
 *  AT the building's centre column (where the YOU pill is drawn).
 *
 *  `FLOOR_FRAMES[N]` describes the chevron band as a polygon with TWO
 *  V-shaped edges (top + bottom), both dipping down by `chevron` % at
 *  the centre. So at the building's centre column, the polygon
 *  vertically spans `g.top + g.chevron` (top dip) to `g.bottom +
 *  g.chevron` (bottom apex). Taking the midpoint of THAT range parks
 *  the pill visually inside the chevron outline regardless of how
 *  deep the V dips for that floor. Using `(top+bottom)/2` alone (the
 *  side-corner mid) leaves the pill above the polygon at the centre
 *  column — which is why earlier versions read as "one floor too
 *  high". The pill's own translate(-100%) means top:% becomes its
 *  bottom edge, so the pill body extends UP into the polygon. */
function youMarkerTopPct(floor: number): number {
  const idx = Math.max(1, Math.min(TOTAL_FLOORS, floor))
  const g = FLOOR_FRAMES[idx]
  if (g) {
    // Calibrated against two hand-tuned reference points from the
    // live bitmap:
    //
    //   Floor 20 → top = 16.3 → (16.3 − 12.35) / 5.5 = 0.718
    //   Floor 1  → top = 91.3 → (91.3 − 85.52) / 7.9 = 0.732
    //
    // The ratio `(top − g.bottom) / g.chevron` ≈ 0.725 generalises
    // across the band, so the marker now lands inside the chevron
    // polygon at the centre column for every floor (verified visually
    // at both ends). If FLOOR_FRAMES or the bitmap ever shifts, dial
    // the factor in again by picking two reference floors and
    // recomputing the ratio.
    return Math.min(95, g.bottom + g.chevron * 0.725)
  }
  return floorTopPct(floor)
}

function floorToMarker(floor: number): { top: number; left: number } {
  const t = (Math.max(1, Math.min(TOTAL_FLOORS, floor)) - 1) / (TOTAL_FLOORS - 1)
  return {
    top: youMarkerTopPct(floor),
    left: BOTTOM_LEFT_PCT + t * (TOP_LEFT_PCT - BOTTOM_LEFT_PCT),
  }
}

// ─── Hover-frame geometry (isometric floor outline) ─────────────────────
// The hover highlight traces the floor's footprint INSIDE the building
// rather than a full-width band. The tower is viewed corner-on, so each
// floor line is a shallow "v" that dips toward the front edge (centre).
// All four values are % of the bitmap; tweak to fit the silhouette.
const BUILDING_LEFT_PCT   = 21    // left silhouette of the tower (% width)
const BUILDING_RIGHT_PCT  = 79    // right silhouette
const BUILDING_CENTER_PCT = 50.5  // front vertical edge (faces meet here)
const FLOOR_CHEVRON_PCT   = 5.5   // floor-line dip at the centre (% height)

/** SVG polygon points (in bitmap %) outlining one floor's chevron band,
 *  using that floor's OWN geometry so each frame is independent. */
function framePoints(g: FrameGeom): string {
  return [
    [g.left, g.top],
    [g.center, g.top + g.chevron],
    [g.right, g.top],
    [g.right, g.bottom],
    [g.center, g.bottom + g.chevron],
    [g.left, g.bottom],
  ]
    .map(p => p.join(','))
    .join(' ')
}

function floorFramePoints(floor: number): string {
  return framePoints(floorFrame(floor))
}

export function TowerView({
  signedIn,
  currentFloor,
  // totalInvites + teamName + onSignIn are still part of the public
  // Props contract (callers pass them) — they powered the now-retired
  // top-left info card / sign-in CTA. Left in the interface so external
  // callers don't break; intentionally NOT destructured here so eslint
  // doesn't flag them as unused locals.
  onClose,
}: TowerViewProps) {
  const marker = useMemo(() => floorToMarker(currentFloor), [currentFloor])

  // Calibration mode — `/tower?calibrate=1` swaps the hover strips for a
  // click-to-map overlay so the per-floor FLOOR_TOP_PCT table can be
  // measured against the real bitmap. Read from the URL on mount
  // (client-only) to avoid pulling useSearchParams into this component.
  const [calibrate, setCalibrate] = useState(false)
  // `/tower?tune=1` → live slider panel to hand-adjust the frame geometry
  // + vertical calibration, printing values to bake into the constants.
  const [tune, setTune] = useState(false)
  // `/tower?draw=1` → per-floor frame drawer (drag each floor's edges).
  const [draw, setDraw] = useState(false)
  useEffect(() => {
    const q = new URLSearchParams(window.location.search)
    setCalibrate(q.get('calibrate') === '1')
    setTune(q.get('tune') === '1')
    setDraw(q.get('draw') === '1')
  }, [])

  // Lock body scroll while overlay is open.
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  // Esc closes.
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-0 flex items-center justify-center overflow-hidden"
      style={{
        background:
          'radial-gradient(ellipse 80% 60% at 50% 40%, #1d1b46 0%, #0a0a22 55%, #04040d 100%)',
      }}
    >
      <Stars />

      {/* No standalone close button — the page's Header carries the
          "Office view" toggle that navigates back to /. */}

      {/* Tower image — uses the IMG's intrinsic aspect to drive layout.
          The wrapper is inline-block sized to the image's rendered box,
          so the wrapper rect always matches the bitmap exactly (no
          letterbox in either axis). YOU marker + click strips can then
          use simple bitmap-% positioning that lines up everywhere. */}
      <div className="relative h-full flex items-center justify-center w-full px-4">
        <div className="relative inline-block">
          {/* Soft golden halo behind the tower */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                'radial-gradient(ellipse 40% 50% at 50% 38%, rgba(251, 191, 36, 0.18) 0%, transparent 65%)',
            }}
          />

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/tower.png"
            alt="Diaflow teammate"
            className="block select-none drop-shadow-[0_30px_60px_rgba(0,0,0,0.6)]"
            draggable={false}
            style={{
              maxHeight: '100vh',
              maxWidth: '100%',
              height: 'auto',
              width: 'auto',
            }}
          />

          {/* YOU marker — only for signed-in visitors. Anonymous users see the
              tower without a position so the marker can't be spoofed via
              localStorage. */}
          {signedIn && (
            <div
              className="absolute pointer-events-none z-10"
              style={{
                top: `${marker.top}%`,
                left: `${marker.left}%`,
                transform: 'translate(-50%, -100%)',
                transition:
                  'top 0.7s cubic-bezier(0.22, 1, 0.36, 1), left 0.7s cubic-bezier(0.22, 1, 0.36, 1)',
              }}
            >
              <YouMarker />
            </div>
          )}

          {/* Floor click strips — clicking any floor on the tower image
              opens the public read-only preview at /tower-view/{N}. The
              strips are calibrated against the same constants used for
              the YOU marker, so they line up with the floors visible in
              the image. In calibrate mode they're replaced by the
              click-to-map overlay. */}
          {calibrate ? (
            <FloorCalibrator />
          ) : tune ? (
            <FloorTuner />
          ) : draw ? (
            <FloorDrawer />
          ) : (
            <FloorClickStrips />
          )}
        </div>
      </div>

    </div>
  )
}

function YouMarker() {
  return (
    <div className="flex flex-col items-center">
      <div
        className="relative px-2.5 py-1 rounded-md text-white text-[11px] font-bold tracking-wider shadow-lg mb-1.5 whitespace-nowrap"
        style={{
          background: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 60%, #c084fc 100%)',
          boxShadow:
            '0 4px 14px rgba(168, 85, 247, 0.55), 0 0 0 1px rgba(255,255,255,0.18) inset',
        }}
      >
        YOU
        <div
          className="absolute -bottom-[5px] left-1/2 -translate-x-1/2 w-0 h-0"
          style={{
            borderLeft: '4px solid transparent',
            borderRight: '4px solid transparent',
            borderTop: '5px solid #a855f7',
          }}
        />
      </div>
      <div className="relative">
        <div
          className="absolute -inset-4 rounded-full"
          style={{
            background:
              'radial-gradient(circle, rgba(168,85,247,0.55) 0%, rgba(168,85,247,0) 70%)',
            animation: 'tower-pulse 1.8s ease-in-out infinite',
          }}
        />
        <div
          className="relative w-5 h-5 rounded-full ring-2 ring-white/90"
          style={{
            background: 'linear-gradient(135deg, #c084fc 0%, #7c3aed 100%)',
            boxShadow: '0 0 18px 4px rgba(168, 85, 247, 0.65)',
          }}
        />
      </div>
      <style jsx>{`
        @keyframes tower-pulse {
          0%, 100% { transform: scale(1); opacity: 0.85; }
          50%      { transform: scale(1.45); opacity: 0.35; }
        }
      `}</style>
    </div>
  )
}

function Stars() {
  const stars = useMemo(() => {
    const arr: { top: number; left: number; size: number; opacity: number }[] = []
    let s = 1337
    const rand = () => {
      s = (s * 1103515245 + 12345) & 0x7fffffff
      return s / 0x7fffffff
    }
    for (let i = 0; i < 120; i++) {
      arr.push({
        top: rand() * 100,
        left: rand() * 100,
        size: 1 + Math.floor(rand() * 2.5),
        opacity: 0.35 + rand() * 0.55,
      })
    }
    return arr
  }, [])
  return (
    <div className="absolute inset-0 pointer-events-none">
      {stars.map((s, i) => (
        <div
          key={i}
          className="absolute rounded-full bg-white"
          style={{
            top: `${s.top}%`,
            left: `${s.left}%`,
            width: `${s.size}px`,
            height: `${s.size}px`,
            opacity: s.opacity,
            boxShadow: s.size > 1 ? '0 0 4px rgba(255,255,255,0.55)' : undefined,
          }}
        />
      ))}
    </div>
  )
}

// ─── Floor click strips — 20 invisible buttons over the tower image ─────
function FloorClickStrips() {
  const router = useRouter()
  // Bumped the instant a strip is clicked so a spinner covers the tower
  // while /tower-view/{floor} fetches its RSC.
  const [navTarget, setNavTarget] = useState<number | null>(null)
  // Currently-hovered floor — drives the chevron frame + "View FN" pill.
  const [hovered, setHovered] = useState<number | null>(null)
  return (
    <div className="absolute inset-0 z-20">
      {/* One interactive chevron polygon per floor. The polygon IS the
          hit-area (pointerEvents:'all' captures hover/click over its exact
          shape) AND the visual frame — so the highlighted floor is always
          the one under the cursor. (The old version used flat rectangles
          for hit-testing while drawing chevron frames, so the cursor near
          a floor's dipped centre landed in the neighbour's rectangle and
          lit up the wrong floor.) */}
      <svg
        className="absolute inset-0 w-full h-full z-10"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{ pointerEvents: 'none' }}
      >
        {Array.from({ length: TOTAL_FLOORS }, (_, i) => {
          const floor = i + 1
          const isHover = hovered === floor
          return (
            <polygon
              key={floor}
              points={floorFramePoints(floor)}
              fill={isHover ? 'rgba(251,191,36,0.12)' : 'transparent'}
              stroke={isHover ? '#fbbf24' : 'transparent'}
              strokeWidth={1.5}
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              tabIndex={0}
              role="button"
              aria-label={`Preview Floor ${floor}`}
              style={{ pointerEvents: 'all', cursor: 'pointer', outline: 'none' }}
              onMouseEnter={() => {
                setHovered(floor)
                router.prefetch(`/tower-view/${floor}`)
              }}
              onMouseLeave={() => setHovered(h => (h === floor ? null : h))}
              onFocus={() => {
                setHovered(floor)
                router.prefetch(`/tower-view/${floor}`)
              }}
              onBlur={() => setHovered(h => (h === floor ? null : h))}
              onClick={() => {
                setNavTarget(floor)
                router.push(`/tower-view/${floor}`)
              }}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  setNavTarget(floor)
                  router.push(`/tower-view/${floor}`)
                }
              }}
            />
          )
        })}
      </svg>

      {/* "View FN" pill — sits at the hovered floor's number height, just
          to the right of the building silhouette. */}
      {hovered != null && (
        <span
          className="absolute -translate-y-1/2 px-2 py-0.5 rounded-md bg-purple-300 text-[#1a1a2e] text-[10px] font-bold tracking-wide pointer-events-none shadow-lg z-10"
          style={{
            top: `${floorTopPct(hovered)}%`,
            left: `${floorFrame(hovered).right + 1}%`,
          }}
        >
          View F{hovered} →
        </span>
      )}

      {/* Loading overlay — covers the tower view while the
          /tower-view/{floor} RSC fetches. */}
      {navTarget != null && (
        <ViewTransitionOverlay label={`Loading Floor ${navTarget}…`} />
      )}
    </div>
  )
}

// ─── Calibration overlay — /tower?calibrate=1 ───────────────────────────
// Click each floor's NUMBER in order, Floor 1 → Floor 20. Each click is
// recorded as a % of the tower bitmap's height. When all 20 are mapped it
// prints the FLOOR_TOP_PCT object to paste into the table above. Lives
// inside the same image wrapper as the strips, so click-Y maps 1:1 onto
// the bitmap percentage the strips/markers use.
function FloorCalibrator() {
  const [clicks, setClicks] = useState<number[]>([])
  const done = clicks.length >= TOTAL_FLOORS
  const nextFloor = clicks.length + 1

  function record(e: React.MouseEvent<HTMLDivElement>) {
    if (done) return
    const rect = e.currentTarget.getBoundingClientRect()
    const pct = ((e.clientY - rect.top) / rect.height) * 100
    setClicks(prev => [...prev, +pct.toFixed(2)])
  }

  const tableStr =
    '{ ' + clicks.map((p, i) => `${i + 1}: ${p}`).join(', ') + ' }'

  return (
    <div className="absolute inset-0 z-30 cursor-crosshair" onClick={record}>
      {/* Recorded floor lines */}
      {clicks.map((p, i) => (
        <div
          key={i}
          className="absolute inset-x-0 pointer-events-none"
          style={{ top: `${p}%`, height: 0, borderTop: '2px solid #00e5ff' }}
        >
          <span
            className="absolute -translate-y-1/2 left-1 text-[11px] font-extrabold"
            style={{ color: '#00e5ff', textShadow: '0 0 3px #000' }}
          >
            {i + 1}
          </span>
        </div>
      ))}

      {/* Instruction + output panel — stopPropagation so taps here don't
          register as floor clicks. */}
      <div
        onClick={e => e.stopPropagation()}
        className="absolute top-2 left-2 right-2 z-40 rounded-lg bg-black/85 border border-cyan-400/40 px-3 py-2 text-cyan-100 text-[12px] pointer-events-auto"
      >
        {!done ? (
          <div className="flex items-center justify-between gap-2">
            <span>
              Tap <strong className="text-cyan-300">Floor {nextFloor}</strong>’s
              number ({clicks.length}/{TOTAL_FLOORS})
            </span>
            <button
              type="button"
              onClick={() => setClicks(prev => prev.slice(0, -1))}
              disabled={clicks.length === 0}
              className="px-2 py-0.5 rounded bg-white/10 border border-white/20 disabled:opacity-40"
            >
              Undo
            </button>
          </div>
        ) : (
          <div className="space-y-1">
            <div className="font-bold text-cyan-300">
              Done — paste this into FLOOR_TOP_PCT:
            </div>
            <textarea
              readOnly
              value={tableStr}
              onFocus={e => e.currentTarget.select()}
              className="w-full h-14 bg-black/60 border border-white/15 rounded p-1 font-mono text-[11px] text-cyan-100"
            />
            <button
              type="button"
              onClick={() => setClicks([])}
              className="px-2 py-0.5 rounded bg-white/10 border border-white/20"
            >
              Reset
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Manual tuner — /tower?tune=1 ───────────────────────────────────────
// Live sliders to hand-adjust the frame geometry + vertical calibration.
// Renders every floor's chevron frame using the live values so you can
// see the whole tower align as you drag, then prints the numbers to bake
// into the constants at the top of this file.
function FloorTuner() {
  const [bl, setBl] = useState(BUILDING_LEFT_PCT)
  const [br, setBr] = useState(BUILDING_RIGHT_PCT)
  const [bc, setBc] = useState(BUILDING_CENTER_PCT)
  const [ch, setCh] = useState(FLOOR_CHEVRON_PCT)
  const [bt, setBt] = useState(BOTTOM_TOP_PCT) // floor 1 vertical %
  const [tt, setTt] = useState(TOP_TOP_PCT) // floor 20 vertical %

  const topPct = (f: number) =>
    bt - ((Math.max(1, Math.min(TOTAL_FLOORS, f)) - 1) / (TOTAL_FLOORS - 1)) * (bt - tt)

  const points = (f: number) => {
    const center = topPct(f)
    const up = f < TOTAL_FLOORS ? topPct(f + 1) : center - (topPct(f - 1) - center)
    const down = f > 1 ? topPct(f - 1) : center + (center - topPct(f + 1))
    const topSide = (center + up) / 2
    const botSide = (center + down) / 2
    return [
      [bl, topSide],
      [bc, topSide + ch],
      [br, topSide],
      [br, botSide],
      [bc, botSide + ch],
      [bl, botSide],
    ]
      .map(p => p.join(','))
      .join(' ')
  }

  const dump =
    `BUILDING_LEFT_PCT=${bl}  BUILDING_RIGHT_PCT=${br}  BUILDING_CENTER_PCT=${bc}\n` +
    `FLOOR_CHEVRON_PCT=${ch}  BOTTOM_TOP_PCT=${bt}  TOP_TOP_PCT=${tt}`

  return (
    <div className="absolute inset-0 z-30">
      {/* Every floor's frame, live */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden
      >
        {Array.from({ length: TOTAL_FLOORS }, (_, i) => (
          <polygon
            key={i}
            points={points(i + 1)}
            fill="none"
            stroke="#fbbf24"
            strokeWidth={1.2}
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>

      {/* Slider panel — fixed to the viewport so it isn't clipped. */}
      <div
        className="fixed top-3 right-3 z-50 w-[230px] rounded-lg bg-black/90 border border-amber-400/40 px-3 py-2.5 text-amber-100 text-[11px] space-y-1.5"
        style={{ pointerEvents: 'auto' }}
      >
        <div className="font-bold text-amber-300 text-[12px]">Frame tuner</div>
        <Slider label="Left" value={bl} min={15} max={48} step={0.5} onChange={setBl} />
        <Slider label="Right" value={br} min={55} max={88} step={0.5} onChange={setBr} />
        <Slider label="Centre" value={bc} min={42} max={60} step={0.5} onChange={setBc} />
        <Slider label="Chevron" value={ch} min={0} max={10} step={0.1} onChange={setCh} />
        <Slider label="Floor 1 y" value={bt} min={84} max={99} step={0.2} onChange={setBt} />
        <Slider label="Floor 20 y" value={tt} min={4} max={22} step={0.2} onChange={setTt} />
        <textarea
          readOnly
          value={dump}
          onFocus={e => e.currentTarget.select()}
          className="w-full h-12 mt-1 bg-black/60 border border-white/15 rounded p-1 font-mono text-[10px] text-amber-100"
        />
      </div>
    </div>
  )
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
}) {
  return (
    <label className="flex items-center gap-2">
      <span className="w-[58px] shrink-0">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(+e.target.value)}
        className="flex-1 min-w-0 accent-amber-400"
      />
      <span className="w-[34px] text-right tabular-nums">{value}</span>
    </label>
  )
}

// ─── Per-floor frame drawer — /tower?draw=1 ─────────────────────────────
// Pick a floor, then drag its TOP/BOTTOM handles + tweak its OWN
// left/right/centre/chevron sliders. Every control is per-floor, so
// adjusting one floor never moves another. Prints the full FLOOR_FRAMES
// table to paste into the constant at the top of this file.
function FloorDrawer() {
  const [sel, setSel] = useState(1)
  const [collapsed, setCollapsed] = useState(false)
  // Panel corner — move it away from whichever floors you're editing
  // (e.g. to the top while adjusting the lower floors). Cycles TL→TR→BR→BL.
  const [corner, setCorner] = useState<'tl' | 'tr' | 'br' | 'bl'>('bl')
  // Each floor keeps its OWN full geometry — editing one never touches
  // another. Seeded from the baked FLOOR_FRAMES (or the default).
  const [frames, setFrames] = useState<Record<number, FrameGeom>>(() => {
    const o: Record<number, FrameGeom> = {}
    for (let f = 1; f <= TOTAL_FLOORS; f++) o[f] = { ...floorFrame(f) }
    return o
  })
  const dragRef = useRef<'top' | 'bottom' | null>(null)

  const g = frames[sel]
  const patch = (p: Partial<FrameGeom>) =>
    setFrames(prev => ({ ...prev, [sel]: { ...prev[sel], ...p } }))

  // Keyboard floor nav (↑/↓) so floors switch without the on-screen buttons.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSel(s => Math.min(TOTAL_FLOORS, s + 1))
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSel(s => Math.max(1, s - 1))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Drag the selected floor's top/bottom edge (pointer Y → bitmap %).
  useEffect(() => {
    function move(e: PointerEvent) {
      if (!dragRef.current) return
      const img = document.querySelector('img[alt="Diaflow teammate"]')
      if (!img) return
      const r = img.getBoundingClientRect()
      const y = Math.max(0, Math.min(100, ((e.clientY - r.top) / r.height) * 100))
      const edge = dragRef.current
      setFrames(prev => ({ ...prev, [sel]: { ...prev[sel], [edge]: +y.toFixed(2) } }))
    }
    function up() {
      dragRef.current = null
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
  }, [sel])

  const dump =
    'FLOOR_FRAMES = {\n' +
    Array.from({ length: TOTAL_FLOORS }, (_, i) => i + 1)
      .map(f => {
        const x = frames[f]
        return `  ${f}: { left: ${x.left}, right: ${x.right}, center: ${x.center}, chevron: ${x.chevron}, top: ${x.top}, bottom: ${x.bottom} },`
      })
      .join('\n') +
    '\n}'

  return (
    <div className="absolute inset-0 z-30">
      {/* All floor frames — selected bright cyan, others faint gold. */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden
      >
        {Array.from({ length: TOTAL_FLOORS }, (_, i) => {
          const f = i + 1
          return (
            <polygon
              key={f}
              points={framePoints(frames[f])}
              fill={f === sel ? 'rgba(0,229,255,0.12)' : 'none'}
              stroke={f === sel ? '#00e5ff' : 'rgba(251,191,36,0.35)'}
              strokeWidth={f === sel ? 1.6 : 1}
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          )
        })}
      </svg>

      {/* Draggable TOP/BOTTOM edge handles for the selected floor only. */}
      {(['top', 'bottom'] as const).map(edge => (
        <div
          key={edge}
          onPointerDown={e => {
            e.preventDefault()
            dragRef.current = edge
          }}
          className="absolute cursor-ns-resize"
          style={{
            top: `${g[edge]}%`,
            left: `${g.left}%`,
            width: `${g.right - g.left}%`,
            height: 14,
            transform: 'translateY(-50%)',
            background: 'rgba(0,229,255,0.18)',
            borderTop: '2px solid #00e5ff',
          }}
        />
      ))}

      {/* Control panel — collapsible + movable (the ⤢ button cycles it
          between corners so it never covers the floor you're editing).
          EVERY slider edits the SELECTED floor only. */}
      <div
        className={
          'fixed z-50 rounded-lg bg-black/90 border border-cyan-400/40 text-cyan-100 text-[11px] ' +
          { tl: 'top-3 left-3', tr: 'top-3 right-3', br: 'bottom-3 right-3', bl: 'bottom-3 left-3' }[corner] +
          ' ' +
          (collapsed ? 'px-2 py-1.5' : 'w-[230px] px-3 py-2.5 space-y-1.5')
        }
      >
        <div className="flex items-center justify-between gap-2">
          <span className="font-bold text-cyan-300 text-[12px]">Draw F{sel}</span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setSel(s => Math.max(1, s - 1))}
              className="px-2 rounded bg-white/10 border border-white/20"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => setSel(s => Math.min(TOTAL_FLOORS, s + 1))}
              className="px-2 rounded bg-white/10 border border-white/20"
            >
              ›
            </button>
            <button
              type="button"
              onClick={() =>
                setCorner(c => (({ tl: 'tr', tr: 'br', br: 'bl', bl: 'tl' } as const)[c]))
              }
              className="px-2 rounded bg-white/10 border border-white/20"
              title="Move panel to next corner"
            >
              ⤢
            </button>
            <button
              type="button"
              onClick={() => setCollapsed(c => !c)}
              className="px-2 rounded bg-white/10 border border-white/20"
              title={collapsed ? 'Expand' : 'Collapse'}
            >
              {collapsed ? '▸' : '▾'}
            </button>
          </div>
        </div>

        {!collapsed && (
          <>
            <div className="text-cyan-200/70 leading-snug">
              Each slider edits Floor {sel} ONLY. Drag the cyan TOP/BOTTOM bars
              for its height; ‹ › or ↑/↓ for the next floor; ▾ to free the view.
            </div>
            <Slider label="Left" value={g.left} min={15} max={48} step={0.5} onChange={v => patch({ left: v })} />
            <Slider label="Right" value={g.right} min={55} max={88} step={0.5} onChange={v => patch({ right: v })} />
            <Slider label="Centre" value={g.center} min={42} max={60} step={0.5} onChange={v => patch({ center: v })} />
            <Slider label="Chevron" value={g.chevron} min={0} max={10} step={0.1} onChange={v => patch({ chevron: v })} />
            <Slider label="Top y" value={g.top} min={2} max={98} step={0.2} onChange={v => patch({ top: v })} />
            <Slider label="Bottom y" value={g.bottom} min={2} max={98} step={0.2} onChange={v => patch({ bottom: v })} />
            <textarea
              readOnly
              value={dump}
              onFocus={e => e.currentTarget.select()}
              className="w-full h-20 mt-1 bg-black/60 border border-white/15 rounded p-1 font-mono text-[9.5px] text-cyan-100"
            />
          </>
        )}
      </div>
    </div>
  )
}
