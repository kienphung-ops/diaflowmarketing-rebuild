'use client'

import { Canvas } from '@react-three/fiber'
import { OfficeScene, type OnboardingStep, type RecruitedCharacter } from './OfficeScene'

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
