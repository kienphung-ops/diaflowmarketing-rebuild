'use client'

import { Billboard, Text } from '@react-three/drei'

export type BeaconReason = 'behind-wall' | 'off-floor' | null

/** Per-line max for both name + role on the in-scene NameBadge. Beyond
 *  this the badge overflows the 1.3-wide plane and reads as overlap
 *  with neighbouring teammates. Names / roles longer than 20 chars are
 *  truncated to the first 20 + "…" so the badge stays a fixed width. */
const MAX_LABEL_LEN = 20
function truncate(label: string): string {
  return label.length > MAX_LABEL_LEN ? label.slice(0, MAX_LABEL_LEN) + '...' : label
}

interface NameBadgeProps {
  name: string
  role: string
  /** Why the badge is in beacon mode — drives label text + which side
   *  the user lost the teammate on. `null` = normal head-anchored badge. */
  beaconReason?: BeaconReason
  /** Local-space offset placing the badge at a guaranteed-visible point
   *  above the back wall. Caller (Character.tsx) computes these by
   *  subtracting the character's current world position from a known-
   *  visible world point (e.g. clamped-X / wall-front-Z / above-wall-Y). */
  beaconOffsetX?: number
  beaconOffsetY?: number
  beaconOffsetZ?: number
}

export function NameBadge({
  name,
  role,
  beaconReason = null,
  beaconOffsetX = 0,
  beaconOffsetY = 0,
  beaconOffsetZ = 0,
}: NameBadgeProps) {
  const isBeacon = beaconReason !== null

  // Normal: badge floats just above the head.
  // Beacon: caller-supplied offset puts the badge above the wall at a
  //         safe lateral position so it's always discoverable.
  const x = isBeacon ? beaconOffsetX : 0
  const y = isBeacon ? beaconOffsetY : 1.85
  const z = isBeacon ? beaconOffsetZ : 0

  const bgColor = isBeacon ? '#3a1f00' : '#0d0d1f'
  const borderColor = isBeacon ? '#fbbf24' : '#3344aa'
  const nameColor = isBeacon ? '#fde68a' : '#ffffff'
  const roleColor = isBeacon ? '#fbbf24' : '#8899cc'
  const scale = isBeacon ? 1.25 : 1

  const hintLabel =
    beaconReason === 'behind-wall'
      ? 'behind the wall'
      : beaconReason === 'off-floor'
      ? 'off the floor — tap to find'
      : null

  return (
    <Billboard
      position={[x, y, z]}
      follow
      lockX={false}
      lockY={false}
      lockZ={false}
    >
      <group scale={scale}>
        <mesh position={[0, 0, -0.015]} renderOrder={998}>
          <planeGeometry args={[1.34, 0.46]} />
          <meshBasicMaterial
            color={borderColor}
            transparent
            opacity={isBeacon ? 0.95 : 0.6}
            depthTest={!isBeacon}
          />
        </mesh>
        <mesh position={[0, 0, -0.01]} renderOrder={999}>
          <planeGeometry args={[1.3, 0.42]} />
          <meshBasicMaterial
            color={bgColor}
            transparent
            opacity={isBeacon ? 0.95 : 0.85}
            depthTest={!isBeacon}
          />
        </mesh>

        <Text
          fontSize={0.14}
          color={nameColor}
          anchorX="center"
          anchorY="middle"
          position={[0, 0.08, 0]}
          renderOrder={1000}
          material-depthTest={!isBeacon}
        >
          {truncate(name)}
        </Text>
        <Text
          fontSize={0.09}
          color={roleColor}
          anchorX="center"
          anchorY="middle"
          position={[0, -0.09, 0]}
          renderOrder={1000}
          material-depthTest={!isBeacon}
        >
          {truncate(role)}
        </Text>

        {isBeacon && (
          <>
            <Text
              fontSize={0.18}
              color="#fbbf24"
              anchorX="center"
              anchorY="middle"
              position={[0, -0.32, 0]}
              renderOrder={1000}
              material-depthTest={false}
            >
              ▼
            </Text>
            {hintLabel && (
              <Text
                fontSize={0.075}
                color="#fbbf24"
                anchorX="center"
                anchorY="middle"
                position={[0, -0.46, 0]}
                renderOrder={1000}
                material-depthTest={false}
              >
                {hintLabel}
              </Text>
            )}
          </>
        )}
      </group>
    </Billboard>
  )
}
