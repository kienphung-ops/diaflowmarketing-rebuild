'use client'

import { useEffect, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'

/**
 * Locked overview camera. Position + lookAt extracted from the user's
 * exported three.org scene (camera.json) — a PerspectiveCamera looking
 * at the room from the +X side, elevated ~25° downward.
 *
 *   matrix translation:  (23.65688, 11.02205, -0.16078)
 *   forward (extracted from col2): mostly -X, ~25° below horizontal
 *   target: (0, 0, 0)
 *   fov: 50
 *
 * No intro animation, no target lerp — the camera is pinned so the room
 * never appears to swing or tilt while the user drags teammates.
 */

// const POSITION = new THREE.Vector3(23.65688, 11.02205, -0.16078)
const POSITION = new THREE.Vector3(0, 5, 13)
const LOOK_AT = new THREE.Vector3(0, 0, -1)
const FOV = 50

export function StaticCamera() {
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const { set, size } = useThree()

  useEffect(() => {
    const aspect = size.width / size.height
    const cam = new THREE.PerspectiveCamera(FOV, aspect, 0.1, 1000)
    cam.position.copy(POSITION)
    cam.lookAt(LOOK_AT)
    cam.updateProjectionMatrix()
    cameraRef.current = cam
    set({ camera: cam })
    return () => {
      cameraRef.current = null
    }
    // Intentionally run only once on mount — viewport resize handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Update aspect on viewport resize, but never move the camera.
  useEffect(() => {
    const cam = cameraRef.current
    if (!cam) return
    cam.aspect = size.width / size.height
    cam.updateProjectionMatrix()
  }, [size.width, size.height])

  return null
}
