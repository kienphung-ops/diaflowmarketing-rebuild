'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { SceneSkeleton } from '@/components/fallback/SceneSkeleton'
import { Mobile2DScene } from '@/components/scene2d/Mobile2DScene'
import { ShareModal } from '@/components/ShareModal'
import { SignupModal } from '@/components/SignupModal'
import { useFloor, useFloorsConfig } from '@/lib/floorsConfigClient'
import { DEFAULT_NPC_COUNT } from '@/lib/floors'
import type { FloorPreview } from '@/lib/towerFloorPreview'

const SceneCanvas = dynamic(
  () => import('@/components/scene/SceneCanvas').then(m => ({ default: m.SceneCanvas })),
  { ssr: false, loading: () => <SceneSkeleton /> }
)

interface Props {
  preview: FloorPreview
  /** True when the visitor has a resolved session. Anonymous visitors
   *  see the pre-login state regardless of which floor they preview. */
  viewerSignedIn: boolean
  /** The visitor's own current floor — drives climbed / here / locked. */
  viewerCurrentFloor: number
  /** The visitor's invite count — drives "N invites away" math. */
  viewerTotalInvites: number
  /** The visitor's referral code — builds their personal share link. */
  viewerReferralCode: string | null
}

/** The viewer's relationship to the floor they're previewing. */
type ViewState = 'prelogin' | 'passed' | 'here' | 'locked'

export default function TowerFloorViewClient({
  preview,
  viewerSignedIn,
  viewerCurrentFloor,
  viewerTotalInvites,
  viewerReferralCode,
}: Props) {
  const prevFloor = preview.floor > 1 ? preview.floor - 1 : null
  const nextFloor = preview.floor < preview.totalFloors ? preview.floor + 1 : null

  // ── Viewer state ─────────────────────────────────────────────────
  const state: ViewState = !viewerSignedIn
    ? 'prelogin'
    : preview.floor < viewerCurrentFloor
      ? 'passed'
      : preview.floor === viewerCurrentFloor
        ? 'here'
        : 'locked'

  // The floor immediately above the one being previewed — used for the
  // "N invites to Floor X" status line on the user's current floor.
  const oneUp = useFloor(preview.floor + 1)
  const invitesToNext = oneUp
    ? Math.max(0, oneUp.invitesRequired - viewerTotalInvites)
    : 0
  // Invites still needed to reach THIS (locked) floor.
  const invitesAway = Math.max(0, preview.invitesRequired - viewerTotalInvites)

  // ── Ghosting (tower-view preview) ────────────────────────────────
  // When the viewer peeks at a floor ABOVE their own, items + teammate
  // slots they haven't yet unlocked render at half opacity ("future
  // perks" preview). The owner's actual unlocked set is derived from
  // every floor at-or-below `viewerCurrentFloor` in the live floors
  // config. Anonymous viewers behave like floor-1 viewers (their
  // `viewerCurrentFloor` is seeded to 1 server-side).
  const allFloors = useFloorsConfig()
  const viewerFloorCfg = useFloor(viewerCurrentFloor)
  const isLockedPeek = preview.floor > viewerCurrentFloor
  const viewerMaxTeammates = viewerFloorCfg?.maxTeammates ?? DEFAULT_NPC_COUNT
  const solidTeammateCount = isLockedPeek
    ? Math.max(0, viewerMaxTeammates - DEFAULT_NPC_COUNT)
    : undefined
  const ghostItemKeys = isLockedPeek
    ? (() => {
        const owned = new Set<string>()
        for (const f of allFloors) {
          if (f.id <= viewerCurrentFloor) {
            for (const it of f.items) owned.add(it.key)
          }
        }
        return new Set(preview.unlockedItemKeys.filter(k => !owned.has(k)))
      })()
    : undefined

  // Personal share link — only resolvable client-side (needs origin).
  const [origin, setOrigin] = useState('')
  useEffect(() => {
    setOrigin(window.location.origin)
  }, [])
  const inviteUrl =
    viewerReferralCode && origin ? `${origin}/floor/${viewerReferralCode}` : null

  const [shareOpen, setShareOpen] = useState(false)
  const [signupOpen, setSignupOpen] = useState(false)

  // Per-state presentation for the info card + status line.
  const pill =
    state === 'passed'
      ? { label: '✓ Reached', cls: 'bg-white/5 text-tower-cream/60 border-white/10' }
      : state === 'here'
        ? { label: '📍 You’re here', cls: 'bg-emerald-400/10 text-emerald-300 border-emerald-400/30' }
        : state === 'locked'
          ? { label: '🔒 Locked', cls: 'bg-purple-500/15 text-purple-200 border-purple-400/30' }
          : { label: '🔒 Save to unlock', cls: 'bg-amber-400/10 text-amber-300 border-amber-400/30' }

  const status =
    state === 'passed'
      ? { text: `You’re on Floor ${viewerCurrentFloor} — already past this`, cls: 'text-tower-cream/55' }
      : state === 'here'
        ? {
            text: oneUp
              ? `Your current floor · ${invitesToNext} ${invitesToNext === 1 ? 'invite' : 'invites'} to Floor ${oneUp.id}`
              : 'Your current floor · Penthouse 👑',
            cls: 'text-emerald-300',
          }
        : state === 'locked'
          ? { text: `${invitesAway} ${invitesAway === 1 ? 'invite' : 'invites'} away`, cls: 'text-purple-200' }
          : { text: 'Save your team first to start leveling up', cls: 'text-amber-300' }

  const cardBorder =
    state === 'here'
      ? 'border-emerald-400/30'
      : state === 'prelogin'
        ? 'border-amber-400/30'
        : state === 'locked'
          ? 'border-purple-400/25'
          : 'border-white/15'

  return (
    <main className="fixed inset-0 overflow-hidden bg-[#04040d]">
      {/* Top chrome — re-designed so users stop confusing the preview
          with their own floor. The "PREVIEWING FLOOR N" pill makes it
          unmistakable, and "Go to your office" gives a one-click escape
          back to where they actually live.
            Mobile: 2 rows — back/office on top, floor nav below.
            Desktop: 1 row — back/office on the left, pill centred,
                              floor nav on the right. */}
      <header className="fixed top-0 inset-x-0 z-10 px-3 md:px-4 py-2.5 md:py-3 pointer-events-none">
        {/* ── Row 1 (mobile + desktop): nav buttons ─────────────── */}
        <div className="flex items-center justify-between md:relative">
          {/* Mobile: Back to tower sticks to the LEFT edge — paired
              with "Go to your office" pinned to the right edge via
              its own wrapper below. This keeps the two primary nav
              affordances at the far corners of the row so they're
              easy to thumb on a phone and visually distinct from
              the floor-nav row below. Desktop keeps both buttons
              grouped on the left (the pill takes the centre and the
              preview buttons take the right). */}
          <div className="pointer-events-auto flex items-center md:gap-2">
            <Link
              href="/tower"
              className="px-3 py-1.5 md:py-2 rounded-md bg-night-mid border border-white/15 text-tower-cream text-xs md:text-sm font-semibold hover:bg-night-mid/80 transition whitespace-nowrap shadow-[0_4px_12px_rgba(0,0,0,0.4)]"
              aria-label="Back to tower"
            >
              Back to tower
            </Link>
            {/* Desktop-only second button — on mobile the same link
                renders at the right edge of the row (see sibling
                wrapper below) so the two CTAs flank the row. */}
            <Link
              href="/"
              className="hidden md:inline-flex px-3 py-1.5 md:py-2 rounded-md bg-night-mid border border-purple-400/40 text-tower-cream text-xs md:text-sm font-semibold hover:bg-night-mid/80 transition whitespace-nowrap shadow-[0_4px_12px_rgba(0,0,0,0.4)]"
              aria-label="Go to your office"
            >
              Go to your office
            </Link>
          </div>

          {/* Centre pill — DESKTOP ONLY (mobile shows the floor number
              between the prev/next buttons on row 2). Same night-mid
              palette as the flanking nav buttons so the chrome reads
              as one coherent bar; the floor number itself is the only
              accent (tower-gold) — that's what the user actually needs
              to notice, not the pill's chrome. */}
          <div
            className="hidden md:flex pointer-events-auto absolute left-1/2 -translate-x-1/2 items-center gap-1.5 px-4 py-2 rounded-full bg-night-mid border border-white/15 text-tower-cream text-[13px] font-extrabold uppercase tracking-[0.06em] shadow-[0_4px_12px_rgba(0,0,0,0.4)]"
          >
            <span aria-hidden>🔭</span>
            <span>
              Previewing Floor <span className="text-tower-gold">{preview.floor}</span>
            </span>
          </div>

          {/* MOBILE-ONLY — Go to your office anchored to the row's
              right edge. Pairs with "Back to tower" on the left so
              the two primary actions flank the row instead of
              huddling together. Desktop version sits in the left
              cluster above (alongside Back to tower) since the
              middle/right slots are occupied by the pill + preview
              nav. */}
          <Link
            href="/"
            className="md:hidden pointer-events-auto px-3 py-1.5 rounded-md bg-night-mid border border-purple-400/40 text-tower-cream text-xs font-semibold hover:bg-night-mid/80 transition whitespace-nowrap shadow-[0_4px_12px_rgba(0,0,0,0.4)]"
            aria-label="Go to your office"
          >
            Go to your office
          </Link>

          {/* Right cluster — DESKTOP prev/next preview buttons. Mobile
              version lives on row 2 below. */}
          <div className="hidden md:flex pointer-events-auto items-center gap-1.5">
            {prevFloor && (
              <Link
                href={`/tower-view/${prevFloor}`}
                className="px-3 py-1.5 rounded-md bg-night-mid/70 border border-white/10 text-tower-cream/80 text-xs font-semibold hover:bg-night-mid transition flex flex-col items-center leading-tight"
                aria-label={`Preview Floor ${prevFloor}`}
              >
                <span className="text-[9px] uppercase tracking-[0.1em] text-tower-cream/45 font-bold">
                  ← Preview
                </span>
                <span className="text-[13px] font-bold text-tower-cream">Floor {prevFloor}</span>
              </Link>
            )}
            {nextFloor && (
              <Link
                href={`/tower-view/${nextFloor}`}
                className="px-3 py-1.5 rounded-md bg-night-mid/70 border border-white/10 text-tower-cream/80 text-xs font-semibold hover:bg-night-mid transition flex flex-col items-center leading-tight"
                aria-label={`Preview Floor ${nextFloor}`}
              >
                <span className="text-[9px] uppercase tracking-[0.1em] text-tower-cream/45 font-bold">
                  Preview →
                </span>
                <span className="text-[13px] font-bold text-tower-cream">Floor {nextFloor}</span>
              </Link>
            )}
          </div>
        </div>

        {/* ── Row 2 (MOBILE ONLY): prev / current / next floor nav.
            Equal-width 3-column grid so the "Floor X of N" centre
            doesn't drift even when there's no prev/next link. */}
        <div className="md:hidden mt-2 grid grid-cols-3 items-center gap-1.5 pointer-events-auto">
          <div className="justify-self-start">
            {prevFloor ? (
              <Link
                href={`/tower-view/${prevFloor}`}
                className="inline-flex items-center px-3 py-1.5 rounded-md bg-night-mid/70 border border-white/10 text-tower-cream text-xs font-semibold hover:bg-night-mid transition"
                aria-label={`Preview Floor ${prevFloor}`}
              >
                ← Floor {prevFloor}
              </Link>
            ) : (
              <span />
            )}
          </div>
          <div className="justify-self-center text-center text-tower-cream text-xs font-bold leading-tight">
             <span className="text-night-mid ">Floor {preview.floor}</span>{' '}
            <span className="text-tower-cream/80 font-medium">of {preview.totalFloors}</span>
          </div>
          <div className="justify-self-end">
            {nextFloor ? (
              <Link
                href={`/tower-view/${nextFloor}`}
                className="inline-flex items-center px-3 py-1.5 rounded-md bg-night-mid/70 border border-white/10 text-tower-cream text-xs font-semibold hover:bg-night-mid transition"
                aria-label={`Preview Floor ${nextFloor}`}
              >
                Floor {nextFloor} →
              </Link>
            ) : (
              <span />
            )}
          </div>
        </div>
      </header>

      {/* Floor info card — top-left under the header chrome. Border + pill
          + status line all shift with the viewer's state. */}
      <div
        className={
          // top-28 on mobile clears the new 2-row header (back/office +
          // floor nav), top-16 on desktop matches the original 1-row chrome.
          'absolute top-28 md:top-16 left-3 md:left-7 z-20 px-4 md:px-5 py-3 md:py-4 rounded-2xl bg-black/80 backdrop-blur-md border max-w-[92vw] md:w-[320px] ' +
          cardBorder
        }
        style={{ boxShadow: '0 12px 40px rgba(0,0,0,0.5)' }}
      >
        <span
          className={
            'inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-[10.5px] font-extrabold uppercase tracking-[0.08em] mb-3 ' +
            pill.cls
          }
        >
          {pill.label}
        </span>
        <div className="text-[15px] md:text-[17px] font-bold text-tower-cream leading-snug">
          👥 <span className="font-extrabold">{preview.maxTeammates} teammates</span>
          <span className="opacity-40 mx-1.5">·</span>
          {preview.floorLabel}
        </div>
        <div className={'mt-3 pt-3 border-t border-white/10 text-[13px] font-bold ' + status.cls}>
          {status.text}
        </div>
      </div>

      {/* Desktop: 3D React Three Fiber preview. */}
      <div className="hidden md:block">
        <SceneCanvas
          onboardingStep="done"
          companyName={preview.companyName}
          recruitedCharacters={preview.teammates}
          currentFloor={preview.floor}
          unlockedItemKeys={preview.unlockedItemKeys}
          onFloorClick={() => {}}
          readonly
          // Tower-view ghost: items + teammates beyond the viewer's
          // real floor render translucent so the preview reads as
          // "future perks", not what they already have.
          solidTeammateCount={solidTeammateCount}
          ghostItemKeys={ghostItemKeys}
        />
      </div>

      {/* Mobile: lightweight 2D front-elevation preview. Read-only —
          floor previews are static snapshots, so the minifigures can't
          be dragged/moved (matches the desktop 3D scene's `readonly`). */}
      <Mobile2DScene
        companyName={preview.companyName}
        recruitedCharacters={preview.teammates}
        currentFloor={preview.floor}
        readonly
        solidTeammateCount={solidTeammateCount}
        ghostItemKeys={ghostItemKeys}
      />

      {/* Share / Save CTA — bottom-right on desktop. Pre-login users get
          a "Save my team to climb" funnel into signup; everyone else
          opens the share modal. */}
      {state === 'prelogin' ? (
        <button
          onClick={() => setSignupOpen(true)}
          className="hidden md:inline-flex fixed bottom-7 right-7 z-30 items-center gap-2 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-amber-300 to-tower-gold text-night-deep text-[14.5px] font-extrabold shadow-[0_14px_36px_rgba(168,117,255,0.4)] hover:from-amber-200 hover:to-tower-gold transition"
        >
          <span aria-hidden>🔒</span> Save my team to level up →
        </button>
      ) : (
        <button
          onClick={() => setShareOpen(true)}
          className="hidden md:inline-flex fixed bottom-7 right-7 z-30 items-center gap-2 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-[#b489ff] to-tower-gold text-night-deep text-[14.5px] font-extrabold shadow-[0_14px_36px_rgba(168,117,255,0.4)] hover:opacity-95 transition"
        >
          <span aria-hidden>📣</span> Share to level up →
        </button>
      )}

      <ShareModal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        inviteUrl={inviteUrl}
        currentFloor={viewerCurrentFloor}
        totalInvites={viewerTotalInvites}
      />

      {signupOpen && <SignupModal onClose={() => setSignupOpen(false)} />}
    </main>
  )
}
