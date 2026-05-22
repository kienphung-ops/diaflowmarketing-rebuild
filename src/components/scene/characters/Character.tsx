'use client'

import { useRef, useState, useEffect, useCallback, memo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import type { CharacterConfig } from '@/types/scene'
import { CharacterBody } from './CharacterBody'
import { NameBadge } from './NameBadge'
import { pickDragBubbleWord } from './dragBubbleWords'

// Inject CSS animations once into the document
if (typeof window !== 'undefined' && !document.getElementById('poke-animations')) {
  const style = document.createElement('style')
  style.id = 'poke-animations'
  style.textContent = `
    @keyframes floatUp {
      from { opacity: 1; transform: translateY(0px); }
      to   { opacity: 0; transform: translateY(-30px); }
    }
    @keyframes speechPop {
      0%   { opacity: 0; transform: scale(0.7) translateY(4px); }
      15%  { opacity: 1; transform: scale(1.08) translateY(0); }
      25%  { transform: scale(1); }
      75%  { opacity: 1; }
      100% { opacity: 0; }
    }
    @keyframes sparkleOut {
      0%   { opacity: 1; transform: translate(-50%, -50%) scale(0.5); }
      35%  { opacity: 1; transform: translate(-50%, -50%) scale(1.2); }
      100% { opacity: 0; transform: translate(-50%, -50%) scale(0.1); }
    }
  `
  document.head.appendChild(style)
}

const SPEECH_TEXTS = ['Hi!', '👋', '✨', 'Hey!', '😊', 'Thanks!']
const SPARKLE_COLORS = ['#f472b6', '#60a5fa', '#34d399', '#fbbf24', '#a78bfa']
const SPARKLE_ANGLES = [0, 72, 144, 216, 288]

interface CharacterProps {
  config: CharacterConfig
  model?: React.ReactNode
  onSelect: (slug: string) => void
  isSelected: boolean
  positionOverride?: [number, number, number]
  onDragStart?: (slug: string, mouseX: number, mouseY: number) => void
  draggingSlugRef?: React.MutableRefObject<string | null>
  onPoke?: (slug: string) => void
  pokeSignal?: number
  greetingSignal?: number
  greetingText?: string
  spawnSignal?: number
  spawnGreeting?: string
}

export const Character = memo(function Character({
  config, model, onSelect, isSelected, positionOverride,
  onDragStart, draggingSlugRef, onPoke, pokeSignal, greetingSignal, greetingText, spawnSignal, spawnGreeting,
}: CharacterProps) {
  const pos = positionOverride ?? config.position

  const groupRef = useRef<THREE.Group>(null)
  const [hovered, setHovered] = useState(false)
  const timeRef = useRef(0)
  const pointerDownRef = useRef<{ x: number; y: number; time: number } | null>(null)
  // Tracks the character's actual rendered X/Z position; lerps toward positionOverride target
  const visualPosRef = useRef<[number, number]>([pos[0], pos[2]])

  // 3D reaction (drives useFrame overrides)
  const reactionRef = useRef<{ type: 'bounce' | 'spin'; elapsed: number } | null>(null)

  // Html overlay state
  const [plus1Id, setPlus1Id]   = useState(0)
  const [speech, setSpeech]     = useState<{ text: string; id: number } | null>(null)
  const [sparkleId, setSparkleId] = useState(0)
  const speechIdRef             = useRef(0)

  // Rate-limit history (per-character, local)
  const pokeTimestamps = useRef<number[]>([])

  // Drag-bubble bookkeeping. We want a fresh random word every ~1.2s
  // while the user keeps dragging this minifigure. `lastDragBubbleAt`
  // gates the emission inside useFrame; `wasDragging` lets us reset
  // the gate the moment drag starts (so the first bubble pops
  // immediately, not 1.2s into the gesture) and fires one final
  // bubble at drop. Both kept as refs since they don't need to drive
  // a render — the bubble itself goes through the existing `speech`
  // state machine.
  const lastDragBubbleAt = useRef(0)
  const wasDraggingThisChar = useRef(false)

  // Spawn scale-in animation
  const spawnScaleRef = useRef(1)
  const isSpawningRef = useRef(false)

  const triggerPoke = useCallback(() => {
    const now = Date.now()
    pokeTimestamps.current = [
      ...pokeTimestamps.current.filter(t => now - t < 30_000),
      now,
    ]
    const last10s = pokeTimestamps.current.filter(t => now - t < 10_000).length
    const last30s = pokeTimestamps.current.length

    let speechText: string | null = null
    let doSparkle = false

    if (last30s >= 10) {
      speechText = '🙈 ok ok!'
      // reset 3D animation in case one was running
      if (groupRef.current) groupRef.current.scale.set(1, 1, 1)
      reactionRef.current = null
    } else if (last10s >= 5) {
      speechText = '💤 need a sec...'
      if (groupRef.current) groupRef.current.scale.set(1, 1, 1)
      reactionRef.current = null
    } else {
      const roll = Math.floor(Math.random() * 5)
      if (roll === 0) {
        doSparkle = true
      } else if (roll === 1) {
        speechText = SPEECH_TEXTS[Math.floor(Math.random() * SPEECH_TEXTS.length)]
      } else {
        // Reset any previous animation cleanly
        if (groupRef.current) groupRef.current.scale.set(1, 1, 1)
        reactionRef.current = { type: roll === 2 ? 'bounce' : 'spin', elapsed: 0 }
      }
    }

    // Always show +1 float
    setPlus1Id(prev => prev + 1)

    if (speechText) {
      const id = ++speechIdRef.current
      setSpeech({ text: speechText, id })
      setTimeout(() => {
        setSpeech(prev => (prev?.id === id ? null : prev))
      }, 2_300)
    }

    if (doSparkle) setSparkleId(prev => prev + 1)
  }, [])

  // Drag-triggered poke: parent increments pokeSignal
  useEffect(() => {
    if (!pokeSignal) return
    triggerPoke()
  }, [pokeSignal, triggerPoke])

  // Greeting on spawn: parent increments greetingSignal once when character is recruited
  useEffect(() => {
    if (!greetingSignal) return
    const id = ++speechIdRef.current
    setSpeech({ text: greetingText ?? 'Hello! 👋', id })
    setTimeout(() => setSpeech(p => p?.id === id ? null : p), 2_800)
  }, [greetingSignal, greetingText])

  // Scale-in entrance animation
  useEffect(() => {
    if (!spawnSignal) return
    spawnScaleRef.current = 0
    isSpawningRef.current = true
    if (spawnGreeting) {
      const id = ++speechIdRef.current
      setSpeech({ text: spawnGreeting, id })
      setTimeout(() => setSpeech(p => p?.id === id ? null : p), 2_800)
    }
  }, [spawnSignal, spawnGreeting])

  useFrame((_state, delta) => {
    if (!groupRef.current) return
    timeRef.current += delta
    const t = timeRef.current
    const baseY = pos[1]

    const bobAmp   = isSelected ? 0.055 : 0.032
    const bobSpeed = isSelected ? 2.0   : 1.3
    let yOffset = Math.sin(t * bobSpeed) * bobAmp

    // Reaction overrides
    if (reactionRef.current) {
      reactionRef.current.elapsed += delta
      const { type, elapsed } = reactionRef.current

      if (type === 'bounce') {
        const half = 0.225
        const full = 0.45
        if (elapsed < half) {
          yOffset += Math.sin(Math.PI * (elapsed / half)) * 0.42
        } else if (elapsed < full) {
          const p = (elapsed - half) / half
          const squash = 1 - Math.sin(Math.PI * p) * 0.15
          groupRef.current.scale.set(1 + Math.sin(Math.PI * p) * 0.1, squash, 1 + Math.sin(Math.PI * p) * 0.1)
        } else {
          groupRef.current.scale.set(1, 1, 1)
          reactionRef.current = null
        }
      } else if (type === 'spin') {
        const duration = 0.6
        if (elapsed < duration) {
          groupRef.current.rotation.y = (config.rotationY ?? Math.PI) + (elapsed / duration) * Math.PI * 2
        } else {
          groupRef.current.rotation.y = config.rotationY ?? Math.PI
          reactionRef.current = null
        }
      }
    }

    // Spawn scale-in
    if (isSpawningRef.current) {
      spawnScaleRef.current = Math.min(1, spawnScaleRef.current + delta * 2.2)
      groupRef.current.scale.setScalar(spawnScaleRef.current)
      if (spawnScaleRef.current >= 1) isSpawningRef.current = false
    }

    // Smooth movement: lerp X/Z toward target (snap instantly while dragging for responsive feel)
    const draggingThis = draggingSlugRef?.current === config.slug
    if (draggingThis) {
      visualPosRef.current[0] = pos[0]
      visualPosRef.current[1] = pos[2]
    } else {
      const dx = pos[0] - visualPosRef.current[0]
      const dz = pos[2] - visualPosRef.current[1]
      const dist = Math.sqrt(dx * dx + dz * dz)
      if (dist > 0.001) {
        const step = Math.min(dist, 1.4 * delta)  // max 1.4 units/sec
        visualPosRef.current[0] += (dx / dist) * step
        visualPosRef.current[1] += (dz / dist) * step
      }
    }

    // Drag-bubble: pop a random word while this character is being
    // dragged. The first bubble fires the instant drag starts (reset
    // gate when wasDraggingThisChar flips from false → true), then
    // every ~1.2s thereafter while drag is sustained. The existing
    // `speech` state + auto-clear timeout handle teardown, so when
    // the user drops the figure the last bubble fades out on its own.
    if (draggingThis) {
      if (!wasDraggingThisChar.current) {
        // Force the next branch to fire immediately on drag start.
        lastDragBubbleAt.current = 0
        wasDraggingThisChar.current = true
      }
      const now = performance.now()
      if (now - lastDragBubbleAt.current > 1200) {
        lastDragBubbleAt.current = now
        const id = ++speechIdRef.current
        setSpeech({ text: pickDragBubbleWord(), id })
        // Same 2.3s lifespan as poke speech bubbles so the
        // animation matches the existing speechPop keyframes.
        setTimeout(() => setSpeech(prev => (prev?.id === id ? null : prev)), 2_300)
      }
    } else if (wasDraggingThisChar.current) {
      // Drag just ended — flag reset, no extra bubble needed (the
      // last in-flight one is already animating out).
      wasDraggingThisChar.current = false
    }
    groupRef.current.position.x = visualPosRef.current[0]
    groupRef.current.position.y = baseY + yOffset
    groupRef.current.position.z = visualPosRef.current[1]

    const isSpinning = reactionRef.current?.type === 'spin'

    if (config.idleAnimation === 'typing') {
      const armL = groupRef.current.getObjectByName('armL')
      const armR = groupRef.current.getObjectByName('armR')
      if (armL) armL.rotation.x = -0.35 + Math.sin(t * 5 + 0.5) * 0.1
      if (armR) armR.rotation.x = -0.35 + Math.sin(t * 5) * 0.1
    } else if (config.idleAnimation === 'headturn' && !isSpinning) {
      const head = groupRef.current.getObjectByName('head')
      if (head) head.rotation.y = Math.sin(t * 0.5) * 0.35
    } else if (config.idleAnimation === 'wave') {
      const armR = groupRef.current.getObjectByName('armR')
      if (armR) {
        armR.rotation.z = Math.sin(t * 3.5) * 0.45 - 0.5
        armR.rotation.x = -0.25
      }
    }
  })

  return (
    <group
      ref={groupRef}
      position={[pos[0], pos[1], pos[2]]}
      rotation={[0, config.rotationY ?? Math.PI, 0]}
      onPointerOver={(e) => {
        e.stopPropagation()
        setHovered(true)
        document.body.style.cursor = draggingSlugRef?.current === config.slug ? 'grabbing' : 'grab'
      }}
      onPointerOut={() => {
        setHovered(false)
        if (!draggingSlugRef?.current) document.body.style.cursor = 'auto'
      }}
      onPointerDown={(e) => {
        e.stopPropagation()
        pointerDownRef.current = { x: e.nativeEvent.clientX, y: e.nativeEvent.clientY, time: Date.now() }
        onDragStart?.(config.slug, e.nativeEvent.clientX, e.nativeEvent.clientY)
        document.body.style.cursor = 'grabbing'
      }}
      onClick={(e) => {
        e.stopPropagation()
        if (!pointerDownRef.current) return
        const dx = e.clientX - pointerDownRef.current.x
        const dy = e.clientY - pointerDownRef.current.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        const elapsed = Date.now() - pointerDownRef.current.time
        if (dist < 6 && elapsed < 350) {
          onSelect(config.slug)
          triggerPoke()
          onPoke?.(config.slug)
        }
        pointerDownRef.current = null
      }}
    >
      {model ?? <CharacterBody config={config} hovered={hovered || isSelected} />}
      {(() => {
        // ── Beacon trigger ──────────────────────────────────────────
        // The badge switches from a head-floating label to a wall-top
        // beacon when the teammate would otherwise be unfindable:
        //   - behind back wall  (z < -5.5)             → "behind the wall"
        //   - off the floor planks (|x| > 7.15 or
        //     z > 7 or z < -7)                         → "off the floor"
        // The beacon's lateral X is clamped to ±6 so it stays inside the
        // camera frustum no matter how far sideways the user dragged.
        const cx = pos[0], cz = pos[2]
        const behindWall = cz < -5.5
        const offFloor = Math.abs(cx) > 7.15 || cz > 7 || cz < -7
        const reason: 'behind-wall' | 'off-floor' | null = behindWall
          ? 'behind-wall'
          : offFloor
          ? 'off-floor'
          : null
        if (!reason) {
          return <NameBadge name={config.name} role={config.role} />
        }
        // Target world position for the beacon — above wall (y=5.9),
        // just in front of the wall (z=-5), and laterally clamped so it
        // stays in the camera's horizontal frustum.
        const beaconWorldX = Math.max(-6, Math.min(6, cx))
        const beaconWorldY = 5.9
        const beaconWorldZ = -5
        // Convert to local-space offsets (badge lives inside the
        // character group, so we subtract the character's world pos).
        return (
          <NameBadge
            name={config.name}
            role={config.role}
            beaconReason={reason}
            beaconOffsetX={beaconWorldX - cx}
            beaconOffsetY={beaconWorldY - pos[1]}
            beaconOffsetZ={beaconWorldZ - cz}
          />
        )
      })()}

      {/* +1 float */}
      {plus1Id > 0 && (
        <Html position={[0, 2.8, 0]} center>
          <div
            key={plus1Id}
            style={{
              animation: 'floatUp 0.45s ease-out forwards',
              color: '#a855f7',
              fontWeight: 800,
              fontSize: '15px',
              pointerEvents: 'none',
              userSelect: 'none',
              textShadow: '0 0 8px rgba(168,85,247,0.7)',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            }}
          >
            +1
          </div>
        </Html>
      )}

      {/* Speech bubble */}
      {speech && (
        <Html position={[0.9, 2.3, 0]} center>
          <div
            key={speech.id}
            style={{
              background: 'white',
              color: '#111',
              borderRadius: '12px',
              padding: '5px 11px',
              fontSize: '13px',
              fontWeight: 700,
              animation: 'speechPop 2.3s ease forwards',
              pointerEvents: 'none',
              whiteSpace: 'nowrap',
              userSelect: 'none',
              boxShadow: '0 2px 10px rgba(0,0,0,0.25)',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            }}
          >
            {speech.text}
          </div>
        </Html>
      )}

      {/* Sparkle burst */}
      {sparkleId > 0 && (
        <Html position={[0, 2.2, 0]} center>
          <div key={sparkleId} style={{ position: 'relative', width: 0, height: 0, pointerEvents: 'none' }}>
            {SPARKLE_ANGLES.map((deg, i) => {
              const rad = (deg * Math.PI) / 180
              return (
                <div
                  key={i}
                  style={{
                    position: 'absolute',
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: SPARKLE_COLORS[i],
                    animation: 'sparkleOut 0.65s ease-out forwards',
                    animationDelay: `${i * 35}ms`,
                    left: `${Math.round(Math.cos(rad) * 18)}px`,
                    top: `${Math.round(Math.sin(rad) * 18)}px`,
                    transform: 'translate(-50%, -50%) scale(0.5)',
                  }}
                />
              )
            })}
          </div>
        </Html>
      )}

      <mesh position={[0, -0.95, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[1.1, 24]} />
        <meshBasicMaterial
          color={config.glowColor}
          transparent
          opacity={isSelected ? 0.35 : 0.22}
          depthWrite={false}
        />
      </mesh>
      <mesh position={[0, -0.94, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.0, 1.6, 24]} />
        <meshBasicMaterial
          color={config.glowColor}
          transparent
          opacity={isSelected ? 0.12 : 0.07}
          depthWrite={false}
        />
      </mesh>
    </group>
  )
})
