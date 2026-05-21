'use client'

import { useMemo, type ReactNode } from 'react'
import * as THREE from 'three'
import { useFloorItems } from '@/lib/floorsConfigClient'

const LOCKED_OPACITY = 0.18

/**
 * Wraps a group with materials that honour the unlocked / ghosted state.
 * Locked items render at LOCKED_OPACITY so the user can preview what's
 * waiting on the next floors.
 */
function ItemWrapper({
  position,
  unlocked,
  children,
}: {
  position: [number, number, number]
  unlocked: boolean
  children: ReactNode
}) {
  // We can't override every child material via a parent group — instead,
  // children read the unlocked flag through context-less prop drilling.
  // The pattern: each item renders meshes with `meshStandardMaterial
  // transparent={!unlocked} opacity={unlocked ? 1 : LOCKED_OPACITY}`.
  // To keep it DRY we just hide via a single group's visible+scale and
  // overlay a translucent silhouette material approach where needed.
  return (
    <group position={position} visible>
      <group>{children}</group>
      {!unlocked && (
        <mesh position={[0, 0.5, 0]} visible={false}>
          <boxGeometry args={[0.01, 0.01, 0.01]} />
        </mesh>
      )}
    </group>
  )
}

interface MaterialProps {
  color: string
  unlocked: boolean
  emissive?: string
  emissiveIntensity?: number
}

function M({ color, unlocked, emissive, emissiveIntensity }: MaterialProps) {
  return (
    <meshStandardMaterial
      color={color}
      transparent={!unlocked}
      opacity={unlocked ? 1 : LOCKED_OPACITY}
      emissive={emissive ?? '#000000'}
      emissiveIntensity={unlocked ? emissiveIntensity ?? 0 : 0}
      roughness={0.7}
      side={THREE.FrontSide}
    />
  )
}

/* ── Item meshes ──────────────────────────────────────────────── */

function FloorLamp({ unlocked }: { unlocked: boolean }) {
  return (
    <group>
      <mesh position={[0, 0.1, 0]}>
        <cylinderGeometry args={[0.18, 0.22, 0.06, 12]} />
        <M color="#2a1a0a" unlocked={unlocked} />
      </mesh>
      <mesh position={[0, 0.9, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 1.6, 8]} />
        <M color="#3a2a1a" unlocked={unlocked} />
      </mesh>
      <mesh position={[0, 1.75, 0]}>
        <coneGeometry args={[0.28, 0.32, 16, 1, true]} />
        <M color="#f0d488" unlocked={unlocked} emissive="#fff1c4" emissiveIntensity={0.45} />
      </mesh>
    </group>
  )
}

function BasicChairDesk({ unlocked }: { unlocked: boolean }) {
  return (
    <group>
      {/* Desk top */}
      <mesh position={[0, 0.4, 0]}>
        <boxGeometry args={[1.4, 0.06, 0.7]} />
        <M color="#7a5230" unlocked={unlocked} />
      </mesh>
      {/* Desk legs */}
      {([-0.6, 0.6] as number[]).flatMap(dx =>
        ([-0.25, 0.25] as number[]).map(dz => (
          <mesh key={`${dx}${dz}`} position={[dx, 0.18, dz]}>
            <boxGeometry args={[0.08, 0.4, 0.08]} />
            <M color="#4a3020" unlocked={unlocked} />
          </mesh>
        ))
      )}
      {/* Chair seat */}
      <mesh position={[0, 0.3, 0.7]}>
        <boxGeometry args={[0.45, 0.06, 0.45]} />
        <M color="#3a2a1a" unlocked={unlocked} />
      </mesh>
      <mesh position={[0, 0.55, 0.9]}>
        <boxGeometry args={[0.45, 0.5, 0.06]} />
        <M color="#3a2a1a" unlocked={unlocked} />
      </mesh>
    </group>
  )
}

function PottedPlant({ unlocked }: { unlocked: boolean }) {
  return (
    <group>
      <mesh position={[0, 0.14, 0]}>
        <cylinderGeometry args={[0.16, 0.12, 0.28, 8]} />
        <M color="#8B4513" unlocked={unlocked} />
      </mesh>
      <mesh position={[0, 0.42, 0]}>
        <sphereGeometry args={[0.26, 8, 6]} />
        <M color="#3a7a22" unlocked={unlocked} />
      </mesh>
      <mesh position={[0.12, 0.55, 0.08]}>
        <sphereGeometry args={[0.18, 8, 6]} />
        <M color="#52a032" unlocked={unlocked} />
      </mesh>
    </group>
  )
}

function CoffeeMug({ unlocked }: { unlocked: boolean }) {
  return (
    <group>
      <mesh position={[0, 0.09, 0]}>
        <cylinderGeometry args={[0.08, 0.07, 0.18, 12]} />
        <M color="#f5f0e8" unlocked={unlocked} />
      </mesh>
      <mesh position={[0.1, 0.09, 0]}>
        <torusGeometry args={[0.05, 0.015, 8, 12, Math.PI]} />
        <M color="#f5f0e8" unlocked={unlocked} />
      </mesh>
      <mesh position={[0, 0.17, 0]}>
        <cylinderGeometry args={[0.07, 0.07, 0.01, 12]} />
        <M color="#3a2a1a" unlocked={unlocked} />
      </mesh>
    </group>
  )
}

function Bookshelf({ unlocked }: { unlocked: boolean }) {
  const bookColors = ['#c0392b', '#2980b9', '#27ae60', '#e67e22', '#8e44ad', '#2c3e50', '#d35400', '#16a085']
  return (
    <group>
      <mesh>
        <boxGeometry args={[1.8, 2.6, 0.15]} />
        <M color="#5a3a1a" unlocked={unlocked} />
      </mesh>
      {[0.7, 0, -0.7].map((y, si) => (
        <mesh key={si} position={[0, y, 0.08]}>
          <boxGeometry args={[1.8, 0.06, 0.3]} />
          <M color="#7a5a2a" unlocked={unlocked} />
        </mesh>
      ))}
      {[0.7, 0, -0.7].map((shelfY, si) =>
        bookColors.slice(si * 2, si * 2 + 4).map((color, bi) => (
          <mesh key={`b${si}-${bi}`} position={[-0.6 + bi * 0.22, shelfY + 0.18, 0.13]}>
            <boxGeometry args={[0.17, 0.3, 0.18]} />
            <M color={color} unlocked={unlocked} />
          </mesh>
        ))
      )}
    </group>
  )
}

function Printer({ unlocked }: { unlocked: boolean }) {
  return (
    <group>
      <mesh position={[0, 0.18, 0]}>
        <boxGeometry args={[0.6, 0.36, 0.5]} />
        <M color="#3a3a3a" unlocked={unlocked} />
      </mesh>
      <mesh position={[0, 0.38, 0.05]}>
        <boxGeometry args={[0.55, 0.04, 0.3]} />
        <M color="#f5f5f5" unlocked={unlocked} />
      </mesh>
      <mesh position={[0.2, 0.42, 0.1]}>
        <boxGeometry args={[0.08, 0.02, 0.05]} />
        <M color="#22c55e" unlocked={unlocked} emissive="#22c55e" emissiveIntensity={0.6} />
      </mesh>
    </group>
  )
}

function Whiteboard({ unlocked }: { unlocked: boolean }) {
  return (
    <group>
      {/* Mount to back wall — slightly raised position */}
      <mesh>
        <boxGeometry args={[2.2, 1.4, 0.06]} />
        <M color="#3a2a1a" unlocked={unlocked} />
      </mesh>
      <mesh position={[0, 0, 0.04]}>
        <planeGeometry args={[2.05, 1.25]} />
        <M color="#f8f8f0" unlocked={unlocked} />
      </mesh>
      {/* Marker tray */}
      <mesh position={[0, -0.72, 0.06]}>
        <boxGeometry args={[2.05, 0.05, 0.1]} />
        <M color="#3a2a1a" unlocked={unlocked} />
      </mesh>
    </group>
  )
}

function MiniFridge({ unlocked }: { unlocked: boolean }) {
  return (
    <group>
      <mesh position={[0, 0.55, 0]}>
        <boxGeometry args={[0.7, 1.1, 0.55]} />
        <M color="#e5e5e5" unlocked={unlocked} />
      </mesh>
      <mesh position={[0, 0.6, 0.28]}>
        <boxGeometry args={[0.6, 0.95, 0.02]} />
        <M color="#cccccc" unlocked={unlocked} />
      </mesh>
      <mesh position={[0.22, 0.62, 0.3]}>
        <boxGeometry args={[0.05, 0.18, 0.03]} />
        <M color="#888" unlocked={unlocked} />
      </mesh>
    </group>
  )
}

function Trophy({ unlocked }: { unlocked: boolean }) {
  return (
    <group>
      <mesh position={[0, 0.04, 0]}>
        <boxGeometry args={[0.32, 0.08, 0.32]} />
        <M color="#4a3520" unlocked={unlocked} />
      </mesh>
      <mesh position={[0, 0.18, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 0.2, 8]} />
        <M color="#c89f4a" unlocked={unlocked} emissive="#c89f4a" emissiveIntensity={0.3} />
      </mesh>
      <mesh position={[0, 0.4, 0]}>
        <cylinderGeometry args={[0.18, 0.12, 0.32, 12]} />
        <M color="#fbbf24" unlocked={unlocked} emissive="#fbbf24" emissiveIntensity={0.5} />
      </mesh>
    </group>
  )
}

function Couch({ unlocked }: { unlocked: boolean }) {
  return (
    <group>
      <mesh position={[0, 0.28, 0]}>
        <boxGeometry args={[1.6, 0.32, 0.7]} />
        <M color="#4a90d9" unlocked={unlocked} />
      </mesh>
      <mesh position={[0, 0.55, -0.3]}>
        <boxGeometry args={[1.6, 0.5, 0.18]} />
        <M color="#5fa3ec" unlocked={unlocked} />
      </mesh>
      <mesh position={[-0.7, 0.5, 0]}>
        <boxGeometry args={[0.18, 0.5, 0.7]} />
        <M color="#3a82cf" unlocked={unlocked} />
      </mesh>
      <mesh position={[0.7, 0.5, 0]}>
        <boxGeometry args={[0.18, 0.5, 0.7]} />
        <M color="#3a82cf" unlocked={unlocked} />
      </mesh>
    </group>
  )
}

function UpgradedDesk({ unlocked }: { unlocked: boolean }) {
  return (
    <group>
      <mesh position={[0, 0.5, 0]}>
        <boxGeometry args={[1.8, 0.08, 0.85]} />
        <M color="#2a1a0a" unlocked={unlocked} />
      </mesh>
      {([-0.8, 0.8] as number[]).flatMap(dx =>
        ([-0.3, 0.3] as number[]).map(dz => (
          <mesh key={`${dx}${dz}`} position={[dx, 0.23, dz]}>
            <boxGeometry args={[0.08, 0.5, 0.08]} />
            <M color="#1a0a00" unlocked={unlocked} />
          </mesh>
        ))
      )}
    </group>
  )
}

function NeonSign({ unlocked }: { unlocked: boolean }) {
  return (
    <group>
      <mesh>
        <torusGeometry args={[0.35, 0.04, 8, 24]} />
        <M color="#e879f9" unlocked={unlocked} emissive="#e879f9" emissiveIntensity={0.9} />
      </mesh>
      <mesh position={[0, 0, -0.05]}>
        <planeGeometry args={[0.9, 0.45]} />
        <M color="#1a0030" unlocked={unlocked} />
      </mesh>
    </group>
  )
}

function ArcadeMachine({ unlocked }: { unlocked: boolean }) {
  return (
    <group>
      <mesh position={[0, 0.7, 0]}>
        <boxGeometry args={[0.6, 1.4, 0.5]} />
        <M color="#7c3aed" unlocked={unlocked} />
      </mesh>
      <mesh position={[0, 1.05, 0.26]}>
        <planeGeometry args={[0.5, 0.4]} />
        <M color="#1a0030" unlocked={unlocked} emissive="#a855f7" emissiveIntensity={0.6} />
      </mesh>
      <mesh position={[0, 0.7, 0.26]}>
        <boxGeometry args={[0.5, 0.15, 0.08]} />
        <M color="#3a2a1a" unlocked={unlocked} />
      </mesh>
    </group>
  )
}

function FloorCeilingWindows({ unlocked }: { unlocked: boolean }) {
  // Narrower decor (2.4 wide vs old 3.5) so it fits the right-of-window
  // strip (x ∈ [5, 7.4]) without overlapping the back-wall window cut-out
  // (which lives at x ∈ [2, 5]).
  return (
    <group>
      <mesh>
        <planeGeometry args={[2.4, 4.5]} />
        <M color="#101830" unlocked={unlocked} emissive="#5580c0" emissiveIntensity={0.3} />
      </mesh>
      {/* Frames */}
      <mesh position={[0, 0, 0.02]}>
        <boxGeometry args={[2.4, 0.08, 0.06]} />
        <M color="#1a1a2e" unlocked={unlocked} />
      </mesh>
      <mesh position={[-1.15, 0, 0.02]}>
        <boxGeometry args={[0.08, 4.5, 0.06]} />
        <M color="#1a1a2e" unlocked={unlocked} />
      </mesh>
      <mesh position={[1.15, 0, 0.02]}>
        <boxGeometry args={[0.08, 4.5, 0.06]} />
        <M color="#1a1a2e" unlocked={unlocked} />
      </mesh>
    </group>
  )
}

function LivingWall({ unlocked }: { unlocked: boolean }) {
  return (
    <group>
      <mesh>
        <planeGeometry args={[2.2, 2.4]} />
        <M color="#2d5a1b" unlocked={unlocked} />
      </mesh>
      {Array.from({ length: 18 }, (_, i) => {
        const x = (i % 6 - 2.5) * 0.35
        const y = (Math.floor(i / 6) - 1) * 0.6
        return (
          <mesh key={i} position={[x, y, 0.04]}>
            <sphereGeometry args={[0.18, 8, 6]} />
            <M color={i % 3 === 0 ? '#3a7a22' : i % 3 === 1 ? '#52a032' : '#83c45c'} unlocked={unlocked} />
          </mesh>
        )
      })}
    </group>
  )
}

function EspressoMachine({ unlocked }: { unlocked: boolean }) {
  return (
    <group>
      <mesh position={[0, 0.25, 0]}>
        <boxGeometry args={[0.5, 0.5, 0.4]} />
        <M color="#1a1a1a" unlocked={unlocked} />
      </mesh>
      <mesh position={[0, 0.55, 0.05]}>
        <cylinderGeometry args={[0.06, 0.06, 0.16, 8]} />
        <M color="#c89f4a" unlocked={unlocked} emissive="#c89f4a" emissiveIntensity={0.3} />
      </mesh>
      <mesh position={[0, 0.15, 0.2]}>
        <cylinderGeometry args={[0.05, 0.04, 0.1, 8]} />
        <M color="#f5f0e8" unlocked={unlocked} />
      </mesh>
    </group>
  )
}

function PingPongTable({ unlocked }: { unlocked: boolean }) {
  return (
    <group>
      <mesh position={[0, 0.42, 0]}>
        <boxGeometry args={[2.4, 0.04, 1.2]} />
        <M color="#2980b9" unlocked={unlocked} />
      </mesh>
      <mesh position={[0, 0.5, 0]}>
        <boxGeometry args={[2.4, 0.15, 0.02]} />
        <M color="#ffffff" unlocked={unlocked} />
      </mesh>
      <mesh position={[0, 0.42, 0]}>
        <boxGeometry args={[2.4, 0.005, 0.04]} />
        <M color="#ffffff" unlocked={unlocked} />
      </mesh>
      {([-1.05, 1.05] as number[]).flatMap(dx =>
        ([-0.5, 0.5] as number[]).map(dz => (
          <mesh key={`${dx}${dz}`} position={[dx, 0.2, dz]}>
            <boxGeometry args={[0.07, 0.4, 0.07]} />
            <M color="#1a1a1a" unlocked={unlocked} />
          </mesh>
        ))
      )}
    </group>
  )
}

function RooftopTerrace({ unlocked }: { unlocked: boolean }) {
  return (
    <group>
      <mesh position={[0, 0.02, 0]}>
        <boxGeometry args={[2.5, 0.04, 1.5]} />
        <M color="#7a5230" unlocked={unlocked} />
      </mesh>
      {/* String lights — small emissive bulbs */}
      {Array.from({ length: 6 }, (_, i) => (
        <mesh key={i} position={[(i - 2.5) * 0.45, 0.9, 0]}>
          <sphereGeometry args={[0.06, 8, 6]} />
          <M color="#fde68a" unlocked={unlocked} emissive="#fde68a" emissiveIntensity={0.9} />
        </mesh>
      ))}
      {/* Railing */}
      <mesh position={[0, 0.4, 0.75]}>
        <boxGeometry args={[2.5, 0.04, 0.04]} />
        <M color="#1a1a1a" unlocked={unlocked} />
      </mesh>
    </group>
  )
}

function PenthouseCrown({ unlocked }: { unlocked: boolean }) {
  return (
    <group>
      <mesh position={[0, 0.4, 0]}>
        <coneGeometry args={[0.35, 0.5, 5]} />
        <M color="#fbbf24" unlocked={unlocked} emissive="#fbbf24" emissiveIntensity={0.7} />
      </mesh>
    </group>
  )
}

/* ── Layout ───────────────────────────────────────────────────── */

interface ItemSpec {
  key: string
  /** Base position for the first instance. Multi-instance items (quantity > 1)
   *  are offset along `offsetStep` per additional copy. */
  position: [number, number, number]
  /** Offset added per extra instance when DB quantity > 1. Defaults to
   *  [1.8, 0, 0] (one desk-width along x). */
  offsetStep?: [number, number, number]
  render: (unlocked: boolean) => ReactNode
}

// Wall layout (z ≈ -5.3 plane). The back-wall window cut-out lives at
// x ∈ [2, 5], y ∈ [1.3, 3.5] — every wall-mounted item below sits
// outside that band so nothing overlaps the cityscape window. The
// company picture frame was doubled to 3.2×3.2 (see Walls.tsx
// CompanyFrame), so its reserved band stretches further than before.
//
//   x: [-7.5, -3.9]  → bookshelf + trophy
//   x: [-3.9, -0.7]  → company_picture_frame (drawn from Walls.tsx)
//                      reserved band y ∈ [0.6, 3.8]
//   x: [-0.5, 1.7]   → living_wall (lower) stacked under whiteboard (upper);
//                      both centred at x = 0.6
//   x: [2,   5]      → WINDOW (do not place items here)
//   x: [4.35, 5.25]  → neon_sign (above window, y > 3.7)
//   x: [5,   7.4]    → floor_ceiling_windows decor
const ITEMS: ItemSpec[] = [
  // 1. company_picture_frame — drawn by Walls.CompanyFrame (always shown)
  { key: 'floor_lamp', position: [-6.2, -0.55, -2.0], render: u => <FloorLamp unlocked={u} /> },
  // basic_chair_desk: multi-instance via DB quantity. Each extra copy
  // steps +1.8 along x so 3 desks at quantity:3 sit side-by-side.
  {
    key: 'basic_chair_desk',
    position: [-3.2, -0.55, 1.5],
    offsetStep: [1.8, 0, 0],
    render: u => <BasicChairDesk unlocked={u} />,
  },
  { key: 'potted_plant', position: [-6.4, -0.55, -3.5], render: u => <PottedPlant unlocked={u} /> },
  { key: 'coffee_mug', position: [-3.2, -0.13, 1.4], render: u => <CoffeeMug unlocked={u} /> },
  { key: 'bookshelf', position: [-5.8, 0.75, -5.3], render: u => <Bookshelf unlocked={u} /> },
  { key: 'printer', position: [-1.3, -0.55, -3.5], render: u => <Printer unlocked={u} /> },
  // Whiteboard sits in the strip between the (now doubled) picture
  // frame and the cityscape window. UPPER half — placed ABOVE the
  // living wall per product spec. Centred at x = 0.6 (clears the
  // frame's right edge at x = -0.7 with a 0.2 unit gap, and clears
  // the window's left edge at x = 2 with a 0.3 unit gap).
  { key: 'whiteboard', position: [0.6, 2.6, -5.34], render: u => <Whiteboard unlocked={u} /> },
  { key: 'mini_fridge', position: [6.2, -0.55, -3.8], render: u => <MiniFridge unlocked={u} /> },
  { key: 'trophy', position: [-5.8, 2.45, -5.18], render: u => <Trophy unlocked={u} /> },
  { key: 'couch', position: [3.5, -0.55, 2.5], render: u => <Couch unlocked={u} /> },
  { key: 'upgraded_desk', position: [0.5, -0.55, -2.5], render: u => <UpgradedDesk unlocked={u} /> },
  // Neon nudged up to y=4.0 so it sits above the window (top at y≈3.5).
  { key: 'neon_sign', position: [4.8, 4.0, -5.36], render: u => <NeonSign unlocked={u} /> },
  { key: 'arcade_machine', position: [6.4, -0.55, -1.5], render: u => <ArcadeMachine unlocked={u} /> },
  // Floor-ceiling-windows decor narrowed (3.5→2.4 wide) and shifted
  // right (5.5→6.2) so its left edge clears the real window at x=5.
  { key: 'floor_ceiling_windows', position: [6.2, 1.9, -5.4], render: u => <FloorCeilingWindows unlocked={u} /> },
  // Living wall — LOWER half of the same strip between the frame and
  // the window. Now sits BELOW the whiteboard (swap from the previous
  // layout) so the order top→bottom is whiteboard then living wall.
  // Same x = 0.6 centre as the whiteboard above.
  { key: 'living_wall', position: [0.6, 0.5, -5.34], render: u => <LivingWall unlocked={u} /> },
  { key: 'espresso_machine', position: [6.0, -0.55, -4.5], render: u => <EspressoMachine unlocked={u} /> },
  { key: 'ping_pong_table', position: [2.0, -0.55, 3.0], render: u => <PingPongTable unlocked={u} /> },
  { key: 'rooftop_terrace', position: [-2.5, -0.55, 4.0], render: u => <RooftopTerrace unlocked={u} /> },
  { key: 'penthouse', position: [0, 4.2, -3.0], render: u => <PenthouseCrown unlocked={u} /> },
]

interface Props {
  currentFloor: number
}

export function FloorItems({ currentFloor }: Props) {
  // PER-FLOOR semantic: each floor's row in floor_items lists exactly
  // the items that floor owns, with quantities. We trust that list
  // verbatim — no cumulative union, no preview ghosting of next-floor
  // items. (Old cumulative behaviour was the reported bug: at F1 every
  // item was visible because F1's row, plus all higher floors' rows,
  // covered everything.)
  const floorItems = useFloorItems(currentFloor)

  // itemKey → quantity for fast lookup in the layout loop below.
  const quantityByKey = useMemo(() => {
    const m = new Map<string, number>()
    for (const it of floorItems) m.set(it.key, it.quantity)
    return m
  }, [floorItems])

  return (
    <group>
      {ITEMS.map(it => {
        const quantity = quantityByKey.get(it.key)
        // Not configured for this floor → don't render anything.
        if (!quantity || quantity < 1) return null
        const offset = it.offsetStep ?? [1.8, 0, 0]
        // Render `quantity` copies, each offset by `offset` from the
        // previous. Quantity 1 renders exactly one copy at the base
        // position — single-instance items behave as before.
        const copies: ReactNode[] = []
        for (let i = 0; i < quantity; i++) {
          const pos: [number, number, number] = [
            it.position[0] + offset[0] * i,
            it.position[1] + offset[1] * i,
            it.position[2] + offset[2] * i,
          ]
          copies.push(
            <group key={`${it.key}-${i}`} position={pos}>
              {it.render(true /* always 'unlocked' — it's on this floor */)}
            </group>,
          )
        }
        return <group key={it.key}>{copies}</group>
      })}
    </group>
  )
}

// Suppress unused-var for ItemWrapper (kept for future opacity-via-wrapper refactor).
void ItemWrapper
