'use client'

import type { CharacterSlug } from '@/types/scene'
import { Laptop } from './props/Laptop'
import { CoffeeMug } from './props/CoffeeMug'
import { Books } from './props/Books'
import { Typewriter } from './props/Typewriter'
import { Monitor } from './props/Monitor'
import { Headphones } from './props/Headphones'
import { HolographicPad } from './props/HolographicPad'
import { OfficeChair } from './props/OfficeChair'

interface DeskProps {
  position: [number, number, number]
  character?: CharacterSlug
  chairColor?: string
}

const DESK_SURFACE_Y = 0.72

export function Desk({ position, character = undefined, chairColor = '#1a1a2e' }: DeskProps) {
  return (
    <group position={position}>
      {/* Desk surface */}
      <mesh position={[0, DESK_SURFACE_Y, 0]} receiveShadow castShadow>
        <boxGeometry args={[2.2, 0.065, 1.1]} />
        <meshLambertMaterial color="#3d2a12" />
      </mesh>
      {/* Desk edge trim */}
      <mesh position={[0, DESK_SURFACE_Y - 0.04, 0.56]}>
        <boxGeometry args={[2.2, 0.04, 0.03]} />
        <meshLambertMaterial color="#2a1a08" />
      </mesh>
      {/* Desk modesty panel (back) */}
      <mesh position={[0, DESK_SURFACE_Y / 2, -0.52]}>
        <boxGeometry args={[2.2, DESK_SURFACE_Y - 0.07, 0.04]} />
        <meshLambertMaterial color="#301e0a" />
      </mesh>
      {/* Four legs */}
      {(
        [[-0.95, -0.44], [0.95, -0.44], [-0.95, 0.44], [0.95, 0.44]] as [number, number][]
      ).map(([x, z], i) => (
        <mesh key={i} position={[x, DESK_SURFACE_Y / 2, z]} castShadow>
          <boxGeometry args={[0.07, DESK_SURFACE_Y, 0.07]} />
          <meshLambertMaterial color="#2a1a08" />
        </mesh>
      ))}

      {/* Office chair — positioned in front of desk (toward camera) */}
      <OfficeChair position={[0, -0.5, 0.55]} color={chairColor} />

      {/* Desk lamp */}
      <group position={[0.8, DESK_SURFACE_Y + 0.033, -0.3]}>
        {/* Lamp base */}
        <mesh>
          <cylinderGeometry args={[0.06, 0.08, 0.03, 8]} />
          <meshLambertMaterial color="#222222" />
        </mesh>
        {/* Lamp arm */}
        <mesh position={[0, 0.22, 0]}>
          <cylinderGeometry args={[0.012, 0.012, 0.4, 6]} />
          <meshLambertMaterial color="#333333" />
        </mesh>
        {/* Lamp shade */}
        <mesh position={[0, 0.42, 0]}>
          <coneGeometry args={[0.1, 0.14, 8, 1, true]} />
          <meshLambertMaterial color="#c8a04a" side={2} />
        </mesh>
      </group>

      {/* Character-specific props */}
      {character === 'mia' && (
        <>
          <Laptop position={[-0.15, DESK_SURFACE_Y + 0.033, 0.05]} />
          <CoffeeMug position={[0.45, DESK_SURFACE_Y + 0.07, -0.28]} />
          <Books position={[-0.82, DESK_SURFACE_Y + 0.033, -0.1]} />
          <Typewriter position={[0.25, DESK_SURFACE_Y + 0.05, 0.18]} />
        </>
      )}
      {character === 'iris' && (
        <>
          <Monitor position={[0, DESK_SURFACE_Y + 0.033, -0.1]} />
          <Headphones position={[0.7, DESK_SURFACE_Y + 0.08, 0.18]} />
          <CoffeeMug position={[-0.7, DESK_SURFACE_Y + 0.07, -0.2]} />
        </>
      )}
      {character === 'leo' && (
        <>
          <HolographicPad position={[0, DESK_SURFACE_Y + 0.013, 0]} />
          <CoffeeMug position={[-0.7, DESK_SURFACE_Y + 0.07, -0.2]} />
        </>
      )}
    </group>
  )
}
