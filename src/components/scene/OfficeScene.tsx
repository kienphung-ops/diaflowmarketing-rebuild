'use client'

import { Suspense, useState, useEffect, useCallback, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { Html } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { StaticCamera } from './camera/StaticCamera'
// Tower view is no longer 3D — see <TowerView /> DOM overlay rendered at
// the TowerLanding level. The 3D TowerScene + CinematicCamera modules are
// kept on disk for reference but no longer imported here.
import { Floor } from './environment/Floor'
import { Walls } from './environment/Walls'
import { FloorItems } from './environment/FloorItems'
import { Lighting } from './environment/Lighting'
import { Character } from './characters/Character'
import { CHARACTERS, EMPTY_DESK_POSITION } from './characters/characters.config'
import type { CharacterConfig } from '@/types/scene'
// `Desk` was the per-character desk renderer (3 hard-coded for Iris/
// Mia/Leo + 1 empty). Desk count is now DB-driven via FloorItems'
// `basic_chair_desk × quantity` rendering, so the per-character desk
// system was retired to avoid double-rendering.

export interface RecruitedCharacter {
  name: string
  role: string
}

// Keep in sync with `src/lib/trial.ts → OnboardingStep`. The two
// modules can't share the same type without dragging trial.ts into
// the scene chain, so both copies must include 'mia-info'. `showMia`
// covers mia, mia-info, leo, done; `showLeo` only covers leo + done.
export type OnboardingStep = 'iris' | 'mia' | 'mia-info' | 'leo' | 'done'

interface Props {
  onboardingStep: OnboardingStep
  companyName: string | null
  recruitedCharacters: RecruitedCharacter[]
  /** No-op — kept so SceneCanvas's pass-through types align. Tower view is
   *  now a DOM overlay rendered at the TowerLanding level. */
  showTower?: boolean
  currentFloor: number
  unlockedItemKeys: string[]
  onFloorClick: (n: number) => void
  /** Called when an NPC character is clicked (only after onboarding is done). */
  onNpcClick?: (slug: 'iris' | 'mia' | 'leo') => void
  /** Called when a recruited teammate is clicked, passing the array index. */
  onTeammateClick?: (index: number) => void
  /** Reports each NPC's world-space position so the overlay can anchor bubbles. */
  onNpcPosition?: (slug: 'iris' | 'mia' | 'leo', pos: [number, number, number]) => void
  /** Reset-position trigger from parent. Bump `counter` to fire; `slug`
   *  is either a specific character slug, `'all'`, or `null` (no-op).
   *  Mutating positions inside OfficeScene from the outside is awkward
   *  because the state lives here, so we use a signal-counter pattern
   *  rather than imperative refs. */
  resetSignal?: { slug: string | 'all' | null; counter: number } | null
  /** Read-only mode (used by /tower-view/[floor] floor previews):
   *  disables drag, NPC/teammate clicks, and hover cursor changes so the
   *  scene is purely a marketing snapshot of what the floor looks like. */
  readonly?: boolean
  /** Fired when a teammate is drag-dropped with meaningful movement
   *  (> 0.2 world units). Used by /floor/[code] to record a poke on
   *  the server when a visitor (not the floor owner) drags one of the
   *  owner's teammates around. `slug` is `'iris'|'mia'|'leo'` for
   *  default NPCs or `'recruited-N'` for user-added teammates. */
  onTeammatePoke?: (slug: string) => void
}

const FLOOR_PLANE = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)

/** Back wall z-position (Walls.tsx). When a teammate is dragged past this
 *  plane they're geometrically hidden by the wall — NameBadge.tsx detects
 *  this and pops the name badge up above the wall so the user can still
 *  see where the teammate is and reset their position from the UI. */
export const BACK_WALL_Z = -5.5

function DragSystem({
  dragging,
  onMove,
  onDrop,
}: {
  dragging: string | null
  onMove: (pos: [number, number, number]) => void
  onDrop: () => void
}) {
  const { camera, gl } = useThree()
  const raycaster = useMemo(() => new THREE.Raycaster(), [])
  const target = useMemo(() => new THREE.Vector3(), [])

  useEffect(() => {
    if (!dragging) return
    const canvas = gl.domElement
    const onMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      const y = -((e.clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(new THREE.Vector2(x, y), camera)
      if (raycaster.ray.intersectPlane(FLOOR_PLANE, target)) {
        // No clamp at all — drag is fully free. Lost teammates surface
        // via NameBadge's beacon mode (see Character.tsx): once the
        // character leaves the floor planks or goes behind the wall,
        // their name badge pops to a guaranteed-visible spot above the
        // wall with the lateral X clamped into the camera frustum, so
        // the user can always click it and Reset position from the
        // edit modal.
        onMove([target.x, 0, target.z])
      }
      document.body.style.cursor = 'grabbing'
    }
    const onMouseUp = () => {
      onDrop()
      document.body.style.cursor = 'auto'
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [dragging, camera, gl, raycaster, target, onMove, onDrop])

  return null
}

const RECRUIT_POSITIONS: [number, number, number][] = [
  [-3.5, -0.05, 0.3],
  [-5.2, -0.05, 1.5],
  [-2.0, -0.05, 2.5],
  [-4.5, -0.05, 3.2],
  [-0.8, -0.05, 3.8],
  [-3.0, -0.05, 1.0],
  [-1.5, -0.05, 0.8],
  [-5.5, -0.05, 3.0],
]

const RECRUIT_APPEARANCES = [
  { hairColor: '#4a90d9', clothesColor: '#22c55e', glowColor: '#22c55e' },
  { hairColor: '#e879f9', clothesColor: '#f59e0b', glowColor: '#f59e0b' },
  { hairColor: '#34d399', clothesColor: '#6366f1', glowColor: '#6366f1' },
  { hairColor: '#fb923c', clothesColor: '#ec4899', glowColor: '#ec4899' },
  { hairColor: '#a78bfa', clothesColor: '#14b8a6', glowColor: '#14b8a6' },
  { hairColor: '#f87171', clothesColor: '#8b5cf6', glowColor: '#8b5cf6' },
  { hairColor: '#60a5fa', clothesColor: '#facc15', glowColor: '#facc15' },
  { hairColor: '#a3e635', clothesColor: '#3b82f6', glowColor: '#3b82f6' },
]

export function OfficeScene({
  onboardingStep,
  companyName,
  recruitedCharacters,
  currentFloor,
  unlockedItemKeys,
  onNpcClick,
  onTeammateClick,
  onNpcPosition,
  resetSignal,
  readonly = false,
  onTeammatePoke,
}: Props) {
  // `unlockedItemKeys` is no longer consumed here — FloorItems reads
  // its config straight from /api/floors via useFloorItems. Kept on
  // the Props interface so callers don't need touching.
  void unlockedItemKeys
  const [dragging, setDragging] = useState<string | null>(null)
  const [pokeSignals, setPokeSignals] = useState<Record<string, number>>({})
  const [positions, setPositions] = useState<Record<string, [number, number, number]>>(() => {
    const init: Record<string, [number, number, number]> = {}
    CHARACTERS.forEach(c => { init[c.slug] = c.position })
    return init
  })

  const dragSlugRef = useRef<string | null>(null)
  const dragStartPositionRef = useRef<[number, number, number] | null>(null)
  const positionsRef = useRef(positions)
  useEffect(() => { positionsRef.current = positions }, [positions])

  // Report NPC positions upward for HTML overlay anchoring.
  useEffect(() => {
    if (!onNpcPosition) return
    ;(['iris', 'mia', 'leo'] as const).forEach(slug => {
      const pos = positions[slug]
      if (pos) onNpcPosition(slug, pos)
    })
  }, [positions, onNpcPosition])

  // Camera target removed — office view uses StaticCamera (locked front
  // view). Only tower view still uses CinematicCamera with its own target.

  // Drag handlers.
  const handleDragStart = useCallback((slug: string) => {
    dragSlugRef.current = slug
    dragStartPositionRef.current = positionsRef.current[slug] ?? null
    setDragging(slug)
  }, [])
  const handleDragMove = useCallback((pos: [number, number, number]) => {
    const slug = dragSlugRef.current
    if (!slug) return
    setPositions(prev => ({ ...prev, [slug]: [pos[0], prev[slug]?.[1] ?? 0, pos[2]] }))
  }, [])
  const handleDrop = useCallback(() => {
    const slug = dragSlugRef.current
    if (slug && dragStartPositionRef.current) {
      const [ox, , oz] = dragStartPositionRef.current
      const cur = positionsRef.current[slug]
      if (cur) {
        const dist = Math.sqrt((cur[0] - ox) ** 2 + (cur[2] - oz) ** 2)
        if (dist > 0.2) {
          setPokeSignals(prev => ({ ...prev, [slug]: (prev[slug] ?? 0) + 1 }))
          // Notify the parent (currently /floor/[code] visitor view)
          // that a meaningful drag happened. The visitor uses this to
          // record a server-side poke on the floor owner's teammate.
          onTeammatePoke?.(slug)
        }
      }
    }
    dragStartPositionRef.current = null
    dragSlugRef.current = null
    setDragging(null)
  }, [onTeammatePoke])

  const handleSelect = useCallback(
    (slug: string) => {
      if (onboardingStep !== 'done') return
      if (slug === 'iris' || slug === 'mia' || slug === 'leo') {
        onNpcClick?.(slug)
        return
      }
      if (slug.startsWith('recruited-')) {
        const idx = parseInt(slug.slice('recruited-'.length), 10)
        if (!Number.isNaN(idx)) onTeammateClick?.(idx)
      }
    },
    [onboardingStep, onNpcClick, onTeammateClick]
  )
  const handlePokeChar = useCallback(() => {
    // Poke is purely visual feedback — animations already wired inside Character.
  }, [])

  // Visibility — Iris always; Mia after iris step; Leo after mia step.
  const showMia = onboardingStep !== 'iris'
  const showLeo = onboardingStep === 'leo' || onboardingStep === 'done'

  const iris = CHARACTERS.find(c => c.slug === 'iris')!
  const mia = CHARACTERS.find(c => c.slug === 'mia')!
  const leo = CHARACTERS.find(c => c.slug === 'leo')!

  const visibleDeskChars = useMemo(
    () =>
      CHARACTERS.filter(c => {
        if (c.hasDeskAndChair === false) return false
        if (c.slug === 'mia' && !showMia) return false
        if (c.slug === 'leo' && !showLeo) return false
        return true
      }),
    [showMia, showLeo]
  )

  const recruitedConfigs = useMemo<CharacterConfig[]>(
    () =>
      recruitedCharacters.slice(0, RECRUIT_POSITIONS.length).map((rc, i) => ({
        slug: `recruited-${i}` as CharacterConfig['slug'],
        name: rc.name,
        role: rc.role,
        position: RECRUIT_POSITIONS[i],
        deskPosition: EMPTY_DESK_POSITION,
        skinColor: '#FDBCB4',
        idleAnimation: 'wave' as const,
        hasDeskAndChair: false,
        // Face the camera (+Z) like Iris — default rotation Math.PI would
        // put their back to the viewer since they have no desk to look at.
        rotationY: 0,
        ...RECRUIT_APPEARANCES[i % RECRUIT_APPEARANCES.length],
      })),
    [recruitedCharacters]
  )

  // No anonymous background figures: the office only shows the 3 default
  // NPCs (Iris/Mia/Leo) plus user-recruited teammates. Empty slots stay
  // visually empty so the user can see exactly who they've added.

  useEffect(() => {
    setPositions(prev => {
      const next = { ...prev }
      let changed = false
      recruitedCharacters.forEach((_, i) => {
        const slug = `recruited-${i}`
        if (!next[slug]) {
          next[slug] = RECRUIT_POSITIONS[i % RECRUIT_POSITIONS.length]
          changed = true
        }
      })
      return changed ? next : prev
    })
  }, [recruitedCharacters])

  // Reset-position handler — triggered by parent bumping `resetSignal.counter`.
  // `slug = 'all'` resets everyone; a specific slug resets just that one.
  const lastResetCounter = useRef(0)
  useEffect(() => {
    if (!resetSignal) return
    if (resetSignal.counter === lastResetCounter.current) return
    lastResetCounter.current = resetSignal.counter
    const target = resetSignal.slug
    if (!target) return
    setPositions(prev => {
      const next = { ...prev }
      if (target === 'all') {
        CHARACTERS.forEach(c => { next[c.slug] = c.position })
        recruitedCharacters.forEach((_, i) => {
          next[`recruited-${i}`] = RECRUIT_POSITIONS[i % RECRUIT_POSITIONS.length]
        })
      } else if (target.startsWith('recruited-')) {
        const idx = parseInt(target.slice('recruited-'.length), 10)
        if (!Number.isNaN(idx)) {
          next[target] = RECRUIT_POSITIONS[idx % RECRUIT_POSITIONS.length]
        }
      } else {
        const cfg = CHARACTERS.find(c => c.slug === target)
        if (cfg) next[target] = cfg.position
      }
      return next
    })
  }, [resetSignal, recruitedCharacters])

  const isOnboarding = onboardingStep !== 'done'

  return (
    <>
      {/* Office view: locked front-facing camera. No follow, no animation,
          so the room never appears to swing while a teammate is being
          dragged. (Tower-wide view is a DOM overlay — see TowerView.tsx.) */}
      <StaticCamera />
      <Lighting
        characters={CHARACTERS}
        positions={positions}
        onboardingStep={isOnboarding ? onboardingStep : undefined}
      />
      {!readonly && (
        <DragSystem dragging={dragging} onMove={handleDragMove} onDrop={handleDrop} />
      )}

      <Suspense
        fallback={
          <Html center>
            <span style={{ color: 'white' }}>Building scene…</span>
          </Html>
        }
      >
        <group>
            <Floor />
            <Walls companyName={companyName ?? undefined} currentFloor={currentFloor} />
            <FloorItems currentFloor={currentFloor} />

            {/* Desks come from FloorItems' basic_chair_desk × quantity now —
                no per-character Desk render here. Characters stand
                independently at their `char.position`. */}
            {visibleDeskChars.map(char => (
              <group key={char.slug}>
                <Character
                  config={char}
                  onSelect={handleSelect}
                  isSelected={false}
                  positionOverride={positions[char.slug]}
                  onDragStart={readonly ? undefined : handleDragStart}
                  draggingSlugRef={dragSlugRef}
                  onPoke={handlePokeChar}
                  pokeSignal={pokeSignals[char.slug] ?? 0}
                />
              </group>
            ))}

            <Character
              config={iris}
              onSelect={handleSelect}
              isSelected={false}
              positionOverride={positions['iris']}
              onDragStart={readonly ? undefined : handleDragStart}
              draggingSlugRef={dragSlugRef}
              onPoke={handlePokeChar}
              pokeSignal={pokeSignals['iris'] ?? 0}
            />

            {showLeo && (
              <Character
                config={leo}
                onSelect={handleSelect}
                isSelected={false}
                positionOverride={positions['leo']}
                onDragStart={readonly ? undefined : handleDragStart}
                draggingSlugRef={dragSlugRef}
                onPoke={handlePokeChar}
                pokeSignal={pokeSignals['leo'] ?? 0}
              />
            )}

            {recruitedConfigs.map((cfg, i) => {
              const slug = `recruited-${i}`
              const charPos = positions[slug] ?? cfg.position
              return (
                <Character
                  key={slug}
                  config={cfg}
                  onSelect={handleSelect}
                  isSelected={false}
                  positionOverride={charPos}
                  onDragStart={readonly ? undefined : handleDragStart}
                  draggingSlugRef={dragSlugRef}
                  onPoke={handlePokeChar}
                  pokeSignal={pokeSignals[slug] ?? 0}
                />
              )
            })}

        </group>
      </Suspense>

      {/* Suppress unused-var warning for mia (referenced only via CHARACTERS list). */}
      {false && <Character config={mia} onSelect={handleSelect} isSelected={false} positionOverride={positions['mia']} draggingSlugRef={dragSlugRef} />}
    </>
  )
}
