'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useFloorsConfig, useFloor } from '@/lib/floorsConfigClient'
import { buildShareCopyText } from '@/lib/shareCopy'

interface Props {
  open: boolean
  onClose: () => void
  inviteUrl: string | null
  /** Current floor — used to compute next-floor delta for the Copy
   *  button's enriched payload. Optional so legacy callers that just
   *  want the table still work; falls back to floor 1 (the worst case
   *  is the copy says "N invites from the next floor" with the user's
   *  view of N being whatever the floor-1 → floor-2 threshold is). */
  currentFloor?: number
  /** User's cumulative invites — see currentFloor above. */
  totalInvites?: number
}

// (removed) FLOOR_REWARDS hardcoded fallback table — superseded by
// the per-floor `productReward` column populated from the seed. The
// fallback's values had drifted out of sync with the live DB (e.g.
// it claimed F6 had "1 mo free" when the canonical reward sits at
// F7 now), so the modal silently lied for those rows. Reward lookup
// is now strictly `cfg.productReward`.

const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'

export function HowItWorksModal({
  open,
  onClose,
  inviteUrl,
  currentFloor = 1,
  totalInvites = 0,
}: Props) {
  const [copied, setCopied] = useState(false)
  // Live floor catalogue from /api/floors. Falls back to the static
  // FLOOR_CONFIG snapshot until the first response lands.
  const floors = useFloorsConfig()
  // Next-floor + invites-to-next mirror the math in MySquadDrawer +
  // IrisHireModal so the Copy-button payload reads the same string in
  // every place: "built my AI office, N invites from the next floor — <url>".
  const nextFloor = useFloor(currentFloor + 1)
  const invitesToNext = nextFloor
    ? Math.max(0, nextFloor.invitesRequired - totalInvites)
    : 0

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
    // Enriched payload — matches MySquadDrawer + IrisHireModal so
    // every Copy button across the app pastes the same string.
    const payload = buildShareCopyText(inviteUrl, invitesToNext, !!nextFloor)
    try {
      await navigator.clipboard.writeText(payload)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* ignore */
    }
  }

  return createPortal(
    <div
      // Wrapper: bottom-aligned sheet on mobile, centered modal on
      // desktop. Tailwind responsive `items-*` swaps the alignment
      // at md; the rest of the chrome stays inline-styled to match
      // the existing palette.
      className="fixed inset-0 z-[80] flex items-end md:items-center justify-center md:p-5"
      style={{ fontFamily: FONT }}
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

      {/* Card — mobile bottom sheet (rounded top only, full-width) vs
          desktop centered card. Max-height stays at 90vh on desktop;
          on mobile we drop to 88dvh so the home-indicator inset isn't
          covered. */}
      <div
        onClick={e => e.stopPropagation()}
        className={
          'relative z-[1] flex flex-col text-white overflow-hidden w-full ' +
          'rounded-t-3xl md:rounded-[20px] ' +
          'max-h-[88dvh] md:max-h-[90vh] md:max-w-[520px] ' +
          'border-t md:border border-white/10'
        }
        style={{ background: '#13112a' }}
      >
        {/* Mobile sheet grip */}
        <div className="md:hidden flex justify-center pt-2.5" aria-hidden>
          <div className="w-9 h-1 rounded-full bg-white/20" />
        </div>
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
            const reward = cfg.productReward
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
                {/* Stitched reward line in three "•"-separated chunks:
                    1. "<max> teammate slots" (white, bold)
                    2. unlock_items joined by " + " (now reads the
                       Postgres text[] field — each item appears as
                       its own badge instead of a single concatenated
                       string)
                    3. product reward (green) when present.
                    Falls back to `cfg.label` if unlockItems is empty
                    (defensive — every seeded floor should have at
                    least one item, but legacy / partially-edited
                    rows shouldn't show a blank middle column). */}
                <p style={{ margin: 0, fontSize: '13px', color: 'rgba(255,255,255,0.85)', lineHeight: 1.45 }}>
                  <span style={{ color: 'rgba(255,255,255,0.6)' }}>
                    <b>• {cfg.maxTeammates} teammate slots</b>
                  </span>
                  <span style={{ color: 'rgba(255,255,255,0.4)', margin: '0 6px' }}>•</span>
                  <span>
                    {isPenthouse ? '🏆 ' : ''}
                    {cfg.unlockItems.length > 0
                      ? cfg.unlockItems.map((item, idx) => (
                          <span key={idx}>
                            {idx > 0 && (
                              <span style={{ color: 'rgba(255,255,255,0.35)', margin: '0 4px' }}>
                                +
                              </span>
                            )}
                            <span>{item}</span>
                          </span>
                        ))
                      : cfg.label}
                  </span>
                  {reward && (
                    <>
                      <span style={{ color: 'rgba(255,255,255,0.4)', margin: '0 6px' }}>•</span>
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
