'use client'

/**
 * Mobile 2D office scene — replaces the React Three Fiber canvas
 * on sub-md viewports. Front-elevation perspective:
 *
 *   ┌─────────────────────────────────┐
 *   │ Back wall  · wall-mounted items │  ← top WALL_BAND_PCT
 *   │            · windows / pictures │
 *   ├─────────────────────────────────┤
 *   │ Wood floor                      │
 *   │   desks · chairs · plants ·     │
 *   │   minifigures (clickable)       │  ← bottom band
 *   └─────────────────────────────────┘
 *
 * Each unlocked item from FloorItems' ITEMS list renders as a
 * stylised 2D sprite (see itemSprites.tsx). Wall vs floor mounting
 * is driven by the world Z coordinate (≤ WALL_Z_THRESHOLD → wall).
 * Z-order within the floor band uses the projected Y percentage so
 * items further back render BEHIND items closer to the camera.
 *
 * Clicking a character fires `onTeammateClick` (custom recruits)
 * or `onNpcClick` (Iris / Mia / Leo) — same callback shape as the
 * 3D SceneCanvas so the parent's modal-routing logic is identical
 * across breakpoints.
 *
 * This component is hidden at md+ by the parent; the 3D
 * SceneCanvas continues to render desktop.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { useFloorItems } from '@/lib/floorsConfigClient'
import type { RecruitedCharacter } from '@/components/scene/OfficeScene'
import {
  ITEMS_2D,
  CHARACTER_2D_POSITIONS,
  RECRUIT_2D_POSITIONS,
} from './itemPositions'
import {
  projectToScreen,
  inverseProjectToWorld,
  WALL_BAND_PCT,
} from './sceneProjection'
import { SPRITES, SPRITE_SIZES, PlaceholderSprite } from './itemSprites'
import { floorToWindowImage } from './windowImage'

/** Floor at which the back-wall window (and the floor-ceiling
 *  windows item) are hidden. The penthouse switches to a full glass
 *  envelope in the 3D scene — the mobile 2D scene mirrors that by
 *  dropping the wall window entirely so the scenery doesn't repeat
 *  the panorama already implied by the title chip / progress pill. */
const PENTHOUSE_FLOOR = 20

interface Props {
  companyName: string | null
  recruitedCharacters: RecruitedCharacter[]
  currentFloor: number
  /** Optional override for Mia's role label — mirrors the 3D scene. */
  miaRole?: string | null
  /** Fires on a TAP (small movement, short press) of a default NPC. */
  onNpcClick?: (slug: 'iris' | 'mia' | 'leo') => void
  /** Fires on a TAP of a recruited teammate. `index` matches the
   *  custom-recruit ordering used by `RECRUIT_2D_POSITIONS` and the
   *  `recruited-{i}` slug convention. */
  onTeammateClick?: (index: number) => void
  /** Fires on a DRAG-DROP — when the user releases after meaningful
   *  movement. Slug shape matches the desktop 3D scene's drag-drop
   *  signal: `'iris' | 'mia' | 'leo' | 'recruited-{i}'`. The parent
   *  is expected to forward the slug to /api/poke so the visitor /
   *  owner poke flow is identical across breakpoints. */
  onTeammatePoke?: (slug: string) => void
}

interface PlacedItem {
  uid: string
  key: string
  xPct: number
  yPct: number
  width: number
  height: number
  onWall: boolean
}

export function Mobile2DScene({
  companyName,
  recruitedCharacters,
  currentFloor,
  miaRole,
  onNpcClick,
  onTeammateClick,
  onTeammatePoke,
}: Props) {
  // Ref to the outer scene container — passed to each CharacterSprite
  // so its pointer-move handler can compute (clientX, clientY) →
  // (xPct, yPct) relative to the same canvas the items render into.
  const sceneRef = useRef<HTMLDivElement | null>(null)

  // Per-character position overrides. Empty by default — each sprite
  // falls back to its canonical seed position (CHARACTER_2D_POSITIONS
  // / RECRUIT_2D_POSITIONS). A successful drag updates the entry for
  // that slug, and the character renders at the new spot until the
  // user navigates away. Same client-side-only convention the 3D
  // scene uses (drag positions are visual, the only DB write on
  // drag-drop is the poke counter — see /api/poke).
  const [charPositions, setCharPositions] = useState<
    Record<string, [number, number, number]>
  >({})

  function handleCharMove(slug: string, pos: [number, number, number]) {
    setCharPositions(prev => ({ ...prev, [slug]: pos }))
  }
  // Pull the user's floor item list from the same cached config the
  // 3D scene uses. Wrap in a quantity map for fast lookup below.
  const floorItems = useFloorItems(currentFloor)
  const quantityByKey = useMemo(() => {
    const m = new Map<string, number>()
    for (const it of floorItems) m.set(it.key, it.quantity)
    return m
  }, [floorItems])

  // Build the list of placed sprites — for each ITEM in our
  // catalogue, expand the multi-instance ones (offsetStep) into one
  // entry per quantity-N copy. Items with quantity 0 / no entry on
  // this floor are skipped entirely (they're not unlocked yet OR
  // they've been "swapped out" by an upgrade like F12's dark desks).
  const placed: PlacedItem[] = useMemo(() => {
    const out: PlacedItem[] = []
    for (const item of ITEMS_2D) {
      const qty = quantityByKey.get(item.key) ?? 0
      if (qty <= 0) continue
      // Penthouse special-case: the floor-ceiling windows item is
      // suppressed entirely so the wall reads as continuous glass
      // (mirroring the 3D scene's penthouse treatment). Other items
      // on the penthouse floor render normally.
      if (
        item.key === 'floor_ceiling_windows' &&
        currentFloor >= PENTHOUSE_FLOOR
      ) {
        continue
      }
      for (let i = 0; i < qty; i++) {
        const offset = item.offsetStep ?? [0, 0, 0]
        const pos: [number, number, number] = [
          item.position[0] + offset[0] * i,
          item.position[1] + offset[1] * i,
          item.position[2] + offset[2] * i,
        ]
        const { xPct, yPct, onWall } = projectToScreen(pos)
        const size = SPRITE_SIZES[item.key] ?? { w: 40, h: 40 }
        out.push({
          uid: `${item.key}_${i}`,
          key: item.key,
          xPct,
          yPct,
          width: size.w,
          height: size.h,
          onWall,
        })
      }
    }
    return out
  }, [quantityByKey, currentFloor])

  // Items that always paint last (on top of everything else),
  // regardless of their floor depth. The coffee mug sits on a desk
  // surface in world coordinates but the 2D front-elevation can't
  // model "on top of" naturally — the desk and the mug end up with
  // similar yPct + similar z, so the mug otherwise paints UNDER the
  // desk. Promoting it to a top-layer fixes the visual stack.
  const ALWAYS_ON_TOP = new Set(['coffee_mug'])

  // Stable sort: wall items first (so they render BEHIND floor items
  // when stacks happen to overlap at the wall/floor seam), then by
  // yPct ascending so items higher up the canvas render before items
  // lower (depth-first painting — items "closer" to the viewer cover
  // items "farther back"). ALWAYS_ON_TOP keys are pushed to the very
  // end so they paint over everything else.
  const renderOrder = useMemo(() => {
    return [...placed].sort((a, b) => {
      const aTop = ALWAYS_ON_TOP.has(a.key)
      const bTop = ALWAYS_ON_TOP.has(b.key)
      if (aTop && !bTop) return 1
      if (!aTop && bTop) return -1
      if (a.onWall && !b.onWall) return -1
      if (!a.onWall && b.onWall) return 1
      return a.yPct - b.yPct
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placed])

  return (
    <div
      ref={sceneRef}
      className="md:hidden fixed inset-0 overflow-hidden bg-[#1a1530] select-none"
      // touch-action none → we own every touch sequence inside the
      // scene (otherwise iOS would interpret single-finger drags as
      // page-scroll and the character-move gesture would never reach
      // our pointer handlers).
      style={{ touchAction: 'none' }}
    >
      {/* Back wall — two flavours:
          • F1-19: solid tan paint with a subtle vignette (the
            normal office wall).
          • F20  : the penthouse loses its solid back wall and the
            full span becomes floor-to-ceiling glass. We render the
            same /window_images/6.png panorama the 3D scene uses as
            the wall background and overlay a thin cool-blue glass
            tint so it reads as a window rather than a wallpaper.
            Matches Walls.tsx's `glassColor` / `glassOpacity`. */}
      {currentFloor >= PENTHOUSE_FLOOR ? (
        <div
          className="absolute inset-x-0 top-0 pointer-events-none"
          style={{
            height: `${WALL_BAND_PCT * 100}%`,
            backgroundImage: `url(${floorToWindowImage(currentFloor)})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            // Subtle horizon-line shadow at the wall/floor seam so
            // the glass band still reads as bounded by a frame.
            boxShadow: 'inset 0 -8px 12px rgba(0,0,0,0.35)',
          }}
        >
          {/* Cool light-blue glass tint — matches the 3D
              penthouse's glassColor (#e8f1ff @ 0.18). Sits on top
              of the panorama so the scenery shows clearly while
              still cueing "you're looking through glass". */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: 'rgba(232,241,255,0.18)' }}
            aria-hidden
          />
        </div>
      ) : (
        <div
          className="absolute inset-x-0 top-0 bg-[#d4c5a9] pointer-events-none"
          style={{
            height: `${WALL_BAND_PCT * 100}%`,
            boxShadow: 'inset 0 -20px 30px rgba(0,0,0,0.25)',
          }}
        />
      )}

      {/* Wood floor — diagonal plank stripes, anchored just under
          the wall and extending to the bottom of the viewport.
          pointer-events-none so a character dropped on top of the
          floor still receives taps — the floor is purely
          decorative. */}
      <div
        className="absolute inset-x-0 bottom-0 pointer-events-none"
        style={{
          top: `${WALL_BAND_PCT * 100}%`,
          background:
            'repeating-linear-gradient(135deg, #8b5e3c 0, #8b5e3c 10px, #6b4527 10px, #6b4527 11px)',
        }}
      />

      {/* Company picture frame — always rendered at the front-and-
          centre of the back wall. Sized to ~1/4 of the wall width so
          it reads as the focal point, matches the Walls.CompanyFrame
          mesh in the 3D scene. `pointer-events-none` keeps it
          purely decorative so a character dragged in front of it
          still receives taps. */}
      <div
        className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none"
        style={{
          left: '38%',
          top: `${WALL_BAND_PCT * 100 * 0.45}%`,
          width: 88,
          height: 88,
        }}
      >
        <div className="w-full h-full p-1 bg-[#5a3a10] rounded-md">
          <div className="w-full h-full p-1 bg-[#7a5520] rounded-sm">
            <div className="w-full h-full bg-[#f5f0e8] rounded-sm flex items-center justify-center text-[10px] font-bold text-[#3a2a1a] px-1 text-center leading-tight">
              {companyName?.trim() || 'Diaflow'}
            </div>
          </div>
        </div>
      </div>

      {/* Back-wall scenery window — to the right of the company
          frame, mirroring the 3D scene's cut-out window. The image
          rotates per floor band (see floorToWindowImage). Hidden at
          the penthouse so the wall reads as continuous glass.
          The floor_ceiling_windows item below ALSO hides at the
          penthouse via the placed[] filter above. */}
      {currentFloor < PENTHOUSE_FLOOR && (
        <div
          className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none"
          style={{
            left: '70%',
            top: `${WALL_BAND_PCT * 100 * 0.45}%`,
            width: 96,
            height: 78,
          }}
        >
          <div
            className="w-full h-full rounded-sm border-[3px] border-[#5a3a10] relative overflow-hidden shadow-[inset_0_0_18px_rgba(0,0,0,0.45)]"
            style={{
              backgroundImage: `url(${floorToWindowImage(currentFloor)})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          >
            {/* Window mullions — single + cross overlaid on the
                scenery so it reads as a framed window rather than a
                wallpaper sticker. */}
            <div className="absolute inset-x-0 top-1/2 h-px bg-[#3a2a1a]/80" />
            <div className="absolute inset-y-0 left-1/2 w-px bg-[#3a2a1a]/80" />
          </div>
        </div>
      )}

      {/* Item sprites — absolutely positioned by projected x/y % */}
      {renderOrder.map(item => {
        const renderer = SPRITES[item.key]
        return (
          <div
            key={item.uid}
            className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none"
            style={{
              left: `${item.xPct}%`,
              top: `${item.yPct}%`,
              width: item.width,
              height: item.height,
            }}
            aria-hidden
          >
            {renderer ? renderer({ companyName, currentFloor }) : <PlaceholderSprite />}
          </div>
        )
      })}

      {/* Characters — rendered AFTER items so they always paint on
          top of the floor decor in the same row. Each character is
          a tappable box that fires the parent's click callback. */}
      {(['iris', 'mia', 'leo'] as const).map(slug => {
        const cfg = NPC_CONFIG[slug]
        return (
          <CharacterSprite
            key={slug}
            slug={slug}
            name={cfg.name}
            role={slug === 'mia' ? miaRole ?? cfg.role : cfg.role}
            worldPos={charPositions[slug] ?? CHARACTER_2D_POSITIONS[slug]}
            bodyColor={cfg.bodyColor}
            hairColor={cfg.hairColor}
            skinColor={cfg.skinColor}
            sceneRef={sceneRef}
            onTap={() => onNpcClick?.(slug)}
            onPoke={() => onTeammatePoke?.(slug)}
            onMove={pos => handleCharMove(slug, pos)}
          />
        )
      })}
      {recruitedCharacters
        .slice(0, RECRUIT_2D_POSITIONS.length)
        .map((rc, i) => {
          const slug = `recruited-${i}`
          return (
            <CharacterSprite
              key={slug}
              slug={slug}
              name={rc.name}
              role={rc.role}
              worldPos={charPositions[slug] ?? RECRUIT_2D_POSITIONS[i]}
              bodyColor={RECRUIT_BODY_COLORS[i % RECRUIT_BODY_COLORS.length]}
              hairColor={RECRUIT_HAIR_COLORS[i % RECRUIT_HAIR_COLORS.length]}
              skinColor={RECRUIT_SKIN_COLORS[i % RECRUIT_SKIN_COLORS.length]}
              sceneRef={sceneRef}
              onTap={() => onTeammateClick?.(i)}
              onPoke={() => onTeammatePoke?.(slug)}
              onMove={pos => handleCharMove(slug, pos)}
            />
          )
        })}
    </div>
  )
}

/** Default NPC palette + names. Hair + skin tones mirror the 3D
 *  scene's CharacterConfig (see scene/characters/characters.config.ts)
 *  so the same teammate reads as the same identity across views. */
const NPC_CONFIG: Record<
  'iris' | 'mia' | 'leo',
  {
    name: string
    role: string
    bodyColor: string
    hairColor: string
    skinColor: string
  }
> = {
  iris: {
    name: 'Iris',
    role: 'AI Recruiter',
    bodyColor: '#f9a8d4',
    hairColor: '#1C1C1C',
    skinColor: '#c98a5b',
  },
  mia: {
    name: 'Mia',
    role: 'Assistant',
    bodyColor: '#a875ff',
    hairColor: '#8B4513',
    skinColor: '#fcd2b3',
  },
  leo: {
    name: 'Leo',
    role: 'Demo Specialist',
    bodyColor: '#60a5fa',
    hairColor: '#2C2C54',
    skinColor: '#f1c27d',
  },
}

/** Body colours for recruited teammates — mirrors RECRUIT_APPEARANCES
 *  in OfficeScene.tsx so the user's roster looks consistent across
 *  desktop ↔ mobile. We use the `clothesColor` from each entry. */
const RECRUIT_BODY_COLORS = [
  '#22c55e',
  '#f59e0b',
  '#6366f1',
  '#ec4899',
  '#14b8a6',
  '#f43f5e',
  '#0ea5e9',
  '#84cc16',
]

/** Hair palette for recruited teammates — cycled with body colour so
 *  no two adjacent recruits look identical. Chosen to span warm /
 *  cool / neutral tones for visual variety. */
const RECRUIT_HAIR_COLORS = [
  '#3b2410', // dark brown
  '#1c1c1c', // black
  '#6b3410', // chestnut
  '#c98a3b', // honey blonde
  '#5a3b8c', // purple-tinted
  '#1e3a8a', // ink blue
  '#6b1212', // auburn
  '#3b3b3b', // charcoal
]

/** Skin palette for recruited teammates — cycled independently so the
 *  combinations vary. */
const RECRUIT_SKIN_COLORS = [
  '#fcd2b3',
  '#c98a5b',
  '#f1c27d',
  '#a86b3c',
  '#fbe1c4',
  '#8d5524',
  '#e8b07a',
  '#d6926a',
]

/** Mobile 2D keyframes — mirror the three CSS animations the 3D
 *  scene injects from `Character.tsx`. Same names so the visual
 *  behaviour stays familiar to anyone who's seen the desktop poke
 *  feedback before. Injected once, on first mount, in a stable
 *  `<style id>` so HMR + duplicate sprite instances don't create a
 *  stack of identical rules. */
if (typeof window !== 'undefined' && !document.getElementById('mobile2d-anims')) {
  const style = document.createElement('style')
  style.id = 'mobile2d-anims'
  style.textContent = `
    @keyframes mobile2dFloatUp {
      from { opacity: 1; transform: translate(-50%, 0); }
      to   { opacity: 0; transform: translate(-50%, -32px); }
    }
    @keyframes mobile2dSpeechPop {
      0%   { opacity: 0; transform: translate(-50%, 4px) scale(0.7); }
      15%  { opacity: 1; transform: translate(-50%, 0)   scale(1.08); }
      25%  { transform: translate(-50%, 0) scale(1); }
      75%  { opacity: 1; }
      100% { opacity: 0; }
    }
    @keyframes mobile2dSparkleOut {
      0%   { opacity: 1; transform: translate(-50%, -50%) scale(0.4); }
      35%  { opacity: 1; transform: translate(-50%, -50%) scale(1.3); }
      100% { opacity: 0; transform: translate(-50%, -50%) scale(0.1); }
    }
    @keyframes mobile2dBounce {
      0%   { transform: translateY(0); }
      30%  { transform: translateY(-6px); }
      60%  { transform: translateY(0); }
      80%  { transform: translateY(-2px); }
      100% { transform: translateY(0); }
    }
  `
  document.head.appendChild(style)
}

/**
 * Returns the input hex colour darkened by `amount` (0..1). Used by
 * the character sprite to derive outline / inner-shadow tones from
 * the body / skin / hair base so each character renders without a
 * separate stroke-colour prop.
 *
 * Accepts `#rgb`, `#rrggbb`, or anything else (passes through). Pure
 * function so it's safe to call inline in render.
 */
function darken(hex: string, amount: number): string {
  const m = hex.trim().match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i)
  if (!m) return hex
  let r: number, g: number, b: number
  const v = m[1]
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

/** Random-word pool the bubble cycles through during drag. Mirrors
 *  `DRAG_BUBBLE_WORDS` from the 3D `dragBubbleWords.ts` but kept
 *  inline here so the 2D module doesn't pull a 3D dependency. */
const DRAG_BUBBLE_WORDS = [
  'Wheee!',
  'Where to?',
  '🛸',
  'Hold on!',
  '✨',
  'Whoa',
  '😀',
  '😳',
  'Yeet!',
  'Flying!',
]

/** Per-character speech texts on tap — same pool the 3D scene uses. */
const SPEECH_TEXTS = ['Hi!', '👋', '✨', 'Hey!', '😊', 'Thanks!']

/** Sparkle colours + angles for the radial poke effect — mirrors the
 *  3D scene's burst. */
const SPARKLE_COLORS = ['#f472b6', '#60a5fa', '#34d399', '#fbbf24', '#a78bfa']
const SPARKLE_ANGLES = [0, 72, 144, 216, 288]

/** Drag detection threshold — once the pointer has moved this many
 *  pixels from its down position, the gesture is treated as a drag
 *  (not a tap). Bumped above the 6-pixel 3D threshold because touch
 *  taps wobble more than mouse clicks; a smaller threshold made
 *  intended taps register as accidental short drags. */
const DRAG_THRESHOLD_PX = 12

/** Vertical clamp during drag — keeps the character INSIDE the
 *  region of the mobile canvas that's NOT covered by floating UI.
 *
 *  Root cause this guards against: the MobileCounterChips strip
 *  (z-10, occupies top ~11% of the viewport) and the
 *  MobileBottomNav (z-30, occupies bottom ~10%) BOTH sit on a
 *  higher z than the character button (no explicit z, default 0
 *  inside the scene's `fixed inset-0` parent). Geometric hit-
 *  testing in real browsers (Chrome / Brave / Safari) routes any
 *  tap inside those overlay rects to the overlay, never to the
 *  character underneath — even if the character is fully painted.
 *
 *  The clamp accounts for the FULL character silhouette, not just
 *  the feet anchor. The button is `-translate-y-full`, so the
 *  visible body + head + name tag extend ~9% UPWARD from the feet
 *  yPct. We need:
 *    SAFE_Y_MIN  ≥  chip_band_bottom (11%) + character_height (9%)
 *                ≈  20%   — bumped to 22 for slack.
 *    SAFE_Y_MAX  ≤  100% − nav_band_height (10%)
 *                ≈  90%   — held at 88 for slack.
 *
 *  Claude's preview_click bypasses hit-testing (CSS-selector
 *  targeting hits the element directly), which is why earlier
 *  preview tests didn't reproduce. Real browsers MUST land the
 *  character fully outside the overlay rects. */
const SAFE_Y_MIN_PCT = 22
const SAFE_Y_MAX_PCT = 88

/** Max time between pointerdown and pointerup for a "tap" to still
 *  count, in ms. Longer presses without movement count as a long-
 *  press and are intentionally NOT treated as taps. Mirrors the
 *  350 ms used by the 3D scene. */
const TAP_MAX_MS = 350

/**
 * A single draggable minifigure. Lego-style stacked head + body +
 * legs with a name tag floating above. Two gestures map onto the
 * same target the same way they do on desktop:
 *
 *   TAP   (small movement + short press) → onTap()
 *                                          (opens TeammateBubble /
 *                                          NPC modal upstream)
 *   DRAG  (movement > DRAG_THRESHOLD_PX)  → onMove() per frame,
 *                                          then onPoke() on release
 *
 * Position state lives in the parent (via onMove + worldPos) so a
 * drag persists across re-renders until the user navigates away.
 */
function CharacterSprite({
  name,
  role,
  worldPos,
  bodyColor,
  hairColor = '#3b2410',
  skinColor = '#f5cfa8',
  sceneRef,
  onTap,
  onPoke,
  onMove,
}: {
  slug: string
  name: string
  role: string
  worldPos: [number, number, number]
  bodyColor: string
  /** Hair colour painted as a cap above the head. Defaults to a dark
   *  brown for backwards compat with callers that haven't been
   *  updated yet. */
  hairColor?: string
  /** Face / hand / arm tint. Defaults match the previous all-light
   *  face shade so older callers still render. */
  skinColor?: string
  sceneRef: React.RefObject<HTMLDivElement | null>
  onTap: () => void
  onPoke: () => void
  onMove: (pos: [number, number, number]) => void
}) {
  const { xPct, yPct } = projectToScreen(worldPos)
  // Gesture state — captured at pointerdown, mutated on pointermove,
  // consulted at pointerup to decide tap vs drag. `moved` flips true
  // the first time the pointer crosses the DRAG_THRESHOLD so we
  // commit to "drag" semantics for the rest of the gesture even if
  // the user fingers back closer to the start.
  const gestureRef = useRef<{
    pointerId: number
    startX: number
    startY: number
    startTime: number
    moved: boolean
    lastBubbleAt: number
  } | null>(null)

  // Cross-handler flag used to deduplicate the synthetic click event
  // the browser fires after touchend. The pointerup handler already
  // dispatches the tap/poke action; the onClick below is purely a
  // safety net for browsers where the pointer-event sequence drops
  // a frame (some Safari versions, some Android touch quirks). When
  // pointerup HAS handled the gesture, we set this flag so the
  // matching click event no-ops instead of double-firing onTap.
  const tapHandledRef = useRef(false)

  // ── Animation state ──────────────────────────────────────────
  // Each effect is keyed by an id that increments per trigger so
  // re-firing the same animation restarts it (React keys force the
  // overlay node to remount → its CSS animation plays from t=0).
  //
  //   speech / bubble  → pop-and-fade text bubble above the head.
  //                      Used for the random drag word AND for the
  //                      tap-feedback "Hi!" greetings.
  //   plus1Id          → "+1" text floating up after a poke.
  //   sparkleId        → 5-point sparkle burst around the body.
  //   bounceId         → tiny vertical bounce of the character body.
  const [speech, setSpeech] = useState<{ text: string; id: number } | null>(null)
  const [plus1Id, setPlus1Id] = useState(0)
  const [sparkleId, setSparkleId] = useState(0)
  const [bounceId, setBounceId] = useState(0)
  const speechIdRef = useRef(0)

  // Auto-dismiss the speech bubble after its CSS animation finishes
  // so stale text doesn't linger. The animation is 1.6s — wait a
  // beat past it to avoid race conditions with mid-flight re-renders.
  useEffect(() => {
    if (!speech) return
    const id = window.setTimeout(() => {
      setSpeech(s => (s?.id === speech.id ? null : s))
    }, 1800)
    return () => window.clearTimeout(id)
  }, [speech])

  function fireSpeech(text: string) {
    speechIdRef.current += 1
    setSpeech({ text, id: speechIdRef.current })
  }

  function firePoke() {
    // Synchronous burst of all four poke animations. The state
    // increments restart any animation already in flight.
    fireSpeech('+1 ✨')
    setPlus1Id(n => n + 1)
    setSparkleId(n => n + 1)
    setBounceId(n => n + 1)
  }

  function onPointerDown(e: React.PointerEvent<HTMLButtonElement>) {
    // Don't propagate so the scene's outer container doesn't try to
    // interpret this as a backdrop tap.
    e.stopPropagation()
    // Some browsers throw on setPointerCapture with unusual pointer
    // ids (older Safari + a few Android quirks). Capture is an
    // optimisation — without it the drag still works as long as the
    // finger stays over the button — so a failure here shouldn't
    // tank the whole gesture.
    try {
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    } catch {
      /* capture not supported in this browser/event combo */
    }
    gestureRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startTime: Date.now(),
      moved: false,
      // Track when the last drag-bubble fired so we throttle the
      // pool to ~1 word per ~1.2s (matches the 3D scene cadence).
      lastBubbleAt: 0,
    }
  }

  function onPointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    const g = gestureRef.current
    if (!g || g.pointerId !== e.pointerId) return
    const dx = e.clientX - g.startX
    const dy = e.clientY - g.startY
    const justCrossed =
      !g.moved && Math.sqrt(dx * dx + dy * dy) > DRAG_THRESHOLD_PX
    if (justCrossed) {
      g.moved = true
      // Fire the first drag-bubble immediately so the user gets
      // visual feedback the instant their gesture qualifies as a
      // drag. The throttle below picks up from there.
      fireSpeech(
        DRAG_BUBBLE_WORDS[Math.floor(Math.random() * DRAG_BUBBLE_WORDS.length)],
      )
      g.lastBubbleAt = Date.now()
    }
    if (g.moved) {
      // Throttled random-word bubble while the drag is sustained.
      const now = Date.now()
      if (now - g.lastBubbleAt > 1200) {
        fireSpeech(
          DRAG_BUBBLE_WORDS[Math.floor(Math.random() * DRAG_BUBBLE_WORDS.length)],
        )
        g.lastBubbleAt = now
      }
      // Translate cursor → scene-relative % → world coords, same
      // inverse projection the items-editor uses. The scene ref
      // gives us the actual canvas bounds without hard-coding any
      // viewport size assumptions. Y is clamped to the SAFE_Y_*
      // range so the character can't be dropped behind the
      // MobileCounterChips strip or the MobileBottomNav — both of
      // those overlays sit at z >= 10 and would otherwise eat
      // subsequent taps meant for the character.
      const rect = sceneRef.current?.getBoundingClientRect()
      if (!rect) return
      const cursorXPct = Math.max(
        0,
        Math.min(100, ((e.clientX - rect.left) / rect.width) * 100),
      )
      const cursorYPct = Math.max(
        SAFE_Y_MIN_PCT,
        Math.min(SAFE_Y_MAX_PCT, ((e.clientY - rect.top) / rect.height) * 100),
      )
      const world = inverseProjectToWorld(cursorXPct, cursorYPct, worldPos)
      onMove(world)
    }
  }

  function onPointerUp(e: React.PointerEvent<HTMLButtonElement>) {
    const g = gestureRef.current
    if (!g || g.pointerId !== e.pointerId) return
    gestureRef.current = null
    // Release capture explicitly so the next gesture's pointerdown
    // hit-tests against the actual element under the cursor instead
    // of inheriting our previous capture target. Some browsers
    // release automatically on pointerup, others hold the capture
    // until releasePointerCapture is called.
    try {
      ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
    } catch {
      /* nothing was captured — fine */
    }
    const elapsed = Date.now() - g.startTime
    if (g.moved) {
      // Drag-drop completed — fire the poke + the visual burst
      // (+1 / sparkles / bounce / speech). Position was already
      // updated mid-gesture via onMove; we don't write again.
      firePoke()
      onPoke()
      tapHandledRef.current = true
    } else if (elapsed < TAP_MAX_MS) {
      // Tap → open the bubble/modal upstream AND show a brief
      // greeting overlay so the user sees the character acknowledge
      // their tap before the modal animation lands.
      fireSpeech(
        SPEECH_TEXTS[Math.floor(Math.random() * SPEECH_TEXTS.length)],
      )
      setBounceId(n => n + 1)
      onTap()
      tapHandledRef.current = true
    }
    // Long-press without movement is intentionally a no-op (no
    // accidental modal opens after the user touched and waited).
    // Clear the dedup flag once the browser would have dispatched
    // its synthetic click event (50ms is well past the worst-case
    // delay on modern mobile browsers).
    window.setTimeout(() => {
      tapHandledRef.current = false
    }, 80)
  }

  function onClick(e: React.MouseEvent<HTMLButtonElement>) {
    // Safety-net tap handler for the touch-event edge cases where
    // pointerup doesn't fire / drops a frame / is interrupted. On a
    // normal gesture the pointerup handler above already set
    // tapHandledRef.current, so this no-ops. If pointerup never
    // fired, the synthetic click below still opens the modal.
    e.stopPropagation()
    if (tapHandledRef.current) return
    fireSpeech(
      SPEECH_TEXTS[Math.floor(Math.random() * SPEECH_TEXTS.length)],
    )
    setBounceId(n => n + 1)
    onTap()
  }

  return (
    <button
      type="button"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onClick={onClick}
      aria-label={`${name} — ${role}`}
      // Anchor by the character's FEET, not its centre, so changing
      // the figure's height doesn't shift its floor position.
      // touch-action: none → reach all touch sequences without the
      // browser stealing them for scroll/pinch first.
      // z-10 makes hit-test wins explicit — even if a future sibling
      // accidentally creates its own stacking context (transform,
      // filter, etc), the character button stays the topmost
      // tappable element in the scene's stacking context.
      className="absolute z-10 -translate-x-1/2 -translate-y-full pointer-events-auto group cursor-grab active:cursor-grabbing"
      style={{
        left: `${xPct}%`,
        top: `${yPct}%`,
        touchAction: 'none',
      }}
    >
      {/* Name + role tag floating above the head. Always visible on
          mobile (no hover) so the user can tell minifigures apart at
          a glance — matches the mockup's "Mia / Iris / Leo" labels. */}
      <div className="mb-1 px-1.5 py-0.5 rounded-sm bg-night-deep/85 border border-white/15 text-[8.5px] leading-tight text-tower-cream text-center min-w-[36px] max-w-[64px] mx-auto">
        <div className="font-bold truncate">{name}</div>
        <div className="text-[7.5px] text-tower-cream/55 truncate">{role}</div>
      </div>

      {/* Speech bubble — appears for both drag-bubble words AND tap
          greetings (+1/✨ overlay after a poke). One node handles
          both flows; the `key` restart drives the CSS animation. */}
      {speech && (
        <div
          key={speech.id}
          className="absolute left-1/2 -top-6 z-10 pointer-events-none whitespace-nowrap"
          style={{
            transform: 'translate(-50%, 0)',
            animation: 'mobile2dSpeechPop 1.6s ease-out forwards',
          }}
          aria-hidden
        >
          <div className="px-1.5 py-0.5 rounded-md bg-white text-night-deep text-[9px] font-bold shadow-[0_4px_10px_rgba(0,0,0,0.45)]">
            {speech.text}
          </div>
        </div>
      )}

      {/* +1 floating up text — fired on a poke. Independent of the
          speech bubble (which shows '+1 ✨' during the same beat) so
          the two effects stack and the burst reads bigger. */}
      {plus1Id > 0 && (
        <div
          key={plus1Id}
          className="absolute left-1/2 top-0 pointer-events-none text-[12px] font-extrabold"
          style={{
            color: bodyColor,
            textShadow: '0 1px 4px rgba(0,0,0,0.6)',
            transform: 'translate(-50%, 0)',
            animation: 'mobile2dFloatUp 0.9s ease-out forwards',
          }}
          aria-hidden
        >
          +1
        </div>
      )}

      {/* Sparkle burst — 5 dots radiating outward from the body
          centre at the angles from `SPARKLE_ANGLES`. */}
      {sparkleId > 0 && (
        <div
          key={sparkleId}
          className="absolute left-1/2 top-1/2 w-0 h-0 pointer-events-none"
          aria-hidden
        >
          {SPARKLE_ANGLES.map((angle, i) => {
            const rad = (angle * Math.PI) / 180
            const dx = Math.cos(rad) * 22
            const dy = Math.sin(rad) * 22
            return (
              <span
                key={i}
                className="absolute w-1.5 h-1.5 rounded-full"
                style={{
                  background: SPARKLE_COLORS[i % SPARKLE_COLORS.length],
                  left: `${dx}px`,
                  top: `${dy}px`,
                  boxShadow: `0 0 6px ${SPARKLE_COLORS[i % SPARKLE_COLORS.length]}`,
                  animation: 'mobile2dSparkleOut 0.8s ease-out forwards',
                }}
              />
            )
          })}
        </div>
      )}

      {/* Stacked body — hair + head + torso + arms + hands + legs.
          Soft box-shadow matches the 3D scene's emissive glow.
          The bounce animation wraps the whole stack via a keyed inner
          div so re-firing restarts the keyframes from t=0. */}
      <div
        key={`bounce-${bounceId}`}
        className="mx-auto w-7 h-9 rounded-sm relative"
        style={{
          background: bodyColor,
          boxShadow: `0 0 14px ${bodyColor}55`,
          animation: bounceId > 0 ? 'mobile2dBounce 0.45s ease-out' : undefined,
        }}
      >
        {/* Head — skin-toned square with subtle darker outline */}
        <div
          className="absolute left-1/2 -translate-x-1/2 -top-3.5 w-5 h-5 rounded-sm"
          style={{
            background: skinColor,
            border: `1px solid ${darken(skinColor, 0.35)}`,
          }}
        >
          {/* Hair — cap that sits on the top of the head, sticks out
              a hair (no pun) on both sides so the character reads as
              having a hairline instead of a bald skin block. Renders
              behind the eyes because eyes are positioned absolutely
              from the head. */}
          <div
            className="absolute -top-[3px] -left-[1.5px] -right-[1.5px] h-2 rounded-t-md"
            style={{
              background: hairColor,
              boxShadow: `inset 0 -1px 0 ${darken(hairColor, 0.25)}`,
            }}
            aria-hidden
          />
          {/* Side hair tufts — frame the face on both sides so the
              top-down hair cap doesn't read as a floating beanie. */}
          <span
            className="absolute -left-[1.5px] top-[2px] w-[2px] h-[6px]"
            style={{ background: hairColor }}
            aria-hidden
          />
          <span
            className="absolute -right-[1.5px] top-[2px] w-[2px] h-[6px]"
            style={{ background: hairColor }}
            aria-hidden
          />

          {/* Eyes — bumped to 1×1 px so they're visible at this scale
              (the previous 0.5×0.5 effectively rendered as half pixels
              and disappeared on most displays). */}
          <span className="absolute left-[5px] top-[8px] w-[2px] h-[2px] rounded-[1px] bg-[#1a1a2e]" />
          <span className="absolute right-[5px] top-[8px] w-[2px] h-[2px] rounded-[1px] bg-[#1a1a2e]" />
          {/* Smile — slightly thicker arc so it reads across the small face */}
          <span className="absolute left-1/2 -translate-x-1/2 bottom-[3px] w-2 h-[1.5px] rounded-full bg-[#a8362c]" />
        </div>

        {/* Left + right arms — same colour as the torso so the arm
            silhouette extends the clothes block, with a skin-toned
            hand at the bottom. Slightly inset from the body's outer
            edge so they read as separate limbs, not a wider torso. */}
        <span
          className="absolute -left-[3px] top-[3px] w-[3px] h-[15px] rounded-sm"
          style={{
            background: bodyColor,
            boxShadow: `inset 1px 0 0 ${darken(bodyColor, 0.2)}`,
          }}
          aria-hidden
        />
        <span
          className="absolute -right-[3px] top-[3px] w-[3px] h-[15px] rounded-sm"
          style={{
            background: bodyColor,
            boxShadow: `inset -1px 0 0 ${darken(bodyColor, 0.2)}`,
          }}
          aria-hidden
        />
        {/* Hands — small skin-toned blocks anchored to the bottom of
            each arm. Just-visible at this scale but enough to break
            the silhouette so the character reads as "arms hanging at
            its sides" not "rectangular costume". */}
        <span
          className="absolute -left-[3px] top-[18px] w-[3px] h-[3px] rounded-sm"
          style={{
            background: skinColor,
            border: `1px solid ${darken(skinColor, 0.35)}`,
          }}
          aria-hidden
        />
        <span
          className="absolute -right-[3px] top-[18px] w-[3px] h-[3px] rounded-sm"
          style={{
            background: skinColor,
            border: `1px solid ${darken(skinColor, 0.35)}`,
          }}
          aria-hidden
        />

        {/* Legs — dark trousers, slightly more spread so the gait
            reads at the small scale. */}
        <div className="absolute left-1 -bottom-2 w-2 h-2.5 bg-[#2d2d2d] rounded-sm" />
        <div className="absolute right-1 -bottom-2 w-2 h-2.5 bg-[#2d2d2d] rounded-sm" />
      </div>
    </button>
  )
}
