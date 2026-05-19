'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { FLOOR_CONFIG, getMaxTeammates } from '@/lib/floors'

interface Props {
  open: boolean
  onClose: () => void
  inviteUrl: string | null
}

// Per planning.md — reward strings keyed by floor.
const FLOOR_REWARDS: Record<number, string> = {
  3: 'Free beta access',
  6: '1 mo free',
  15: '2 mo free',
  20: '3-mo free + featured',
}

const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'

export function HowItWorksModal({ open, onClose, inviteUrl }: Props) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!open) return null
  if (typeof document === 'undefined') return null

  const shareText = encodeURIComponent(
    "Building my AI office on Diaflow Tower — climb the floors with me 🚀"
  )
  const encodedUrl = inviteUrl ? encodeURIComponent(inviteUrl) : ''

  async function handleCopy() {
    if (!inviteUrl) return
    try {
      await navigator.clipboard.writeText(inviteUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* ignore */
    }
  }

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 80,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        fontFamily: FONT,
      }}
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop — strong blur so the drawer + office scene behind both go soft */}
      <div
        onClick={onClose}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.65)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
        }}
      />

      {/* Card */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: 'relative',
          zIndex: 1,
          background: '#13112a',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '20px',
          width: '100%',
          maxWidth: '520px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          color: 'white',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{ padding: '24px 24px 16px', flexShrink: 0 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: '12px',
            }}
          >
            <div>
              <p style={{ fontWeight: 800, fontSize: '22px', margin: '0 0 6px', lineHeight: 1.2 }}>
                Every floor, every unlock
              </p>
              <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', margin: 0, lineHeight: 1.5 }}>
                20 floors. New decor, more teammates, and real rewards at every level.
              </p>
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              style={{
                background: 'rgba(255,255,255,0.08)',
                border: 'none',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'rgba(255,255,255,0.6)',
                fontSize: '15px',
                cursor: 'pointer',
              }}
            >
              ✕
            </button>
          </div>

          {/* Column headers */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '56px 70px 100px 1fr 100px',
              gap: 0,
              marginTop: '20px',
              borderBottom: '1px solid rgba(255,255,255,0.1)',
              paddingBottom: '8px',
            }}
          >
            {['FLOOR', 'INVITES', 'TEAMMATES', 'DECOR', 'REWARD'].map(h => (
              <p
                key={h}
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  letterSpacing: '0.07em',
                  color: 'rgba(255,255,255,0.35)',
                  margin: 0,
                }}
              >
                {h}
              </p>
            ))}
          </div>
        </div>

        {/* Scrollable table rows */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '0 24px' }}>
          {FLOOR_CONFIG.map((cfg, i) => {
            const reward = FLOOR_REWARDS[cfg.floor]
            const isLast = i === FLOOR_CONFIG.length - 1
            const isPenthouse = cfg.floor === 20
            return (
              <div
                key={cfg.floor}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '56px 70px 100px 1fr 100px',
                  gap: 0,
                  padding: '13px 0',
                  borderBottom: isLast ? 'none' : '1px solid rgba(255,255,255,0.06)',
                  background: cfg.floor === 1 ? 'rgba(129,140,248,0.07)' : 'transparent',
                }}
              >
                <p
                  style={{
                    margin: 0,
                    fontSize: '14px',
                    fontWeight: cfg.floor === 1 ? 700 : 400,
                    color: isPenthouse ? '#fbbf24' : 'white',
                  }}
                >
                  {cfg.floor}
                </p>
                <p style={{ margin: 0, fontSize: '14px', color: 'rgba(255,255,255,0.7)' }}>
                  {cfg.invitesRequired}
                </p>
                <p style={{ margin: 0, fontSize: '14px', color: 'rgba(255,255,255,0.7)' }}>
                  {getMaxTeammates(cfg.floor)}
                </p>
                <p style={{ margin: 0, fontSize: '13px', color: 'rgba(255,255,255,0.85)' }}>
                  {isPenthouse ? '🏆 ' : ''}
                  {cfg.label}
                </p>
                <p
                  style={{
                    margin: 0,
                    fontSize: '12px',
                    color: reward ? '#34d399' : 'rgba(255,255,255,0.3)',
                    fontWeight: reward ? 600 : 400,
                  }}
                >
                  {reward ?? '—'}
                </p>
              </div>
            )
          })}
        </div>

        {/* Footer — share section */}
        <div
          style={{
            padding: '16px 24px 24px',
            flexShrink: 0,
            borderTop: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', margin: '0 0 12px', lineHeight: 1.5 }}>
            Share your link to get more invites and climb to higher floors.{' '}
            <strong style={{ color: 'white' }}>Every signup moves you up.</strong>
          </p>

          {/* URL row */}
          {inviteUrl ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: '10px',
                padding: '10px 14px',
                marginBottom: '10px',
              }}
            >
              <span
                style={{
                  flex: 1,
                  fontSize: '13px',
                  color: 'rgba(255,255,255,0.7)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {inviteUrl}
              </span>
              <button
                onClick={handleCopy}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: 700,
                  color: copied ? '#34d399' : '#818cf8',
                  whiteSpace: 'nowrap',
                  padding: 0,
                }}
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          ) : (
            <div
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '10px',
                padding: '10px 14px',
                marginBottom: '10px',
                fontSize: '13px',
                color: 'rgba(255,255,255,0.5)',
              }}
            >
              Sign up to get your personal invite link.
            </div>
          )}

          {/* Share buttons with real brand SVG icons */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <a
              href={inviteUrl ? `https://twitter.com/intent/tweet?text=${shareText}&url=${encodedUrl}` : undefined}
              aria-disabled={!inviteUrl}
              target="_blank"
              rel="noreferrer"
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '7px',
                background: '#000',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: '10px',
                padding: '11px',
                color: 'white',
                fontWeight: 700,
                fontSize: '13px',
                textDecoration: 'none',
                opacity: inviteUrl ? 1 : 0.4,
                pointerEvents: inviteUrl ? 'auto' : 'none',
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="white" aria-hidden>
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
              Share
            </a>
            <a
              href={inviteUrl ? `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}` : undefined}
              aria-disabled={!inviteUrl}
              target="_blank"
              rel="noreferrer"
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '7px',
                background: '#0a66c2',
                border: 'none',
                borderRadius: '10px',
                padding: '11px',
                color: 'white',
                fontWeight: 700,
                fontSize: '13px',
                textDecoration: 'none',
                opacity: inviteUrl ? 1 : 0.4,
                pointerEvents: inviteUrl ? 'auto' : 'none',
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="white" aria-hidden>
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
              </svg>
              Share
            </a>
            <a
              href={inviteUrl ? `https://www.threads.net/intent/post?text=${shareText}%20${encodedUrl}` : undefined}
              aria-disabled={!inviteUrl}
              target="_blank"
              rel="noreferrer"
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '7px',
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: '10px',
                padding: '11px',
                color: 'white',
                fontWeight: 700,
                fontSize: '13px',
                textDecoration: 'none',
                opacity: inviteUrl ? 1 : 0.4,
                pointerEvents: inviteUrl ? 'auto' : 'none',
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="white" aria-hidden>
                <path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.5 12.068c0-3.548.858-6.424 2.551-8.55C5.89 1.257 8.586.062 12.093.004c2.743-.044 5.048.632 6.852 2.01 1.63 1.24 2.712 2.953 3.217 5.09l-2.403.533c-.367-1.617-1.13-2.886-2.27-3.77-1.314-.999-3.09-1.497-5.28-1.46-2.75.046-4.828.882-6.169 2.483-1.347 1.61-2.03 3.96-2.03 6.988 0 3.031.675 5.373 2.007 6.96 1.323 1.578 3.383 2.383 6.115 2.402 2.354.016 4.1-.556 5.19-1.7.933-.98 1.403-2.437 1.403-4.335 0-.437-.035-.847-.107-1.22a5.02 5.02 0 00-.288-.96c-.567.29-1.19.518-1.854.677-1.174.281-2.442.346-3.77.193-1.61-.187-2.854-.745-3.697-1.659-.843-.914-1.27-2.12-1.27-3.587 0-1.536.46-2.794 1.364-3.737.929-.97 2.245-1.479 3.91-1.511 1.59-.031 2.964.449 3.974 1.385.977.905 1.553 2.188 1.713 3.817 1.05-.39 1.89-1.013 2.496-1.854a6.85 6.85 0 00.527-1.02 8.47 8.47 0 00-.38-6.62c-.72-1.48-1.843-2.607-3.337-3.351C16.16.78 14.24.338 12.093.338h-.007zm-.44 13.5c.736.086 1.46.05 2.148-.107.503-.118.97-.297 1.39-.53a6.3 6.3 0 00-.135-1.02c-.097-.481-.286-.894-.561-1.226-.51-.617-1.276-.946-2.275-.977-1.01-.032-1.79.255-2.317.852-.441.499-.664 1.149-.664 1.933 0 .794.23 1.43.683 1.89.436.444 1.07.68 1.731.756l.001-.571z" />
              </svg>
              Threads
            </a>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
