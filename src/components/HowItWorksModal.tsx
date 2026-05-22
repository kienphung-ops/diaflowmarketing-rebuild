'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useFloorsConfig } from '@/lib/floorsConfigClient'

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
  // Live floor catalogue from /api/floors. Falls back to the static
  // FLOOR_CONFIG snapshot until the first response lands.
  const floors = useFloorsConfig()

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!open) return null
  if (typeof document === 'undefined') return null

  // X share text + URL go in separate params per the spec
  // (requirements/share-btn.md): X auto-appends + auto-shortens the
  // URL when passed via `&url=`, and `&hashtags=` appends a
  // hashtag chip below the tweet text.
  const xText = encodeURIComponent(
    'just built my AI office at diaflow 🚀 climb the floors with me'
  )
  const encodedUrl = inviteUrl ? encodeURIComponent(inviteUrl) : ''
  const xShareHref = inviteUrl
    ? `https://x.com/intent/tweet?text=${xText}&url=${encodedUrl}&hashtags=DiaflowTower`
    : undefined
  const linkedinShareHref = inviteUrl
    ? `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`
    : undefined

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

          {/* Column headers. The TEAMMATES + DECOR + REWARD columns
              were folded into a single wider REWARD column — each row
              now reads as one stitched sentence ("max 5 + Basic chair
              + first desk + Free beta access") so the unlock at each
              floor is grokable in one glance instead of three eye
              hops across the row. */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '56px 80px 1fr',
              gap: 0,
              marginTop: '20px',
              borderBottom: '1px solid rgba(255,255,255,0.1)',
              paddingBottom: '8px',
            }}
          >
            {['FLOOR', 'INVITES', 'REWARD'].map(h => (
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
          {floors.map((cfg, i) => {
            const reward = cfg.productReward ?? FLOOR_REWARDS[cfg.id]
            const isLast = i === floors.length - 1
            const isPenthouse = cfg.id === floors.length
            return (
              <div
                key={cfg.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '56px 80px 1fr',
                  gap: 0,
                  padding: '13px 0',
                  borderBottom: isLast ? 'none' : '1px solid rgba(255,255,255,0.06)',
                  background: cfg.id === 1 ? 'rgba(129,140,248,0.07)' : 'transparent',
                }}
              >
                <p
                  style={{
                    margin: 0,
                    fontSize: '14px',
                    fontWeight: cfg.id === 1 ? 700 : 400,
                    color: isPenthouse ? '#fbbf24' : 'white',
                  }}
                >
                  {cfg.id}
                </p>
                <p style={{ margin: 0, fontSize: '14px', color: 'rgba(255,255,255,0.7)' }}>
                  {cfg.invitesRequired}
                </p>
                {/* Stitched reward line: "max N + decor [+ reward]".
                    The product-reward suffix (e.g. "Free beta access")
                    is rendered as a separate green span so it still
                    visually pops, but the parts read as one
                    continuous sentence rather than three columns. */}
                <p style={{ margin: 0, fontSize: '13px', color: 'rgba(255,255,255,0.85)', lineHeight: 1.45 }}>
                  <span style={{ color: 'rgba(255,255,255,0.6)' }}>max {cfg.maxTeammates} teammates</span>
                  <span style={{ color: 'rgba(255,255,255,0.4)', margin: '0 6px' }}>+</span>
                  <span>
                    {isPenthouse ? '🏆 ' : ''}
                    {cfg.label}
                  </span>
                  {reward && (
                    <>
                      <span style={{ color: 'rgba(255,255,255,0.4)', margin: '0 6px' }}>+</span>
                      <span style={{ color: '#34d399', fontWeight: 600 }}>{reward}</span>
                    </>
                  )}
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
          <p style={{ fontSize: '14px', color: 'white', fontWeight: 600, margin: '0 0 12px', lineHeight: 1.4 }}>
            Share your office to move up the next floor
          </p>

          {/* Share row — X / LinkedIn / Copy. Mirrors MySquadDrawer so
              the affordance is consistent everywhere the invite URL
              is offered. Threads + the standalone URL pill were
              removed (Threads consolidated into X cross-posting, the
              URL pill duplicated the Copy action). */}
          {!inviteUrl && (
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
            <a
              href={xShareHref}
              aria-disabled={!inviteUrl}
              target="_blank"
              rel="noreferrer"
              style={{
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
              X
            </a>
            <a
              href={linkedinShareHref}
              aria-disabled={!inviteUrl}
              target="_blank"
              rel="noreferrer"
              style={{
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
              LinkedIn
            </a>
            <button
              onClick={handleCopy}
              disabled={!inviteUrl}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '7px',
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: '10px',
                padding: '11px',
                color: 'white',
                fontWeight: 700,
                fontSize: '13px',
                cursor: inviteUrl ? 'pointer' : 'not-allowed',
                opacity: inviteUrl ? 1 : 0.4,
              }}
            >
              {copied ? (
                <>
                  <span aria-hidden>✓</span>
                  Copied
                </>
              ) : (
                <>
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="white"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.5 1.5" />
                    <path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.5-1.5" />
                  </svg>
                  Copy
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
