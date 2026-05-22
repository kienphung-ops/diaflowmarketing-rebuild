'use client'

import { useEffect, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'

/**
 * Locked overview camera with aspect-aware framing + user-controlled
 * zoom. On desktop landscape the room comfortably fills the view; on
 * narrow portrait viewports we automatically pull the camera back
 * along the same direction so the full back-wall width stays visible.
 *
 * Zoom: wheel-scroll on desktop / pinch on touch. We slide the camera
 * along its existing direction-from-origin vector (no FOV change) so
 * perspective stays consistent — closer = larger figures + more
 * floor detail, farther = wider room overview. Pan/rotate stay
 * disabled; the room never swings while the user drags a teammate.
 */

// Direction from origin → camera. Two presets:
//   Desktop (aspect ≥ 1): (0, 5, 13) — ~21° down from horizontal
//   Mobile  (aspect < 1): rotated 10° lower → flatter angle, ~11° down
// The actual distance from origin is computed per-resize so the scene
// fits whatever aspect we're rendering at.
const POSITION_DIR_DESKTOP = new THREE.Vector3(10, 8, 10)
const POSITION_DIR_MOBILE = (() => {
  // Take the desktop direction and rotate it down 10° around the X axis,
  // which lowers the camera (smaller Y, larger Z) while keeping the same
  // distance from origin.
  const v = new THREE.Vector3(0, 5, 13)
  v.applyAxisAngle(new THREE.Vector3(1, 0, 0), -(10 * Math.PI) / 180)
  return v
})()
const LOOK_AT = new THREE.Vector3(0, 0, -1)
const FOV = 50
// Half of the on-screen width we need to keep visible at LOOK_AT depth.
// Back wall is ~16 wide; this adds a bit of padding so side walls show.
const TARGET_HALF_WIDTH = 9.2
// Minimum camera distance so desktop landscape stays at the original framing.
const MIN_DISTANCE = POSITION_DIR_DESKTOP.length() // ≈ 13.93

// Zoom clamps applied on top of the aspect-aware base distance.
// 0.55× → close-up of the desks; 1.45× → pulled back room overview.
// Sized so even at min zoom the back wall stays visible.
const ZOOM_MIN = 0.55
const ZOOM_MAX = 1.45
// Wheel sensitivity — bigger values zoom faster. Calibrated for a
// "feels natural" 3-4 notch zoom across the full range.
const WHEEL_ZOOM_STEP = 0.001
// Pinch sensitivity — pixel-distance change between two fingers.
const PINCH_ZOOM_STEP = 0.004

function distanceForAspect(aspect: number): number {
  const halfFovY = ((FOV * Math.PI) / 180) / 2
  // half-width visible at distance d = d * tan(vFov/2) * aspect
  const required = TARGET_HALF_WIDTH / (Math.tan(halfFovY) * aspect)
  return Math.max(MIN_DISTANCE, required)
}

function positionFor(aspect: number, zoom: number): THREE.Vector3 {
  const distance = distanceForAspect(aspect) * zoom
  const dir = aspect < 1 ? POSITION_DIR_MOBILE : POSITION_DIR_DESKTOP
  return dir.clone().normalize().multiplyScalar(distance)
}

export function StaticCamera() {
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  // Mutable zoom factor; mutated by wheel + pinch handlers and read
  // by every position-update path. Lives in a ref so we don't trigger
  // React re-renders on every wheel tick.
  const zoomRef = useRef(1)
  const aspectRef = useRef(1)
  const { set, size, gl } = useThree()

  useEffect(() => {
    const aspect = size.width / size.height
    aspectRef.current = aspect
    const cam = new THREE.PerspectiveCamera(FOV, aspect, 0.1, 1000)
    cam.position.copy(positionFor(aspect, zoomRef.current))
    cam.lookAt(LOOK_AT)
    cam.updateProjectionMatrix()
    cameraRef.current = cam
    set({ camera: cam })
    return () => {
      cameraRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Re-fit on viewport resize: update aspect, distance, AND elevation
  // (lower angle on portrait phones) so the back wall stays in frame
  // without an exaggerated top-down look. Preserves the user's
  // current zoom factor.
  useEffect(() => {
    const cam = cameraRef.current
    if (!cam) return
    const aspect = size.width / size.height
    aspectRef.current = aspect
    cam.aspect = aspect
    cam.position.copy(positionFor(aspect, zoomRef.current))
    cam.lookAt(LOOK_AT)
    cam.updateProjectionMatrix()
  }, [size.width, size.height])

  // Wheel + pinch zoom. Listens on the actual canvas DOM element so
  // page scrolling stays untouched outside the 3D viewport.
  useEffect(() => {
    const canvas = gl.domElement
    const cam = cameraRef.current
    if (!canvas || !cam) return

    function applyZoom(deltaZoom: number) {
      const cam = cameraRef.current
      if (!cam) return
      zoomRef.current = Math.max(
        ZOOM_MIN,
        Math.min(ZOOM_MAX, zoomRef.current + deltaZoom),
      )
      cam.position.copy(positionFor(aspectRef.current, zoomRef.current))
      cam.lookAt(LOOK_AT)
      cam.updateProjectionMatrix()
    }

    function onWheel(e: WheelEvent) {
      // Only intercept when the wheel is over the canvas. preventDefault
      // stops the page from scrolling — desktop users expect the scroll
      // wheel to zoom the 3D scene when their cursor is on it.
      e.preventDefault()
      applyZoom(e.deltaY * WHEEL_ZOOM_STEP)
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
        // Pinch out (fingers spreading) → zoom IN → smaller distance
        // → smaller zoomRef. Sign inverted accordingly.
        const delta = -(d - pinchStartDist) * PINCH_ZOOM_STEP
        applyZoom(delta)
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
