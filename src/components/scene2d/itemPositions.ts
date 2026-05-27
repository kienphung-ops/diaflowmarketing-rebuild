/**
 * Item positions for the mobile 2D front-elevation office scene.
 *
 * Hand-edited via the `/admin/items-editor-2d` page and pasted back
 * here. Values were last finalised against
 * `requirements/positons.js` — keep the two in sync when the editor
 * is used again. The 3D scene (FloorItems.tsx) keeps its OWN
 * positions because the iso projection has different framing
 * constraints; the two arrays are intentionally allowed to drift.
 *
 * For multi-instance items (office_desk, basic_chair,
 * executive_chair, upgraded_desk), `position` is instance 0 and
 * subsequent copies step by `offsetStep` per copy.
 */

export interface Item2DConfig {
  key: string
  position: [number, number, number]
  /** Multi-instance items step their X by this delta per copy. */
  offsetStep?: [number, number, number]
}

export const ITEMS_2D: Item2DConfig[] = [
  {
    key: 'office_desk',
    position: [-3.0, -0.55, 0.3],
    offsetStep: [2.5, 0, 0],
  },
  { key: 'floor_lamp', position: [-5.01, -0.55, -2.82] },
  {
    key: 'basic_chair',
    position: [-3.0, -0.55, -0.70],
    offsetStep: [2.5, 0, 0],
  },
  {
    key: 'executive_chair',
    position: [-3.0, -0.55, -0.70],
    offsetStep: [2.5, 0, 0],
  },
  { key: 'potted_plant', position: [-5.00, 1.0, 2.91] },
  { key: 'coffee_mug', position: [-3.50, -1.0, 0.15] },
  { key: 'bookshelf', position: [-5.80, 0.75, -5.30] },
  { key: 'printer', position: [-3.64, -0.54, -5.34] },
  { key: 'whiteboard', position: [2.0, 2.95, -5.34] },
  { key: 'mini_fridge', position: [3.46, -0.30, -5.34] },
  { key: 'trophy', position: [-5.80, 2.45, -5.18] },
  { key: 'couch', position: [4.51, -0.55, 2.62] },
  {
    key: 'upgraded_desk',
    position: [-3.0, -0.55, 0.3],
    offsetStep: [2.5, 0, 0],
  },
  { key: 'neon_sign', position: [-2.0, 3.20, -5.29] },
  // `arcade_machine` is no longer floor-gated decor — it's the spin
  // entry point, rendered ALWAYS as an interactive sprite in
  // Mobile2DScene (see <Arcade2D>). Removed here to avoid duplication.
  { key: 'floor_ceiling_windows', position: [4.87, 2.27, -5.34] },
  { key: 'tea_table', position: [4.23, -0.55, 4.05] },
  { key: 'living_wall', position: [1.08, 1.49, -5.34] },
  { key: 'espresso_machine', position: [5.33, -0.36, -5.34] },
  { key: 'ping_pong_table', position: [-0.11, -0.55, 2.91] },
  { key: 'dj_stand', position: [-1.21, -0.49, -5.34] },
  { key: 'penthouse', position: [-2.52, 4.20, -5.16] },
]

/** Default character positions (mirrors RECRUIT_POSITIONS +
 *  CHAR_CONFIGS from OfficeScene.tsx). The 2D scene needs these to
 *  place clickable minifigures. */
export const CHARACTER_2D_POSITIONS = {
  iris: [-1.5, -0.05, 1.2] as [number, number, number],
  mia: [1.2, -0.05, 2.0] as [number, number, number],
  leo: [3.5, -0.05, 1.5] as [number, number, number],
}

export const RECRUIT_2D_POSITIONS: [number, number, number][] = [
  [-3.5, -0.05, 0.3],
  [-5.2, -0.05, 1.5],
  [-2.0, -0.05, 2.5],
  [-4.5, -0.05, 3.2],
  [-0.8, -0.05, 3.8],
  [-3.0, -0.05, 1.0],
  [-1.5, -0.05, 0.8],
  [-5.5, -0.05, 3.0],
]
