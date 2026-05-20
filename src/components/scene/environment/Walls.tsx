'use client'

import { memo, Suspense, useMemo } from 'react'
import * as THREE from 'three'
import { Text, useTexture } from '@react-three/drei'

// Memoize so re-renders of the parent (camera target changes, scene reflows)
// don't force the SDF text atlas to rebuild — which manifested as flicker.
const CompanyFrame = memo(function CompanyFrame({ companyName }: { companyName?: string }) {
  return (
    <group position={[-2.4, 2.2, -5.4]}>
      <mesh castShadow>
        <boxGeometry args={[1.08, 1.08, 0.04]} />
        <meshLambertMaterial color="#5a3a10" />
      </mesh>
      <mesh position={[0, 0, 0.024]}>
        <boxGeometry args={[0.96, 0.96, 0.02]} />
        <meshLambertMaterial color="#7a5520" />
      </mesh>
      <mesh position={[0, 0, 0.034]}>
        <planeGeometry args={[0.94, 0.94]} />
        <meshLambertMaterial color="#f5f0e8" />
      </mesh>
      {companyName && (
        <Text
          position={[0, 0, 0.07]}
          fontSize={0.1}
          maxWidth={0.82}
          textAlign="center"
          color="#1a1a2e"
          anchorX="center"
          anchorY="middle"
          renderOrder={1}
          overflowWrap="break-word"
          whiteSpace="overflowWrap"
        >
          {companyName.slice(0, 30)}
        </Text>
      )}
    </group>
  )
})

/**
 * Map a floor number to one of 6 reusable scenery images, so the client
 * only downloads up to 6 PNGs instead of 20.
 *
 *   Floor 1         → 1.png
 *   Floor 2 – 5     → 2.png
 *   Floor 6 – 10    → 3.png
 *   Floor 11 – 15   → 4.png
 *   Floor 16 – 19   → 5.png
 *   Floor 20        → 6.png  (handled separately via FloorTwentyPanorama)
 */
function floorToImageNumber(floor: number): number {
  if (floor <= 1) return 1
  if (floor <= 5) return 2
  if (floor <= 10) return 3
  if (floor <= 15) return 4
  if (floor <= 19) return 5
  return 6
}

/** Loads /window_images/<N>.png. Suspends until ready. */
function FloorSceneryTexture({ floor }: { floor: number }) {
  const url = `/window_images/${floorToImageNumber(floor)}.png`
  const texture = useTexture(url) as THREE.Texture
  texture.colorSpace = THREE.SRGBColorSpace

  // Standard cut-out window — texture fills the planeGeometry inside the
  // back-wall opening. Floor 1-19 use this; Floor 20 uses the glass-wall
  // panorama (see FloorTwentyPanorama).
  return (
    <mesh position={[3.5, 2.4, -5.32]}>
      <planeGeometry args={[3, 2.2]} />
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  )
}

/** Procedural 3D night-sky panorama for Floor 20. Deep navy sky with
 *  stars, a crescent moon, a milky-way streak, drifting clouds at the
 *  horizon, a hot-air balloon and an airship. Renders behind the glass
 *  walls so the penthouse has a tranquil "above the clouds" feel. */

function seededRand(seed: number): number {
  const x = Math.sin(seed) * 10000
  return x - Math.floor(x)
}

function CrescentMoon() {
  return (
    <group position={[-9, 12, -20]}>
      {/* Bright moon body */}
      <mesh>
        <sphereGeometry args={[1.3, 32, 24]} />
        <meshBasicMaterial color="#f4ecd8" />
      </mesh>
      {/* Dark overlapping sphere carves the crescent shape */}
      <mesh position={[0.55, 0.18, 0.1]}>
        <sphereGeometry args={[1.25, 32, 24]} />
        <meshBasicMaterial color="#070a1c" />
      </mesh>
      {/* Soft halo */}
      <mesh position={[-0.1, 0, -0.05]}>
        <sphereGeometry args={[2.1, 24, 18]} />
        <meshBasicMaterial color="#fbe9a8" transparent opacity={0.1} />
      </mesh>
    </group>
  )
}

function MilkyWayStreak() {
  // Soft purple-blue gradient streak suggesting the galactic plane.
  return (
    <group>
      <mesh position={[3, 11, -23]} rotation={[0, 0, -0.55]}>
        <planeGeometry args={[10, 1.4]} />
        <meshBasicMaterial color="#5a4dad" transparent opacity={0.32} />
      </mesh>
      <mesh position={[3, 11, -23.02]} rotation={[0, 0, -0.55]}>
        <planeGeometry args={[7, 0.7]} />
        <meshBasicMaterial color="#8b6fce" transparent opacity={0.32} />
      </mesh>
    </group>
  )
}

function ShootingStar() {
  return (
    <mesh position={[-3, 9.5, -21]} rotation={[0, 0, -0.6]}>
      <planeGeometry args={[2.6, 0.05]} />
      <meshBasicMaterial color="#ffffff" />
    </mesh>
  )
}

interface HotAirBalloonProps {
  position: [number, number, number]
}

function HotAirBalloon({ position }: HotAirBalloonProps) {
  return (
    <group position={position}>
      {/* Balloon dome — slightly elongated sphere */}
      <mesh position={[0, 0.2, 0]} scale={[1, 1.25, 1]}>
        <sphereGeometry args={[0.7, 18, 14]} />
        <meshLambertMaterial color="#a82838" emissive="#3a0a14" emissiveIntensity={0.2} />
      </mesh>
      {/* Vertical stripes — thin tall planes around the equator */}
      {Array.from({ length: 6 }, (_, i) => {
        const angle = (i / 6) * Math.PI * 2
        return (
          <mesh
            key={i}
            position={[Math.cos(angle) * 0.55, 0.2, Math.sin(angle) * 0.55]}
            rotation={[0, -angle, 0]}
            scale={[1, 1.25, 1]}
          >
            <planeGeometry args={[0.18, 1.3]} />
            <meshLambertMaterial color="#f4e8d2" side={THREE.DoubleSide} />
          </mesh>
        )
      })}
      {/* Burner glow */}
      <mesh position={[0, -0.65, 0]}>
        <sphereGeometry args={[0.18, 10, 8]} />
        <meshBasicMaterial color="#fcd34d" />
      </mesh>
      {/* Basket */}
      <mesh position={[0, -0.95, 0]}>
        <boxGeometry args={[0.4, 0.3, 0.4]} />
        <meshLambertMaterial color="#7a4a1a" />
      </mesh>
      {/* Ropes connecting basket to balloon */}
      {[[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]].map(([rx, rz], i) => (
        <mesh key={i} position={[rx, -0.45, rz]}>
          <cylinderGeometry args={[0.012, 0.012, 0.65, 4]} />
          <meshBasicMaterial color="#3a2a1a" />
        </mesh>
      ))}
    </group>
  )
}

function Airship() {
  return (
    <group position={[2, 7, -16]}>
      {/* Elongated zeppelin body */}
      <mesh rotation={[0, 0, Math.PI / 2]} scale={[1, 2.6, 1]}>
        <sphereGeometry args={[0.42, 20, 12]} />
        <meshLambertMaterial color="#e6e6ec" />
      </mesh>
      {/* Lower gondola */}
      <mesh position={[0, -0.32, 0]}>
        <boxGeometry args={[0.7, 0.14, 0.22]} />
        <meshLambertMaterial color="#3a3f55" />
      </mesh>
      {/* Tail fins */}
      <mesh position={[-1.0, 0.18, 0]}>
        <boxGeometry args={[0.18, 0.4, 0.05]} />
        <meshLambertMaterial color="#e6e6ec" />
      </mesh>
      <mesh position={[-1.0, 0, 0.18]} rotation={[Math.PI / 2, 0, 0]}>
        <boxGeometry args={[0.18, 0.4, 0.05]} />
        <meshLambertMaterial color="#e6e6ec" />
      </mesh>
      {/* Tiny warm cabin lights */}
      {[-0.2, 0, 0.2].map((dx, i) => (
        <mesh key={i} position={[dx, -0.32, 0.12]}>
          <planeGeometry args={[0.05, 0.05]} />
          <meshBasicMaterial color="#fde68a" />
        </mesh>
      ))}
    </group>
  )
}

interface CloudProps {
  position: [number, number, number]
  scale?: number
}

function Cloud({ position, scale = 1 }: CloudProps) {
  // Stacked spheres form a fluffy stylised cloud silhouette.
  const puffs: Array<[number, number, number, number]> = [
    [0, 0, 0, 1.4],
    [1.4, -0.1, 0, 1.05],
    [-1.4, -0.1, 0, 1.15],
    [0.6, 0.55, 0, 0.95],
    [-0.6, 0.45, 0, 0.9],
    [2.2, -0.25, 0, 0.8],
    [-2.2, -0.25, 0, 0.75],
    [1.0, -0.45, 0, 0.7],
  ]
  return (
    <group position={position} scale={scale}>
      {puffs.map(([x, y, z, s], i) => (
        <mesh key={i} position={[x, y, z]} scale={s}>
          <sphereGeometry args={[0.55, 14, 10]} />
          <meshLambertMaterial color="#d6dded" />
        </mesh>
      ))}
    </group>
  )
}

function FloorTwentyNightSky() {
  // Star scatter — varied sizes + occasional warm-yellow accent star.
  const stars = useMemo(() => {
    const arr: Array<{ pos: [number, number, number]; size: number; warm: boolean }> = []
    for (let i = 0; i < 180; i++) {
      const s = i * 7919 + 11
      const x = (seededRand(s) - 0.5) * 60
      const y = 6 + seededRand(s * 3) * 14
      const z = -18 - seededRand(s * 5) * 10
      const size = 0.05 + seededRand(s * 7) * 0.09
      arr.push({ pos: [x, y, z], size, warm: seededRand(s * 11) < 0.08 })
    }
    return arr
  }, [])

  return (
    <group>
      {/* Deep navy sky — gradient via two stacked planes (dark top, mid below) */}
      <mesh position={[0, 14, -27]}>
        <planeGeometry args={[80, 22]} />
        <meshBasicMaterial color="#070b22" />
      </mesh>
      <mesh position={[0, 1, -26.98]}>
        <planeGeometry args={[80, 12]} />
        <meshBasicMaterial color="#0d1238" />
      </mesh>
      {/* Side sky panels */}
      <mesh position={[-22, 8, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[40, 30]} />
        <meshBasicMaterial color="#080b22" />
      </mesh>
      <mesh position={[22, 8, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[40, 30]} />
        <meshBasicMaterial color="#080b22" />
      </mesh>

      {/* Stars */}
      {stars.map((s, i) => (
        <mesh key={i} position={s.pos}>
          <sphereGeometry args={[s.size, 6, 5]} />
          <meshBasicMaterial color={s.warm ? '#fde68a' : '#f5f0e6'} />
        </mesh>
      ))}

      <MilkyWayStreak />
      <ShootingStar />
      <CrescentMoon />

      {/* Aircraft */}
      <HotAirBalloon position={[8, 9, -18]} />
      <Airship />

      {/* Clouds along the horizon — back + sides */}
      <Cloud position={[-9, 0.4, -16]} scale={1.4} />
      <Cloud position={[7, -0.2, -17]} scale={1.6} />
      <Cloud position={[-2, -0.5, -14]} scale={1} />
      <Cloud position={[-15, 1.2, -8]} scale={1.2} />
      <Cloud position={[15, 0.8, -10]} scale={1.3} />
      <Cloud position={[-18, -0.3, 4]} scale={1.1} />
      <Cloud position={[18, 0.2, 2]} scale={1.2} />
    </group>
  )
}

/** Window frame mullions overlaid on top of the floor-scenery texture
 *  (a + cross + outer rim). */
function WindowFrame() {
  return (
    <>
      {[
        { pos: [3.5, 3.6, -5.26] as [number, number, number], size: [3.3, 0.14, 0.12] as [number, number, number] },
        { pos: [3.5, 1.3, -5.26] as [number, number, number], size: [3.3, 0.14, 0.12] as [number, number, number] },
        { pos: [2.0, 2.45, -5.26] as [number, number, number], size: [0.14, 2.5, 0.12] as [number, number, number] },
        { pos: [5.0, 2.45, -5.26] as [number, number, number], size: [0.14, 2.5, 0.12] as [number, number, number] },
      ].map((f, i) => (
        <mesh key={i} position={f.pos}>
          <boxGeometry args={f.size} />
          <meshLambertMaterial color="#3a2a1a" />
        </mesh>
      ))}
      <mesh position={[3.5, 2.45, -5.26]}>
        <boxGeometry args={[0.08, 2.5, 0.08]} />
        <meshLambertMaterial color="#3a2a1a" />
      </mesh>
      <mesh position={[3.5, 2.45, -5.26]}>
        <boxGeometry args={[3.3, 0.08, 0.08]} />
        <meshLambertMaterial color="#3a2a1a" />
      </mesh>
    </>
  )
}

interface WallsProps {
  companyName?: string
  currentFloor: number
  /** When false, suppresses the cut-out window entirely (legacy demos). */
  showWindow?: boolean
}

export function Walls({ companyName, currentFloor, showWindow = true }: WallsProps) {
  const isPenthouse = currentFloor >= 20
  // Walls become almost-transparent glass on Floor 20 so the panorama
  // shows through from all 3 sides. Earlier floors keep solid plaster.
  const wallMaterial = isPenthouse ? (
    <meshLambertMaterial color="#e8f1ff" transparent opacity={0.18} />
  ) : (
    <meshLambertMaterial color="#e8dfd0" />
  )
  const sideWallMaterial = isPenthouse ? (
    <meshLambertMaterial color="#e8f1ff" transparent opacity={0.18} />
  ) : (
    <meshLambertMaterial color="#dccfb8" />
  )

  return (
    <group>
      {/* Back wall */}
      <mesh position={[0, 1.8, -5.5]} receiveShadow>
        <boxGeometry args={[16, 7, 0.18]} />
        {wallMaterial}
      </mesh>

      {/* Left wall */}
      <mesh position={[-8, 1.8, 0]} receiveShadow>
        <boxGeometry args={[0.18, 7, 11]} />
        {sideWallMaterial}
      </mesh>

      {/* Right wall */}
      <mesh position={[8, 1.8, 0]} receiveShadow>
        <boxGeometry args={[0.18, 7, 11]} />
        {sideWallMaterial}
      </mesh>

      {/* Side baseboards — kept even on Floor 20 to anchor the room */}
      <mesh position={[-7.92, -0.52, 0]}>
        <boxGeometry args={[0.1, 0.12, 11]} />
        <meshLambertMaterial color="#2a1a0a" />
      </mesh>
      <mesh position={[7.92, -0.52, 0]}>
        <boxGeometry args={[0.1, 0.12, 11]} />
        <meshLambertMaterial color="#2a1a0a" />
      </mesh>

      {isPenthouse ? (
        // Glass-wall panorama — no cut-out window, the whole back+sides become
        // floor-to-ceiling glass with 20.png as the surrounding skyline.
        <FloorTwentyNightSky />
      ) : (
        showWindow && (
          <>
            <Suspense fallback={null}>
              <FloorSceneryTexture floor={currentFloor} />
            </Suspense>
            <WindowFrame />
          </>
        )
      )}

      <CompanyFrame companyName={companyName} />

      {/* Baseboard along back wall */}
      <mesh position={[0, -0.52, -5.42]}>
        <boxGeometry args={[16, 0.12, 0.1]} />
        <meshLambertMaterial color="#2a1a0a" />
      </mesh>
    </group>
  )
}
