'use client'

/**
 * RoomArranger — fullscreen overlay shown when the user enters
 * "Arrange your room" mode. Renders the office scene (floor + walls +
 * the user's currently-unlocked items) with every item draggable on
 * the floor plane. Drag is clamped to room bounds so figures can't
 * vanish behind a wall.
 *
 * Rules per product spec:
 *   - only positions the user's OWN room items (not someone else's)
 *   - constrained to "inside the room" (X/Z clamps applied below)
 *   - changes live in component state; parent calls Save → PATCH
 *     /api/user/item-positions, or Cancel → revert.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { StaticCamera } from './scene/camera/StaticCamera'
import { Lighting } from './scene/environment/Lighting'
import { Floor } from './scene/environment/Floor'
import { Walls } from './scene/environment/Walls'
import { CHARACTERS } from './scene/characters/characters.config'
import { useFloorItems } from '@/lib/floorsConfigClient'
import {
  ITEMS,
  ArcadeMachine,
  type ItemSpec,
} from './scene/environment/FloorItems'
import { SPIN_ARCADE_3D_DEFAULT } from './scene/SpinArcade3D'

/** Synthetic catalogue entry for the spin arcade. It's NOT a
 *  floor-gated decor item (it's the always-on spin entry), but it IS
 *  user-arrangeable, so we inject it into the arranger's item list so
 *  it can be dragged. Keyed `spin_arcade` → stored as `spin_arcade_0`
 *  (matching SPIN_ARCADE_KEY in SpinArcade3D). */
const ARCADE_SPEC: ItemSpec = {
  key: 'spin_arcade',
  position: SPIN_ARCADE_3D_DEFAULT,
  render: u => <ArcadeMachine unlocked={u} />,
}

const FLOOR_PLANE = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)

// Room bounds — match the floor extent plus a small margin so items
// don't escape behind walls or off the planks. Wall items (z ≈ -5.3)
// rely on Y > 0 to stay attached to the back wall; we keep their Z
// fixed by clamping the lower-Z bound below their canonical Z.
const X_MIN = -7.0
const X_MAX = 7.0
const Z_MIN = -5.4
const Z_MAX = 6.3

type Triple = [number, number, number]
type PositionMap = Record<string, Triple>

function clamp(value: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, value))
}

/* ─── Drag system ───────────────────────────────────────────────── */

function DragSystem({
  draggingSlugRef,
  draggingYRef,
  onMove,
  onDrop,
}: {
  draggingSlugRef: React.MutableRefObject<string | null>
  draggingYRef: React.MutableRefObject<number>
  onMove: (slug: string, pos: Triple) => void
  onDrop: () => void
}) {
  const { camera, gl } = useThree()
  const raycaster = useMemo(() => new THREE.Raycaster(), [])
  const target = useMemo(() => new THREE.Vector3(), [])

  useEffect(() => {
    const canvas = gl.domElement
    const onMouseMove = (e: MouseEvent) => {
      const slug = draggingSlugRef.current
      if (!slug) return
      const rect = canvas.getBoundingClientRect()
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      const y = -((e.clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(new THREE.Vector2(x, y), camera)
      if (raycaster.ray.intersectPlane(FLOOR_PLANE, target)) {
        onMove(slug, [
          clamp(target.x, X_MIN, X_MAX),
          draggingYRef.current,
          clamp(target.z, Z_MIN, Z_MAX),
        ])
      }
      document.body.style.cursor = 'grabbing'
    }
    const onMouseUp = () => {
      if (!draggingSlugRef.current) return
      onDrop()
      document.body.style.cursor = 'auto'
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [camera, gl, raycaster, target, onMove, onDrop, draggingSlugRef, draggingYRef])

  return null
}

/* ─── Individual draggable item ─────────────────────────────────── */

function DraggableItem({
  slug,
  spec,
  position,
  onStartDrag,
  isDragged,
}: {
  slug: string
  spec: ItemSpec
  position: Triple
  onStartDrag: (slug: string, y: number) => void
  isDragged: boolean
}) {
  return (
    <group
      position={position}
      onPointerDown={e => {
        e.stopPropagation()
        onStartDrag(slug, position[1])
      }}
      onPointerOver={e => {
        e.stopPropagation()
        document.body.style.cursor = 'grab'
      }}
      onPointerOut={() => {
        document.body.style.cursor = 'auto'
      }}
    >
      {isDragged && (
        <mesh position={[0, -position[1] + 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.7, 0.9, 32]} />
          <meshBasicMaterial color="#fbbf24" transparent opacity={0.85} depthTest={false} />
        </mesh>
      )}
      {spec.render(true)}
    </group>
  )
}

/* ─── Scene-side renderer ───────────────────────────────────────── */

/** Renders every unlocked instance of every item on the user's floor
 *  as a separate draggable, keyed by `${itemKey}_${index}`. */
function ArrangerScene({
  visibleItems,
  positions,
  draggingSlug,
  draggingSlugRef,
  draggingYRef,
  onStartDrag,
  onMove,
  onDrop,
  companyName,
}: {
  visibleItems: { spec: ItemSpec; quantity: number }[]
  positions: PositionMap
  draggingSlug: string | null
  draggingSlugRef: React.MutableRefObject<string | null>
  draggingYRef: React.MutableRefObject<number>
  onStartDrag: (slug: string, y: number) => void
  onMove: (slug: string, pos: Triple) => void
  onDrop: () => void
  companyName: string | null
}) {
  return (
    <>
      <StaticCamera />
      <Lighting characters={CHARACTERS} positions={{}} />
      <DragSystem
        draggingSlugRef={draggingSlugRef}
        draggingYRef={draggingYRef}
        onMove={onMove}
        onDrop={onDrop}
      />
      <Floor />
      <Walls currentFloor={1} companyName={companyName ?? undefined} />
      {visibleItems.flatMap(({ spec, quantity }) => {
        const offset = spec.offsetStep ?? [1.8, 0, 0]
        return Array.from({ length: quantity }, (_, i) => {
          const slug = `${spec.key}_${i}`
          const fallback: Triple = [
            spec.position[0] + offset[0] * i,
            spec.position[1] + offset[1] * i,
            spec.position[2] + offset[2] * i,
          ]
          const indexed = positions[slug]
          const bare = i === 0 ? positions[spec.key] : undefined
          const pos: Triple = indexed ?? bare ?? fallback
          return (
            <DraggableItem
              key={slug}
              slug={slug}
              spec={spec}
              position={pos}
              onStartDrag={onStartDrag}
              isDragged={draggingSlug === slug}
            />
          )
        })
      })}
    </>
  )
}

/* ─── Public component ──────────────────────────────────────────── */

interface Props {
  open: boolean
  currentFloor: number
  /** User's team name — shown on the back-wall picture frame. */
  companyName: string | null
  /** Live positions map being edited. Parent owns the state. */
  positions: PositionMap
  /** Called whenever a drag moves an item — parent updates state. */
  onChange: (next: PositionMap) => void
  onSave: () => void | Promise<void>
  onCancel: () => void
  saving?: boolean
}

export function RoomArranger({
  open,
  currentFloor,
  companyName,
  positions,
  onChange,
  onSave,
  onCancel,
  saving,
}: Props) {
  const floorItems = useFloorItems(currentFloor)
  const draggingSlugRef = useRef<string | null>(null)
  const draggingYRef = useRef<number>(0)
  const [draggingSlug, setDraggingSlug] = useState<string | null>(null)

  // Lookup specs for whichever items the user has unlocked.
  const visibleItems = useMemo(() => {
    const list: { spec: ItemSpec; quantity: number }[] = []
    for (const it of floorItems) {
      const spec = ITEMS.find(s => s.key === it.key)
      if (!spec) continue
      list.push({ spec, quantity: it.quantity })
    }
    // Spin arcade — always arrangeable (it's the spin entry, present
    // from day one regardless of floor).
    list.push({ spec: ARCADE_SPEC, quantity: 1 })
    return list
  }, [floorItems])

  const handleStartDrag = useCallback((slug: string, y: number) => {
    draggingSlugRef.current = slug
    draggingYRef.current = y
    setDraggingSlug(slug)
  }, [])

  const handleMove = useCallback(
    (slug: string, pos: Triple) => {
      onChange({ ...positions, [slug]: pos })
    },
    [positions, onChange],
  )

  const handleDrop = useCallback(() => {
    draggingSlugRef.current = null
    setDraggingSlug(null)
  }, [])

  // Esc cancels. Enter saves (only when not actively dragging).
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel()
      if (e.key === 'Enter' && !draggingSlugRef.current) onSave()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onCancel, onSave])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-40 bg-[#04040d]">
      {/* Top toolbar — title + Save / Cancel */}
      <div className="absolute top-0 left-0 right-0 z-10 bg-night-mid/95 border-b border-white/10 backdrop-blur-md px-4 md:px-6 py-3 flex items-center justify-between gap-3 text-tower-cream">
        <div className="min-w-0">
          <h1 className="text-base md:text-lg font-bold">Arrange your room</h1>
          <p className="text-[11px] text-tower-cream/60 mt-0.5 hidden md:block">
            Drag any item on the floor. Esc cancels, Enter saves.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onCancel}
            disabled={saving}
            className="px-3 md:px-4 py-1.5 md:py-2 rounded-md border border-white/15 text-tower-cream/80 hover:bg-night-deep hover:text-tower-cream text-sm transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave()}
            disabled={saving}
            className="px-3 md:px-4 py-1.5 md:py-2 rounded-md bg-tower-gold text-night-deep font-semibold text-sm hover:bg-tower-gold/90 transition disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving…' : 'Save layout'}
          </button>
        </div>
      </div>

      <Canvas shadows gl={{ antialias: true, powerPreference: 'high-performance' }}>
        <ArrangerScene
          visibleItems={visibleItems}
          positions={positions}
          draggingSlug={draggingSlug}
          draggingSlugRef={draggingSlugRef}
          draggingYRef={draggingYRef}
          onStartDrag={handleStartDrag}
          onMove={handleMove}
          onDrop={handleDrop}
          companyName={companyName}
        />
      </Canvas>

      {/* Bottom-center help pill — visible on every screen size */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-night-mid/90 backdrop-blur border border-white/10 text-xs text-tower-cream/80 max-w-[90vw] text-center">
        Drag items to rearrange. Bounds are clamped to the room — items can&apos;t escape behind a wall.
      </div>
    </div>
  )
}
