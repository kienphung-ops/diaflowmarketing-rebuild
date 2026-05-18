'use client'

import { useEffect, useState } from 'react'
import { FLOOR_CONFIG, getFloorConfig } from '@/lib/floors'

interface ServerRecruit {
  id: string
  name: string
  role: string
}

interface Props {
  open: boolean
  onClose: () => void
  signedIn: boolean
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
  signedIn,
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
      className={`fixed inset-y-0 right-0 z-30 w-[440px] max-w-full bg-night-mid/95 border-l border-white/10 backdrop-blur-md shadow-2xl flex flex-col text-tower-cream transition-transform duration-300 ${
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

        <div className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-1 text-tower-cream/50">ⓘ How it works</span>
          <button className="text-purple-300 hover:text-purple-200">Open →</button>
        </div>
      </div>

      <div className="border-t border-white/5 p-4">
        <a
          href="https://discord.gg/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-md bg-purple-600 hover:bg-purple-500 text-white font-semibold transition"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/discord.png" alt="" width={20} height={20} className="opacity-95" />
          Join us on Discord
        </a>
      </div>
    </div>
  )
}
