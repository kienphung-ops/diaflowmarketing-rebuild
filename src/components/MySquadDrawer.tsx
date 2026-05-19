'use client'

import { useEffect, useState } from 'react'
import { FLOOR_CONFIG, getFloorConfig } from '@/lib/floors'
import { DISCORD_URL } from '@/lib/links'
import { HowItWorksModal } from './HowItWorksModal'

interface ServerRecruit {
  id: string
  name: string
  role: string
}

interface Props {
  open: boolean
  onClose: () => void
  teamName: string | null
  onTeamNameChange?: (next: string) => void
  referralCode: string | null
  totalInvites: number
  currentFloor: number
  emailCaptured: boolean
  teammates: ServerRecruit[]
  onTeammateUpdate?: (id: string, patch: { name?: string; role?: string }) => void
  onAddTeammate?: () => void
  onOpenSignup?: () => void
}

const PUBLIC_BASE = typeof window !== 'undefined' ? window.location.origin : 'https://diaflow.io'

function buildInviteUrl(code: string | null): string {
  if (!code) return ''
  return `${PUBLIC_BASE}/?ref=${code}`
}

export function MySquadDrawer({
  open,
  onClose,
  teamName,
  onTeamNameChange,
  referralCode,
  totalInvites,
  currentFloor,
  emailCaptured,
  teammates,
  onTeammateUpdate,
  onAddTeammate,
  onOpenSignup,
}: Props) {
  const [renaming, setRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState(teamName ?? '')
  const [copied, setCopied] = useState(false)
  const [editingTeammate, setEditingTeammate] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<{ name: string; role: string }>({ name: '', role: '' })
  const [howItWorksOpen, setHowItWorksOpen] = useState(false)

  useEffect(() => {
    setRenameValue(teamName ?? '')
  }, [teamName])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const inviteUrl = buildInviteUrl(referralCode)
  const nextFloor = getFloorConfig(currentFloor + 1)
  const currentFloorCfg = getFloorConfig(currentFloor)
  const invitesToNext = nextFloor ? Math.max(0, nextFloor.invitesRequired - totalInvites) : 0
  const progressPct = nextFloor
    ? Math.min(
        100,
        Math.round(
          ((totalInvites - (currentFloorCfg?.invitesRequired ?? 0)) /
            Math.max(1, nextFloor.invitesRequired - (currentFloorCfg?.invitesRequired ?? 0))) *
            100
        )
      )
    : 100

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

  function handleShare(network: 'x' | 'linkedin' | 'threads') {
    if (!inviteUrl) return
    const text = `Building my AI squad with @Diaflow. Currently on Floor ${currentFloor} of ${FLOOR_CONFIG.length} — climb with me`
    const encoded = encodeURIComponent(text + ' ' + inviteUrl)
    const urls: Record<typeof network, string> = {
      x: `https://x.com/intent/tweet?text=${encoded}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(inviteUrl)}`,
      threads: `https://www.threads.net/intent/post?text=${encoded}`,
    }
    window.open(urls[network], '_blank', 'noopener,noreferrer,width=620,height=620')
  }

  function startEditing(t: ServerRecruit) {
    setEditingTeammate(t.id)
    setEditValues({ name: t.name, role: t.role })
  }

  function saveTeammate() {
    if (!editingTeammate) return
    onTeammateUpdate?.(editingTeammate, { name: editValues.name.trim(), role: editValues.role.trim() })
    setEditingTeammate(null)
  }

  return (
    <div
      className={`fixed inset-y-0 right-0 z-30 w-full md:w-[440px] max-w-full bg-night-mid/95 border-l border-white/10 backdrop-blur-md shadow-2xl flex flex-col text-tower-cream transition-transform duration-300 ${
        open ? 'translate-x-0' : 'translate-x-full'
      }`}
    >
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
        <h2 className="text-2xl font-bold">My Squad</h2>
        <button onClick={onClose} className="text-tower-cream/50 hover:text-tower-cream text-xl" aria-label="Close">
          ×
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
        {emailCaptured && (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
            ✓ You&apos;re in — we&apos;ll email you on launch day
          </div>
        )}

        {/* Team name */}
        <div>
          <div className="text-[11px] uppercase tracking-widest text-tower-cream/40 mb-2">Your squad</div>
          <div className="flex items-center gap-2">
            {renaming ? (
              <>
                <input
                  autoFocus
                  value={renameValue}
                  onChange={e => setRenameValue(e.target.value.slice(0, 40))}
                  className="flex-1 px-2 py-1 rounded bg-night-deep border border-white/10 focus:border-tower-gold focus:outline-none text-2xl font-bold"
                />
                <button
                  onClick={() => {
                    onTeamNameChange?.(renameValue.trim())
                    setRenaming(false)
                  }}
                  className="text-xs text-tower-gold hover:underline"
                >
                  Save
                </button>
              </>
            ) : (
              <>
                <div className="text-3xl font-bold lowercase">{teamName || 'untitled'}</div>
                <button
                  onClick={() => setRenaming(true)}
                  className="text-xs px-2 py-1 rounded bg-night-deep/80 border border-white/10 text-tower-cream/60 hover:text-tower-cream"
                >
                  ✎ Rename
                </button>
              </>
            )}
          </div>

          {/* Invite link */}
          {referralCode ? (
            <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-md bg-night-deep border border-white/10">
              <span className="flex-1 text-sm font-mono text-tower-cream/80 truncate">{inviteUrl}</span>
              <button
                onClick={handleCopy}
                className="text-tower-cream/60 hover:text-tower-gold text-sm"
                aria-label="Copy invite link"
              >
                {copied ? '✓' : '⧉'}
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenSignup}
              className="mt-3 w-full px-3 py-2 rounded-md bg-night-deep border border-tower-gold/30 text-sm text-tower-gold hover:bg-night-deep/80"
            >
              Sign up to get your invite link →
            </button>
          )}
        </div>

        {/* Current floor card */}
        <div className="rounded-xl p-4 bg-gradient-to-br from-purple-900/40 to-purple-800/20 border border-purple-500/30">
          <div className="flex items-baseline justify-between">
            <div className="text-[11px] uppercase tracking-widest text-tower-cream/50">Current floor</div>
            <div className="text-right">
              <div className="text-sm font-semibold">Rank #{Math.max(1, 500 - totalInvites * 7)}</div>
            </div>
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <div className="text-5xl font-bold">{currentFloor}</div>
            <div className="text-base text-tower-cream/50">of {FLOOR_CONFIG.length}</div>
          </div>
          <div className="mt-3 h-1.5 rounded-full bg-night-deep/60 overflow-hidden">
            <div className="h-full bg-purple-400" style={{ width: `${progressPct}%` }} />
          </div>
          <div className="mt-2 flex items-center justify-between text-xs">
            <span className="text-tower-cream/80">
              {nextFloor
                ? `${invitesToNext} more ${invitesToNext === 1 ? 'invite' : 'invites'} → Floor ${nextFloor.floor}`
                : 'You reached the top'}
            </span>
            {nextFloor && <span className="text-tower-cream/60">{nextFloor.label}</span>}
          </div>
        </div>

        {/* Recruited teammate list */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="text-[11px] uppercase tracking-widest text-tower-cream/40">
              Your teammates ({teammates.length})
            </div>
            {onAddTeammate && (
              <button
                onClick={onAddTeammate}
                className="text-xs px-2 py-1 rounded bg-tower-gold/15 text-tower-gold hover:bg-tower-gold/25 font-semibold"
              >
                + Add
              </button>
            )}
          </div>
          {teammates.length > 0 && (
          <div>
            <div className="space-y-2">
              {teammates.map(t => (
                <div key={t.id} className="rounded-md bg-night-deep/60 border border-white/5 px-3 py-2">
                  {editingTeammate === t.id ? (
                    <div className="flex flex-col gap-2">
                      <input
                        value={editValues.name}
                        onChange={e => setEditValues(v => ({ ...v, name: e.target.value.slice(0, 40) }))}
                        className="px-2 py-1 rounded bg-night-mid border border-white/10 text-sm focus:border-tower-gold focus:outline-none"
                        placeholder="Name"
                      />
                      <input
                        value={editValues.role}
                        onChange={e => setEditValues(v => ({ ...v, role: e.target.value.slice(0, 60) }))}
                        className="px-2 py-1 rounded bg-night-mid border border-white/10 text-sm focus:border-tower-gold focus:outline-none"
                        placeholder="Role"
                      />
                      <div className="flex gap-2 text-xs">
                        <button onClick={saveTeammate} className="px-2 py-1 rounded bg-tower-gold text-night-deep font-semibold">
                          Save
                        </button>
                        <button onClick={() => setEditingTeammate(null)} className="px-2 py-1 text-tower-cream/50">
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold truncate">{t.name}</div>
                        <div className="text-xs text-tower-cream/50 truncate">{t.role}</div>
                      </div>
                      <button
                        onClick={() => startEditing(t)}
                        className="shrink-0 px-2 py-1 rounded text-xs text-tower-cream/70 hover:text-tower-gold hover:bg-night-mid/60 transition"
                      >
                        ✎ Edit
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        </div>

        {/* Share */}
        <div>
          <div className="text-sm font-semibold mb-2">Share to climb faster</div>
          <div className="grid grid-cols-3 gap-2">
            {(['x', 'linkedin', 'threads'] as const).map(net => (
              <button
                key={net}
                onClick={() => handleShare(net)}
                className="px-3 py-2 rounded-md bg-night-deep/80 border border-white/10 text-sm font-semibold capitalize hover:bg-night-deep transition"
                disabled={!inviteUrl}
              >
                {net === 'x' ? '𝕏 X' : net === 'linkedin' ? '🔗 LinkedIn' : '@ Threads'}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={() => setHowItWorksOpen(true)}
          className="flex items-center justify-between w-full text-xs hover:bg-night-deep/40 rounded-md px-1 py-0.5 -mx-1 transition"
        >
          <span className="flex items-center gap-1 text-tower-cream/50">ⓘ How it works</span>
          <span className="text-purple-300 hover:text-purple-200 font-semibold">Open →</span>
        </button>
      </div>

      <HowItWorksModal
        open={howItWorksOpen}
        onClose={() => setHowItWorksOpen(false)}
        inviteUrl={inviteUrl || null}
      />

      <div className="border-t border-white/5 p-4 mt-auto">
        <a
          href={DISCORD_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-md bg-[#5865f2] hover:bg-[#4752c4] text-white font-semibold transition"
        >
          <svg width="18" height="14" viewBox="0 0 71 55" fill="white" xmlns="http://www.w3.org/2000/svg" aria-hidden>
            <path d="M60.1045 4.8978C55.5792 2.8214 50.7265 1.2916 45.6527 0.41542C45.5603 0.39851 45.468 0.44077 45.4204 0.52529C44.7963 1.6353 44.105 3.0834 43.6209 4.2216C38.1637 3.4046 32.7345 3.4046 27.3892 4.2216C26.905 3.0581 26.1886 1.6353 25.5617 0.52529C25.5141 0.44336 25.4218 0.40110 25.3294 0.41542C20.2584 1.2888 15.4057 2.8186 10.8776 4.8978C10.8384 4.9147 10.8048 4.9429 10.7825 4.9795C1.57795 18.7309 -0.943561 32.1443 0.293408 45.3914C0.299005 45.4562 0.335386 45.5182 0.385761 45.5576C7.41596 50.7066 14.2196 53.9330 20.8952 56.0834C20.9876 56.1127 21.0857 56.0806 21.1445 56.0074C22.7586 53.8321 24.2017 51.5327 25.4414 49.1156C25.5026 48.9988 25.4442 48.8594 25.3183 48.8143C23.0568 47.9498 20.9009 46.9023 18.8254 45.7017C18.6864 45.6195 18.6752 45.4225 18.8030 45.3260C19.2317 45.0054 19.6605 44.6733 20.0701 44.3383C20.1347 44.2844 20.2243 44.2731 20.2998 44.3073C32.3202 49.7978 45.4020 49.7978 57.2796 44.3073C57.3551 44.2703 57.4447 44.2816 57.5121 44.3355C57.9217 44.6705 58.3505 45.0054 58.7820 45.3260C58.9098 45.4225 58.9014 45.6195 58.7624 45.7017C56.6869 46.9247 54.5310 47.9498 52.2667 48.8115C52.1408 48.8566 52.0852 48.9988 52.1464 49.1156C53.4085 51.5299 54.8516 53.8265 56.4349 56.0046C56.4937 56.0806 56.5946 56.1127 56.6870 56.0834C63.3933 53.9330 70.1970 50.7066 77.2272 45.5576C77.2804 45.5182 77.3140 45.4590 77.3196 45.3942C78.8187 30.0731 74.8719 16.7700 67.0575 4.9823C67.0380 4.9429 67.0044 4.9147 66.9624 4.8978ZM25.7628 37.2926C22.2211 37.2926 19.3038 34.0454 19.3038 30.0645C19.3038 26.0836 22.1648 22.8364 25.7628 22.8364C29.3889 22.8364 32.2779 26.1120 32.2218 30.0645C32.2218 34.0454 29.3608 37.2926 25.7628 37.2926ZM45.3311 37.2926C41.7895 37.2926 38.8721 34.0454 38.8721 30.0645C38.8721 26.0836 41.7331 22.8364 45.3311 22.8364C48.9573 22.8364 51.8462 26.1120 51.7901 30.0645C51.7901 34.0454 48.9573 37.2926 45.3311 37.2926Z" />
          </svg>
          Join us on Discord
        </a>
      </div>
    </div>
  )
}
