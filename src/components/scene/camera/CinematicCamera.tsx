'use client'

import { useRef, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

const INTRO_START = new THREE.Vector3(16, 20, 16)
const RESTING = new THREE.Vector3(10, 9.5, 10)
const LOOK_AT = new THREE.Vector3(0, 0.8, 0)
const INTRO_DURATION = 4.5

interface CinematicCameraProps {
  target: THREE.Vector3 | null
  lookAt?: THREE.Vector3   // default: LOOK_AT = (0, 0.8, 0)
  targetZoom?: number       // default: 1.0
  panY?: number             // additional Y offset applied to both position and lookAt
}

export function CinematicCamera({ target, lookAt, targetZoom, panY = 0 }: CinematicCameraProps) {
  const cameraRef = useRef<THREE.OrthographicCamera | null>(null)
  const { set, size } = useThree()
  const currentPos = useRef(INTRO_START.clone())
  const currentLookAt = useRef(LOOK_AT.clone())
  const currentZoom = useRef(1.0)
  const destPos = useRef(new THREE.Vector3())
  const destLook = useRef(new THREE.Vector3())
  const introElapsed = useRef(0)
  const introDone = useRef(false)
  const hasMounted = useRef(false)

  useEffect(() => {
    if (hasMounted.current) return
    hasMounted.current = true
    const aspect = size.width / size.height
    const frustum = 5.2
    const cam = new THREE.OrthographicCamera(
      -frustum * aspect,
      frustum * aspect,
      frustum,
      -frustum,
      0.1,
      200
    )
    cam.position.copy(INTRO_START)
    cam.lookAt(LOOK_AT)
    cameraRef.current = cam
    set({ camera: cam })
    return () => {
      cameraRef.current = null
    }
  }, [set, size.width, size.height])

  // Keep the orthographic frustum in sync with viewport size (so the scene
  // fills the canvas after layout changes / window resize).
  useEffect(() => {
    const cam = cameraRef.current
    if (!cam) return
    const aspect = size.width / size.height
    const frustum = 5.2
    cam.left = -frustum * aspect
    cam.right = frustum * aspect
    cam.top = frustum
    cam.bottom = -frustum
    cam.updateProjectionMatrix()
  }, [size.width, size.height])

  useFrame((_state, delta) => {
    const cam = cameraRef.current
    if (!cam) return
    if (!introDone.current) {
      introElapsed.current += delta
      const t = Math.min(introElapsed.current / INTRO_DURATION, 1)
      const eased = 1 - Math.pow(1 - t, 3)
      currentPos.current.lerpVectors(INTRO_START, RESTING, eased)
      if (t >= 1) introDone.current = true
    } else {
      const base = target ?? RESTING
      destPos.current.set(base.x, base.y + panY, base.z)
      currentPos.current.lerp(destPos.current, 0.05)
    }
    cam.position.copy(currentPos.current)

    const baseLook = lookAt ?? LOOK_AT
    destLook.current.set(baseLook.x, baseLook.y + panY, baseLook.z)
    currentLookAt.current.lerp(destLook.current, 0.05)
    cam.lookAt(currentLookAt.current)

    const destZoom = targetZoom ?? 1.0
    currentZoom.current += (destZoom - currentZoom.current) * 0.05
    cam.zoom = currentZoom.current
    cam.updateProjectionMatrix()
  })

  return null
}
