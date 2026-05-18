'use client'

interface LaptopProps {
  position?: [number, number, number]
}

export function Laptop({ position = [0, 0, 0] }: LaptopProps) {
  return (
    <group position={position}>
      <mesh castShadow>
        <boxGeometry args={[0.72, 0.045, 0.5]} />
        <meshLambertMaterial color="#2d2d2d" />
      </mesh>
      <mesh position={[0, 0.28, -0.24]} rotation={[-0.42, 0, 0]} castShadow>
        <boxGeometry args={[0.7, 0.46, 0.028]} />
        <meshLambertMaterial color="#1a1a1a" />
      </mesh>
      {/* Screen glow */}
      <mesh position={[0, 0.28, -0.228]} rotation={[-0.42, 0, 0]}>
        <planeGeometry args={[0.64, 0.41]} />
        <meshBasicMaterial color="#5b9bd5" />
      </mesh>
      {/* Keyboard marks */}
      <mesh position={[0, 0.025, 0.04]}>
        <planeGeometry args={[0.58, 0.28]} />
        <meshBasicMaterial color="#383838" />
      </mesh>
    </group>
  )
}
