'use client'

import { Outlines } from '@react-three/drei'
import type { CharacterConfig } from '@/types/scene'

interface CharacterBodyProps {
  config: CharacterConfig
  hovered: boolean
}

export function CharacterBody({ config, hovered }: CharacterBodyProps) {
  const { skinColor, clothesColor, hairColor, hasTie, tieColor } = config

  return (
    <group>
      {/* Legs */}
      <mesh name="legL" position={[-0.13, -0.18, 0]} castShadow>
        <boxGeometry args={[0.19, 0.38, 0.2]} />
        <meshLambertMaterial color="#2d2d2d" />
        {hovered && <Outlines thickness={0.025} color="#60a5fa" />}
      </mesh>
      <mesh name="legR" position={[0.13, -0.18, 0]} castShadow>
        <boxGeometry args={[0.19, 0.38, 0.2]} />
        <meshLambertMaterial color="#2d2d2d" />
        {hovered && <Outlines thickness={0.025} color="#60a5fa" />}
      </mesh>
      {/* Shoes */}
      <mesh name="shoeL" position={[-0.13, -0.39, 0.04]} castShadow>
        <boxGeometry args={[0.2, 0.1, 0.28]} />
        <meshLambertMaterial color="#111111" />
      </mesh>
      <mesh name="shoeR" position={[0.13, -0.39, 0.04]} castShadow>
        <boxGeometry args={[0.2, 0.1, 0.28]} />
        <meshLambertMaterial color="#111111" />
      </mesh>

      {/* Torso */}
      <mesh name="torso" position={[0, 0.25, 0]} castShadow>
        <boxGeometry args={[0.5, 0.52, 0.28]} />
        <meshLambertMaterial color={clothesColor} />
        {hovered && <Outlines thickness={0.025} color="#60a5fa" />}
      </mesh>
      {/* Tie — shown on suited characters */}
      {hasTie && (
        <mesh name="tie" position={[0, 0.22, 0.15]} castShadow>
          <boxGeometry args={[0.08, 0.3, 0.03]} />
          <meshLambertMaterial color={tieColor ?? '#dc2626'} />
        </mesh>
      )}
      {/* Collar / neck */}
      <mesh name="neck" position={[0, 0.55, 0]} castShadow>
        <boxGeometry args={[0.2, 0.12, 0.2]} />
        <meshLambertMaterial color={skinColor} />
      </mesh>

      {/* Left arm */}
      <mesh name="armL" position={[-0.34, 0.24, 0]} castShadow>
        <boxGeometry args={[0.17, 0.46, 0.2]} />
        <meshLambertMaterial color={clothesColor} />
        {hovered && <Outlines thickness={0.025} color="#60a5fa" />}
      </mesh>
      {/* Left hand */}
      <mesh name="handL" position={[-0.34, 0, 0]} castShadow>
        <boxGeometry args={[0.16, 0.14, 0.18]} />
        <meshLambertMaterial color={skinColor} />
      </mesh>

      {/* Right arm */}
      <mesh name="armR" position={[0.34, 0.24, 0]} castShadow>
        <boxGeometry args={[0.17, 0.46, 0.2]} />
        <meshLambertMaterial color={clothesColor} />
        {hovered && <Outlines thickness={0.025} color="#60a5fa" />}
      </mesh>
      {/* Right hand */}
      <mesh name="handR" position={[0.34, 0, 0]} castShadow>
        <boxGeometry args={[0.16, 0.14, 0.18]} />
        <meshLambertMaterial color={skinColor} />
      </mesh>

      {/* Head */}
      <mesh name="head" position={[0, 0.84, 0]} castShadow>
        <boxGeometry args={[0.44, 0.44, 0.44]} />
        <meshLambertMaterial color={skinColor} />
        {hovered && <Outlines thickness={0.025} color="#60a5fa" />}
      </mesh>
      {/* Eyes */}
      <mesh name="eyeL" position={[-0.1, 0.86, 0.23]}>
        <boxGeometry args={[0.08, 0.07, 0.02]} />
        <meshBasicMaterial color="#1a1a2e" />
      </mesh>
      <mesh name="eyeR" position={[0.1, 0.86, 0.23]}>
        <boxGeometry args={[0.08, 0.07, 0.02]} />
        <meshBasicMaterial color="#1a1a2e" />
      </mesh>
      {/* Smile */}
      <mesh name="smile" position={[0, 0.76, 0.23]}>
        <boxGeometry args={[0.14, 0.04, 0.02]} />
        <meshBasicMaterial color="#cc6644" />
      </mesh>

      {/* Hair */}
      <mesh name="hair" position={[0, 1.09, 0]} castShadow>
        <boxGeometry args={[0.46, 0.18, 0.46]} />
        <meshLambertMaterial color={hairColor} />
      </mesh>
      {/* Hair sides */}
      <mesh name="hairSideL" position={[-0.23, 0.9, 0]} castShadow>
        <boxGeometry args={[0.04, 0.22, 0.38]} />
        <meshLambertMaterial color={hairColor} />
      </mesh>
      <mesh name="hairSideR" position={[0.23, 0.9, 0]} castShadow>
        <boxGeometry args={[0.04, 0.22, 0.38]} />
        <meshLambertMaterial color={hairColor} />
      </mesh>
    </group>
  )
}
