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
import { SpinArcade3D, SPIN_ARCADE_3D_DEFAULT, SPIN_ARCADE_KEY } from './SpinArcade3D'
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
  /** Per-user item position overrides (Arrange-your-room feature).
   *  Plumbed down to FloorItems where the actual lookup happens. */
  itemPositionOverrides?: Record<string, [number, number, number]>
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
  /** Optional override for Mia's role label in the scene NameBadge.
   *  When provided, replaces the hard-coded `'Assistant'` from
   *  `characters.config.ts` so the personalised Diaflow recommendation
   *  (stored in `User.recommendedRole` / `RecruitedTeammate(slug='mia').role`)
   *  shows up above her head. Iris + Leo keep their static defaults. */
  miaRole?: string | null
  /** Open teammate slots on the current floor. When > 0 and onboarding
   *  is done, Iris floats a persistent "👋 ready to hire…" nudge above
   *  her head — desktop mirror of the mobile Iris hint. */
  slotsAvailable?: number
  /** Per-recruit greeting nonces (recruit index → counter). Bumping an
   *  index pops a one-shot "Hi, I'm <name>!" speech bubble above that
   *  minifigure — fired by the parent on a bulk add. */
  recruitGreetSignals?: Record<number, number>
  /** Spin wheel (GRO-5): clicking the in-room arcade fires this. When
   *  omitted the arcade renders as plain decor (e.g. floor previews). */
  onArcadeClick?: () => void
  /** Live spin-token count — drives the arcade badge + glow. */
  spinTokens?: number
  /** Anonymous teaser — paints the arcade's gold "FREE SPIN" badge. */
  spinTeaser?: boolean
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

// ─── Auto-wander tuning ─────────────────────────────────────────────────
// Every WANDER_INTERVAL_MS one random rendered character is picked and
// nudged to a new in-bounds position. Character.tsx's useFrame already
// lerps the character to that target at ~1.4 u/s, so we get a smooth
// "walk over there" for free without any extra animation plumbing.
//
// Bounds are deliberately tighter than the actual floor extents
// (|x| ≤ 7.15, z ∈ [-7, 7]) so the wanderer never trips the beacon
// mode in NameBadge (off-floor or behind-wall). Adjust freely.
const WANDER_INTERVAL_MS = 5_000
const WANDER_X_MIN = -6
const WANDER_X_MAX = 6
const WANDER_Z_MIN = -2
const WANDER_Z_MAX = 4.5

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
  itemPositionOverrides,
  onNpcClick,
  onTeammateClick,
  onNpcPosition,
  resetSignal,
  readonly = false,
  onTeammatePoke,
  miaRole,
  slotsAvailable,
  recruitGreetSignals,
  onArcadeClick,
  spinTokens = 0,
  spinTeaser = false,
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
  // Mia's role is overrideable — apply the caller-supplied `miaRole`
  // (Diaflow recommendation) on top of the hard-coded config so the
  // NameBadge under her head reads e.g. "Senior Code Review Assistant"
  // instead of the seeded "Assistant". `null` / `undefined` falls back
  // to the config default.
  const baseMia = CHARACTERS.find(c => c.slug === 'mia')!
  const mia = useMemo(
    () => (miaRole && miaRole.trim() ? { ...baseMia, role: miaRole } : baseMia),
    [baseMia, miaRole],
  )
  const leo = CHARACTERS.find(c => c.slug === 'leo')!

  const visibleDeskChars = useMemo(
    () =>
      CHARACTERS.filter(c => {
        if (c.hasDeskAndChair === false) return false
        if (c.slug === 'mia' && !showMia) return false
        if (c.slug === 'leo' && !showLeo) return false
        return true
      }).map(c =>
        // Apply the same Mia override when iterating the desk-list so
        // the NameBadge there reads the personalised role too. Iris is
        // already excluded (hasDeskAndChair=false); Leo unchanged.
        c.slug === 'mia' ? mia : c,
      ),
    [showMia, showLeo, mia]
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

  // Iris "👋 ready to hire…" nudge — shown only once onboarding is done
  // and there's an open teammate slot on the floor (matches the mobile
  // Iris hint). During onboarding Iris is busy with the team-name step,
  // so the hire prompt would be premature.
  const irisHint =
    !isOnboarding && (slotsAvailable ?? 0) > 0 ? '👋 ready to hire…' : undefined

  // Auto-wander: every WANDER_INTERVAL_MS, pick one visible character at
  // random and walk them to a random in-bounds position. Skipped in
  // readonly mode (tower-view previews are static snapshots) and during
  // onboarding (Iris/Mia/Leo are pinned to scripted positions for the
  // narrative). The character being actively dragged by the user is
  // also excluded so the auto-pick doesn't fight the cursor.
  useEffect(() => {
    if (readonly) return
    if (isOnboarding) return

    const id = window.setInterval(() => {
      // Compose the slug pool from currently-rendered characters. Iris
      // is always visible post-onboarding; Mia + Leo follow the same
      // visibility gates the render path uses; recruits are 0..N-1.
      const pool: string[] = ['iris']
      if (showMia) pool.push('mia')
      if (showLeo) pool.push('leo')
      for (let i = 0; i < recruitedCharacters.length; i++) {
        pool.push(`recruited-${i}`)
      }
      // Drop the currently-dragged slug (if any) so the cursor doesn't
      // fight an autonomous nudge mid-drag.
      const dragSlug = dragSlugRef.current
      const eligible = dragSlug ? pool.filter(s => s !== dragSlug) : pool
      if (eligible.length === 0) return

      const slug = eligible[Math.floor(Math.random() * eligible.length)]
      const targetX = WANDER_X_MIN + Math.random() * (WANDER_X_MAX - WANDER_X_MIN)
      const targetZ = WANDER_Z_MIN + Math.random() * (WANDER_Z_MAX - WANDER_Z_MIN)
      setPositions(prev => ({
        ...prev,
        [slug]: [targetX, prev[slug]?.[1] ?? -0.05, targetZ],
      }))
    }, WANDER_INTERVAL_MS)

    return () => window.clearInterval(id)
  }, [readonly, isOnboarding, showMia, showLeo, recruitedCharacters.length])

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
            <FloorItems currentFloor={currentFloor} positionOverrides={itemPositionOverrides} />

            {/* Spin-wheel arcade — interactive in-room object. Its
                position honours the "Arrange your room" override
                (key `spin_arcade_0`), falling back to the canonical
                default. Skipped on read-only floor previews since the
                spin entry is owner-specific. */}
            {!readonly && (
              <SpinArcade3D
                position={
                  itemPositionOverrides?.[SPIN_ARCADE_KEY] ?? SPIN_ARCADE_3D_DEFAULT
                }
                tokens={spinTokens}
                teaser={spinTeaser}
                onClick={onArcadeClick}
              />
            )}

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
              hint={irisHint}
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
                  // Bulk-add greeting — bumping this nonce pops a
                  // "Hi, I'm <name>!" bubble above the new recruit.
                  greetingSignal={recruitGreetSignals?.[i] ?? 0}
                  greetingText={`Hi, I'm ${cfg.name}!`}
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
