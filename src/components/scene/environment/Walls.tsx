'use client'

import { useMemo } from 'react'
import * as THREE from 'three'
import { Text } from '@react-three/drei'

function Stars() {
  const positions = useMemo(() => {
    const pts: number[] = []
    for (let i = 0; i < 60; i++) {
      pts.push(
        (Math.random() - 0.5) * 4 + 3.5,
        (Math.random()) * 1.8 + 1.4,
        -5.25
      )
    }
    return new Float32Array(pts)
  }, [])

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" array={positions} count={60} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial color="#ffffff" size={0.03} sizeAttenuation />
    </points>
  )
}

function Bookshelf() {
  const bookColors = ['#c0392b', '#2980b9', '#27ae60', '#e67e22', '#8e44ad', '#2c3e50', '#d35400', '#16a085']
  return (
    <group position={[-4.5, 0.6, -5.3]}>
      {/* Shelf unit back panel */}
      <mesh castShadow>
        <boxGeometry args={[2.4, 3.2, 0.15]} />
        <meshLambertMaterial color="#5a3a1a" />
      </mesh>
      {/* Three shelves */}
      {[0.8, 0, -0.8].map((y, si) => (
        <mesh key={si} position={[0, y, 0.08]} castShadow>
          <boxGeometry args={[2.4, 0.06, 0.3]} />
          <meshLambertMaterial color="#7a5a2a" />
        </mesh>
      ))}
      {/* Side panels */}
      {[-1.17, 1.17].map((x, i) => (
        <mesh key={i} position={[x, 0, 0.08]}>
          <boxGeometry args={[0.06, 3.2, 0.3]} />
          <meshLambertMaterial color="#5a3a1a" />
        </mesh>
      ))}
      {/* Books on shelves */}
      {[0.8, 0, -0.8].map((shelfY, si) =>
        bookColors.slice(si * 2, si * 2 + 5).map((color, bi) => (
          <mesh key={`b${si}-${bi}`} position={[-0.85 + bi * 0.22, shelfY + 0.12, 0.13]} castShadow>
            <boxGeometry args={[0.17, 0.22, 0.18]} />
            <meshLambertMaterial color={color} />
          </mesh>
        ))
      )}
    </group>
  )
}

function PlantPot() {
  return (
    <group position={[-6.1, -0.3, -2.5]}>
      {/* Pot */}
      <mesh castShadow>
        <cylinderGeometry args={[0.16, 0.12, 0.28, 8]} />
        <meshLambertMaterial color="#8B4513" />
      </mesh>
      {/* Soil */}
      <mesh position={[0, 0.15, 0]}>
        <cylinderGeometry args={[0.155, 0.155, 0.04, 8]} />
        <meshLambertMaterial color="#3d2b1a" />
      </mesh>
      {/* Stems and leaves */}
      {[
        { pos: [0, 0.18, 0] as [number, number, number], rot: [0, 0, 0] as [number, number, number] },
        { pos: [0.12, 0.18, 0] as [number, number, number], rot: [0, 0, 0.4] as [number, number, number] },
        { pos: [-0.1, 0.18, 0.08] as [number, number, number], rot: [0, 0, -0.3] as [number, number, number] },
      ].map((s, i) => (
        <group key={i} position={s.pos} rotation={s.rot}>
          {/* Stem */}
          <mesh castShadow>
            <cylinderGeometry args={[0.015, 0.015, 0.4, 5]} />
            <meshLambertMaterial color="#2d5a1b" />
          </mesh>
          {/* Leaf — use planeGeometry scaled to leaf shape */}
          <mesh position={[0, 0.22, 0]} rotation={[0.3, i * 0.8, 0]}>
            <planeGeometry args={[0.28, 0.16]} />
            <meshLambertMaterial color="#3a7a22" side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

function CompanyFrame({ companyName }: { companyName?: string }) {
  return (
    <group position={[-2.4, 2.2, -5.38]}>
      {/* Outer frame — dark wood */}
      <mesh castShadow>
        <boxGeometry args={[1.08, 1.08, 0.04]} />
        <meshLambertMaterial color="#5a3a10" />
      </mesh>
      {/* Inner frame lip */}
      <mesh position={[0, 0, 0.022]}>
        <boxGeometry args={[0.96, 0.96, 0.02]} />
        <meshLambertMaterial color="#7a5520" />
      </mesh>
      {/* White mat backing */}
      <mesh position={[0, 0, 0.032]}>
        <planeGeometry args={[0.94, 0.94]} />
        <meshLambertMaterial color="#f5f0e8" />
      </mesh>
      {/* Company name text — shown after user enters it */}
      {companyName && (
        <Text
          position={[0, 0, 0.036]}
          fontSize={0.09}
          maxWidth={0.76}
          textAlign="center"
          color="#1a1a2e"
          anchorX="center"
          anchorY="middle"
        >
          {companyName}
        </Text>
      )}
    </group>
  )
}

interface WallsProps {
  companyName?: string
  showBookshelf?: boolean
  showPlant?: boolean
  showWindow?: boolean
}

export function Walls({
  companyName,
  showBookshelf = true,
  showPlant = true,
  showWindow = true,
}: WallsProps) {
  return (
    <group>
      {/* Back wall */}
      <mesh position={[0, 1.8, -5.5]} receiveShadow>
        <boxGeometry args={[16, 7, 0.18]} />
        <meshLambertMaterial color="#e8dfd0" />
      </mesh>

      {showWindow && (
        <>
          {/* Sky backdrop */}
          <mesh position={[3.5, 2.4, -5.32]}>
            <planeGeometry args={[3, 2.2]} />
            <meshBasicMaterial color="#050a1a" />
          </mesh>
          {/* Moon */}
          <mesh position={[4.6, 3.1, -5.3]}>
            <circleGeometry args={[0.18, 16]} />
            <meshBasicMaterial color="#e8e4c8" />
          </mesh>
          <mesh position={[4.6, 3.1, -5.31]}>
            <circleGeometry args={[0.28, 16]} />
            <meshBasicMaterial color="#c8c4a0" transparent opacity={0.15} />
          </mesh>
          <Stars />
          <mesh position={[3.5, 2.4, -5.28]}>
            <planeGeometry args={[2.8, 2.0]} />
            <meshBasicMaterial color="#1a2a4a" transparent opacity={0.2} />
          </mesh>
          {[
            { pos: [3.5, 3.6, -5.26] as [number, number, number], size: [3.3, 0.14, 0.12] as [number, number, number] },
            { pos: [3.5, 1.3, -5.26] as [number, number, number], size: [3.3, 0.14, 0.12] as [number, number, number] },
            { pos: [2.0, 2.45, -5.26] as [number, number, number], size: [0.14, 2.5, 0.12] as [number, number, number] },
            { pos: [5.0, 2.45, -5.26] as [number, number, number], size: [0.14, 2.5, 0.12] as [number, number, number] },
          ].map((f, i) => (
            <mesh key={i} position={f.pos}>
              <boxGeometry args={f.size} />
              <meshLambertMaterial color="#3a2a1a" />
            </mesh>
          ))}
          <mesh position={[3.5, 2.45, -5.26]}>
            <boxGeometry args={[0.08, 2.5, 0.08]} />
            <meshLambertMaterial color="#3a2a1a" />
          </mesh>
          <mesh position={[3.5, 2.45, -5.26]}>
            <boxGeometry args={[3.3, 0.08, 0.08]} />
            <meshLambertMaterial color="#3a2a1a" />
          </mesh>
        </>
      )}

      {showBookshelf && <Bookshelf />}
      {showPlant && <PlantPot />}

      <CompanyFrame companyName={companyName} />

      {/* Baseboard */}
      <mesh position={[0, -0.52, -5.42]}>
        <boxGeometry args={[16, 0.12, 0.1]} />
        <meshLambertMaterial color="#2a1a0a" />
      </mesh>
    </group>
  )
}
