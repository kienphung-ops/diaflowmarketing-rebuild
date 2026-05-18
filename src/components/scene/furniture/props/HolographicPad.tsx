'use client'

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

interface HolographicPadProps {
  position?: [number, number, number]
}

export function HolographicPad({ position = [0, 0, 0] }: HolographicPadProps) {
  const holoRef = useRef<THREE.Group>(null)
  const timeRef = useRef(0)

  useFrame((_state, delta) => {
    timeRef.current += delta
    if (holoRef.current) {
      holoRef.current.rotation.y = timeRef.current * 0.8
      holoRef.current.position.y = 0.22 + Math.sin(timeRef.current * 2) * 0.015
    }
  })

  return (
    <group position={position}>
      {/* Base pad */}
      <mesh castShadow>
        <cylinderGeometry args={[0.18, 0.18, 0.025, 12]} />
        <meshLambertMaterial color="#2a1a4a" />
      </mesh>
      {/* Glowing ring */}
      <mesh position={[0, 0.02, 0]}>
        <torusGeometry args={[0.14, 0.01, 6, 16]} />
        <meshBasicMaterial color="#a855f7" />
      </mesh>

      {/* Hologram projection */}
      <group ref={holoRef} position={[0, 0.22, 0]}>
        <mesh>
          <octahedronGeometry args={[0.1]} />
          <meshBasicMaterial color="#c084fc" transparent opacity={0.7} wireframe />
        </mesh>
        <mesh scale={0.65}>
          <octahedronGeometry args={[0.1]} />
          <meshBasicMaterial color="#e879f9" transparent opacity={0.4} />
        </mesh>
      </group>

      {/* Projection beam */}
      <mesh position={[0, 0.12, 0]}>
        <cylinderGeometry args={[0.005, 0.08, 0.22, 8]} />
        <meshBasicMaterial color="#a855f7" transparent opacity={0.15} />
      </mesh>
    </group>
  )
}
