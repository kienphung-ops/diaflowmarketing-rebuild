'use client'

/**
 * 2D sprites that mirror the 3D meshes in FloorItems.tsx for the
 * mobile front-elevation scene. Each sprite is a tiny stylised
 * illustration — not pixel-perfect, but the silhouette + palette
 * match the 3D version so a user who's been on desktop recognises
 * "their" office on mobile.
 *
 * Sprites are positioned by the parent (Mobile2DScene) via absolute
 * positioning + the sceneProjection helpers. Each sprite is rendered
 * inside a fixed-size box (`w-* h-*` from the SPRITE_SIZES map) so
 * the projection math doesn't have to know the visual width of every
 * item — it just centres the box on (xPct, yPct).
 *
 * The mapping from item key → sprite is `SPRITES`. Items added to
 * FloorItems.tsx but missing from this file fall back to a generic
 * placeholder box.
 */

import type { ReactNode } from 'react'
import { floorToWindowImage } from './windowImage'

/** Context the per-item renderer receives. `currentFloor` drives the
 *  floor-ceiling-window's scenery selection so the picture inside
 *  matches whatever the back-wall window is showing. */
export interface SpriteContext {
  companyName?: string | null
  currentFloor: number
}

/** Default sprite footprint per item — drives the wrapper `<div>`'s
 *  width and height so the parent can centre it on the projected
 *  position. Values are tuned per item; missing entries fall back to
 *  a generic 40×40 footprint. */
export const SPRITE_SIZES: Record<string, { w: number; h: number }> = {
  company_picture_frame: { w: 90, h: 90 },
  office_desk: { w: 56, h: 36 },
  basic_chair: { w: 24, h: 32 },
  executive_chair: { w: 28, h: 40 },
  upgraded_desk: { w: 56, h: 36 },
  potted_plant: { w: 36, h: 50 },
  coffee_mug: { w: 14, h: 14 },
  bookshelf: { w: 36, h: 72 },
  printer: { w: 30, h: 28 },
  whiteboard: { w: 70, h: 44 },
  mini_fridge: { w: 30, h: 50 },
  trophy: { w: 22, h: 30 },
  couch: { w: 64, h: 36 },
  neon_sign: { w: 56, h: 22 },
  arcade_machine: { w: 36, h: 60 },
  floor_ceiling_windows: { w: 50, h: 110 },
  tea_table: { w: 38, h: 28 },
  living_wall: { w: 60, h: 60 },
  espresso_machine: { w: 30, h: 36 },
  ping_pong_table: { w: 64, h: 28 },
  dj_stand: { w: 44, h: 32 },
  penthouse: { w: 64, h: 24 },
  // Tall + slim — a floor lamp's silhouette is mostly vertical
  // pole. Width is intentionally narrow so it doesn't crowd the
  // workstation it usually sits beside.
  floor_lamp: { w: 28, h: 72 },
}

/** Wall thumbnail with a brown frame + a single tinted band that
 *  hints at the contents (sky / company logo / etc). Used for the
 *  picture-frame, neon sign, penthouse banner, etc. */
function FlatWallTile({
  bg,
  accent,
  label,
  rotate = 0,
}: {
  bg: string
  accent: string
  label?: string
  rotate?: number
}) {
  return (
    <div
      className="w-full h-full rounded-md border-2 border-[#6b4f3a] overflow-hidden flex items-center justify-center text-[8px] font-bold uppercase tracking-wide text-[#3a2a1a]"
      style={{ background: bg, transform: rotate ? `rotate(${rotate}deg)` : undefined }}
    >
      {label && <span className="px-1 text-center leading-tight">{label}</span>}
      {!label && accent && (
        <span
          className="block w-3/4 h-3/5 rounded-sm"
          style={{ background: accent }}
        />
      )}
    </div>
  )
}

/** Sprite catalogue. Each entry returns a fragment that fills the
 *  parent footprint (the parent sizes via SPRITE_SIZES). The
 *  context object lets sprites that care about the user's progress
 *  (e.g. floor-ceiling windows showing per-floor scenery) read it
 *  without us threading every value as a separate argument. */
export const SPRITES: Record<string, (ctx: SpriteContext) => ReactNode> = {
  company_picture_frame: ({ companyName }) => (
    <FlatWallTile
      bg="#fafaf2"
      accent="#fff"
      label={companyName?.trim() || 'Diaflow'}
    />
  ),

  office_desk: () => (
    <div className="w-full h-full relative">
      {/* Desktop slab */}
      <div className="absolute inset-x-0 top-1 h-4 rounded-sm bg-[#7a4a22] border border-[#4a2a10]" />
      {/* Laptop body */}
      <div className="absolute left-1/2 -translate-x-1/2 top-2 w-5 h-2.5 bg-[#1a1a2e] rounded-[1px]" />
      {/* Screen glow */}
      <div className="absolute left-1/2 -translate-x-1/2 top-2 w-4 h-1.5 bg-[#3b82f6]" />
      {/* Legs */}
      <div className="absolute left-1 bottom-0 w-1 h-3/4 bg-[#3a2a1a]" />
      <div className="absolute right-1 bottom-0 w-1 h-3/4 bg-[#3a2a1a]" />
    </div>
  ),

  upgraded_desk: () => (
    <div className="w-full h-full relative">
      {/* Dark walnut variant of office_desk */}
      <div className="absolute inset-x-0 top-1 h-4 rounded-sm bg-[#2a1a0a] border border-[#140a00]" />
      <div className="absolute left-1/2 -translate-x-1/2 top-2 w-5 h-2.5 bg-[#1a1a2e] rounded-[1px]" />
      <div className="absolute left-1/2 -translate-x-1/2 top-2 w-4 h-1.5 bg-[#3b82f6]" />
      <div className="absolute left-1 bottom-0 w-1 h-3/4 bg-[#140a00]" />
      <div className="absolute right-1 bottom-0 w-1 h-3/4 bg-[#140a00]" />
    </div>
  ),

  basic_chair: () => (
    <div className="w-full h-full relative">
      {/* Backrest */}
      <div className="absolute inset-x-0 top-0 h-2/3 rounded-sm bg-[#3a3a4a] border border-[#1a1a2e]" />
      {/* Seat */}
      <div className="absolute inset-x-0 bottom-1 h-1/3 bg-[#2a2a3a] rounded-sm" />
      {/* Single leg */}
      <div className="absolute left-1/2 -translate-x-1/2 bottom-0 w-1 h-1 bg-[#1a1a2e]" />
    </div>
  ),

  executive_chair: () => (
    <div className="w-full h-full relative">
      {/* Tall backrest with subtle gold trim */}
      <div className="absolute inset-x-0 top-0 h-3/5 rounded-md bg-[#1a1a2e] border-2 border-[#3a2a1a]" />
      <div className="absolute inset-x-1 top-1 h-1/2 rounded-sm bg-[#0a0a1f]" />
      {/* Seat */}
      <div className="absolute inset-x-0 top-3/5 h-1/5 bg-[#1a1a2e]" />
      {/* 5-arm base */}
      <div className="absolute left-1/2 -translate-x-1/2 bottom-1 w-3/4 h-1 bg-[#3a2a1a]" />
      <div className="absolute left-1/2 -translate-x-1/2 bottom-0 w-1.5 h-1 bg-[#1a1a2e]" />
    </div>
  ),

  floor_lamp: () => (
    // Classic floor-lamp silhouette: round base, slim pole, conical
    // shade with a warm glow. The shade uses a soft radial gradient
    // so the bulb reads as illuminated rather than flat-painted.
    <div className="w-full h-full relative">
      {/* Shade — trapezoid via inset borders. Warm cream tone +
          glow halo so the lamp reads as "on" in the dim wall band. */}
      <div className="absolute left-1/2 -translate-x-1/2 top-0 w-full h-[28%]">
        <div
          className="w-full h-full"
          style={{
            background:
              'radial-gradient(ellipse at center top, #fff7d6 0%, #fbbf24 65%, #c89f4a 100%)',
            clipPath: 'polygon(18% 0, 82% 0, 100% 100%, 0 100%)',
            boxShadow: '0 0 14px rgba(251,191,36,0.55)',
          }}
        />
      </div>
      {/* Tiny neck connecting shade to pole — adds a hint of detail
          at the join so it doesn't look like one continuous bar. */}
      <div className="absolute left-1/2 -translate-x-1/2 top-[27%] w-[18%] h-[4%] bg-[#3a2a1a]" />
      {/* Pole — slim dark column running ~70% of the sprite height. */}
      <div className="absolute left-1/2 -translate-x-1/2 top-[30%] w-[10%] h-[65%] bg-[#1a1a2e] rounded-sm" />
      {/* Base — wider round disc at the floor anchor. */}
      <div className="absolute left-1/2 -translate-x-1/2 bottom-0 w-[60%] h-[6%] bg-[#3a2a1a] rounded-full shadow-[0_2px_4px_rgba(0,0,0,0.4)]" />
    </div>
  ),

  potted_plant: () => (
    <div className="w-full h-full relative">
      {/* Leaves — three overlapping rounded blobs */}
      <div className="absolute left-1/2 -translate-x-1/2 top-0 w-full h-2/3 rounded-full bg-[#3a7a22] shadow-inner" />
      <div className="absolute left-1 top-2 w-2/3 h-1/2 rounded-full bg-[#52a032]" />
      <div className="absolute right-1 top-3 w-2/3 h-1/2 rounded-full bg-[#83c45c]" />
      {/* Pot */}
      <div className="absolute inset-x-1.5 bottom-0 h-1/3 bg-[#a05a2a] rounded-b-sm border-t-2 border-[#7a3a10]" />
    </div>
  ),

  coffee_mug: () => (
    <div className="w-full h-full relative">
      <div className="absolute inset-0 rounded-full bg-white border border-[#aaa]" />
      <div className="absolute inset-1 rounded-full bg-[#5a3a10]" />
    </div>
  ),

  bookshelf: () => (
    <div className="w-full h-full bg-[#5a3a10] rounded-sm border border-[#3a2a1a] grid grid-rows-4 gap-px p-px">
      {[0, 1, 2, 3].map(i => (
        <div key={i} className="flex gap-px">
          <div className="flex-1 bg-[#d33b3b]" />
          <div className="flex-1 bg-[#1a3a8a]" />
          <div className="flex-1 bg-[#52a032]" />
          <div className="flex-1 bg-[#fbbf24]" />
        </div>
      ))}
    </div>
  ),

  printer: () => (
    <div className="w-full h-full relative">
      <div className="absolute inset-0 bg-[#e0e0e0] rounded-sm border border-[#aaa]" />
      <div className="absolute inset-x-1 top-1 h-1 bg-[#1a1a2e]" />
      <div className="absolute left-1 bottom-1 w-2 h-1 bg-[#22c55e]" />
    </div>
  ),

  whiteboard: () => (
    <div className="w-full h-full p-1 bg-[#3a2a1a] rounded-sm">
      <div className="w-full h-full bg-[#f8f8f0] rounded-sm flex items-center justify-center">
        <span className="text-[8px] font-bold leading-tight text-center text-[#1a3a8a] px-1">
          go unicorn
          <br />
          this year
        </span>
      </div>
    </div>
  ),

  mini_fridge: () => (
    <div className="w-full h-full bg-[#e5e5e5] rounded-sm border border-[#aaa] relative">
      <div className="absolute left-1 inset-y-1 w-px bg-[#aaa]" />
      <div className="absolute right-1 top-1/3 w-1 h-2 bg-[#1a1a2e]" />
    </div>
  ),

  trophy: () => (
    <div className="w-full h-full relative flex flex-col items-center">
      <div className="w-3/5 h-2/3 bg-[#fbbf24] rounded-t-full border border-[#c89f4a] shadow-[0_0_8px_rgba(251,191,36,0.6)]" />
      <div className="w-1 h-1/6 bg-[#c89f4a]" />
      <div className="w-3/4 h-1/6 bg-[#4a3520] rounded-sm" />
    </div>
  ),

  couch: () => (
    <div className="w-full h-full relative">
      <div className="absolute inset-x-0 top-1/4 h-1/2 bg-[#4a90d9] rounded-md border border-[#3a82cf]" />
      <div className="absolute inset-x-0 top-0 h-1/3 bg-[#5fa3ec] rounded-t-md" />
      <div className="absolute left-0 inset-y-0 w-1.5 bg-[#3a82cf] rounded-l-md" />
      <div className="absolute right-0 inset-y-0 w-1.5 bg-[#3a82cf] rounded-r-md" />
    </div>
  ),

  neon_sign: () => (
    <div className="w-full h-full rounded-md bg-[#1a0030] border-2 border-[#fbbf24] flex items-center justify-center shadow-[0_0_12px_rgba(251,191,36,0.6)]">
      <span className="text-[8px] font-extrabold text-[#fbbf24] tracking-widest">
        OPEN
      </span>
    </div>
  ),

  arcade_machine: () => (
    <div className="w-full h-full relative">
      {/* Cabinet body */}
      <div className="absolute inset-x-0 inset-y-2 bg-[#7c3aed] rounded-sm border border-[#5a2ac0]" />
      {/* Marquee — "SPIN" title so it reads as a prize machine, not a
          generic arcade. */}
      <div className="absolute inset-x-0 top-0 h-2.5 bg-[#a855f7] rounded-t-sm shadow-[0_0_8px_rgba(168,85,247,0.7)] flex items-center justify-center">
        <span className="text-[5px] font-black text-night-deep tracking-[0.15em] leading-none">SPIN</span>
      </div>
      {/* Spin WHEEL on the front face — the key differentiator from a
          plain arcade screen. Conic-gradient 7-segment wheel + a gold
          pointer at the top. */}
      <div className="absolute left-1/2 -translate-x-1/2 top-[26%] w-[66%] aspect-square">
        {/* Pointer */}
        <div
          className="absolute left-1/2 -translate-x-1/2 -top-[2px] z-10"
          style={{
            width: 0,
            height: 0,
            borderLeft: '3px solid transparent',
            borderRight: '3px solid transparent',
            borderTop: '5px solid #fbbf24',
          }}
        />
        {/* Wheel disc */}
        <div
          className="w-full h-full rounded-full border border-[#fbbf24] shadow-[0_0_8px_rgba(168,85,247,0.7)]"
          style={{
            background:
              'conic-gradient(#9F8BFF 0deg 51.43deg, #4c3a8c 51.43deg 102.86deg, #6d4bd8 102.86deg 154.29deg, #8b5cf6 154.29deg 205.71deg, #a78bfa 205.71deg 257.14deg, #1f2147 257.14deg 308.57deg, #fbbf24 308.57deg 360deg)',
          }}
        />
        {/* Hub */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-[#fbbf24] border border-[#1f2147]" />
      </div>
      {/* Control deck */}
      <div className="absolute inset-x-1 bottom-3 h-1.5 bg-[#3a2a1a] flex items-center justify-evenly">
        <span className="w-1 h-1 rounded-full bg-[#d33b3b]" />
        <span className="w-1 h-1 rounded-full bg-[#22d3ee]" />
      </div>
    </div>
  ),

  floor_ceiling_windows: ({ currentFloor }) => (
    // Window on the back wall — landscape scenery from
    // /window_images/<N>.png, same banding the 3D scene uses. The
    // dark mullion grid sits ON TOP of the photo so the panel still
    // reads as a window (not a flat picture). Mobile2DScene hides
    // this entire item at floor 20 (penthouse loses its
    // floor-ceiling glass on this scale), so the renderer doesn't
    // need a special-case for that floor — it just won't be called.
    <div
      className="w-full h-full rounded-sm border-2 border-[#3a2a1a] shadow-[inset_0_0_12px_rgba(0,0,0,0.45)] relative overflow-hidden"
      style={{
        backgroundImage: `url(${floorToWindowImage(currentFloor)})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {/* Mullions — a single horizontal + vertical bar to evoke a
          window frame. Kept thin so the scenery underneath dominates. */}
      <div className="absolute inset-x-0 top-1/2 h-px bg-[#3a2a1a]/80" />
      <div className="absolute inset-y-0 left-1/2 w-px bg-[#3a2a1a]/80" />
    </div>
  ),

  tea_table: () => (
    <div className="w-full h-full relative">
      <div className="absolute inset-x-0 top-1/3 h-1/3 bg-[#5a3a10] rounded-sm border border-[#3a2a1a]" />
      {/* Teapot blob */}
      <div className="absolute left-1.5 top-1 w-3 h-3 rounded-full bg-[#f5f0e8] border border-[#aaa]" />
      {/* Cup */}
      <div className="absolute right-1.5 top-2 w-2 h-1.5 rounded-sm bg-[#f5f0e8] border border-[#aaa]" />
      {/* Legs */}
      <div className="absolute left-0.5 bottom-0 w-px h-1/3 bg-[#3a2a1a]" />
      <div className="absolute right-0.5 bottom-0 w-px h-1/3 bg-[#3a2a1a]" />
    </div>
  ),

  living_wall: () => (
    <div className="w-full h-full bg-[#2d5a1b] rounded-sm grid grid-cols-6 grid-rows-3 gap-px p-1">
      {Array.from({ length: 18 }).map((_, i) => (
        <span
          key={i}
          className="rounded-full"
          style={{
            background: i % 3 === 0 ? '#3a7a22' : i % 3 === 1 ? '#52a032' : '#83c45c',
          }}
        />
      ))}
    </div>
  ),

  espresso_machine: () => (
    <div className="w-full h-full relative">
      <div className="absolute inset-x-0 top-0 h-3/4 bg-[#1a1a2e] rounded-sm" />
      <div className="absolute inset-x-1 top-1 h-2 bg-[#fbbf24]" />
      <div className="absolute inset-x-1 bottom-3 h-1 bg-[#7a5520]" />
      <div className="absolute inset-x-0 bottom-0 h-1/4 bg-[#5a3a10]" />
    </div>
  ),

  ping_pong_table: () => (
    <div className="w-full h-full relative">
      <div className="absolute inset-x-0 top-1/4 h-1/2 bg-[#1a6a3a] rounded-sm border border-white" />
      <div className="absolute left-1/2 inset-y-1 w-px bg-white" />
      <div className="absolute left-1 bottom-0 w-1 h-1/4 bg-[#3a2a1a]" />
      <div className="absolute right-1 bottom-0 w-1 h-1/4 bg-[#3a2a1a]" />
    </div>
  ),

  dj_stand: () => (
    <div className="w-full h-full relative">
      <div className="absolute inset-x-0 top-1/4 h-1/2 bg-[#1a1a2e] rounded-sm border border-[#3a2a1a]" />
      <div className="absolute left-1 top-1/3 w-3 h-3 rounded-full bg-[#3a3a4a] border border-[#fbbf24]" />
      <div className="absolute right-1 top-1/3 w-3 h-3 rounded-full bg-[#3a3a4a] border border-[#fbbf24]" />
    </div>
  ),

  penthouse: () => (
    <FlatWallTile bg="linear-gradient(180deg,#fbbf24,#c89f4a)" accent="" label="👑 Penthouse" />
  ),
}

/** Generic placeholder for items we haven't drawn yet. */
export function PlaceholderSprite() {
  return (
    <div className="w-full h-full rounded-sm bg-white/10 border border-white/20" />
  )
}
