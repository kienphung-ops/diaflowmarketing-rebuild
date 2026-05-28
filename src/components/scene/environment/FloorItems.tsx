'use client'

import { useMemo, type ReactNode } from 'react'
import * as THREE from 'three'
import { Text } from '@react-three/drei'
import { useFloorItems } from '@/lib/floorsConfigClient'

const LOCKED_OPACITY = 0.18

/**
 * Wraps a group with materials that honour the unlocked / ghosted state.
 * Locked items render at LOCKED_OPACITY so the user can preview what's
 * waiting on the next floors.
 */
function ItemWrapper({
  position,
  unlocked,
  children,
}: {
  position: [number, number, number]
  unlocked: boolean
  children: ReactNode
}) {
  // We can't override every child material via a parent group — instead,
  // children read the unlocked flag through context-less prop drilling.
  // The pattern: each item renders meshes with `meshStandardMaterial
  // transparent={!unlocked} opacity={unlocked ? 1 : LOCKED_OPACITY}`.
  // To keep it DRY we just hide via a single group's visible+scale and
  // overlay a translucent silhouette material approach where needed.
  return (
    <group position={position} visible>
      <group>{children}</group>
      {!unlocked && (
        <mesh position={[0, 0.5, 0]} visible={false}>
          <boxGeometry args={[0.01, 0.01, 0.01]} />
        </mesh>
      )}
    </group>
  )
}

interface MaterialProps {
  color: string
  unlocked: boolean
  emissive?: string
  emissiveIntensity?: number
}

function M({ color, unlocked, emissive, emissiveIntensity }: MaterialProps) {
  return (
    <meshStandardMaterial
      color={color}
      transparent={!unlocked}
      opacity={unlocked ? 1 : LOCKED_OPACITY}
      emissive={emissive ?? '#000000'}
      emissiveIntensity={unlocked ? emissiveIntensity ?? 0 : 0}
      roughness={0.7}
      side={THREE.FrontSide}
    />
  )
}

/* ── Item meshes ──────────────────────────────────────────────── */

function FloorLamp({ unlocked }: { unlocked: boolean }) {
  return (
    <group>
      <mesh position={[0, 0.1, 0]}>
        <cylinderGeometry args={[0.18, 0.22, 0.06, 12]} />
        <M color="#2a1a0a" unlocked={unlocked} />
      </mesh>
      <mesh position={[0, 0.9, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 1.6, 8]} />
        <M color="#3a2a1a" unlocked={unlocked} />
      </mesh>
      <mesh position={[0, 1.75, 0]}>
        <coneGeometry args={[0.28, 0.32, 16, 1, true]} />
        <M color="#f0d488" unlocked={unlocked} emissive="#fff1c4" emissiveIntensity={0.45} />
      </mesh>
    </group>
  )
}

// (removed) BasicChairDesk composite mesh — the F3+ "Basic chair +
// desk" unlock used to combine OfficeDesk + BasicChair into one
// render group, but the chair ended up stuck to the desk and facing
// the wrong way. Per the new spec the pair is two SEPARATE items
// (office_desk + basic_chair) lined up via matching offsetSteps in
// the ITEMS array — each chair sits in front of its desk at the
// canonical orientation (chair's natural -z backrest = facing +z
// toward its desk).

/* F1 — bigger standalone "office desk" introduced in new_items.md.
 * Standalone desk — the recruit "chair+desk" workstation is now
 * built from a paired (office_desk, basic_chair) entry in the ITEMS
 * array, not a composite mesh.
 * Wider top, taller legs, more substantial silhouette. */
function OfficeDesk({ unlocked }: { unlocked: boolean }) {
  // Raised desk-top from y=0.55 → y=0.85 (about a standing-desk
  // height bump). Legs lengthened to match; modesty panel and laptop
  // shifted up so they ride on the new top surface.
  return (
    <group>
      {/* Desk top — wider and thicker; sits higher */}
      <mesh position={[0, 0.85, 0]}>
        <boxGeometry args={[2.0, 0.09, 0.95]} />
        <M color="#5a3a1a" unlocked={unlocked} />
      </mesh>
      {/* Four sturdy legs — longer to support the raised top */}
      {([-0.9, 0.9] as number[]).flatMap(dx =>
        ([-0.4, 0.4] as number[]).map(dz => (
          <mesh key={`${dx}${dz}`} position={[dx, 0.4, dz]}>
            <boxGeometry args={[0.1, 0.85, 0.1]} />
            <M color="#3a2a14" unlocked={unlocked} />
          </mesh>
        ))
      )}
      {/* Front modesty panel — taller, follows the new top */}
      <mesh position={[0, 0.55, -0.4]}>
        <boxGeometry args={[1.9, 0.6, 0.05]} />
        <M color="#4a3018" unlocked={unlocked} />
      </mesh>
      {/* Laptop on top — shifted up to ride the new desk-top */}
      <mesh position={[0, 0.93, 0.05]}>
        <boxGeometry args={[0.55, 0.025, 0.38]} />
        <M color="#1a1a1a" unlocked={unlocked} />
      </mesh>
      <mesh position={[0, 1.08, -0.13]} rotation={[-Math.PI * 0.15, 0, 0]}>
        <boxGeometry args={[0.55, 0.36, 0.025]} />
        <M color="#0a0a0a" unlocked={unlocked} emissive="#3a5cff" emissiveIntensity={0.35} />
      </mesh>
    </group>
  )
}

/* F6 — "+ one extra chair", per spec a high-back leather executive
 * chair (giám đốc style). Five-arm wheeled base, padded seat, tall
 * padded backrest with two armrests. Distinct from BasicChair so the
 * F6 unlock reads as a real upgrade rather than just "another stool". */
function ExecutiveChair({ unlocked }: { unlocked: boolean }) {
  return (
    <group>
      {/* Five-arm base — radiating thin boxes from a central hub */}
      {[0, 72, 144, 216, 288].map(deg => {
        const rad = (deg * Math.PI) / 180
        return (
          <mesh
            key={deg}
            position={[Math.sin(rad) * 0.15, 0.04, Math.cos(rad) * 0.15]}
            rotation={[0, rad, 0]}
          >
            <boxGeometry args={[0.06, 0.04, 0.3]} />
            <M color="#0a0a0a" unlocked={unlocked} />
          </mesh>
        )
      })}
      {/* Caster wheels at each base tip */}
      {[0, 72, 144, 216, 288].map(deg => {
        const rad = (deg * Math.PI) / 180
        return (
          <mesh
            key={`wheel-${deg}`}
            position={[Math.sin(rad) * 0.3, 0.04, Math.cos(rad) * 0.3]}
          >
            <cylinderGeometry args={[0.035, 0.035, 0.04, 8]} />
            <M color="#1a1a1a" unlocked={unlocked} />
          </mesh>
        )
      })}
      {/* Central hub */}
      <mesh position={[0, 0.08, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 0.04, 10]} />
        <M color="#1a1a1a" unlocked={unlocked} />
      </mesh>
      {/* Vertical pneumatic post */}
      <mesh position={[0, 0.3, 0]}>
        <cylinderGeometry args={[0.035, 0.04, 0.4, 10]} />
        <M color="#2a2a2a" unlocked={unlocked} />
      </mesh>
      {/* Seat cushion — wide & plush */}
      <mesh position={[0, 0.55, 0]}>
        <boxGeometry args={[0.55, 0.12, 0.5]} />
        <M color="#0a0a0a" unlocked={unlocked} />
      </mesh>
      {/* Seat top quilted highlight (slightly lighter band) */}
      <mesh position={[0, 0.62, 0]}>
        <boxGeometry args={[0.5, 0.005, 0.45]} />
        <M color="#1a1a1a" unlocked={unlocked} />
      </mesh>
      {/* Tall backrest — high-back leather */}
      <mesh position={[0, 0.95, -0.22]}>
        <boxGeometry args={[0.5, 0.8, 0.12]} />
        <M color="#0a0a0a" unlocked={unlocked} />
      </mesh>
      {/* Headrest cap on top of backrest */}
      <mesh position={[0, 1.4, -0.22]}>
        <boxGeometry args={[0.5, 0.12, 0.14]} />
        <M color="#0a0a0a" unlocked={unlocked} />
      </mesh>
      {/* Vertical leather panel lines on the backrest for texture */}
      {[-0.12, 0, 0.12].map(dx => (
        <mesh key={`stitch-${dx}`} position={[dx, 0.95, -0.155]}>
          <boxGeometry args={[0.012, 0.7, 0.01]} />
          <M color="#1a1a1a" unlocked={unlocked} />
        </mesh>
      ))}
      {/* Armrests — left + right padded blocks */}
      {([-0.32, 0.32] as number[]).map(dx => (
        <group key={`arm-${dx}`}>
          {/* Vertical arm stem from seat */}
          <mesh position={[dx, 0.7, -0.05]}>
            <boxGeometry args={[0.05, 0.2, 0.08]} />
            <M color="#1a1a1a" unlocked={unlocked} />
          </mesh>
          {/* Padded arm top */}
          <mesh position={[dx, 0.82, 0.0]}>
            <boxGeometry args={[0.07, 0.05, 0.35]} />
            <M color="#0a0a0a" unlocked={unlocked} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

/* F2 — standalone basic chair (the "+ basic chair" unlock). Pairs
 * 1-to-1 with office_desk via matching offsetStep in the ITEMS array
 * so each F2/F3/F5 unlock reads as a complete "basic chair + desk"
 * workstation. F6's extra chair is the separate ExecutiveChair item
 * above (not another basic_chair). */
function BasicChair({ unlocked }: { unlocked: boolean }) {
  return (
    <group>
      {/* Seat */}
      <mesh position={[0, 0.3, 0]}>
        <boxGeometry args={[0.45, 0.06, 0.45]} />
        <M color="#3a2a1a" unlocked={unlocked} />
      </mesh>
      {/* Backrest */}
      <mesh position={[0, 0.6, -0.2]}>
        <boxGeometry args={[0.45, 0.55, 0.06]} />
        <M color="#3a2a1a" unlocked={unlocked} />
      </mesh>
      {/* Four legs */}
      {([-0.18, 0.18] as number[]).flatMap(dx =>
        ([-0.18, 0.18] as number[]).map(dz => (
          <mesh key={`${dx}${dz}`} position={[dx, 0.15, dz]}>
            <boxGeometry args={[0.06, 0.3, 0.06]} />
            <M color="#2a1a0a" unlocked={unlocked} />
          </mesh>
        ))
      )}
    </group>
  )
}

function PottedPlant({ unlocked }: { unlocked: boolean }) {
  // Scaled ~1.8× from the original so it reads as a proper office
  // floor plant rather than a desk succulent. Wider terracotta pot,
  // taller layered foliage, plus a second leafy cluster spilling to
  // the side to break up the silhouette.
  return (
    <group>
      {/* Pot — wider and taller terracotta */}
      <mesh position={[0, 0.28, 0]}>
        <cylinderGeometry args={[0.32, 0.22, 0.56, 12]} />
        <M color="#8B4513" unlocked={unlocked} />
      </mesh>
      {/* Rim ring on top of pot */}
      <mesh position={[0, 0.56, 0]}>
        <torusGeometry args={[0.32, 0.04, 6, 16]} />
        <M color="#6a3010" unlocked={unlocked} />
      </mesh>
      {/* Main foliage — large sphere */}
      <mesh position={[0, 0.95, 0]}>
        <sphereGeometry args={[0.5, 10, 8]} />
        <M color="#3a7a22" unlocked={unlocked} />
      </mesh>
      {/* Mid-tone secondary cluster */}
      <mesh position={[0.25, 1.15, 0.18]}>
        <sphereGeometry args={[0.36, 10, 8]} />
        <M color="#52a032" unlocked={unlocked} />
      </mesh>
      {/* Brighter top cluster — gives a highlight tier */}
      <mesh position={[-0.15, 1.35, -0.05]}>
        <sphereGeometry args={[0.3, 10, 8]} />
        <M color="#83c45c" unlocked={unlocked} />
      </mesh>
      {/* A few drooping leaves spilling out of the pot */}
      <mesh position={[-0.35, 0.7, 0.2]} rotation={[0.4, 0.2, 0.3]}>
        <sphereGeometry args={[0.22, 8, 6]} />
        <M color="#3a7a22" unlocked={unlocked} />
      </mesh>
    </group>
  )
}

function CoffeeMug({ unlocked }: { unlocked: boolean }) {
  return (
    <group>
      <mesh position={[0, 0.09, 0]}>
        <cylinderGeometry args={[0.08, 0.07, 0.18, 12]} />
        <M color="#f5f0e8" unlocked={unlocked} />
      </mesh>
      <mesh position={[0.1, 0.09, 0]}>
        <torusGeometry args={[0.05, 0.015, 8, 12, Math.PI]} />
        <M color="#f5f0e8" unlocked={unlocked} />
      </mesh>
      <mesh position={[0, 0.17, 0]}>
        <cylinderGeometry args={[0.07, 0.07, 0.01, 12]} />
        <M color="#3a2a1a" unlocked={unlocked} />
      </mesh>
    </group>
  )
}

function Bookshelf({ unlocked }: { unlocked: boolean }) {
  const bookColors = ['#c0392b', '#2980b9', '#27ae60', '#e67e22', '#8e44ad', '#2c3e50', '#d35400', '#16a085']
  return (
    <group>
      <mesh>
        <boxGeometry args={[1.8, 2.6, 0.15]} />
        <M color="#5a3a1a" unlocked={unlocked} />
      </mesh>
      {[0.7, 0, -0.7].map((y, si) => (
        <mesh key={si} position={[0, y, 0.08]}>
          <boxGeometry args={[1.8, 0.06, 0.3]} />
          <M color="#7a5a2a" unlocked={unlocked} />
        </mesh>
      ))}
      {[0.7, 0, -0.7].map((shelfY, si) =>
        bookColors.slice(si * 2, si * 2 + 4).map((color, bi) => (
          <mesh key={`b${si}-${bi}`} position={[-0.6 + bi * 0.22, shelfY + 0.18, 0.13]}>
            <boxGeometry args={[0.17, 0.3, 0.18]} />
            <M color={color} unlocked={unlocked} />
          </mesh>
        ))
      )}
    </group>
  )
}

function Printer({ unlocked }: { unlocked: boolean }) {
  // Bigger floor-standing printer (was a tiny desk-top unit). The
  // new silhouette is ~2× the old one in every axis and adds a paper
  // tray + control LCD + green status LED for visual texture so it
  // reads as a real office multi-function printer.
  return (
    <group>
      {/* Main body — wider, taller, deeper */}
      <mesh position={[0, 0.45, 0]}>
        <boxGeometry args={[1.0, 0.9, 0.85]} />
        <M color="#2a2a2a" unlocked={unlocked} />
      </mesh>
      {/* Lid / paper-output tray on top — recessed paper landing pad */}
      <mesh position={[0, 0.92, 0.05]}>
        <boxGeometry args={[0.95, 0.05, 0.55]} />
        <M color="#3a3a3a" unlocked={unlocked} />
      </mesh>
      {/* Paper sheet sitting in the output tray */}
      <mesh position={[0, 0.955, 0.05]}>
        <boxGeometry args={[0.6, 0.005, 0.42]} />
        <M color="#f5f5f5" unlocked={unlocked} />
      </mesh>
      {/* Front control panel (light strip across the front face) */}
      <mesh position={[0, 0.78, 0.43]}>
        <boxGeometry args={[0.9, 0.16, 0.02]} />
        <M color="#1a1a1a" unlocked={unlocked} />
      </mesh>
      {/* LCD display inset into the control panel */}
      <mesh position={[-0.15, 0.78, 0.44]}>
        <boxGeometry args={[0.32, 0.1, 0.01]} />
        <M color="#2cc18e" unlocked={unlocked} emissive="#2cc18e" emissiveIntensity={0.55} />
      </mesh>
      {/* Front paper-feed tray slot (input drawer) */}
      <mesh position={[0, 0.4, 0.44]}>
        <boxGeometry args={[0.7, 0.18, 0.04]} />
        <M color="#1a1a1a" unlocked={unlocked} />
      </mesh>
      {/* Lower body / base plinth */}
      <mesh position={[0, 0.06, 0]}>
        <boxGeometry args={[1.02, 0.12, 0.87]} />
        <M color="#1a1a1a" unlocked={unlocked} />
      </mesh>
      {/* Green status LED in the top-right corner */}
      <mesh position={[0.4, 0.85, 0.44]}>
        <boxGeometry args={[0.06, 0.02, 0.02]} />
        <M color="#22c55e" unlocked={unlocked} emissive="#22c55e" emissiveIntensity={0.9} />
      </mesh>
    </group>
  )
}

function Whiteboard({ unlocked }: { unlocked: boolean }) {
  // Scribbled motto ("go unicorn this year") on the whiteboard — a
  // little visual joke tied to the F7 unlock. We render it as two
  // SDF text rows so the line wraps on narrow displays. `position.z`
  // sits just in front of the white panel (z=0.04) so it doesn't
  // z-fight with the board. Opacity follows the unlocked state so
  // ghosted previews still dim the text along with the rest.
  return (
    <group>
      {/* Mount to back wall — slightly raised position */}
      <mesh>
        <boxGeometry args={[2.2, 1.4, 0.06]} />
        <M color="#3a2a1a" unlocked={unlocked} />
      </mesh>
      <mesh position={[0, 0, 0.04]}>
        <planeGeometry args={[2.05, 1.25]} />
        <M color="#f8f8f0" unlocked={unlocked} />
      </mesh>
      <Text
        position={[0, 0.15, 0.06]}
        fontSize={0.22}
        maxWidth={1.9}
        textAlign="center"
        color="#1a3a8a"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.005}
        outlineColor="#0a1a4a"
        fillOpacity={unlocked ? 1 : LOCKED_OPACITY}
        renderOrder={1}
      >
        go unicorn{'\n'}this year
      </Text>
      {/* Decorative underline doodle in marker red, evoking a
          handwritten emphasis stroke under the motto. */}
      <mesh position={[0, -0.32, 0.055]}>
        <boxGeometry args={[1.2, 0.025, 0.005]} />
        <M color="#d33b3b" unlocked={unlocked} emissive="#d33b3b" emissiveIntensity={0.4} />
      </mesh>
      {/* Marker tray */}
      <mesh position={[0, -0.72, 0.06]}>
        <boxGeometry args={[2.05, 0.05, 0.1]} />
        <M color="#3a2a1a" unlocked={unlocked} />
      </mesh>
    </group>
  )
}

function MiniFridge({ unlocked }: { unlocked: boolean }) {
  return (
    <group>
      <mesh position={[0, 0.55, 0]}>
        <boxGeometry args={[0.7, 1.1, 0.55]} />
        <M color="#e5e5e5" unlocked={unlocked} />
      </mesh>
      <mesh position={[0, 0.6, 0.28]}>
        <boxGeometry args={[0.6, 0.95, 0.02]} />
        <M color="#cccccc" unlocked={unlocked} />
      </mesh>
      <mesh position={[0.22, 0.62, 0.3]}>
        <boxGeometry args={[0.05, 0.18, 0.03]} />
        <M color="#888" unlocked={unlocked} />
      </mesh>
    </group>
  )
}

function Trophy({ unlocked }: { unlocked: boolean }) {
  // Bumped another 30% over the previous size — F11 trophy is meant
  // to read clearly as an "achievement" item from across the room,
  // and at the old scale it was getting lost on the bookshelf right
  // next to it. We do the bump via `<group scale>` rather than
  // rewriting each cylinder/box, which keeps the proportions and
  // shelf-relative anchor intact.
  return (
    <group scale={1.3}>
      {/* Base — wider, thicker plinth */}
      <mesh position={[0, 0.06, 0]}>
        <boxGeometry args={[0.46, 0.12, 0.46]} />
        <M color="#4a3520" unlocked={unlocked} />
      </mesh>
      {/* Stem */}
      <mesh position={[0, 0.28, 0]}>
        <cylinderGeometry args={[0.07, 0.07, 0.3, 8]} />
        <M color="#c89f4a" unlocked={unlocked} emissive="#c89f4a" emissiveIntensity={0.35} />
      </mesh>
      {/* Cup */}
      <mesh position={[0, 0.58, 0]}>
        <cylinderGeometry args={[0.26, 0.17, 0.46, 12]} />
        <M color="#fbbf24" unlocked={unlocked} emissive="#fbbf24" emissiveIntensity={0.55} />
      </mesh>
      {/* Handles (small loops on each side of the cup) */}
      <mesh position={[-0.28, 0.58, 0]} rotation={[0, 0, Math.PI / 2]}>
        <torusGeometry args={[0.12, 0.025, 6, 12, Math.PI]} />
        <M color="#fbbf24" unlocked={unlocked} emissive="#fbbf24" emissiveIntensity={0.45} />
      </mesh>
      <mesh position={[0.28, 0.58, 0]} rotation={[0, Math.PI, Math.PI / 2]}>
        <torusGeometry args={[0.12, 0.025, 6, 12, Math.PI]} />
        <M color="#fbbf24" unlocked={unlocked} emissive="#fbbf24" emissiveIntensity={0.45} />
      </mesh>
    </group>
  )
}

function Couch({ unlocked }: { unlocked: boolean }) {
  return (
    <group>
      <mesh position={[0, 0.28, 0]}>
        <boxGeometry args={[1.6, 0.32, 0.7]} />
        <M color="#4a90d9" unlocked={unlocked} />
      </mesh>
      <mesh position={[0, 0.55, -0.3]}>
        <boxGeometry args={[1.6, 0.5, 0.18]} />
        <M color="#5fa3ec" unlocked={unlocked} />
      </mesh>
      <mesh position={[-0.7, 0.5, 0]}>
        <boxGeometry args={[0.18, 0.5, 0.7]} />
        <M color="#3a82cf" unlocked={unlocked} />
      </mesh>
      <mesh position={[0.7, 0.5, 0]}>
        <boxGeometry args={[0.18, 0.5, 0.7]} />
        <M color="#3a82cf" unlocked={unlocked} />
      </mesh>
    </group>
  )
}

/* F12 "Upgraded dark wood desk" — geometrically IDENTICAL to
 * OfficeDesk (same top, apron rails, legs, laptop, and tilted
 * screen). The only difference is wood colour: deep walnut instead
 * of the warm brown OfficeDesk uses. Per user spec, "dark wood
 * desk = just change colour, size + items same as office desk". */
function UpgradedDesk({ unlocked }: { unlocked: boolean }) {
  // Dark walnut palette — keep the relative tonal steps (top lightest,
  // legs darkest) the same as OfficeDesk so the proportions read
  // identically; only the absolute hue shifts toward black-brown.
  const TOP = '#2a1a0a'
  const APRON = '#1f1408'
  const LEG = '#140a00'
  return (
    <group>
      {/* Desk top — same dimensions / Y as OfficeDesk */}
      <mesh position={[0, 0.85, 0]}>
        <boxGeometry args={[2.0, 0.09, 0.95]} />
        <M color={TOP} unlocked={unlocked} />
      </mesh>
      {/* Four sturdy legs */}
      {([-0.9, 0.9] as number[]).flatMap(dx =>
        ([-0.4, 0.4] as number[]).map(dz => (
          <mesh key={`${dx}${dz}`} position={[dx, 0.4, dz]}>
            <boxGeometry args={[0.1, 0.85, 0.1]} />
            <M color={LEG} unlocked={unlocked} />
          </mesh>
        ))
      )}
      {/* Front modesty panel */}
      <mesh position={[0, 0.55, -0.4]}>
        <boxGeometry args={[1.9, 0.6, 0.05]} />
        <M color={APRON} unlocked={unlocked} />
      </mesh>
      {/* Laptop on top — identical to OfficeDesk (laptops aren't
          "upgraded" at F12, only the desk wood is). */}
      <mesh position={[0, 0.93, 0.05]}>
        <boxGeometry args={[0.55, 0.025, 0.38]} />
        <M color="#1a1a1a" unlocked={unlocked} />
      </mesh>
      <mesh position={[0, 1.08, -0.13]} rotation={[-Math.PI * 0.15, 0, 0]}>
        <boxGeometry args={[0.55, 0.36, 0.025]} />
        <M color="#0a0a0a" unlocked={unlocked} emissive="#3a5cff" emissiveIntensity={0.35} />
      </mesh>
    </group>
  )
}

function NeonSign({ unlocked }: { unlocked: boolean }) {
  // Per spec: "đèn led trên tường, hoạ tiết là 1 toà nhà có ánh đèn led"
  // (LED neon on the wall, depicting a building with LED windows).
  // Construction: a dark base plate (the sign panel) + a tall stepped
  // building silhouette built from coloured cyan rectangles + a grid
  // of small emissive squares acting as lit windows.
  const winRows = 7
  const winCols = 5
  const windows: { x: number; y: number; lit: boolean }[] = []
  for (let r = 0; r < winRows; r++) {
    for (let c = 0; c < winCols; c++) {
      const x = (c - (winCols - 1) / 2) * 0.11
      const y = (r - (winRows - 1) / 2) * 0.11
      // Deterministic-looking "random" lit/dim pattern so it animates
      // visually but stays stable across renders.
      const seed = (r * 7 + c * 13) % 11
      windows.push({ x, y, lit: seed > 3 })
    }
  }
  return (
    <group>
      {/* Backing panel (dark sign body, mounted to wall) */}
      <mesh position={[0, 0, -0.05]}>
        <planeGeometry args={[1.1, 1.2]} />
        <M color="#1a0030" unlocked={unlocked} />
      </mesh>
      {/* Building outline — three stacked blocks of decreasing width
          give the classic "stepped skyscraper" silhouette. */}
      <mesh position={[0, -0.3, -0.02]}>
        <planeGeometry args={[0.85, 0.32]} />
        <M color="#06b6d4" unlocked={unlocked} emissive="#06b6d4" emissiveIntensity={0.55} />
      </mesh>
      <mesh position={[0, -0.02, -0.02]}>
        <planeGeometry args={[0.65, 0.26]} />
        <M color="#06b6d4" unlocked={unlocked} emissive="#06b6d4" emissiveIntensity={0.55} />
      </mesh>
      <mesh position={[0, 0.22, -0.02]}>
        <planeGeometry args={[0.42, 0.22]} />
        <M color="#06b6d4" unlocked={unlocked} emissive="#06b6d4" emissiveIntensity={0.55} />
      </mesh>
      {/* Antenna / spire on top */}
      <mesh position={[0, 0.42, -0.02]}>
        <planeGeometry args={[0.04, 0.18]} />
        <M color="#22d3ee" unlocked={unlocked} emissive="#22d3ee" emissiveIntensity={0.8} />
      </mesh>
      {/* Grid of "LED windows" overlaid on the silhouette. Each lit
          window is a small bright emissive square; unlit ones are
          dimmer to read as off-hours. */}
      {windows.map((w, i) => (
        <mesh key={i} position={[w.x, w.y, 0]}>
          <planeGeometry args={[0.05, 0.05]} />
          <M
            color={w.lit ? '#fde68a' : '#3a2050'}
            unlocked={unlocked}
            emissive={w.lit ? '#fde68a' : '#000000'}
            emissiveIntensity={w.lit ? 1.0 : 0}
          />
        </mesh>
      ))}
    </group>
  )
}

export function ArcadeMachine({ unlocked }: { unlocked: boolean }) {
  // Minifigure-sized arcade cabinet — ~1.7 tall (matches the
  // minifigure silhouette from feet to top-of-hair) and ~0.85 wide,
  // so it reads as a "stand up and play it" object, not a wall
  // accent. The position in ITEMS has been moved from the back wall
  // to the front-of-room lounge area so it sits alongside the couch
  // + tea table cluster — the new arcade is closer to the camera
  // and well clear of the workstation strip.
  return (
    <group>
      {/* Cabinet body */}
      <mesh position={[0, 0.85, 0]}>
        <boxGeometry args={[0.85, 1.7, 0.65]} />
        <M color="#7c3aed" unlocked={unlocked} />
      </mesh>
      {/* Marquee — glowing top band, classic arcade title-light */}
      <mesh position={[0, 1.6, 0]}>
        <boxGeometry args={[0.87, 0.22, 0.66]} />
        <M color="#a855f7" unlocked={unlocked} emissive="#c084fc" emissiveIntensity={0.55} />
      </mesh>
      {/* Front face — recessed dark housing behind the wheel. */}
      <mesh position={[0, 1.15, 0.33]}>
        <boxGeometry args={[0.72, 0.58, 0.02]} />
        <M color="#2a1a3a" unlocked={unlocked} />
      </mesh>
      {/* ── SPIN WHEEL on the front — the differentiator from a plain
          arcade screen. A gold-rimmed disc split into 7 coloured pie
          slices (circleGeometry thetaStart/thetaLength), a hub, and a
          downward pointer at the top. */}
      {/* Gold rim backing */}
      <mesh position={[0, 1.15, 0.342]}>
        <circleGeometry args={[0.265, 28]} />
        <M color="#fbbf24" unlocked={unlocked} emissive="#fbbf24" emissiveIntensity={0.4} />
      </mesh>
      {/* 7 pie slices */}
      {(['#9F8BFF', '#4c3a8c', '#6d4bd8', '#8b5cf6', '#a78bfa', '#1f2147', '#fbbf24'] as const).map(
        (col, i) => {
          const slice = (Math.PI * 2) / 7
          return (
            <mesh key={i} position={[0, 1.15, 0.346]}>
              <circleGeometry args={[0.24, 24, i * slice, slice]} />
              <M color={col} unlocked={unlocked} emissive={col} emissiveIntensity={0.35} />
            </mesh>
          )
        },
      )}
      {/* Hub */}
      <mesh position={[0, 1.15, 0.35]}>
        <circleGeometry args={[0.045, 16]} />
        <M color="#fbbf24" unlocked={unlocked} emissive="#fbbf24" emissiveIntensity={0.5} />
      </mesh>
      {/* Pointer — small triangle at the top of the wheel, tip pointing
          down into it. */}
      <mesh position={[0, 1.42, 0.36]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[0.04, 0.08, 3]} />
        <M color="#fbbf24" unlocked={unlocked} emissive="#fbbf24" emissiveIntensity={0.6} />
      </mesh>
      {/* Control deck — flat slab protruding from the front face at
          waist height (where the player stands). */}
      <mesh position={[0, 0.78, 0.46]}>
        <boxGeometry args={[0.78, 0.08, 0.22]} />
        <M color="#3a2a1a" unlocked={unlocked} />
      </mesh>
      {/* Joystick — post + red ball, left side of the deck */}
      <mesh position={[-0.2, 0.86, 0.48]}>
        <cylinderGeometry args={[0.018, 0.018, 0.08, 8]} />
        <M color="#1a1a2e" unlocked={unlocked} />
      </mesh>
      <mesh position={[-0.2, 0.93, 0.48]}>
        <sphereGeometry args={[0.04, 10, 10]} />
        <M color="#d33b3b" unlocked={unlocked} emissive="#d33b3b" emissiveIntensity={0.4} />
      </mesh>
      {/* Two action buttons (yellow + cyan) on the right of the deck */}
      <mesh position={[0.05, 0.83, 0.48]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 0.018, 12]} />
        <M color="#fbbf24" unlocked={unlocked} emissive="#fbbf24" emissiveIntensity={0.45} />
      </mesh>
      <mesh position={[0.18, 0.83, 0.48]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 0.018, 12]} />
        <M color="#22d3ee" unlocked={unlocked} emissive="#22d3ee" emissiveIntensity={0.45} />
      </mesh>
      {/* Coin slot below the control deck */}
      <mesh position={[0, 0.48, 0.33]}>
        <boxGeometry args={[0.1, 0.04, 0.015]} />
        <M color="#1a1a2e" unlocked={unlocked} />
      </mesh>
    </group>
  )
}

function FloorCeilingWindows({ unlocked }: { unlocked: boolean }) {
  // Narrower decor (2.4 wide vs old 3.5) so it fits the right-of-window
  // strip (x ∈ [5, 7.4]) without overlapping the back-wall window cut-out
  // (which lives at x ∈ [2, 5]).
  return (
    <group>
      <mesh>
        <planeGeometry args={[2.4, 4.5]} />
        <M color="#101830" unlocked={unlocked} emissive="#5580c0" emissiveIntensity={0.3} />
      </mesh>
      {/* Frames */}
      <mesh position={[0, 0, 0.02]}>
        <boxGeometry args={[2.4, 0.08, 0.06]} />
        <M color="#1a1a2e" unlocked={unlocked} />
      </mesh>
      <mesh position={[-1.15, 0, 0.02]}>
        <boxGeometry args={[0.08, 4.5, 0.06]} />
        <M color="#1a1a2e" unlocked={unlocked} />
      </mesh>
      <mesh position={[1.15, 0, 0.02]}>
        <boxGeometry args={[0.08, 4.5, 0.06]} />
        <M color="#1a1a2e" unlocked={unlocked} />
      </mesh>
    </group>
  )
}

function LivingWall({ unlocked }: { unlocked: boolean }) {
  return (
    <group>
      <mesh>
        <planeGeometry args={[2.2, 2.4]} />
        <M color="#2d5a1b" unlocked={unlocked} />
      </mesh>
      {Array.from({ length: 18 }, (_, i) => {
        const x = (i % 6 - 2.5) * 0.35
        const y = (Math.floor(i / 6) - 1) * 0.6
        return (
          <mesh key={i} position={[x, y, 0.04]}>
            <sphereGeometry args={[0.18, 8, 6]} />
            <M color={i % 3 === 0 ? '#3a7a22' : i % 3 === 1 ? '#52a032' : '#83c45c'} unlocked={unlocked} />
          </mesh>
        )
      })}
    </group>
  )
}

function EspressoMachine({ unlocked }: { unlocked: boolean }) {
  // F18 "Espresso machine + coffee area" — redesigned per the
  // reference screenshot the user provided. This is no longer a
  // single counter-top machine: it's a TALL custom coffee bar with
  // four visual tiers:
  //
  //   1. Lower cabinet      (y 0   → 1.0)  — dark wood box with two
  //                                          glass-fronted compartments
  //                                          showing bottles inside.
  //   2. Mid counter        (y 1.0 → 1.1)  — wood plank with milk
  //                                          pitcher + cups.
  //   3. Espresso section   (y 1.1 → 1.7)  — back panel + the actual
  //                                          espresso machine.
  //   4. Top shelf          (y 1.9 → 2.4)  — open shelf with bottles
  //                                          / jars, capped by a wood
  //                                          crown.
  //
  // The whole footprint is 1.4 (x) × 0.6 (z) so it slots into the
  // back-wall strip without crowding the mini fridge to its left.
  const cabinetW = 1.4
  const cabinetD = 0.6
  return (
    <group>
      {/* ── Tier 1: lower cabinet body ─────────────────────────── */}
      <mesh position={[0, 0.5, 0]}>
        <boxGeometry args={[cabinetW, 1.0, cabinetD]} />
        <M color="#e8e0d4" unlocked={unlocked} />
      </mesh>
      {/* Two glass-fronted display compartments (panes on the front
          face). Slightly emissive so the "lit cabinet interior" reads
          even in low light. */}
      {([-0.32, 0.32] as number[]).map(dx => (
        <mesh key={`pane-${dx}`} position={[dx, 0.6, cabinetD / 2 + 0.001]}>
          <planeGeometry args={[0.52, 0.7]} />
          <M
            color="#a8c8e8"
            unlocked={unlocked}
            emissive="#a8c8e8"
            emissiveIntensity={0.18}
          />
        </mesh>
      ))}
      {/* Decorative bottles INSIDE the display panes (one per pane) */}
      {([-0.4, -0.24, 0.24, 0.4] as number[]).map((dx, i) => (
        <mesh
          key={`bottle-${i}`}
          position={[dx, 0.45 + (i % 2) * 0.08, cabinetD / 2 - 0.05]}
        >
          <cylinderGeometry args={[0.04, 0.04, 0.2 + (i % 2) * 0.05, 8]} />
          <M
            color={i % 2 === 0 ? '#7a3010' : '#2c5530'}
            unlocked={unlocked}
            emissive={i % 2 === 0 ? '#7a3010' : '#2c5530'}
            emissiveIntensity={0.25}
          />
        </mesh>
      ))}
      {/* Vertical frame strips between the two compartments */}
      <mesh position={[0, 0.6, cabinetD / 2 + 0.002]}>
        <boxGeometry args={[0.04, 0.78, 0.03]} />
        <M color="#3a2a1a" unlocked={unlocked} />
      </mesh>

      {/* ── Tier 2: mid counter top (wood plank) ──────────────── */}
      <mesh position={[0, 1.04, 0]}>
        <boxGeometry args={[cabinetW + 0.04, 0.07, cabinetD + 0.04]} />
        <M color="#6a4520" unlocked={unlocked} />
      </mesh>
      {/* Milk pitcher (small frothing jug) on the counter */}
      <mesh position={[-0.45, 1.18, 0.05]}>
        <cylinderGeometry args={[0.07, 0.085, 0.18, 10]} />
        <M color="#c8c8c8" unlocked={unlocked} />
      </mesh>
      <mesh position={[-0.35, 1.18, 0.05]} rotation={[0, 0, Math.PI / 2]}>
        <torusGeometry args={[0.04, 0.012, 6, 10, Math.PI]} />
        <M color="#a0a0a0" unlocked={unlocked} />
      </mesh>
      {/* Two espresso cups on the counter */}
      {([0.3, 0.45] as number[]).map(dx => (
        <group key={dx} position={[dx, 1.1, 0.05]}>
          <mesh>
            <cylinderGeometry args={[0.04, 0.035, 0.06, 10]} />
            <M color="#f5f0e8" unlocked={unlocked} />
          </mesh>
          <mesh position={[0, 0.031, 0]}>
            <cylinderGeometry args={[0.035, 0.035, 0.005, 10]} />
            <M color="#3a2a1a" unlocked={unlocked} />
          </mesh>
        </group>
      ))}

      {/* ── Tier 3: back panel + espresso machine ─────────────── */}
      {/* Tall back panel that the machine + shelf attach to */}
      <mesh position={[0, 1.55, -cabinetD / 2 + 0.025]}>
        <boxGeometry args={[cabinetW, 0.95, 0.05]} />
        <M color="#e8e0d4" unlocked={unlocked} />
      </mesh>
      {/* The espresso machine itself — chrome top, dark body */}
      <mesh position={[0, 1.35, -0.05]}>
        <boxGeometry args={[0.55, 0.4, 0.35]} />
        <M color="#1a1a1a" unlocked={unlocked} />
      </mesh>
      {/* Steam wand on the right side */}
      <mesh position={[0.32, 1.4, 0.1]}>
        <cylinderGeometry args={[0.015, 0.015, 0.18, 6]} />
        <M color="#c0c0c0" unlocked={unlocked} />
      </mesh>
      {/* Portafilter (group head) on the front */}
      <mesh position={[0, 1.32, 0.18]}>
        <cylinderGeometry args={[0.06, 0.06, 0.08, 8]} />
        <M color="#c89f4a" unlocked={unlocked} emissive="#c89f4a" emissiveIntensity={0.4} />
      </mesh>
      {/* Small power/indicator LED */}
      <mesh position={[0.18, 1.5, 0.18]}>
        <boxGeometry args={[0.04, 0.02, 0.02]} />
        <M color="#22c55e" unlocked={unlocked} emissive="#22c55e" emissiveIntensity={0.9} />
      </mesh>

      {/* ── Tier 4: top open shelf with bottles ────────────────── */}
      {/* Shelf plank */}
      <mesh position={[0, 1.92, 0]}>
        <boxGeometry args={[cabinetW + 0.04, 0.06, cabinetD]} />
        <M color="#6a4520" unlocked={unlocked} />
      </mesh>
      {/* Bottles + jars lined up on the top shelf — variety of
          colours so it reads as a "shelf of supplies" at a glance. */}
      {[
        { x: -0.5, h: 0.32, c: '#3a5a8a' }, // syrup bottle
        { x: -0.28, h: 0.26, c: '#7a3010' }, // brown jar
        { x: -0.08, h: 0.34, c: '#c0a060' }, // amber bottle
        { x: 0.14, h: 0.22, c: '#e8e0d4' }, // white jar
        { x: 0.34, h: 0.3, c: '#2c5530' }, // green bottle
        { x: 0.54, h: 0.24, c: '#a8506a' }, // pink jar
      ].map((b, i) => (
        <mesh key={`top-bot-${i}`} position={[b.x, 1.95 + b.h / 2, 0]}>
          <cylinderGeometry args={[0.05, 0.06, b.h, 8]} />
          <M color={b.c} unlocked={unlocked} />
        </mesh>
      ))}
      {/* Crown plank — caps the unit so the bottles read as INSIDE a
          shelving niche rather than just sitting on top of a board. */}
      <mesh position={[0, 2.36, 0]}>
        <boxGeometry args={[cabinetW + 0.08, 0.1, cabinetD + 0.04]} />
        <M color="#5a3a1a" unlocked={unlocked} />
      </mesh>
      {/* Two thin back-of-shelf vertical accents (the dark uprights
          you can see in the reference). */}
      {([-(cabinetW / 2 - 0.03), cabinetW / 2 - 0.03] as number[]).map(dx => (
        <mesh key={`upr-${dx}`} position={[dx, 2.14, -cabinetD / 2 + 0.03]}>
          <boxGeometry args={[0.04, 0.4, 0.03]} />
          <M color="#3a2a1a" unlocked={unlocked} />
        </mesh>
      ))}
    </group>
  )
}

function PingPongTable({ unlocked }: { unlocked: boolean }) {
  return (
    <group>
      <mesh position={[0, 0.42, 0]}>
        <boxGeometry args={[2.4, 0.04, 1.2]} />
        <M color="#2980b9" unlocked={unlocked} />
      </mesh>
      <mesh position={[0, 0.5, 0]}>
        <boxGeometry args={[2.4, 0.15, 0.02]} />
        <M color="#ffffff" unlocked={unlocked} />
      </mesh>
      <mesh position={[0, 0.42, 0]}>
        <boxGeometry args={[2.4, 0.005, 0.04]} />
        <M color="#ffffff" unlocked={unlocked} />
      </mesh>
      {([-1.05, 1.05] as number[]).flatMap(dx =>
        ([-0.5, 0.5] as number[]).map(dz => (
          <mesh key={`${dx}${dz}`} position={[dx, 0.2, dz]}>
            <boxGeometry args={[0.07, 0.4, 0.07]} />
            <M color="#1a1a1a" unlocked={unlocked} />
          </mesh>
        ))
      )}
    </group>
  )
}

/* F16 — Tea table. Wooden top on slim legs with a small ceramic
 * teapot + a teacup on the surface. (The laptop variant that used
 * to live here moved out per user feedback — this slot now reads
 * as an actual tea-serving station.) */
function TeaTable({ unlocked }: { unlocked: boolean }) {
  return (
    <group>
      {/* Desk top */}
      <mesh position={[0, 0.5, 0]}>
        <boxGeometry args={[1.4, 0.07, 0.7]} />
        <M color="#7a5230" unlocked={unlocked} />
      </mesh>
      {/* Side rails (front + back) for the "thicker apron" look */}
      <mesh position={[0, 0.42, -0.3]}>
        <boxGeometry args={[1.32, 0.06, 0.06]} />
        <M color="#5a3a1a" unlocked={unlocked} />
      </mesh>
      <mesh position={[0, 0.42, 0.3]}>
        <boxGeometry args={[1.32, 0.06, 0.06]} />
        <M color="#5a3a1a" unlocked={unlocked} />
      </mesh>
      {/* Four legs */}
      {([-0.6, 0.6] as number[]).flatMap(dx =>
        ([-0.28, 0.28] as number[]).map(dz => (
          <mesh key={`${dx}${dz}`} position={[dx, 0.23, dz]}>
            <boxGeometry args={[0.08, 0.5, 0.08]} />
            <M color="#4a3020" unlocked={unlocked} />
          </mesh>
        ))
      )}

      {/* ── Teapot — squat ceramic body, with spout / handle / lid ── */}
      {/* Body: short stout cylinder slightly wider at the middle */}
      <mesh position={[-0.25, 0.62, 0]}>
        <cylinderGeometry args={[0.13, 0.11, 0.18, 16]} />
        <M color="#f5f0e8" unlocked={unlocked} />
      </mesh>
      {/* Top shoulder (cap area where lid sits) */}
      <mesh position={[-0.25, 0.72, 0]}>
        <cylinderGeometry args={[0.08, 0.13, 0.04, 16]} />
        <M color="#f5f0e8" unlocked={unlocked} />
      </mesh>
      {/* Lid disc */}
      <mesh position={[-0.25, 0.755, 0]}>
        <cylinderGeometry args={[0.08, 0.08, 0.02, 16]} />
        <M color="#e8d4a8" unlocked={unlocked} />
      </mesh>
      {/* Lid knob */}
      <mesh position={[-0.25, 0.78, 0]}>
        <sphereGeometry args={[0.025, 8, 6]} />
        <M color="#5a3a1a" unlocked={unlocked} />
      </mesh>
      {/* Spout — angled cone pointing forward-left */}
      <mesh
        position={[-0.4, 0.66, 0.04]}
        rotation={[0, 0, Math.PI * 0.35]}
      >
        <cylinderGeometry args={[0.018, 0.035, 0.18, 8]} />
        <M color="#f5f0e8" unlocked={unlocked} />
      </mesh>
      {/* Handle — torus arc on the back side */}
      <mesh
        position={[-0.1, 0.63, 0]}
        rotation={[0, 0, Math.PI / 2]}
      >
        <torusGeometry args={[0.07, 0.018, 6, 14, Math.PI]} />
        <M color="#f5f0e8" unlocked={unlocked} />
      </mesh>
      {/* Decorative blue rim band around the pot */}
      <mesh position={[-0.25, 0.7, 0]}>
        <torusGeometry args={[0.13, 0.008, 6, 16]} />
        <M color="#3a5a8a" unlocked={unlocked} emissive="#3a5a8a" emissiveIntensity={0.2} />
      </mesh>

      {/* ── Teacup + saucer ─────────────────────────────────────── */}
      {/* Saucer (small flat disc) */}
      <mesh position={[0.32, 0.545, 0.05]}>
        <cylinderGeometry args={[0.1, 0.1, 0.012, 16]} />
        <M color="#f5f0e8" unlocked={unlocked} />
      </mesh>
      {/* Saucer rim ring */}
      <mesh position={[0.32, 0.552, 0.05]}>
        <torusGeometry args={[0.1, 0.006, 6, 16]} />
        <M color="#3a5a8a" unlocked={unlocked} />
      </mesh>
      {/* Cup body */}
      <mesh position={[0.32, 0.6, 0.05]}>
        <cylinderGeometry args={[0.07, 0.058, 0.09, 14]} />
        <M color="#f5f0e8" unlocked={unlocked} />
      </mesh>
      {/* Tea inside — dark amber disc near the top of the cup */}
      <mesh position={[0.32, 0.64, 0.05]}>
        <cylinderGeometry args={[0.06, 0.06, 0.005, 14]} />
        <M color="#7a4520" unlocked={unlocked} emissive="#7a4520" emissiveIntensity={0.15} />
      </mesh>
      {/* Cup handle — small torus on the side */}
      <mesh
        position={[0.4, 0.6, 0.05]}
        rotation={[0, 0, Math.PI / 2]}
      >
        <torusGeometry args={[0.035, 0.01, 6, 12, Math.PI]} />
        <M color="#f5f0e8" unlocked={unlocked} />
      </mesh>
    </group>
  )
}

/* F19 — DJ stand. Spec: replaces the old RooftopTerrace. Visual:
 * a low control booth with two glowing decks (turntables) and a
 * small lit display strip. */
function DJStand({ unlocked }: { unlocked: boolean }) {
  return (
    <group>
      {/* Booth body */}
      <mesh position={[0, 0.4, 0]}>
        <boxGeometry args={[1.6, 0.8, 0.6]} />
        <M color="#1a1a1a" unlocked={unlocked} />
      </mesh>
      {/* Console top */}
      <mesh position={[0, 0.82, 0]}>
        <boxGeometry args={[1.7, 0.05, 0.65]} />
        <M color="#2a2a2a" unlocked={unlocked} />
      </mesh>
      {/* Two turntable decks — flat discs with a small centre dot */}
      {([-0.45, 0.45] as number[]).map(dx => (
        <group key={dx} position={[dx, 0.86, 0]}>
          <mesh>
            <cylinderGeometry args={[0.22, 0.22, 0.02, 16]} />
            <M color="#0a0a0a" unlocked={unlocked} />
          </mesh>
          <mesh position={[0, 0.012, 0]}>
            <cylinderGeometry args={[0.03, 0.03, 0.015, 12]} />
            <M color="#e879f9" unlocked={unlocked} emissive="#e879f9" emissiveIntensity={0.8} />
          </mesh>
        </group>
      ))}
      {/* Centre mixer with glowing LED strip */}
      <mesh position={[0, 0.86, 0]}>
        <boxGeometry args={[0.4, 0.025, 0.5]} />
        <M color="#1a1a1a" unlocked={unlocked} />
      </mesh>
      <mesh position={[0, 0.875, 0.18]}>
        <boxGeometry args={[0.36, 0.015, 0.05]} />
        <M color="#22d3ee" unlocked={unlocked} emissive="#22d3ee" emissiveIntensity={1.0} />
      </mesh>
      {/* Front "DJ" facia panel with a subtle purple glow */}
      <mesh position={[0, 0.4, 0.31]}>
        <planeGeometry args={[1.4, 0.6]} />
        <M color="#2d1b4e" unlocked={unlocked} emissive="#7c3aed" emissiveIntensity={0.35} />
      </mesh>
    </group>
  )
}

function PenthouseCrown({ unlocked }: { unlocked: boolean }) {
  return (
    <group>
      <mesh position={[0, 0.4, 0]}>
        <coneGeometry args={[0.35, 0.5, 5]} />
        <M color="#fbbf24" unlocked={unlocked} emissive="#fbbf24" emissiveIntensity={0.7} />
      </mesh>
    </group>
  )
}

/* ── Layout ───────────────────────────────────────────────────── */

export interface ItemSpec {
  key: string
  /** Base position for the first instance. Multi-instance items (quantity > 1)
   *  are offset along `offsetStep` per additional copy. */
  position: [number, number, number]
  /** Offset added per extra instance when DB quantity > 1. Defaults to
   *  [1.8, 0, 0] (one desk-width along x). */
  offsetStep?: [number, number, number]
  render: (unlocked: boolean) => ReactNode
}

// Wall layout (z ≈ -5.3 plane). The back-wall window cut-out lives at
// x ∈ [2, 5], y ∈ [1.3, 3.5] — every wall-mounted item below sits
// outside that band so nothing overlaps the cityscape window. The
// company picture frame was doubled to 3.2×3.2 (see Walls.tsx
// CompanyFrame), so its reserved band stretches further than before.
//
//   x: [-7.5, -3.9]  → bookshelf + trophy
//   x: [-3.9, -0.7]  → company_picture_frame (drawn from Walls.tsx)
//                      reserved band y ∈ [0.6, 3.8]
//   x: [-0.5, 1.7]   → living_wall (lower) stacked under whiteboard (upper);
//                      both centred at x = 0.6
//   x: [2,   5]      → WINDOW (do not place items here)
//   x: [4.35, 5.25]  → neon_sign (above window, y > 3.7)
//   x: [5,   7.4]    → floor_ceiling_windows decor
// Exported so RoomArranger can iterate the same catalogue + render
// the same meshes. Treat as read-only at runtime.
export const ITEMS: ItemSpec[] = [
  // Positions below come straight out of /admin/items-editor →
  // requirements/positons.json (user-finalised layout). Don't free-
  // hand edit individual coordinates without going back through the
  // editor; the whole arrangement is calibrated as a unit.
  //
  // company_picture_frame is drawn by Walls.CompanyFrame (always
  // shown) and isn't listed here.
  // office_desk: multi-instance (up to qty 3 from F5+ per the new
  // spec). offsetStep `[1.8, 0, 0]` keeps the desks aligned along x
  // with desk-width spacing. At F12+ the seed sets quantity to 0
  // (desks are replaced by upgraded_desk below).
  {
    key: 'office_desk',
    position: [-4.12, -0.55, 1.43],
    offsetStep: [2.5, 0, 0],
    render: u => <OfficeDesk unlocked={u} />,
  },
  { key: 'floor_lamp',      position: [-5.89, -0.55, 3.69],  render: u => <FloorLamp unlocked={u} /> },
  // basic_chair: paired 1-for-1 with each office_desk (or
  // upgraded_desk from F12+). Same x-offsetStep so chair[N] sits
  // directly in front of desk[N]. Position is at z=0.11, ~1.3 in
  // front of the desks at z=1.43 — chair's natural -z backrest
  // means the chair faces +z (toward the desk) by default, no
  // rotation needed.
  {
    key: 'basic_chair',
    position: [-4.24, -0.55, 0.11],
    offsetStep: [2.5, 0, 0],
    render: u => <BasicChair unlocked={u} />,
  },
  // executive_chair: from F6+ this REPLACES every basic_chair (chair
  // upgrade, mirroring the F12 desk swap). Position + offsetStep
  // match basic_chair so all 3 director chairs render in the same
  // workstation slots the basic chairs vacate at F6.
  {
    key: 'executive_chair',
    position: [-4.24, -0.55, 0.11],
    offsetStep: [2.5, 0, 0],
    render: u => <ExecutiveChair unlocked={u} />,
  },
  { key: 'potted_plant',    position: [-5.16, -0.55, 5.48],  render: u => <PottedPlant unlocked={u} /> },
  { key: 'coffee_mug',      position: [-4.46,  0.47, 1.73],  render: u => <CoffeeMug unlocked={u} /> },
  { key: 'bookshelf',       position: [-5.80,  0.75, -5.30], render: u => <Bookshelf unlocked={u} /> },
  { key: 'printer',         position: [-3.30, -0.55, -4.84], render: u => <Printer unlocked={u} /> },
  // Wall-mounted items (z ≈ -5.3/-5.4): whiteboard, trophy, neon
  // sign, floor-ceiling windows, living wall, penthouse crown — keep
  // their Z low so they hug the back wall.
  { key: 'whiteboard',      position: [ 0.60,  2.60, -5.34], render: u => <Whiteboard unlocked={u} /> },
  { key: 'mini_fridge',     position: [ 4.42, -0.55, -4.93], render: u => <MiniFridge unlocked={u} /> },
  { key: 'trophy',          position: [-5.80,  2.45, -5.18], render: u => <Trophy unlocked={u} /> },
  { key: 'couch',           position: [ 5.11, -0.55, 3.73],  render: u => <Couch unlocked={u} /> },
  // upgraded_desk: takes over for office_desk at F12+ (the seed
  // sets office_desk qty to 0 at F12 and upgraded_desk qty to 3).
  // Same base position + offsetStep so the 3 dark-wood desks render
  // exactly where the 3 office desks used to be — visually a "skin
  // swap" of the workstations.
  {
    key: 'upgraded_desk',
    position: [-4.12, -0.55, 1.43],
    offsetStep: [2.5, 0, 0],
    render: u => <UpgradedDesk unlocked={u} />,
  },
  { key: 'neon_sign',       position: [ 0.69,  4.20, -5.29], render: u => <NeonSign unlocked={u} /> },
  // NOTE: `arcade_machine` is no longer a floor-gated decor item here.
  // It's the SPIN-WHEEL entry point, so it's rendered ALWAYS (from day
  // one, not unlocked at F14) as an interactive object — see
  // <SpinArcade3D> in OfficeScene.tsx (3D) and the always-on arcade in
  // Mobile2DScene.tsx (2D). Kept out of this gated list to avoid a
  // duplicate cabinet at F14+.
  { key: 'floor_ceiling_windows', position: [6.20, 1.90, -5.40], render: u => <FloorCeilingWindows unlocked={u} /> },
  { key: 'tea_table',       position: [ 3.01, -0.55, 3.75],  render: u => <TeaTable unlocked={u} /> },
  { key: 'living_wall',     position: [ 0.60,  0.50, -5.34], render: u => <LivingWall unlocked={u} /> },
  { key: 'espresso_machine', position: [ 6.00, -0.55, -4.50], render: u => <EspressoMachine unlocked={u} /> },
  { key: 'ping_pong_table', position: [ 5.10, -0.55, 5.17],  render: u => <PingPongTable unlocked={u} /> },
  { key: 'dj_stand',        position: [-2.40, -0.55, 5.57],  render: u => <DJStand unlocked={u} /> },
  { key: 'penthouse',       position: [-2.52,  4.20, -5.16], render: u => <PenthouseCrown unlocked={u} /> },
]

interface Props {
  currentFloor: number
  /** Per-user position overrides for the "Arrange your room" feature.
   *  Key shape:
   *    - `${itemKey}` — applies to a single-instance item OR the
   *      0-th instance of a multi-instance item if no per-instance
   *      override is set.
   *    - `${itemKey}_${index}` — explicit per-instance override
   *      (used for the multi-copy `basic_chair_desk` slots).
   *  Empty / undefined → use the canonical ITEMS positions. */
  positionOverrides?: Record<string, [number, number, number]>
  /** Floor-preview ghosting (tower-view): keys listed here render at
   *  LOCKED_OPACITY even when the floor config marks them unlocked. Used
   *  when a low-floor visitor peeks at a higher floor — items they
   *  haven't yet earned should appear ghosted previews. */
  ghostItemKeys?: ReadonlySet<string>
}

export function FloorItems({ currentFloor, positionOverrides, ghostItemKeys }: Props) {
  // PER-FLOOR semantic: each floor's row in floor_items lists exactly
  // the items that floor owns, with quantities. We trust that list
  // verbatim for the CURRENT floor (rendered at full opacity) and
  // peek at the NEXT floor's row so any item new to F+1 renders as
  // a translucent "preview" — same teaser pattern the old cumulative
  // version had, just rebuilt on top of the per-floor query.
  const floorItems = useFloorItems(currentFloor)
  const nextFloorItems = useFloorItems(currentFloor + 1)

  // itemKey → { unlocked, quantity }. Two passes:
  //   1. CURRENT floor items → marked unlocked, render at full opacity.
  //   2. NEXT floor items not on the current floor → marked preview,
  //      render at LOCKED_OPACITY (the `M` helper handles the dim).
  // The second pass `if (!info.has(it.key))` guard means items on
  // both floors stay unlocked (current beats preview).
  const itemInfo = useMemo(() => {
    const info = new Map<string, { unlocked: boolean; quantity: number }>()
    for (const it of floorItems) {
      info.set(it.key, { unlocked: true, quantity: it.quantity })
    }
    for (const it of nextFloorItems) {
      if (info.has(it.key)) continue
      info.set(it.key, { unlocked: false, quantity: it.quantity })
    }
    // Override unlocked → false for any item the caller wants ghosted
    // (tower-view floor preview, keys above the viewer's real floor).
    if (ghostItemKeys && ghostItemKeys.size > 0) {
      info.forEach((v, k) => {
        if (ghostItemKeys.has(k)) info.set(k, { ...v, unlocked: false })
      })
    }
    return info
  }, [floorItems, nextFloorItems, ghostItemKeys])

  return (
    <group>
      {ITEMS.map(it => {
        const hit = itemInfo.get(it.key)
        // Not configured for this floor OR the next → don't render.
        if (!hit || hit.quantity < 1) return null
        const offset = it.offsetStep ?? [1.8, 0, 0]
        // Per-instance position lookup with three-tier fallback:
        //   1. `${key}_${i}` override (multi-instance items get
        //      their own slot per copy)
        //   2. bare `${key}` override (single-instance items, or
        //      the 0-th copy when no per-instance override exists)
        //   3. defaultPosition + offsetStep × i (canonical behaviour)
        const copies: ReactNode[] = []
        for (let i = 0; i < hit.quantity; i++) {
          const indexedKey = `${it.key}_${i}`
          const override = positionOverrides?.[indexedKey]
            ?? (i === 0 ? positionOverrides?.[it.key] : undefined)
          const pos: [number, number, number] = override ?? [
            it.position[0] + offset[0] * i,
            it.position[1] + offset[1] * i,
            it.position[2] + offset[2] * i,
          ]
          copies.push(
            <group key={`${it.key}-${i}`} position={pos}>
              {it.render(hit.unlocked)}
            </group>,
          )
        }
        return <group key={it.key}>{copies}</group>
      })}
    </group>
  )
}

// Suppress unused-var for ItemWrapper (kept for future opacity-via-wrapper refactor).
void ItemWrapper
