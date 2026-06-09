'use client'

import { Canvas } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import { OfficeScene, type OnboardingStep, type RecruitedCharacter } from './OfficeScene'

// ── Texture pre-warm ────────────────────────────────────────────────
// Drei's `useTexture` exposes a static `.preload()` that kicks off the
// load AND populates drei's internal Three.js TextureLoader cache. By
// calling it at module-top, the moment Next.js parses the SceneCanvas
// chunk on the client, all six window images + the tower image start
// downloading IN PARALLEL with chunk evaluation. By the time React
// commits the Canvas, the textures are typically already in cache and
// `useTexture()` inside FloorSceneryTexture / FloorPanoramaTexture
// resolves synchronously — no per-floor texture pop-in.
//
// The browser will dedupe these against the `<link rel="preload">`
// hints in src/app/layout.tsx, so a cold cache fetch happens AT MOST
// once across both paths.
if (typeof window !== 'undefined') {
  useTexture.preload([
    '/window_images/1.avif',
    '/window_images/2.avif',
    '/window_images/3.avif',
    '/window_images/4.avif',
    '/window_images/5.avif',
    '/window_images/6.avif',
  ])
}

interface Props {
  onboardingStep: OnboardingStep
  companyName: string | null
  recruitedCharacters: RecruitedCharacter[]
  /** Kept for callers (TowerLanding still passes false) — TowerView overlay
   *  now handles whole-building view as a DOM layer; office canvas only
   *  ever renders the interior. */
  showTower?: boolean
  currentFloor: number
  unlockedItemKeys: string[]
  onFloorClick: (n: number) => void
  onNpcClick?: (slug: 'iris' | 'mia' | 'leo') => void
  onTeammateClick?: (index: number) => void
  onNpcPosition?: (slug: 'iris' | 'mia' | 'leo', pos: [number, number, number]) => void
  resetSignal?: { slug: string | 'all' | null; counter: number } | null
  /** Read-only mode for floor previews. Drag + select are disabled. */
  readonly?: boolean
  /** Drag-drop poke callback — see OfficeScene Props. */
  onTeammatePoke?: (slug: string) => void
  /** Optional override for Mia's NameBadge role label — see OfficeScene. */
  miaRole?: string | null
  /** Per-user item position overrides (Arrange-your-room feature).
   *  Pass-through to OfficeScene → FloorItems. */
  itemPositionOverrides?: Record<string, [number, number, number]>
  /** Open teammate slots on the current floor. When > 0 (and onboarding
   *  is done) Iris floats a "👋 ready to hire…" nudge — desktop mirror
   *  of the mobile Iris hint. */
  slotsAvailable?: number
  /** Per-recruit greeting nonces (index in customRecruits → counter).
   *  Bumping an index makes that recruited minifigure pop a
   *  "Hi, I'm <name>!" speech bubble once — used on a bulk add. */
  recruitGreetSignals?: Record<number, number>
  /** Spin wheel (GRO-5) — clicking the in-room arcade fires this. */
  onArcadeClick?: () => void
  /** Live spin-token count for the arcade badge + glow. */
  spinTokens?: number
  /** Anonymous teaser — gold "FREE SPIN" badge on the arcade. */
  spinTeaser?: boolean
  /** Tower-view ghosting — see OfficeScene props. */
  solidTeammateCount?: number
  ghostItemKeys?: ReadonlySet<string>
  /** Slugs to freeze (skip in the auto-wander pick). TowerLanding
   *  passes the set of slugs whose bubble / info / edit modal is
   *  currently open so those characters stop drifting mid-interaction. */
  lockedSlugs?: ReadonlySet<string>
}

export function SceneCanvas(props: Props) {
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100vh',
        background: '#0a0a18',
      }}
    >
      <Canvas shadows gl={{ antialias: true, powerPreference: 'high-performance' }}>
        <OfficeScene {...props} resetSignal={props.resetSignal} />
      </Canvas>
    </div>
  )
}
