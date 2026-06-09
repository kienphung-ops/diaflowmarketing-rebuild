/**
 * Floor → window-scenery image mapping.
 *
 * Mirrors the same banding the 3D scene uses in
 * `components/scene/environment/Walls.tsx → floorToImageNumber`,
 * so the back-wall window on mobile shows the same landscape the
 * user saw on desktop at the same floor. The /window_images/ PNGs
 * live in /public so the URL works from both renderers.
 *
 *   Floor 1         → 1.avif
 *   Floor 2 – 5     → 2.avif
 *   Floor 6 – 10    → 3.avif
 *   Floor 11 – 15   → 4.avif
 *   Floor 16 – 19   → 5.avif
 *   Floor 20        → 6.avif  (penthouse night-sky panorama —
 *                              UNUSED on mobile because the wall
 *                              window itself is hidden at the
 *                              penthouse, see Mobile2DScene.)
 */
export function floorToWindowImage(floor: number): string {
  let n = 1
  if (floor <= 1) n = 1
  else if (floor <= 5) n = 2
  else if (floor <= 10) n = 3
  else if (floor <= 15) n = 4
  else if (floor <= 19) n = 5
  else n = 6
  return `/window_images/${n}.avif`
}
