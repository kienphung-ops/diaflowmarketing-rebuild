'use client'

interface CoffeeMugProps {
  position?: [number, number, number]
}

export function CoffeeMug({ position = [0, 0, 0] }: CoffeeMugProps) {
  return (
    <group position={position}>
      {/* Mug body */}
      <mesh castShadow>
        <cylinderGeometry args={[0.07, 0.065, 0.14, 8]} />
        <meshLambertMaterial color="#e04040" />
      </mesh>
      {/* Coffee surface */}
      <mesh position={[0, 0.06, 0]}>
        <circleGeometry args={[0.062, 8]} />
        <meshBasicMaterial color="#3d1a0a" />
      </mesh>
      {/* Handle */}
      <mesh position={[0.1, 0, 0]}>
        <torusGeometry args={[0.04, 0.012, 6, 8, Math.PI]} />
        <meshLambertMaterial color="#e04040" />
      </mesh>
    </group>
  )
}
