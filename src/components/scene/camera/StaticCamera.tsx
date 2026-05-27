'use client'

import { useEffect, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'

/**
 * Locked overview camera with two distinct modes depending on viewport
 * aspect:
 *
 *   Desktop landscape (aspect ≥ 1): OrthographicCamera at (10, 9.5, 10)
 *     looking at (0, 0.8, 0) with frustum half-height 5.2 — matches the
 *     old marketing site's "resting" iso frame. Parallel-lines diorama
 *     look (Bloxburg / Sims), no perspective foreshortening.
 *
 *   Mobile portrait (aspect < 1): PerspectiveCamera with FOV 50 along
 *     direction (0, 5, 13) rotated -10° around X — the same lower-angle
 *     framing we shipped before, so portrait phones still see the back
 *     wall without the room shrinking into specks.
 *
 * Zoom: wheel-scroll on desktop / pinch on touch. Ortho mutates
 * `cam.zoom`; perspective slides the camera along its direction vector
 * (preserves consistent perspective). Pan/rotate stay disabled — the
 * room never swings while the user drags a teammate.
 */

// ----- Desktop (orthographic) -----
const POSITION_DESKTOP = new THREE.Vector3(10, 9.5, 10)
const LOOK_AT_DESKTOP = new THREE.Vector3(0, 0.8, 0)
const FRUSTUM_HALF_HEIGHT = 5.2
// Lowered floor (was 0.7) so desktop users can pull back further — at
// 0.7 a back-wall corner stayed clipped on wider viewports; 0.45 widens
// the ortho frustum ~1.5× more so the whole room (and both wall corners)
// fit in frame when zoomed all the way out.
const ORTHO_ZOOM_MIN = 0.45
const ORTHO_ZOOM_MAX = 1.8
const WHEEL_STEP_ORTHO = 0.0015
const PINCH_STEP_ORTHO = 0.005

// ----- Mobile (perspective, unchanged from prior shipped version) -----
const POSITION_DIR_MOBILE = (() => {
  const v = new THREE.Vector3(0, 5, 13)
  v.applyAxisAngle(new THREE.Vector3(1, 0, 0), -(10 * Math.PI) / 180)
  return v
})()
const LOOK_AT_MOBILE = new THREE.Vector3(0, 0, -1)
const FOV = 50
const TARGET_HALF_WIDTH = 9.2
// Original minimum-distance cap was the magnitude of the old desktop
// direction (8, 8, 8); we keep that constant so mobile framing is
// pixel-identical to what shipped.
const MIN_DISTANCE = new THREE.Vector3(8, 8, 8).length() // ≈ 13.86
const PERSP_ZOOM_MIN = 0.55
const PERSP_ZOOM_MAX = 1.45
const WHEEL_STEP_PERSP = 0.001
const PINCH_STEP_PERSP = 0.004

function isPortrait(aspect: number): boolean {
  return aspect < 1
}

function perspDistanceForAspect(aspect: number): number {
  const halfFovY = ((FOV * Math.PI) / 180) / 2
  // half-width visible at distance d = d * tan(vFov/2) * aspect
  const required = TARGET_HALF_WIDTH / (Math.tan(halfFovY) * aspect)
  return Math.max(MIN_DISTANCE, required)
}

function perspPositionFor(aspect: number, zoom: number): THREE.Vector3 {
  const distance = perspDistanceForAspect(aspect) * zoom
  return POSITION_DIR_MOBILE.clone().normalize().multiplyScalar(distance)
}

function orthoFrustum(aspect: number) {
  const halfH = FRUSTUM_HALF_HEIGHT
  const halfW = FRUSTUM_HALF_HEIGHT * aspect
  return { halfW, halfH }
}

function clampZoom(z: number, portrait: boolean): number {
  const min = portrait ? PERSP_ZOOM_MIN : ORTHO_ZOOM_MIN
  const max = portrait ? PERSP_ZOOM_MAX : ORTHO_ZOOM_MAX
  return Math.max(min, Math.min(max, z))
}

type StaticCam = THREE.PerspectiveCamera | THREE.OrthographicCamera

function createCamera(aspect: number, zoom: number): StaticCam {
  if (isPortrait(aspect)) {
    const cam = new THREE.PerspectiveCamera(FOV, aspect, 0.1, 1000)
    cam.position.copy(perspPositionFor(aspect, zoom))
    cam.lookAt(LOOK_AT_MOBILE)
    cam.updateProjectionMatrix()
    return cam
  }
  const { halfW, halfH } = orthoFrustum(aspect)
  const cam = new THREE.OrthographicCamera(
    -halfW,
    halfW,
    halfH,
    -halfH,
    0.1,
    200,
  )
  cam.position.copy(POSITION_DESKTOP)
  cam.lookAt(LOOK_AT_DESKTOP)
  cam.zoom = zoom
  cam.updateProjectionMatrix()
  return cam
}

export function StaticCamera() {
  const cameraRef = useRef<THREE.Camera | null>(null)
  // Mutable zoom factor; mutated by wheel + pinch handlers and read
  // by every projection update. Lives in a ref so we don't trigger
  // React re-renders on every wheel tick.
  const zoomRef = useRef(1)
  const aspectRef = useRef(1)
  const { set, size, gl } = useThree()

  useEffect(() => {
    const aspect = size.width / size.height
    aspectRef.current = aspect
    zoomRef.current = clampZoom(1, isPortrait(aspect))
    const cam = createCamera(aspect, zoomRef.current)
    cameraRef.current = cam
    set({ camera: cam })
    return () => {
      cameraRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Re-fit on viewport resize. If the aspect crosses the portrait
  // threshold we have to swap camera types (perspective ↔ ortho);
  // otherwise we update the existing camera in place.
  useEffect(() => {
    const prev = cameraRef.current
    if (!prev) return
    const aspect = size.width / size.height
    aspectRef.current = aspect
    const wasPortrait = prev instanceof THREE.PerspectiveCamera
    const willBePortrait = isPortrait(aspect)

    if (wasPortrait !== willBePortrait) {
      // Mode swap — clamp zoom to the new mode's range and rebuild.
      zoomRef.current = clampZoom(zoomRef.current, willBePortrait)
      const cam = createCamera(aspect, zoomRef.current)
      cameraRef.current = cam
      set({ camera: cam })
      return
    }

    if (willBePortrait) {
      const cam = prev as THREE.PerspectiveCamera
      cam.aspect = aspect
      cam.position.copy(perspPositionFor(aspect, zoomRef.current))
      cam.lookAt(LOOK_AT_MOBILE)
      cam.updateProjectionMatrix()
    } else {
      const cam = prev as THREE.OrthographicCamera
      const { halfW, halfH } = orthoFrustum(aspect)
      cam.left = -halfW
      cam.right = halfW
      cam.top = halfH
      cam.bottom = -halfH
      cam.position.copy(POSITION_DESKTOP)
      cam.lookAt(LOOK_AT_DESKTOP)
      cam.updateProjectionMatrix()
    }
  }, [size.width, size.height, set])

  // Wheel + pinch zoom. Listens on the actual canvas DOM element so
  // page scrolling stays untouched outside the 3D viewport.
  useEffect(() => {
    const canvas = gl.domElement
    if (!canvas) return

    function applyZoom(deltaZoom: number) {
      const cam = cameraRef.current
      if (!cam) return
      const portrait = cam instanceof THREE.PerspectiveCamera
      zoomRef.current = clampZoom(zoomRef.current + deltaZoom, portrait)
      if (portrait) {
        const c = cam as THREE.PerspectiveCamera
        c.position.copy(perspPositionFor(aspectRef.current, zoomRef.current))
        c.lookAt(LOOK_AT_MOBILE)
        c.updateProjectionMatrix()
      } else {
        const c = cam as THREE.OrthographicCamera
        c.zoom = zoomRef.current
        c.updateProjectionMatrix()
      }
    }

    function onWheel(e: WheelEvent) {
      // Only intercept when the wheel is over the canvas. preventDefault
      // stops the page from scrolling — desktop users expect the scroll
      // wheel to zoom the 3D scene when their cursor is on it.
      e.preventDefault()
      const cam = cameraRef.current
      if (!cam) return
      const portrait = cam instanceof THREE.PerspectiveCamera
      if (portrait) {
        // Persp zoom is a distance multiplier — wheel down (deltaY > 0)
        // should move us farther → larger zoom value.
        applyZoom(e.deltaY * WHEEL_STEP_PERSP)
      } else {
        // Ortho zoom > 1 = closer — wheel down → smaller zoom value.
        applyZoom(-e.deltaY * WHEEL_STEP_ORTHO)
      }
    }

    // Two-finger pinch on touch devices. We track the distance between
    // the first two active touches and apply the delta as a zoom step.
    let pinchStartDist = 0
    function touchDist(e: TouchEvent): number {
      if (e.touches.length < 2) return 0
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      return Math.sqrt(dx * dx + dy * dy)
    }
    function onTouchStart(e: TouchEvent) {
      if (e.touches.length === 2) {
        pinchStartDist = touchDist(e)
      }
    }
    function onTouchMove(e: TouchEvent) {
      if (e.touches.length === 2 && pinchStartDist > 0) {
        e.preventDefault()
        const d = touchDist(e)
        const cam = cameraRef.current
        if (!cam) return
        const portrait = cam instanceof THREE.PerspectiveCamera
        if (portrait) {
          // Persp: pinch out (d > start) → closer → smaller distance
          // multiplier → negative delta.
          applyZoom(-(d - pinchStartDist) * PINCH_STEP_PERSP)
        } else {
          // Ortho: pinch out → larger zoom value.
          applyZoom((d - pinchStartDist) * PINCH_STEP_ORTHO)
        }
        pinchStartDist = d
      }
    }
    function onTouchEnd() {
      pinchStartDist = 0
    }

    canvas.addEventListener('wheel', onWheel, { passive: false })
    canvas.addEventListener('touchstart', onTouchStart, { passive: true })
    canvas.addEventListener('touchmove', onTouchMove, { passive: false })
    canvas.addEventListener('touchend', onTouchEnd)
    canvas.addEventListener('touchcancel', onTouchEnd)

    return () => {
      canvas.removeEventListener('wheel', onWheel)
      canvas.removeEventListener('touchstart', onTouchStart)
      canvas.removeEventListener('touchmove', onTouchMove)
      canvas.removeEventListener('touchend', onTouchEnd)
      canvas.removeEventListener('touchcancel', onTouchEnd)
    }
  }, [gl])

  return null
}
