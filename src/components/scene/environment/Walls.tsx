'use client'

import { memo, Suspense } from 'react'
import * as THREE from 'three'
import { Text, useTexture } from '@react-three/drei'

// Memoize so re-renders of the parent (camera target changes, scene reflows)
// don't force the SDF text atlas to rebuild — which manifested as flicker.
//
// Frame enlarged ~50% (1.08 → 1.6) so the company name reads clearly from
// the static camera distance. Reserved band on the back wall is now
// x ∈ [-3.1, -1.5], y ∈ [1.4, 3.0]; the FloorItems layout keeps other
// wall items clear of this box.
const CompanyFrame = memo(function CompanyFrame({ companyName }: { companyName?: string }) {
  return (
    <group position={[-2.3, 2.2, -5.4]}>
      <mesh castShadow>
        <boxGeometry args={[1.6, 1.6, 0.05]} />
        <meshLambertMaterial color="#5a3a10" />
      </mesh>
      <mesh position={[0, 0, 0.03]}>
        <boxGeometry args={[1.42, 1.42, 0.03]} />
        <meshLambertMaterial color="#7a5520" />
      </mesh>
      <mesh position={[0, 0, 0.046]}>
        <planeGeometry args={[1.38, 1.38]} />
        <meshLambertMaterial color="#f5f0e8" />
      </mesh>
      {companyName && (
        <Text
          position={[0, 0, 0.08]}
          fontSize={0.15}
          maxWidth={1.2}
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
 *   Floor 20        → 6.png  (penthouse night-sky panorama)
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
  // back-wall opening. Same treatment for all 20 floors; Floor 20 just maps
  // to 6.png (penthouse night-sky panorama).
  return (
    <mesh position={[3.5, 2.4, -5.32]}>
      <planeGeometry args={[3, 2.2]} />
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
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
  // Floor 20 is the penthouse — all three sides become floor-to-ceiling
  // glass so the user feels like they're standing in an open sky lounge.
  // F1-19 only render the back wall (side walls were removed earlier
  // because the static camera doesn't need them to bound the view).
  const isPenthouse = currentFloor >= 20

  // Shared glass material props — light blue tint, low opacity so the
  // sky outside shows through clearly. `depthWrite: false` keeps it
  // from occluding objects directly behind it (e.g. furniture inside).
  const glassColor = '#e8f1ff'
  const glassOpacity = 0.18

  return (
    <group>
      {/* Back wall — solid plaster on F1-19, transparent glass on F20. */}
      <mesh position={[0, 1.8, -5.5]} receiveShadow>
        <boxGeometry args={[16, 7, 0.18]} />
        {isPenthouse ? (
          <meshLambertMaterial
            color={glassColor}
            transparent
            opacity={glassOpacity}
            depthWrite={false}
          />
        ) : (
          <meshLambertMaterial color="#e8dfd0" />
        )}
      </mesh>

      {/* Side walls — only on penthouse, both glass. The room is 11
          deep along Z (front edge ≈ 5.5, back at -5.5), so left/right
          walls are 11 long centered at z = 0. */}
      {isPenthouse && (
        <>
          <mesh position={[-8, 1.8, 0]} receiveShadow>
            <boxGeometry args={[0.18, 7, 11]} />
            <meshLambertMaterial
              color={glassColor}
              transparent
              opacity={glassOpacity}
              depthWrite={false}
            />
          </mesh>
          <mesh position={[8, 1.8, 0]} receiveShadow>
            <boxGeometry args={[0.18, 7, 11]} />
            <meshLambertMaterial
              color={glassColor}
              transparent
              opacity={glassOpacity}
              depthWrite={false}
            />
          </mesh>
          {/* Thin gold frame strips on each glass edge so the walls
              read as architecture rather than vanishing entirely. */}
          {[
            // Vertical mullions at the four building corners
            { p: [-7.9, 1.8, -5.4] as [number, number, number], s: [0.06, 7, 0.06] as [number, number, number] },
            { p: [7.9, 1.8, -5.4] as [number, number, number], s: [0.06, 7, 0.06] as [number, number, number] },
            { p: [-7.9, 1.8, 5.4] as [number, number, number], s: [0.06, 7, 0.06] as [number, number, number] },
            { p: [7.9, 1.8, 5.4] as [number, number, number], s: [0.06, 7, 0.06] as [number, number, number] },
            // Top + bottom rails on the side panels
            { p: [-7.92, 5.18, 0] as [number, number, number], s: [0.05, 0.08, 11] as [number, number, number] },
            { p: [7.92, 5.18, 0] as [number, number, number], s: [0.05, 0.08, 11] as [number, number, number] },
            { p: [-7.92, -1.58, 0] as [number, number, number], s: [0.05, 0.08, 11] as [number, number, number] },
            { p: [7.92, -1.58, 0] as [number, number, number], s: [0.05, 0.08, 11] as [number, number, number] },
          ].map((m, i) => (
            <mesh key={i} position={m.p}>
              <boxGeometry args={m.s} />
              <meshLambertMaterial color="#3a2a1a" />
            </mesh>
          ))}
        </>
      )}

      {showWindow && (
        <>
          {isPenthouse ? (
            // Penthouse: full-wall glass panorama with 6.png as the
            // background. No cut-out window frame — the entire back is
            // glass so the scenery fills it edge-to-edge.
            <Suspense fallback={null}>
              <FloorPanoramaTexture />
            </Suspense>
          ) : (
            <>
              <Suspense fallback={null}>
                <FloorSceneryTexture floor={currentFloor} />
              </Suspense>
              <WindowFrame />
            </>
          )}
        </>
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

/** Floor-to-ceiling night-sky panorama for the penthouse (Floor 20).
 *
 * Renders 6.png on three separate planes — one behind each of the
 * glass walls (back + both sides). The user, looking through any
 * direction, sees a continuous night sky outside the building. We
 * share a single Texture reference across the three meshes (drei's
 * useTexture deduplicates by URL) so memory cost is the same as the
 * old single-plane setup. */
function FloorPanoramaTexture() {
  const texture = useTexture('/window_images/6.png') as THREE.Texture
  texture.colorSpace = THREE.SRGBColorSpace
  return (
    <>
      {/* Back wall panorama — z = -5.6 is just behind the back wall at z = -5.5 */}
      <mesh position={[0, 1.8, -5.6]}>
        <planeGeometry args={[16, 7]} />
        <meshBasicMaterial map={texture} toneMapped={false} />
      </mesh>
      {/* Left side panorama — sits just outside the left glass wall
          (x = -8) facing inward (+X). Plane is the depth of the
          room (11 along Z) rotated 90° around Y. */}
      <mesh position={[-8.1, 1.8, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[11, 7]} />
        <meshBasicMaterial map={texture} toneMapped={false} />
      </mesh>
      {/* Right side panorama — mirror of the left, facing -X. */}
      <mesh position={[8.1, 1.8, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[11, 7]} />
        <meshBasicMaterial map={texture} toneMapped={false} />
      </mesh>
    </>
  )
}
