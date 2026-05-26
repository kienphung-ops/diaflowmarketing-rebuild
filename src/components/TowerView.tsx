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

import { useEffect, useMemo, useState } from 'react'
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
//   Floor  1 label  ≈ 90% from image top
//   Floor 20 label  ≈ 12% from image top
//
// Linear interpolation is good enough — the original quadratic fit was
// compensating for a letterboxing bug that no longer exists.
const BOTTOM_TOP_PCT  = 90
const TOP_TOP_PCT     = 12
const BOTTOM_LEFT_PCT = 50
const TOP_LEFT_PCT    = 54

function floorTopPct(floor: number): number {
  const f = Math.max(1, Math.min(TOTAL_FLOORS, floor))
  const t = (f - 1) / (TOTAL_FLOORS - 1)
  return BOTTOM_TOP_PCT - t * (BOTTOM_TOP_PCT - TOP_TOP_PCT)
}

function floorToMarker(floor: number): { top: number; left: number } {
  const t = (Math.max(1, Math.min(TOTAL_FLOORS, floor)) - 1) / (TOTAL_FLOORS - 1)
  return {
    top: floorTopPct(floor),
    left: BOTTOM_LEFT_PCT + t * (TOP_LEFT_PCT - BOTTOM_LEFT_PCT),
  }
}

export function TowerView({
  signedIn,
  currentFloor,
  // totalInvites + teamName are still part of the public Props
  // contract (callers pass them) — they powered the now-retired
  // top-left info card. Left in the interface so external callers
  // don't break; intentionally NOT destructured here so eslint
  // doesn't flag them as unused locals.
  onClose,
  onSignIn,
}: TowerViewProps) {
  const marker = useMemo(() => floorToMarker(currentFloor), [currentFloor])

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
            alt="Diaflow Tower"
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
              the image. */}
          <FloorClickStrips />
        </div>
      </div>

      {/* The signed-in "current floor" info card used to live here
          (top-left, showing Floor label + "F1/20 · 0 invites"). It
          was retired — the same info is already surfaced by the
          MobileCounterChips strip / the desktop header pill / the
          YOU marker on the tower image, and a fourth duplicate just
          added clutter on top of the tower silhouette.
          The anon/trial CTA card is kept since it's the only way for
          a non-signed-in visitor to get into the auth flow from here. */}
      {!signedIn && (
        // Hidden on mobile — the header's "Claim your team" pill +
        // MobileBottomNav's "Save my team" hero already give the trial
        // user two paths into signup, and stacking a third floating
        // card on top of the tower image was visual noise (the user
        // explicitly asked for it gone on the small screen). Desktop
        // keeps the card since it doesn't have the bottom-nav hero.
        <div
          className="hidden md:block absolute z-20 rounded-2xl bg-black/70 backdrop-blur-md border border-white/15 max-w-[280px]
                     top-16 left-4 px-4 py-3"
          style={{ boxShadow: '0 12px 40px rgba(0,0,0,0.5)' }}
        >
          <div className="text-sm text-white/85 mb-2">
            🔒 Claim your team
          </div>
          <button
            onClick={onSignIn}
            className="px-4 py-1.5 rounded-md bg-purple-300 text-[#1a1a2e] font-semibold text-xs tracking-wide hover:bg-purple-200 transition"
          >
            Go To Your Team
          </button>
        </div>
      )}
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
  // Bumped to true the instant a strip is clicked so a spinner covers
  // the tower while /tower-view/{floor} fetches its RSC. The page nav
  // unmounts this component, so the overlay disappears naturally when
  // the destination mounts — no setState(false) reset needed.
  const [navTarget, setNavTarget] = useState<number | null>(null)
  // Use the same quadratic vertical calibration as the YOU marker so
  // each strip lines up with its labelled row on the tower image. Each
  // strip's height is the gap between its own center and the next
  // floor's center (clamped so we don't overlap neighbours).
  return (
    <div className="absolute inset-0 z-20">
      {Array.from({ length: TOTAL_FLOORS }, (_, i) => {
        const floor = i + 1
        const centerTop = floorTopPct(floor)
        // Height = distance to the next floor up, halved on each side.
        const above = floor < TOTAL_FLOORS ? floorTopPct(floor + 1) : centerTop - 2
        const below = floor > 1 ? floorTopPct(floor - 1) : centerTop + 2
        const stripHeight = Math.max(1, (below - above) / 2 + (centerTop - above) / 2)
        const stripTop = centerTop - stripHeight / 2
        return (
          <button
            key={floor}
            onClick={() => {
              setNavTarget(floor)
              router.push(`/tower-view/${floor}`)
            }}
            // Hover → warm the destination route's chunks + RSC
            // payload. By the time the user clicks the strip, the
            // /tower-view/N transition feels instant. Cost is tiny
            // (each prefetch dedupes; Next.js caches per-route).
            onMouseEnter={() => router.prefetch(`/tower-view/${floor}`)}
            onFocus={() => router.prefetch(`/tower-view/${floor}`)}
            aria-label={`Preview Floor ${floor}`}
            className="group absolute inset-x-0 cursor-pointer focus:outline-none"
            style={{
              top: `${stripTop}%`,
              height: `${stripHeight}%`,
              background: 'transparent',
            }}
          >
            {/* Hover highlight — gold band + floor pill on the right */}
            <span
              className="absolute inset-0 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition pointer-events-none"
              style={{
                background:
                  'linear-gradient(to right, transparent 0%, rgba(251,191,36,0.18) 50%, transparent 100%)',
                boxShadow: 'inset 0 0 0 1px rgba(251,191,36,0.4)',
              }}
            />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition px-2 py-0.5 rounded-md bg-purple-300 text-[#1a1a2e] text-[10px] font-bold tracking-wide pointer-events-none">
              View F{floor} →
            </span>
          </button>
        )
      })}

      {/* Loading overlay — covers the tower view while the
          /tower-view/{floor} RSC fetches. */}
      {navTarget != null && (
        <ViewTransitionOverlay label={`Loading Floor ${navTarget}…`} />
      )}
    </div>
  )
}
