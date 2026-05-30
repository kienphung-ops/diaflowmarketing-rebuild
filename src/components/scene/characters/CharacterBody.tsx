'use client'

import { Outlines } from '@react-three/drei'
import type { CharacterConfig } from '@/types/scene'

interface CharacterBodyProps {
  config: CharacterConfig
  hovered: boolean
  /** When true, every material renders translucent. Used by the
   *  tower-view floor preview to ghost teammates the viewer hasn't
   *  yet unlocked. */
  dimmed?: boolean
}

export function CharacterBody({ config, hovered, dimmed = false }: CharacterBodyProps) {
  const { skinColor, clothesColor, hairColor, hasTie, tieColor } = config
  // Lambert/Basic both honour `transparent + opacity` — we toggle them
  // together so the figure reads as a ghost when the caller asks for it.
  const matProps = dimmed
    ? { transparent: true, opacity: 0.28 }
    : ({ transparent: false } as const)

  return (
    <group>
      {/* Legs */}
      <mesh name="legL" position={[-0.13, -0.18, 0]} castShadow>
        <boxGeometry args={[0.19, 0.38, 0.2]} />
        <meshLambertMaterial {...matProps} color="#2d2d2d" />
        {hovered && <Outlines thickness={0.025} color="#60a5fa" />}
      </mesh>
      <mesh name="legR" position={[0.13, -0.18, 0]} castShadow>
        <boxGeometry args={[0.19, 0.38, 0.2]} />
        <meshLambertMaterial {...matProps} color="#2d2d2d" />
        {hovered && <Outlines thickness={0.025} color="#60a5fa" />}
      </mesh>
      {/* Shoes */}
      <mesh name="shoeL" position={[-0.13, -0.39, 0.04]} castShadow>
        <boxGeometry args={[0.2, 0.1, 0.28]} />
        <meshLambertMaterial {...matProps} color="#111111" />
      </mesh>
      <mesh name="shoeR" position={[0.13, -0.39, 0.04]} castShadow>
        <boxGeometry args={[0.2, 0.1, 0.28]} />
        <meshLambertMaterial {...matProps} color="#111111" />
      </mesh>

      {/* Torso */}
      <mesh name="torso" position={[0, 0.25, 0]} castShadow>
        <boxGeometry args={[0.5, 0.52, 0.28]} />
        <meshLambertMaterial {...matProps} color={clothesColor} />
        {hovered && <Outlines thickness={0.025} color="#60a5fa" />}
      </mesh>
      {/* Tie — shown on suited characters */}
      {hasTie && (
        <mesh name="tie" position={[0, 0.22, 0.15]} castShadow>
          <boxGeometry args={[0.08, 0.3, 0.03]} />
          <meshLambertMaterial {...matProps} color={tieColor ?? '#dc2626'} />
        </mesh>
      )}
      {/* Collar / neck */}
      <mesh name="neck" position={[0, 0.55, 0]} castShadow>
        <boxGeometry args={[0.2, 0.12, 0.2]} />
        <meshLambertMaterial {...matProps} color={skinColor} />
      </mesh>

      {/* Left arm */}
      <mesh name="armL" position={[-0.34, 0.24, 0]} castShadow>
        <boxGeometry args={[0.17, 0.46, 0.2]} />
        <meshLambertMaterial {...matProps} color={clothesColor} />
        {hovered && <Outlines thickness={0.025} color="#60a5fa" />}
      </mesh>
      {/* Left hand */}
      <mesh name="handL" position={[-0.34, 0, 0]} castShadow>
        <boxGeometry args={[0.16, 0.14, 0.18]} />
        <meshLambertMaterial {...matProps} color={skinColor} />
      </mesh>

      {/* Right arm */}
      <mesh name="armR" position={[0.34, 0.24, 0]} castShadow>
        <boxGeometry args={[0.17, 0.46, 0.2]} />
        <meshLambertMaterial {...matProps} color={clothesColor} />
        {hovered && <Outlines thickness={0.025} color="#60a5fa" />}
      </mesh>
      {/* Right hand */}
      <mesh name="handR" position={[0.34, 0, 0]} castShadow>
        <boxGeometry args={[0.16, 0.14, 0.18]} />
        <meshLambertMaterial {...matProps} color={skinColor} />
      </mesh>

      {/* Head */}
      <mesh name="head" position={[0, 0.84, 0]} castShadow>
        <boxGeometry args={[0.44, 0.44, 0.44]} />
        <meshLambertMaterial {...matProps} color={skinColor} />
        {hovered && <Outlines thickness={0.025} color="#60a5fa" />}
      </mesh>
      {/* Eyes */}
      <mesh name="eyeL" position={[-0.1, 0.86, 0.23]}>
        <boxGeometry args={[0.08, 0.07, 0.02]} />
        <meshBasicMaterial {...matProps} color="#1a1a2e" />
      </mesh>
      <mesh name="eyeR" position={[0.1, 0.86, 0.23]}>
        <boxGeometry args={[0.08, 0.07, 0.02]} />
        <meshBasicMaterial {...matProps} color="#1a1a2e" />
      </mesh>
      {/* Smile */}
      <mesh name="smile" position={[0, 0.76, 0.23]}>
        <boxGeometry args={[0.14, 0.04, 0.02]} />
        <meshBasicMaterial {...matProps} color="#cc6644" />
      </mesh>

      {/* Hair */}
      <mesh name="hair" position={[0, 1.09, 0]} castShadow>
        <boxGeometry args={[0.46, 0.18, 0.46]} />
        <meshLambertMaterial {...matProps} color={hairColor} />
      </mesh>
      {/* Hair sides */}
      <mesh name="hairSideL" position={[-0.23, 0.9, 0]} castShadow>
        <boxGeometry args={[0.04, 0.22, 0.38]} />
        <meshLambertMaterial {...matProps} color={hairColor} />
      </mesh>
      <mesh name="hairSideR" position={[0.23, 0.9, 0]} castShadow>
        <boxGeometry args={[0.04, 0.22, 0.38]} />
        <meshLambertMaterial {...matProps} color={hairColor} />
      </mesh>
    </group>
  )
}
