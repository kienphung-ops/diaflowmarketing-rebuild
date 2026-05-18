import type { CharacterConfig } from '@/types/scene'

interface LightingProps {
  characters: CharacterConfig[]
  positions?: Record<string, [number, number, number]>
  onboardingStep?: string
  showTower?: boolean
}

export function Lighting({ characters, positions = {}, onboardingStep, showTower }: LightingProps) {
  if (showTower) return null
  const isOnboarding = !!onboardingStep && onboardingStep !== 'done'

  const spotlitSlug = !isOnboarding ? null
    : onboardingStep === 'iris' || onboardingStep === 'mia-spawning' ? 'iris'
    : onboardingStep === 'mia' ? 'mia'
    : onboardingStep?.startsWith('leo') ? 'leo'
    : null

  return (
    <>
      {/* Ambient — dimmed during onboarding spotlight moments */}
      <ambientLight color="#fff8f0" intensity={isOnboarding ? 0.35 : 1.1} />

      {/* Main overhead key light */}
      <directionalLight
        color="#ffe8cc"
        intensity={isOnboarding ? 0.5 : 1.6}
        position={[6, 14, 8]}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-near={0.5}
        shadow-camera-far={60}
        shadow-camera-left={-14}
        shadow-camera-right={14}
        shadow-camera-top={14}
        shadow-camera-bottom={-14}
      />

      {/* Soft fill from the opposite side */}
      <directionalLight color="#cce8ff" intensity={isOnboarding ? 0.1 : 0.4} position={[-8, 8, -4]} />

      {/* Strong focused desk spotlight per character */}
      {characters.map((char) => (
        <pointLight
          key={`lamp-${char.slug}`}
          position={[
            char.deskPosition[0],
            char.deskPosition[1] + 2.6,
            char.deskPosition[2] + 0.3,
          ]}
          color="#fff5cc"
          intensity={
            spotlitSlug
              ? char.slug === spotlitSlug ? 10.0 : 0.3
              : char.slug === 'mia' ? 5.0 : 3.5
          }
          distance={5.5}
          decay={2}
          castShadow={false}
        />
      ))}

      {/* Per-character colored floor glow — follows drag position */}
      {characters.map((char) => {
        const pos = positions[char.slug] ?? char.position
        return (
          <pointLight
            key={`glow-${char.slug}`}
            position={[pos[0], -0.3, pos[2]]}
            color={char.glowColor}
            intensity={
              spotlitSlug
                ? char.slug === spotlitSlug ? 5.0 : 0.2
                : char.slug === 'mia' ? 3.5 : 2.5
            }
            distance={4.5}
            decay={1.2}
            castShadow={false}
          />
        )
      })}

      {/* Warm bounce from floor toward camera */}
      <pointLight color="#ffead0" intensity={isOnboarding ? 0.2 : 0.5} position={[0, 2, 10]} distance={18} decay={2} />
    </>
  )
}
