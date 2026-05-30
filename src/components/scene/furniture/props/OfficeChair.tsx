'use client'

interface OfficeChairProps {
  position?: [number, number, number]
  color?: string
}

export function OfficeChair({ position = [0, 0, 0], color = '#1a1a2a' }: OfficeChairProps) {
  return (
    <group position={position}>
      {/* Seat */}
      <mesh position={[0, 0.48, 0]} castShadow>
        <boxGeometry args={[0.52, 0.07, 0.48]} />
        <meshLambertMaterial color={color} />
      </mesh>
      {/* Seat cushion */}
      <mesh position={[0, 0.525, 0]}>
        <boxGeometry args={[0.48, 0.04, 0.44]} />
        <meshLambertMaterial color="#2a2a3a" />
      </mesh>
      {/* Backrest */}
      <mesh position={[0, 0.82, -0.22]} castShadow>
        <boxGeometry args={[0.5, 0.6, 0.06]} />
        <meshLambertMaterial color={color} />
      </mesh>
      {/* Backrest cushion */}
      <mesh position={[0, 0.82, -0.19]}>
        <boxGeometry args={[0.44, 0.54, 0.04]} />
        <meshLambertMaterial color="#2a2a3a" />
      </mesh>
      {/* Armrests */}
      {([-0.29, 0.29] as number[]).map((x, i) => (
        <group key={i}>
          <mesh position={[x, 0.68, -0.04]} castShadow>
            <boxGeometry args={[0.05, 0.04, 0.38]} />
            <meshLambertMaterial color={color} />
          </mesh>
          {/* Armrest pad */}
          <mesh position={[x, 0.705, -0.04]}>
            <boxGeometry args={[0.07, 0.02, 0.28]} />
            <meshLambertMaterial color="#333344" />
          </mesh>
        </group>
      ))}
      {/* Gas cylinder */}
      <mesh position={[0, 0.22, 0]} castShadow>
        <cylinderGeometry args={[0.035, 0.04, 0.44, 8]} />
        <meshLambertMaterial color="#444444" />
      </mesh>
      {/* Star base */}
      {[0, 1, 2, 3, 4].map((i) => {
        const angle = (i / 5) * Math.PI * 2
        return (
          <mesh
            key={i}
            position={[Math.cos(angle) * 0.28, 0.01, Math.sin(angle) * 0.28]}
            rotation={[0, angle, 0.1]}
            castShadow
          >
            <boxGeometry args={[0.52, 0.04, 0.06]} />
            <meshLambertMaterial color="#333333" />
          </mesh>
        )
      })}
      {/* Casters */}
      {[0, 1, 2, 3, 4].map((i) => {
        const angle = (i / 5) * Math.PI * 2
        return (
          <mesh key={i} position={[Math.cos(angle) * 0.27, -0.02, Math.sin(angle) * 0.27]}>
            <sphereGeometry args={[0.04, 6, 4]} />
            <meshLambertMaterial color="#222222" />
          </mesh>
        )
      })}
    </group>
  )
}
