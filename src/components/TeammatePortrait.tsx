'use client'

/**
 * Chest-up pixel portrait of a teammate — shared across all four
 * character-tap modals (IrisHireModal, MiaInfoCard, LeoEmailDrawer,
 * TeammateBubble) so the same identity reads in the modal as on the
 * office floor.
 *
 * ViewBox 56×72; rendered size is set by the parent. Lighting matches
 * the full-body Lego-voxel sprite in Mobile2DScene — implied upper-
 * left light, right-side shadow band derived via `darken()`. Iris
 * additionally paints a red tie + lapel overlay (slug === 'iris').
 *
 * Hardcoded NPC palettes for the three default characters so callers
 * don't have to know the colours — pass just `slug` and the right
 * palette is selected. Custom recruits pass their cycled `bodyColor`
 * / `hairColor` / `skinColor` explicitly.
 */

import { useMemo } from 'react'

type Slug = 'iris' | 'mia' | 'leo' | string

interface Props {
  /** Stable character identifier. `'iris' | 'mia' | 'leo'` map to the
   *  canonical palettes; any other value treats the figure as a
   *  custom recruit and falls back to the colours passed below. */
  slug?: Slug
  /** Required for custom recruits, ignored for the three default NPCs
   *  (their colour comes from the canonical palette). */
  bodyColor?: string
  hairColor?: string
  skinColor?: string
  /** Render size — passes through to the SVG. Defaults to 56×72 which
   *  matches the IrisHireModal mockup. */
  width?: number
  height?: number
}

const NPC_PALETTE: Record<
  'iris' | 'mia' | 'leo',
  { body: string; hair: string; skin: string }
> = {
  iris: { body: '#1c2440', hair: '#1a1a1a', skin: '#5d4030' },
  mia: { body: '#5a8ed8', hair: '#8b5a3c', skin: '#f5d4b0' },
  leo: { body: '#6d3fc8', hair: '#1a1a30', skin: '#f5d4b0' },
}

/** ~30% darker hex used for the right-side shadow band on every
 *  solid surface. Same helper as Mobile2DScene's voxel sprite. */
function darken(hex: string, amount: number): string {
  const m = hex.trim().match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i)
  if (!m) return hex
  const v = m[1]
  let r: number, g: number, b: number
  if (v.length === 3) {
    r = parseInt(v[0] + v[0], 16)
    g = parseInt(v[1] + v[1], 16)
    b = parseInt(v[2] + v[2], 16)
  } else {
    r = parseInt(v.slice(0, 2), 16)
    g = parseInt(v.slice(2, 4), 16)
    b = parseInt(v.slice(4, 6), 16)
  }
  const f = Math.max(0, 1 - Math.max(0, Math.min(1, amount)))
  const rr = Math.round(r * f).toString(16).padStart(2, '0')
  const gg = Math.round(g * f).toString(16).padStart(2, '0')
  const bb = Math.round(b * f).toString(16).padStart(2, '0')
  return `#${rr}${gg}${bb}`
}

export function TeammatePortrait({
  slug,
  bodyColor,
  hairColor,
  skinColor,
  width = 56,
  height = 72,
}: Props) {
  // Resolve the palette: canonical NPC if slug matches, otherwise the
  // colours the caller passed in (custom recruits).
  const palette = useMemo(() => {
    if (slug && (slug === 'iris' || slug === 'mia' || slug === 'leo')) {
      const npc = NPC_PALETTE[slug]
      return { body: npc.body, hair: npc.hair, skin: npc.skin }
    }
    return {
      body: bodyColor ?? '#6b3fc8',
      hair: hairColor ?? '#1a1a1a',
      skin: skinColor ?? '#f5d4b0',
    }
  }, [slug, bodyColor, hairColor, skinColor])

  const bodyShadow = darken(palette.body, 0.28)
  const hairShadow = darken(palette.hair, 0.3)
  const skinShadow = darken(palette.skin, 0.18)

  const isIris = slug === 'iris'

  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 56 72"
      aria-hidden
      style={{ imageRendering: 'pixelated' }}
    >
      {/* Hair — top cap with two side tufts so the silhouette frames
          the face instead of reading as a flat strip. */}
      <rect x="10" y="0" width="36" height="14" fill={palette.hair} rx="2" />
      <rect x="34" y="0" width="12" height="14" fill={hairShadow} rx="0" />
      <rect x="8" y="12" width="5" height="10" fill={palette.hair} />
      <rect x="43" y="12" width="5" height="10" fill={hairShadow} />

      {/* Face — skin-toned square with the standard right-side shadow
          band. Slight border-radius so it doesn't look like a sticker. */}
      <rect x="14" y="11" width="28" height="22" fill={palette.skin} rx="2" />
      <rect x="32" y="11" width="10" height="22" fill={skinShadow} rx="0" />

      {/* Eyes — white per the desktop voxel sprites. */}
      <rect x="19" y="20" width="3" height="4" fill="#ffffff" />
      <rect x="34" y="20" width="3" height="4" fill="#ffffff" />

      {/* Body (chest-up — clipped at the modal edge so we don't need
          legs or feet here). Tapered slightly for the Lego silhouette. */}
      <rect x="6" y="34" width="44" height="38" fill={palette.body} rx="3" />
      <rect x="34" y="34" width="16" height="38" fill={bodyShadow} rx="0" />

      {/* Iris-only overlay: lapel triangles + red tie. */}
      {isIris && (
        <>
          <path d="M 20 34 L 28 38 L 28 44 Z" fill="#141a30" />
          <path d="M 36 34 L 28 38 L 28 44 Z" fill={darken('#141a30', 0.25)} />
          <rect x="25.5" y="36" width="5" height="24" fill="#c53030" rx="1" />
          <rect x="27" y="36" width="2" height="24" fill="#a02020" />
        </>
      )}
    </svg>
  )
}
