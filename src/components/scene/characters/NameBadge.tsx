'use client'

import { Billboard, Text } from '@react-three/drei'

interface NameBadgeProps {
  name: string
  role: string
}

export function NameBadge({ name, role }: NameBadgeProps) {
  return (
    <Billboard position={[0, 1.85, 0]} follow lockX={false} lockY={false} lockZ={false}>
      {/* Background pill */}
      <mesh position={[0, 0, -0.01]}>
        <planeGeometry args={[1.3, 0.42]} />
        <meshBasicMaterial color="#0d0d1f" transparent opacity={0.85} />
      </mesh>
      {/* Border */}
      <mesh position={[0, 0, -0.015]}>
        <planeGeometry args={[1.34, 0.46]} />
        <meshBasicMaterial color="#3344aa" transparent opacity={0.6} />
      </mesh>

      <Text
        fontSize={0.14}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
        position={[0, 0.08, 0]}
      >
        {name}
      </Text>
      <Text
        fontSize={0.09}
        color="#8899cc"
        anchorX="center"
        anchorY="middle"
        position={[0, -0.09, 0]}
      >
        {role}
      </Text>
    </Billboard>
  )
}
