'use client'

import { Suspense, useState, useEffect, useCallback, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { Html } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { CinematicCamera } from './camera/CinematicCamera'
import { TowerScene, TOWER_CAM_POSITION, TOWER_CAM_LOOKAT, TOWER_CAM_ZOOM } from './tower/TowerScene'
import { Floor } from './environment/Floor'
import { Walls } from './environment/Walls'
import { Lighting } from './environment/Lighting'
import { Desk } from './furniture/Desk'
import { Character } from './characters/Character'
import { CHARACTERS, EMPTY_DESK_POSITION } from './characters/characters.config'
import type { CharacterConfig } from '@/types/scene'

export interface RecruitedCharacter {
  name: string
  role: string
}

export type OnboardingStep = 'iris' | 'mia' | 'leo' | 'done'

interface Props {
  onboardingStep: OnboardingStep
  companyName: string | null
  recruitedCharacters: RecruitedCharacter[]
  showTower: boolean
  currentFloor: number
  unlockedItemKeys: string[]
  onFloorClick: (n: number) => void
  /** Called when an NPC character is clicked (only after onboarding is done). */
  onNpcClick?: (slug: 'iris' | 'mia' | 'leo') => void
  /** Called when a recruited teammate is clicked, passing the array index. */
  onTeammateClick?: (index: number) => void
  /** Reports each NPC's world-space position so the overlay can anchor bubbles. */
  onNpcPosition?: (slug: 'iris' | 'mia' | 'leo', pos: [number, number, number]) => void
}

const FLOOR_PLANE = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)

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
  showTower,
  currentFloor,
  unlockedItemKeys,
  onFloorClick,
  onNpcClick,
  onTeammateClick,
  onNpcPosition,
}: Props) {
  const unlockedSet = new Set(unlockedItemKeys)
  const showBookshelf = unlockedSet.has('bookshelf')
  const showPlant = unlockedSet.has('potted_plant')
  const showDesks = unlockedSet.has('basic_chair_desk')
  const [cameraTarget, setCameraTarget] = useState<THREE.Vector3 | null>(null)
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

  // Camera: point at the active onboarding NPC.
  useEffect(() => {
    const slug = onboardingStep === 'iris' || onboardingStep === 'mia' || onboardingStep === 'leo'
      ? onboardingStep
      : recruitedCharacters.length > 0 ? null : 'iris'
    if (!slug) {
      if (recruitedCharacters.length > 0) {
        const i = Math.min(recruitedCharacters.length - 1, RECRUIT_POSITIONS.length - 1)
        const p = RECRUIT_POSITIONS[i]
        setCameraTarget(new THREE.Vector3(p[0] + 1.5, p[1] + 3.5, p[2] + 3.5))
      } else {
        const iris = CHARACTERS.find(c => c.slug === 'iris')!.position
        setCameraTarget(new THREE.Vector3(iris[0] + 1.5, iris[1] + 3.5, iris[2] + 3.5))
      }
      return
    }
    const pos = positions[slug] ?? CHARACTERS.find(c => c.slug === slug)!.position
    setCameraTarget(new THREE.Vector3(pos[0] + 1.5, pos[1] + 3.5, pos[2] + 3.5))
  }, [onboardingStep, recruitedCharacters.length, positions])

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
        }
      }
    }
    dragStartPositionRef.current = null
    dragSlugRef.current = null
    setDragging(null)
  }, [])

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
        ...RECRUIT_APPEARANCES[i % RECRUIT_APPEARANCES.length],
      })),
    [recruitedCharacters]
  )

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

  const isOnboarding = onboardingStep !== 'done'

  return (
    <>
      <CinematicCamera
        target={showTower ? TOWER_CAM_POSITION : cameraTarget}
        lookAt={showTower ? TOWER_CAM_LOOKAT : undefined}
        targetZoom={showTower ? TOWER_CAM_ZOOM : undefined}
        panY={0}
      />
      <Lighting
        characters={CHARACTERS}
        positions={positions}
        onboardingStep={isOnboarding ? onboardingStep : undefined}
        showTower={showTower}
      />
      <DragSystem dragging={dragging} onMove={handleDragMove} onDrop={handleDrop} />

      <Suspense
        fallback={
          <Html center>
            <span style={{ color: 'white' }}>Building scene…</span>
          </Html>
        }
      >
        {!showTower && (
          <group>
            <Floor />
            <Walls
              companyName={companyName ?? undefined}
              showBookshelf={showBookshelf}
              showPlant={showPlant}
            />

            {!isOnboarding && showDesks && <Desk position={EMPTY_DESK_POSITION} chairColor="#1a1a2e" />}

            {visibleDeskChars.map(char => (
              <group key={char.slug}>
                {showDesks && (
                  <Desk position={char.deskPosition} character={char.slug} chairColor="#1a1a2e" />
                )}
                <Character
                  config={char}
                  onSelect={handleSelect}
                  isSelected={false}
                  positionOverride={positions[char.slug]}
                  onDragStart={handleDragStart}
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
              onDragStart={handleDragStart}
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
                onDragStart={handleDragStart}
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
                  onDragStart={handleDragStart}
                  draggingSlugRef={dragSlugRef}
                  onPoke={handlePokeChar}
                  pokeSignal={pokeSignals[slug] ?? 0}
                />
              )
            })}
          </group>
        )}

        {showTower && <TowerScene currentFloor={currentFloor} onFloorClick={onFloorClick} />}
      </Suspense>

      {/* Suppress unused-var warning for mia (referenced only via CHARACTERS list). */}
      {false && <Character config={mia} onSelect={handleSelect} isSelected={false} positionOverride={positions['mia']} draggingSlugRef={dragSlugRef} />}
    </>
  )
}
