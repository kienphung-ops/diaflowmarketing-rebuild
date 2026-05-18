'use client'

import * as THREE from 'three'
import { Text } from '@react-three/drei'
import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'

// ─── Layout — tweak here ──────────────────────────────────────────────────────
const TOWER_FLOORS   = 20
const FLOOR_H        = 4.0    // world units per floor (taller = more visible interior)
const FLOOR_W_BOT    = 10.0   // floor 1 widest
const FLOOR_W_TOP    = 7.5    // floor 20 narrowest
const FLOOR_D        = 7.0    // depth
const SLAB_H         = 0.28   // structural separator thickness

// Camera exports — tuned so the full 20-floor tower (height ≈ 80 world units)
// fills most of the viewport with comfortable padding.
export const TOWER_CAM_POSITION = new THREE.Vector3(28, 55, 28)
export const TOWER_CAM_LOOKAT   = new THREE.Vector3(0, 40, 0)
export const TOWER_CAM_ZOOM     = 0.18

// ─── Seeded random (no Math.random — deterministic) ───────────────────────────
function sr(seed: number) {
  const x = Math.sin(seed + 1) * 10000
  return x - Math.floor(x)
}

// ─── Palettes ─────────────────────────────────────────────────────────────────
const BODY  = ['#3b82f6','#ef4444','#f59e0b','#10b981','#6366f1','#ec4899','#06b6d4','#84cc16','#f97316','#e879f9','#14b8a6','#fb923c']
const SKIN  = ['#FDBCB4','#F1C27D','#E0AC69','#C68642','#8D5524']
const HAIR  = ['#1a0a00','#3d1f00','#f4a261','#e9c46a','#f0efeb','#5c3317','#e76f51','#264653']
const USER_BODY = ['#7c3aed','#9333ea','#a855f7','#8b5cf6','#6d28d9','#c084fc','#d946ef','#7c3aed','#9333ea','#a855f7']

// ─── Mini Lego-style character ────────────────────────────────────────────────
function MiniChar({ x, z, seed, user }: { x: number; z: number; seed: number; user?: boolean }) {
  const body = user ? USER_BODY[seed % USER_BODY.length] : BODY[seed % BODY.length]
  const skin = SKIN[(seed * 3) % SKIN.length]
  const hair = HAIR[(seed * 7) % HAIR.length]
  return (
    <group position={[x, 0, z]}>
      {/* legs */}
      <mesh position={[-0.07, 0.1, 0]}>
        <boxGeometry args={[0.1, 0.22, 0.11]} />
        <meshStandardMaterial color={body} roughness={0.7} />
      </mesh>
      <mesh position={[0.07, 0.1, 0]}>
        <boxGeometry args={[0.1, 0.22, 0.11]} />
        <meshStandardMaterial color={body} roughness={0.7} />
      </mesh>
      {/* torso */}
      <mesh position={[0, 0.35, 0]}>
        <boxGeometry args={[0.26, 0.28, 0.15]} />
        <meshStandardMaterial color={body} roughness={0.7} />
      </mesh>
      {/* head */}
      <mesh position={[0, 0.6, 0]}>
        <boxGeometry args={[0.22, 0.22, 0.2]} />
        <meshStandardMaterial color={skin} roughness={0.8} />
      </mesh>
      {/* hair */}
      <mesh position={[0, 0.76, 0]}>
        <boxGeometry args={[0.23, 0.12, 0.21]} />
        <meshStandardMaterial color={hair} roughness={0.9} />
      </mesh>
    </group>
  )
}

// ─── Mini desk ────────────────────────────────────────────────────────────────
function MiniDesk({ x, z, rot }: { x: number; z: number; rot: number }) {
  return (
    <group position={[x, 0, z]} rotation={[0, rot, 0]}>
      <mesh position={[0, 0.34, 0]}>
        <boxGeometry args={[0.75, 0.065, 0.48]} />
        <meshStandardMaterial color="#7a5230" roughness={0.85} />
      </mesh>
      {([-0.3, 0.3] as number[]).flatMap(dx =>
        ([-0.19, 0.19] as number[]).map(dz => (
          <mesh key={`${dx}${dz}`} position={[dx, 0.15, dz]}>
            <boxGeometry args={[0.06, 0.35, 0.06]} />
            <meshStandardMaterial color="#4a3020" roughness={0.9} />
          </mesh>
        ))
      )}
    </group>
  )
}

// ─── Mini plant ───────────────────────────────────────────────────────────────
function MiniPlant({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.11, 0]}>
        <cylinderGeometry args={[0.1, 0.08, 0.22, 6]} />
        <meshStandardMaterial color="#7c4a1e" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.4, 0]}>
        <sphereGeometry args={[0.22, 6, 5]} />
        <meshStandardMaterial color="#2d7a2d" roughness={0.9} emissive="#1a4d1a" emissiveIntensity={0.15} />
      </mesh>
    </group>
  )
}

// ─── Pulsing glow ring for user's floor ───────────────────────────────────────
function PulseRing({ y }: { y: number }) {
  const ref = useRef<THREE.Mesh>(null)
  useFrame(({ clock }) => {
    if (!ref.current) return
    const s = 1 + Math.sin(clock.elapsedTime * 2.5) * 0.08
    ref.current.scale.setScalar(s)
    ;(ref.current.material as THREE.MeshStandardMaterial).emissiveIntensity =
      0.6 + Math.sin(clock.elapsedTime * 2.5) * 0.25
  })
  return (
    <mesh ref={ref} position={[0, y, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[1.0, 1.7, 32]} />
      <meshStandardMaterial color="#a855f7" emissive="#a855f7" emissiveIntensity={0.6} transparent opacity={0.55} side={THREE.DoubleSide} />
    </mesh>
  )
}

// ─── One floor ────────────────────────────────────────────────────────────────
function TowerFloor({ floorNum, isUser, isPH, onClick }: {
  floorNum: number
  isUser: boolean
  isPH: boolean
  onClick: () => void
}) {
  const idx   = floorNum - 1
  const t     = idx / (TOWER_FLOORS - 1)
  const w     = FLOOR_W_BOT - t * (FLOOR_W_BOT - FLOOR_W_TOP)
  const cy    = (idx + 0.5) * FLOOR_H          // Y center of this floor
  const floorY = -FLOOR_H * 0.5 + SLAB_H       // local Y of the floor surface

  // material colours
  const slabCol = isPH ? '#2a1c00' : '#181630'
  const woodCol = isPH ? '#a07820' : '#b07828'
  const woodEmi = isPH ? '#604810' : '#5a3a10'
  const backCol = isPH ? '#1e1500' : '#100e20'
  const winCol  = isPH ? '#fbbf24' : isUser ? '#c084fc' : '#5580c0'
  const winEmi  = isPH ? '#d97706' : isUser ? '#9333ea' : '#1a3866'
  const winEmiI = isPH ? 0.9       : isUser ? 1.0       : 0.45

  // Character density per floor — matches planning.md's mental model:
  // funnel narrows as you climb. Lower floors are crowded; penthouse is solo.
  const DENSITY_BY_FLOOR = [
    18, 12, 9, 7, 5,    // floors 1-5
    4, 4, 3, 3, 2,      // floors 6-10
    2, 2, 1, 1, 1,      // floors 11-15
    1, 1, 1, 1, 1,      // floors 16-20
  ]
  const baseCount = DENSITY_BY_FLOOR[Math.min(floorNum - 1, DENSITY_BY_FLOOR.length - 1)] ?? 1
  // User's own floor: bump count slightly so the user feels surrounded by their team.
  const charCount = isUser ? Math.max(baseCount, 6) : baseCount
  const deskCount = isPH ? 1 : Math.min(3, Math.round(baseCount / 4) + 1)
  const plantCount = Math.round(sr(floorNum * 11) * 1.5)

  const chars = Array.from({ length: charCount }, (_, m) => {
    const a = (m / charCount) * Math.PI * 2 + sr(floorNum * 13 + m) * 1.0
    const r = 0.25 + sr(floorNum * 17 + m) * 0.65
    return { x: Math.cos(a) * w * 0.36 * r, z: Math.sin(a) * FLOOR_D * 0.27 * r }
  })

  const desks = Array.from({ length: deskCount }, (_, m) => ({
    x: (sr(floorNum * 5 + m) - 0.5) * w * 0.55,
    z: (sr(floorNum * 9 + m) - 0.5) * FLOOR_D * 0.35,
    rot: sr(floorNum * 23 + m) * Math.PI,
  }))

  const plants = Array.from({ length: plantCount }, (_, m) => ({
    x: (sr(floorNum * 19 + m + 1) - 0.5) * w * 0.68,
    z: (sr(floorNum * 29 + m + 1) - 0.5) * FLOOR_D * 0.44,
  }))

  return (
    <group position={[0, cy, 0]} onPointerUp={e => { e.stopPropagation(); onClick() }}>

      {/* Structural separator slab */}
      <mesh position={[0, -FLOOR_H * 0.5 + SLAB_H * 0.5, 0]}>
        <boxGeometry args={[w + 0.3, SLAB_H, FLOOR_D + 0.3]} />
        <meshStandardMaterial color={slabCol} roughness={0.5} metalness={0.15} />
      </mesh>

      {/* Warm wood floor */}
      <mesh position={[0, floorY + 0.03, 0]}>
        <boxGeometry args={[w - 0.15, 0.06, FLOOR_D - 0.15]} />
        <meshStandardMaterial color={woodCol} roughness={0.9} emissive={woodEmi} emissiveIntensity={0.35} />
      </mesh>

      {/* Back wall (cutaway depth) */}
      <mesh position={[0, FLOOR_H * 0.05, -FLOOR_D * 0.5 + 0.05]}>
        <boxGeometry args={[w, FLOOR_H - SLAB_H - 0.05, 0.1]} />
        <meshStandardMaterial color={backCol} roughness={0.85} emissive={backCol} emissiveIntensity={0.08} />
      </mesh>

      {/* Glowing window strip (front face) */}
      <mesh position={[0, FLOOR_H * 0.05, FLOOR_D * 0.5 - 0.04]}>
        <boxGeometry args={[w * 0.72, FLOOR_H * 0.42, 0.06]} />
        <meshStandardMaterial color={winCol} emissive={winEmi} emissiveIntensity={winEmiI} roughness={0.25} transparent opacity={0.88} />
      </mesh>

      {/* Furniture + characters sit on the floor surface */}
      <group position={[0, floorY + 0.06, 0]}>
        {desks.map((d, mi)  => <MiniDesk  key={mi} x={d.x} z={d.z} rot={d.rot} />)}
        {plants.map((p, mi) => <MiniPlant key={mi} x={p.x} z={p.z} />)}
        {chars.map((c, mi)  => <MiniChar  key={mi} x={c.x} z={c.z} seed={floorNum * 31 + mi} user={isUser} />)}
      </group>

      {/* User floor: pulsing ring + YOU label + purple point light */}
      {isUser && (
        <>
          <PulseRing y={floorY + 0.08} />
          <pointLight position={[0, floorY + 1.5, 0]} color="#a855f7" intensity={12} distance={7} decay={2} />
          <Text
            position={[0, FLOOR_H * 0.38, FLOOR_D * 0.38]}
            fontSize={0.55}
            color="#e879f9"
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.06}
            outlineColor="#2a0050"
          >
            YOU
          </Text>
        </>
      )}

      {/* Penthouse crown */}
      {isPH && (
        <Text
          position={[0, FLOOR_H * 0.5 + 0.6, 0]}
          fontSize={0.9}
          anchorX="center"
          anchorY="bottom"
        >
          👑
        </Text>
      )}

      {/* Floor number, right side */}
      <Text
        position={[w * 0.5 + 0.65, 0, 0]}
        fontSize={0.32}
        color={isUser ? '#c084fc' : isPH ? '#fbbf24' : 'rgba(255,255,255,0.28)'}
        anchorX="left"
        anchorY="middle"
      >
        {String(floorNum).padStart(2, '0')}
      </Text>
    </group>
  )
}

// ─── Scene ────────────────────────────────────────────────────────────────────
interface TowerSceneProps {
  currentFloor: number
  onFloorClick?: (n: number) => void
}

export function TowerScene({ currentFloor, onFloorClick }: TowerSceneProps) {
  return (
    <group>
      {/* Tower-specific lighting */}
      <ambientLight color="#fff5e0" intensity={1.6} />
      <directionalLight position={[20, 50, 25]} color="#ffe8cc" intensity={2.2} />
      <directionalLight position={[-15, 30, -10]} color="#cce4ff" intensity={0.6} />

      {Array.from({ length: TOWER_FLOORS }, (_, i) => i + 1).map(n => (
        <TowerFloor
          key={n}
          floorNum={n}
          isUser={n === currentFloor}
          isPH={n === TOWER_FLOORS}
          onClick={() => onFloorClick?.(n)}
        />
      ))}
    </group>
  )
}
