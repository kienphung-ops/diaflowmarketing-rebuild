'use client'

import { useEffect, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'

/**
 * Locked overview camera with aspect-aware framing. On desktop landscape
 * the room comfortably fills the view; on narrow portrait viewports we
 * automatically pull the camera back along the same direction so the
 * full back-wall width stays visible (otherwise the room got cropped on
 * the sides on mobile).
 *
 * No intro animation, no target lerp — the room never swings while the
 * user drags a teammate.
 */

// Direction from origin → camera (also the camera's "up-and-toward-viewer"
// vector). The actual distance from origin is computed per-resize so the
// scene fits whatever aspect we're rendering at.
const POSITION_DIR = new THREE.Vector3(0, 5, 13)
const LOOK_AT = new THREE.Vector3(0, 0, -1)
const FOV = 50
// Half of the on-screen width we need to keep visible at LOOK_AT depth.
// Back wall is ~16 wide; this adds a bit of padding so side walls show.
const TARGET_HALF_WIDTH = 9.2
// Minimum camera distance so desktop landscape stays at the original framing.
const MIN_DISTANCE = POSITION_DIR.length() // ≈ 13.93

function distanceForAspect(aspect: number): number {
  const halfFovY = ((FOV * Math.PI) / 180) / 2
  // half-width visible at distance d = d * tan(vFov/2) * aspect
  const required = TARGET_HALF_WIDTH / (Math.tan(halfFovY) * aspect)
  return Math.max(MIN_DISTANCE, required)
}

function positionFor(distance: number): THREE.Vector3 {
  return POSITION_DIR.clone().normalize().multiplyScalar(distance)
}

export function StaticCamera() {
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const { set, size } = useThree()

  useEffect(() => {
    const aspect = size.width / size.height
    const cam = new THREE.PerspectiveCamera(FOV, aspect, 0.1, 1000)
    cam.position.copy(positionFor(distanceForAspect(aspect)))
    cam.lookAt(LOOK_AT)
    cam.updateProjectionMatrix()
    cameraRef.current = cam
    set({ camera: cam })
    return () => {
      cameraRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Re-fit on viewport resize: update aspect AND camera distance so the
  // back wall stays in frame on portrait phones.
  useEffect(() => {
    const cam = cameraRef.current
    if (!cam) return
    const aspect = size.width / size.height
    cam.aspect = aspect
    cam.position.copy(positionFor(distanceForAspect(aspect)))
    cam.lookAt(LOOK_AT)
    cam.updateProjectionMatrix()
  }, [size.width, size.height])

  return null
}
