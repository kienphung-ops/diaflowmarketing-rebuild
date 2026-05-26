'use client'

/**
 * /admin/items-editor-2d — drag-to-arrange editor for the mobile 2D
 * front-elevation office scene.
 *
 * Workflow:
 *   1. Each item from `ITEMS_2D` renders at its current world
 *      position, projected to screen %.
 *   2. The user mouse-down / touch-starts on a sprite and drags it
 *      anywhere on the canvas. The drag handler converts the cursor
 *      position back to world coordinates via `inverseProjectToWorld`
 *      and writes the new value into local state.
 *   3. The world-coord readout updates live in the side panel. When
 *      the user is happy, they hit **Copy JSON** — the clipboard
 *      ends up with a literal TypeScript-array snippet ready to
 *      paste into `src/components/scene2d/itemPositions.ts`.
 *
 * The page does NOT persist to the server / a user row. It's an
 * internal layout tool — output is meant to land in source control,
 * not in the per-user `User.itemPositions` JSON column.
 *
 * Multi-instance items (office_desk, basic_chair, executive_chair,
 * upgraded_desk) only expose INSTANCE 0 for dragging. Their
 * `offsetStep` is untouched — moving instance 0 visually shifts the
 * whole cluster in lockstep.
 */

import { useCallback, useMemo, useRef, useState } from 'react'
import {
  inverseProjectToWorld,
  projectToScreen,
  WALL_BAND_PCT,
} from '@/components/scene2d/sceneProjection'
import {
  ITEMS_2D,
  type Item2DConfig,
} from '@/components/scene2d/itemPositions'
import { SPRITES, SPRITE_SIZES, PlaceholderSprite } from '@/components/scene2d/itemSprites'

type PositionMap = Record<string, [number, number, number]>

export default function ItemsEditor2DPage() {
  // Working copy of the positions. We seed from the canonical
  // ITEMS_2D array and mutate locally; the source file is never
  // touched until the user copies the JSON and pastes it back in.
  const [positions, setPositions] = useState<PositionMap>(() => {
    const m: PositionMap = {}
    for (const it of ITEMS_2D) m[it.key] = it.position
    return m
  })

  // Which item the user has selected via click. Drives the side-panel
  // coord readout + highlights the sprite in the canvas.
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  // True while a drag gesture is in progress, used to suppress the
  // "tap to select" handler so a drag doesn't immediately swap which
  // sprite is selected.
  const draggingRef = useRef<{ key: string; pointerId: number } | null>(null)
  const canvasRef = useRef<HTMLDivElement | null>(null)

  // ── Drag handlers ─────────────────────────────────────────────
  const onPointerDown = useCallback(
    (key: string) => (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault()
      e.stopPropagation()
      ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
      draggingRef.current = { key, pointerId: e.pointerId }
      setSelectedKey(key)
    },
    [],
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const drag = draggingRef.current
      const canvas = canvasRef.current
      if (!drag || !canvas || e.pointerId !== drag.pointerId) return
      const rect = canvas.getBoundingClientRect()
      // Compute the cursor's position relative to the canvas, as a
      // percentage. Clamp inside the visible canvas.
      const xPct = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100))
      const yPct = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100))
      const next = inverseProjectToWorld(xPct, yPct, positions[drag.key])
      setPositions(prev => ({ ...prev, [drag.key]: next }))
    },
    [positions],
  )

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const drag = draggingRef.current
      if (drag && drag.pointerId === e.pointerId) {
        draggingRef.current = null
      }
    },
    [],
  )

  // ── JSON output ───────────────────────────────────────────────
  // Produces a literal `ITEMS_2D` array snippet that can be pasted
  // straight back into src/components/scene2d/itemPositions.ts.
  // Preserves the offsetStep on multi-instance items by reading it
  // from the canonical array.
  const jsonOutput = useMemo(() => {
    return formatItemsArray(ITEMS_2D, positions)
  }, [positions])

  const [copied, setCopied] = useState(false)
  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(jsonOutput)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard unavailable — user can still select + copy from the
         visible textarea. */
    }
  }

  function handleReset() {
    const m: PositionMap = {}
    for (const it of ITEMS_2D) m[it.key] = it.position
    setPositions(m)
    setSelectedKey(null)
  }

  // ── Render ────────────────────────────────────────────────────
  return (
    <main className="fixed inset-0 flex flex-col md:flex-row bg-night-deep text-tower-cream">
      {/* Canvas — proportions roughly match a phone viewport so the
          editor previews the same layout the production mobile scene
          will render. */}
      <div className="relative flex-1 md:max-w-[420px] aspect-[9/16] md:aspect-auto md:h-full mx-auto md:mx-0 border border-white/10 overflow-hidden bg-[#1a1530] touch-none">
        <div
          ref={canvasRef}
          className="absolute inset-0"
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {/* Back wall */}
          <div
            className="absolute inset-x-0 top-0 bg-[#d4c5a9]"
            style={{
              height: `${WALL_BAND_PCT * 100}%`,
              boxShadow: 'inset 0 -20px 30px rgba(0,0,0,0.25)',
            }}
          />
          {/* Floor */}
          <div
            className="absolute inset-x-0 bottom-0"
            style={{
              top: `${WALL_BAND_PCT * 100}%`,
              background:
                'repeating-linear-gradient(135deg, #8b5e3c 0, #8b5e3c 10px, #6b4527 10px, #6b4527 11px)',
            }}
          />

          {/* Visual marker for the wall/floor seam — helps the user
              eyeball whether they're dropping an item on the wall vs
              the floor band. */}
          <div
            className="absolute inset-x-0 h-px bg-white/20"
            style={{ top: `${WALL_BAND_PCT * 100}%` }}
          />

          {/* Items */}
          {ITEMS_2D.map(item => {
            const pos = positions[item.key]
            const projected = projectToScreen(pos)
            const size = SPRITE_SIZES[item.key] ?? { w: 40, h: 40 }
            const renderer = SPRITES[item.key]
            const isSelected = selectedKey === item.key
            return (
              <div
                key={item.key}
                className={
                  'absolute -translate-x-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing ' +
                  (isSelected ? 'z-20 ring-2 ring-tower-gold rounded-sm' : 'z-10')
                }
                style={{
                  left: `${projected.xPct}%`,
                  top: `${projected.yPct}%`,
                  width: size.w,
                  height: size.h,
                  touchAction: 'none',
                }}
                onPointerDown={onPointerDown(item.key)}
                title={item.key}
              >
                {renderer ? (
                  // Editor previews against a representative
                  // mid-tower floor (10) so the floor-ceiling
                  // windows + any future floor-aware sprites show
                  // their typical art rather than the F1 / F20
                  // edge cases.
                  renderer({ companyName: 'Diaflow', currentFloor: 10 })
                ) : (
                  <PlaceholderSprite />
                )}
                {isSelected && (
                  <div className="absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap text-[9px] font-bold bg-tower-gold text-night-deep px-1 rounded-sm">
                    {item.key}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Side panel — item list + selected-coord readout + JSON
          output. On mobile this stacks underneath the canvas, on
          desktop it lives in the right column. */}
      <aside className="flex-1 min-h-0 overflow-y-auto bg-night-mid border-l border-white/10 p-4 space-y-4">
        <header>
          <div className="text-[10px] uppercase tracking-[0.15em] text-tower-gold/70 font-bold">
            Mobile 2D scene
          </div>
          <h1 className="text-lg font-bold">Items editor</h1>
          <p className="text-xs text-tower-cream/55 mt-1 leading-relaxed">
            Drag any item to a new position. Multi-instance items
            (desks, chairs) move as a cluster — the editor exposes
            instance 0 only.
          </p>
        </header>

        {/* Item list — click to select, sprite is highlighted in the
            canvas. Lets the user pick a small / hidden item that's
            hard to grab via direct click. */}
        <section>
          <div className="text-[10px] uppercase tracking-widest text-tower-cream/45 mb-1.5">
            Items
          </div>
          <div className="grid grid-cols-2 gap-1">
            {ITEMS_2D.map(item => (
              <button
                key={item.key}
                type="button"
                onClick={() => setSelectedKey(item.key)}
                className={
                  'text-left text-[11px] px-2 py-1 rounded border ' +
                  (selectedKey === item.key
                    ? 'bg-tower-gold/15 border-tower-gold text-tower-cream'
                    : 'bg-night-deep/60 border-white/5 text-tower-cream/65 hover:border-white/15')
                }
              >
                {item.key}
              </button>
            ))}
          </div>
        </section>

        {/* Selected-item coord readout */}
        {selectedKey && (
          <section className="rounded-md border border-white/10 bg-night-deep/50 p-3 space-y-1">
            <div className="text-[10px] uppercase tracking-widest text-tower-gold/80 font-bold">
              {selectedKey}
            </div>
            <CoordRow label="x" value={positions[selectedKey]?.[0]} />
            <CoordRow label="y" value={positions[selectedKey]?.[1]} />
            <CoordRow label="z" value={positions[selectedKey]?.[2]} />
            <div className="text-[10px] text-tower-cream/40 pt-1">
              {positions[selectedKey]?.[2] <= -5.0
                ? 'Wall-mounted — y drives vertical, z pinned to −5.34'
                : 'Floor-mounted — z drives depth, y pinned to −0.55'}
            </div>
          </section>
        )}

        {/* JSON output */}
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-[10px] uppercase tracking-widest text-tower-cream/45">
              Paste into{' '}
              <code className="text-tower-gold/80">itemPositions.ts</code>
            </div>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={handleReset}
                className="text-[10px] px-2 py-1 rounded bg-night-deep/60 border border-white/10 text-tower-cream/70 hover:border-white/20"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={handleCopy}
                className="text-[10px] px-2 py-1 rounded bg-tower-gold text-night-deep font-semibold"
              >
                {copied ? 'Copied!' : 'Copy JSON'}
              </button>
            </div>
          </div>
          <textarea
            readOnly
            value={jsonOutput}
            className="w-full h-60 text-[10px] font-mono leading-tight bg-night-deep/70 border border-white/10 rounded p-2 text-tower-cream/85 resize-none"
            onClick={e => (e.target as HTMLTextAreaElement).select()}
          />
        </section>
      </aside>
    </main>
  )
}

function CoordRow({ label, value }: { label: string; value: number | undefined }) {
  return (
    <div className="flex justify-between text-xs">
      <span className="text-tower-cream/55">{label}</span>
      <span className="font-mono text-tower-cream/90">
        {value === undefined ? '—' : value.toFixed(2)}
      </span>
    </div>
  )
}

/**
 * Serialise the working position map into a TypeScript-array snippet
 * matching the canonical `ITEMS_2D` declaration. Multi-instance
 * `offsetStep` entries are preserved verbatim from the source so the
 * cluster spacing math doesn't get accidentally lost on copy-paste.
 */
function formatItemsArray(
  source: Item2DConfig[],
  positions: PositionMap,
): string {
  const lines = source.map(item => {
    const pos = positions[item.key] ?? item.position
    const x = pos[0].toFixed(2)
    const y = pos[1].toFixed(2)
    const z = pos[2].toFixed(2)
    if (item.offsetStep) {
      const ox = item.offsetStep[0].toFixed(2)
      const oy = item.offsetStep[1].toFixed(2)
      const oz = item.offsetStep[2].toFixed(2)
      return `  {\n    key: '${item.key}',\n    position: [${x}, ${y}, ${z}],\n    offsetStep: [${ox}, ${oy}, ${oz}],\n  },`
    }
    return `  { key: '${item.key}', position: [${x}, ${y}, ${z}] },`
  })
  return `export const ITEMS_2D: Item2DConfig[] = [\n${lines.join('\n')}\n]`
}
