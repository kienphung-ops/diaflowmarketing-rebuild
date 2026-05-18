'use client'

interface HeadphonesProps {
  position?: [number, number, number]
}

export function Headphones({ position = [0, 0, 0] }: HeadphonesProps) {
  return (
    <group position={position} rotation={[0.3, 0.4, 0]}>
      {/* Headband arc */}
      <mesh castShadow>
        <torusGeometry args={[0.12, 0.018, 8, 12, Math.PI]} />
        <meshLambertMaterial color="#1a1a1a" />
      </mesh>
      {/* Left ear cup */}
      <mesh position={[-0.12, 0, 0]} castShadow>
        <cylinderGeometry args={[0.055, 0.055, 0.04, 10]} />
        <meshLambertMaterial color="#E8A838" />
      </mesh>
      {/* Right ear cup */}
      <mesh position={[0.12, 0, 0]} castShadow>
        <cylinderGeometry args={[0.055, 0.055, 0.04, 10]} />
        <meshLambertMaterial color="#E8A838" />
      </mesh>
    </group>
  )
}
