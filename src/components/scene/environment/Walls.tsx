'use client'

import { memo, Suspense } from 'react'
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

/** Floor 20: the 3 walls turn into glass + a wraparound panorama plays
 *  on a large background plane outside each wall. The texture (6.png)
 *  is repeated/sampled so it reads as the same skyline from any angle. */
function FloorTwentyPanorama() {
  const url = '/window_images/6.png'
  const texture = useTexture(url) as THREE.Texture
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.ClampToEdgeWrapping

  return (
    <group>
      {/* Back panorama — behind the (now glass) back wall */}
      <mesh position={[0, 2.5, -8.5]}>
        <planeGeometry args={[24, 10]} />
        <meshBasicMaterial map={texture} toneMapped={false} />
      </mesh>
      {/* Left panorama — behind the left glass wall, rotated to face inward */}
      <mesh position={[-11, 2.5, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[16, 10]} />
        <meshBasicMaterial map={texture} toneMapped={false} />
      </mesh>
      {/* Right panorama */}
      <mesh position={[11, 2.5, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[16, 10]} />
        <meshBasicMaterial map={texture} toneMapped={false} />
      </mesh>
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
        <Suspense fallback={null}>
          <FloorTwentyPanorama />
        </Suspense>
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
