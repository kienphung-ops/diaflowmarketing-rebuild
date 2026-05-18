'use client'

interface TypewriterProps {
  position?: [number, number, number]
}

export function Typewriter({ position = [0, 0, 0] }: TypewriterProps) {
  return (
    <group position={position} scale={0.9}>
      {/* Body */}
      <mesh castShadow>
        <boxGeometry args={[0.42, 0.1, 0.3]} />
        <meshLambertMaterial color="#2a2a2a" />
      </mesh>
      {/* Paper roll */}
      <mesh position={[0, 0.14, -0.1]} castShadow>
        <cylinderGeometry args={[0.032, 0.032, 0.38, 8]} />
        <meshLambertMaterial color="#f5f0e8" />
      </mesh>
      {/* Paper sheet */}
      <mesh position={[0, 0.22, -0.06]} rotation={[-0.15, 0, 0]}>
        <planeGeometry args={[0.34, 0.28]} />
        <meshBasicMaterial color="#f8f4ec" />
      </mesh>
      {/* Keys row */}
      {[-0.14, -0.05, 0.04, 0.13].map((x, i) => (
        <mesh key={i} position={[x, 0.058, 0.07]} castShadow>
          <boxGeometry args={[0.06, 0.02, 0.06]} />
          <meshLambertMaterial color="#444444" />
        </mesh>
      ))}
    </group>
  )
}
