'use client'

interface MonitorProps {
  position?: [number, number, number]
}

export function Monitor({ position = [0, 0, 0] }: MonitorProps) {
  return (
    <group position={position}>
      {/* Stand base */}
      <mesh castShadow>
        <boxGeometry args={[0.32, 0.04, 0.22]} />
        <meshLambertMaterial color="#222222" />
      </mesh>
      {/* Stand neck */}
      <mesh position={[0, 0.22, -0.02]} castShadow>
        <boxGeometry args={[0.05, 0.4, 0.05]} />
        <meshLambertMaterial color="#222222" />
      </mesh>
      {/* Screen bezel */}
      <mesh position={[0, 0.56, -0.04]} castShadow>
        <boxGeometry args={[0.88, 0.54, 0.05]} />
        <meshLambertMaterial color="#1a1a1a" />
      </mesh>
      {/* Screen */}
      <mesh position={[0, 0.56, -0.017]}>
        <planeGeometry args={[0.82, 0.48]} />
        <meshBasicMaterial color="#0a1628" />
      </mesh>
      {/* Timeline bars on screen (Iris&apos;s video editor) */}
      {[0.06, 0.0, -0.06, -0.12].map((y, i) => (
        <mesh key={i} position={[-0.05, 0.56 + y, -0.014]}>
          <planeGeometry args={[[0.6, 0.4, 0.7, 0.5][i], 0.04]} />
          <meshBasicMaterial color={['#e85d3a', '#3ab865', '#3a7de8', '#e8b83a'][i]} transparent opacity={0.9} />
        </mesh>
      ))}
    </group>
  )
}
