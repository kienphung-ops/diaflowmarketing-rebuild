import { useMemo } from 'react'

const PLANK_WIDTH = 0.65
const PLANK_COUNT = 22
const PLANK_LENGTH = 14

export function Floor() {
  const planks = useMemo(
    () =>
      Array.from({ length: PLANK_COUNT }, (_, i) => ({
        x: (i - PLANK_COUNT / 2) * PLANK_WIDTH,
        color: i % 3 === 0 ? '#c08040' : i % 3 === 1 ? '#a86c30' : '#c89050',
      })),
    []
  )

  return (
    <group position={[0, -0.56, 0]}>
      {planks.map((plank, i) => (
        <mesh key={i} position={[plank.x, 0, 0]} receiveShadow>
          <boxGeometry args={[PLANK_WIDTH - 0.025, 0.08, PLANK_LENGTH]} />
          <meshLambertMaterial color={plank.color} />
        </mesh>
      ))}
    </group>
  )
}
