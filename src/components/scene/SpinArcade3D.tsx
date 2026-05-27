'use client'

import { useRef, useState } from 'react'
import * as THREE from 'three'
import { Html } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { ArcadeMachine } from './environment/FloorItems'

/** Canonical default position of the spin arcade in the 3D office. The
 *  "Arrange your room" override (key `spin_arcade_0`) takes precedence
 *  when set. Shared with RoomArranger so the arranger and the live
 *  scene agree on where the arcade starts. */
export const SPIN_ARCADE_3D_DEFAULT: [number, number, number] = [1.7, -0.55, 4.5]
/** Position-map key the arrange feature stores the arcade under. The
 *  `_0` suffix matches the single-instance convention used by every
 *  other item (RoomArranger keys as `${itemKey}_${index}`). */
export const SPIN_ARCADE_KEY = 'spin_arcade_0'

/**
 * The spin-wheel entry point, rendered as an interactive 3D object in
 * the office (not a floating DOM button). Always present from day one —
 * clicking the cabinet opens the spin modal. A pulsing point light +
 * a floating HTML badge ("N spins ready" / "TRY YOUR FREE SPIN") draw
 * the eye, mirroring the arcade in the reference mockups.
 */
interface Props {
  position: [number, number, number]
  /** Live token count (signed-in). Drives the badge + glow intensity. */
  tokens: number
  /** Anonymous pre-login teaser — paints the gold "FREE SPIN" badge. */
  teaser?: boolean
  onClick?: () => void
}

export function SpinArcade3D({ position, tokens, teaser, onClick }: Props) {
  const [hovered, setHovered] = useState(false)
  const lightRef = useRef<THREE.PointLight>(null)
  const groupRef = useRef<THREE.Group>(null)

  const active = teaser || tokens > 0

  // Gentle breathing glow + float when there are spins to take.
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    if (lightRef.current) {
      const base = active ? 1.6 : 0.4
      lightRef.current.intensity = base + (active ? Math.sin(t * 2.2) * 0.6 : 0)
    }
    if (groupRef.current && active) {
      groupRef.current.position.y = position[1] + Math.sin(t * 1.6) * 0.05
    }
  })

  return (
    <group ref={groupRef} position={position}>
      {/* Visual cabinet (always rendered unlocked = full opacity). */}
      <ArcadeMachine unlocked />

      {/* Coloured glow around the machine. */}
      <pointLight
        ref={lightRef}
        position={[0, 1.2, 0.6]}
        color={teaser ? '#fbbf24' : '#a855f7'}
        intensity={1.4}
        distance={5}
        decay={2}
      />

      {/* Invisible hit-box covering the cabinet — owns the click + hover
          cursor. Sized a touch larger than the body so it's easy to hit. */}
      <mesh
        position={[0, 0.9, 0.1]}
        onClick={e => {
          e.stopPropagation()
          onClick?.()
        }}
        onPointerOver={e => {
          e.stopPropagation()
          setHovered(true)
          document.body.style.cursor = 'pointer'
        }}
        onPointerOut={() => {
          setHovered(false)
          document.body.style.cursor = 'auto'
        }}
      >
        <boxGeometry args={[1.0, 1.95, 0.85]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {/* Floating badge above the marquee. pointer-events none so the
          click always lands on the hit-box mesh, not the HTML. */}
      <Html position={[0, 2.15, 0]} center zIndexRange={[20, 0]}>
        <div
          style={{
            pointerEvents: 'none',
            transform: `scale(${hovered ? 1.08 : 1})`,
            transition: 'transform 0.15s',
          }}
          className="flex flex-col items-center"
        >
          <span
            className={
              'whitespace-nowrap px-2.5 py-1 rounded-full text-[11px] font-extrabold tracking-wide shadow-lg ' +
              (teaser
                ? 'bg-gradient-to-r from-tower-gold to-pink-400 text-night-deep animate-nav-pulse'
                : tokens > 0
                  ? 'bg-purple-500 text-white animate-nav-pulse'
                  : 'bg-night-deep/85 text-tower-cream/70 border border-white/15')
            }
          >
            {teaser
              ? '🎁 TRY YOUR FREE SPIN'
              : tokens > 0
                ? `🎰 ${tokens} ${tokens === 1 ? 'spin' : 'spins'} ready`
                : 'Earn a spin to play'}
          </span>
        </div>
      </Html>
    </group>
  )
}
