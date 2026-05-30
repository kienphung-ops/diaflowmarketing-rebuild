'use client'

import { Html } from '@react-three/drei'
import { useEffect, useRef } from 'react'

interface BubbleWrapperProps {
  position: [number, number, number]
  children: React.ReactNode
  onClose: () => void
  width?: string
}

export function BubbleWrapper({ position, children, onClose, width = '360px' }: BubbleWrapperProps) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    // Start collapsed, then animate to final position next frame
    el.style.transform = 'scale(0.92) translateY(12px)'
    const id = requestAnimationFrame(() => { el.style.transform = 'scale(1) translateY(0)' })
    return () => cancelAnimationFrame(id)
  }, [])

  return (
    <Html
      position={position}
      center
      zIndexRange={[100, 0]}
      style={{ pointerEvents: 'auto' }}
    >
      <div
        ref={ref}
        style={{
          transition: 'transform 0.25s ease',
          transform: 'scale(0.92) translateY(12px)',
          width,
          background: 'rgba(30, 24, 54, 0.96)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: '20px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          color: 'white',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          fontSize: '14px',
          overflow: 'hidden',
        }}
      >
        {/* Header bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px 12px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 6px #22c55e' }} />
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: '18px', lineHeight: 1, padding: '0 2px' }}
          >×</button>
        </div>
        {children}
      </div>
    </Html>
  )
}
