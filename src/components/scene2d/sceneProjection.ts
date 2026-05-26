/**
 * Front-elevation 2D projection for the mobile office scene.
 *
 * The 3D scene uses world coordinates where:
 *   x  →  left/right         [-7 .. 6.5]      (room width)
 *   y  →  up/down (height)   [-0.55 .. 4.2]   (floor → penthouse band)
 *   z  →  front/back (depth) [-5.4 .. 5.6]    (back wall → camera)
 *
 * For the mobile front-elevation view we collapse z into y-on-screen
 * so the scene reads as a flat illustration:
 *
 *   • Wall items (z ≤ WALL_Z_THRESHOLD) sit on the back wall — their
 *     world Y maps to a percentage of the wall band's height, world X
 *     maps straight to the wall's horizontal extent.
 *   • Floor items (z > WALL_Z_THRESHOLD) stand on the floor — world X
 *     maps to the floor's horizontal extent, world Z controls how far
 *     "down the floor strip" they sit (far back → near the wall, far
 *     forward → near the front edge).
 *
 * Both projections return CSS percentages, ready to drop straight into
 * `left:` / `top:` / `bottom:` style props on absolutely-positioned
 * sprites inside the scene's outer container.
 */

/** Items at or behind this Z are treated as wall-mounted. */
export const WALL_Z_THRESHOLD = -5.0

/** Visible world-X extent the scene maps into the canvas width. We
 *  clamp slightly inside the 3D scene's actual bounds (~±7) so wall-
 *  edge items don't render flush against the device edge. */
const X_MIN = -6.5
const X_MAX = 6.5

/** Wall band height — what fraction of the canvas the back wall
 *  occupies (top portion). Floor takes the remainder. */
export const WALL_BAND_PCT = 0.55

/** Visible world-Y extent on the wall. Items at the bottom of the
 *  wall (y ≈ -0.55) sit just above the floor join; items at the top
 *  (y ≈ 4.5) hug the ceiling. */
const Y_MIN = -0.55
const Y_MAX = 4.5

/** Visible world-Z extent on the floor. */
const Z_FLOOR_MIN = -5.0
const Z_FLOOR_MAX = 5.5

/** Convert a world position to an (xPct, yPct) screen position
 *  (both 0..100). `xPct` is the same regardless of whether the
 *  item is wall- or floor-mounted; `yPct` switches based on the
 *  z threshold. */
export function projectToScreen(
  pos: [number, number, number],
): { xPct: number; yPct: number; onWall: boolean } {
  const [x, y, z] = pos
  const xPct = ((Math.max(X_MIN, Math.min(X_MAX, x)) - X_MIN) / (X_MAX - X_MIN)) * 100

  if (z <= WALL_Z_THRESHOLD) {
    // Wall-mounted: world Y → vertical position INSIDE the wall band.
    // y=Y_MIN → bottom of band; y=Y_MAX → top of band.
    const norm = (Math.max(Y_MIN, Math.min(Y_MAX, y)) - Y_MIN) / (Y_MAX - Y_MIN)
    // Invert so high world Y → small screen Y (top of canvas).
    const yPct = WALL_BAND_PCT * 100 * (1 - norm)
    return { xPct, yPct, onWall: true }
  }

  // Floor-mounted: world Z → vertical position INSIDE the floor band.
  // z near Z_FLOOR_MIN → just below the wall (top of floor strip).
  // z near Z_FLOOR_MAX → near the front edge of the floor.
  const norm =
    (Math.max(Z_FLOOR_MIN, Math.min(Z_FLOOR_MAX, z)) - Z_FLOOR_MIN) /
    (Z_FLOOR_MAX - Z_FLOOR_MIN)
  const yPct = WALL_BAND_PCT * 100 + (1 - WALL_BAND_PCT) * 100 * norm
  return { xPct, yPct, onWall: false }
}

/**
 * Inverse projection — given a screen position in % AND the item's
 * existing world position (so we can preserve the irrelevant axis),
 * back out a new world position. The items-editor uses this to
 * convert drag targets into world coords without forcing the user to
 * type x/y/z by hand.
 *
 * Behaviour:
 *   • If the new screen point lands in the WALL band (yPct ≤
 *     WALL_BAND_PCT*100), we treat the item as wall-mounted: x is
 *     re-derived from xPct, y is re-derived from yPct, and z is
 *     pinned to WALL_Z_THRESHOLD - 0.34 (≈ -5.34, the canonical
 *     back-wall depth used by the 3D scene).
 *   • Otherwise the item is floor-mounted: x is re-derived from xPct,
 *     z is re-derived from yPct, and y is pinned to the floor level
 *     -0.55 (matches the floor-standing meshes in the 3D scene).
 *
 * The original `prev` is consulted only to keep the editor robust if
 * we ever introduce a different anchor convention; today the only
 * value carried over is the world-X comparison for snap-to-grid
 * (none yet) and as a fallback when the input is malformed.
 */
export function inverseProjectToWorld(
  xPct: number,
  yPct: number,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  prev?: [number, number, number],
): [number, number, number] {
  const clampedXPct = Math.max(0, Math.min(100, xPct))
  const worldX = X_MIN + (clampedXPct / 100) * (X_MAX - X_MIN)

  const wallBandPx = WALL_BAND_PCT * 100
  if (yPct <= wallBandPx) {
    const norm = 1 - yPct / wallBandPx
    const worldY = Y_MIN + norm * (Y_MAX - Y_MIN)
    // -5.34 is the canonical back-wall Z — matches the 3D scene's
    // wall-mounted item positions in FloorItems.tsx.
    return [worldX, worldY, -5.34]
  }

  // Floor band — z derives from how far down the floor strip we are.
  const norm = (yPct - wallBandPx) / (100 - wallBandPx)
  const worldZ = Z_FLOOR_MIN + norm * (Z_FLOOR_MAX - Z_FLOOR_MIN)
  // -0.55 is the floor level used by every floor-standing mesh in
  // FloorItems.tsx (the ITEMS array's third coordinate for them all).
  return [worldX, -0.55, worldZ]
}
