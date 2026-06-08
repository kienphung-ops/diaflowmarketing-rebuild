'use client'

/**
 * The Wall (/wall) — public community stats board.
 *
 * Faithful port of requirements/diaflow-wall.html. Each section fetches
 * its own API (no SSR data) so the page shell paints instantly and the
 * numbers stream in:
 *   - /api/wall/stats        → hero counters
 *   - /api/wall/leaderboard  → Top 50
 *   - /api/wall/roles        → "Who's building" (curated ratio, AppConfig)
 *   - /api/wall/poked        → Most poked top 5
 *
 * The data lives behind a ~2-min Redis cache server-side, so this can be
 * fetched freely. Styling is a scoped CSS Module (wall.module.css).
 */

import { useEffect, useState } from 'react'
import styles from './wall.module.css'

const cx = (...c: Array<string | false | undefined>) => c.filter(Boolean).join(' ')

interface Stats {
  teamsBuilding: number
  teammatesHired: number
  joinedThisWeek: number
  reachedLevel3: number
}
interface LeaderEntry {
  rank: number
  teamName: string | null
  level: number
  role: string | null
  referralCode: string
}
/** The viewer's own row when they're outside the top 50 (rendered as a
 *  "50+" footer line). No `rank` — it's always shown as "50+". */
interface ViewerEntry {
  teamName: string | null
  level: number
  role: string | null
  referralCode: string
}
interface RoleSlice { name: string; pct: number }
interface PokedEntry { teamName: string | null; pokes: number }

/** Count-up from 0 → target with an ease-out cubic, ~1.1s. Re-runs when
 *  `target` changes (e.g. null → fetched value). Returns the live value. */
function useCountUp(target: number | null, durationMs = 1100): number {
  const [val, setVal] = useState(0)
  useEffect(() => {
    if (target === null) return
    let raf = 0
    const start = performance.now()
    const from = 0
    const step = (now: number) => {
      const p = Math.min((now - start) / durationMs, 1)
      const e = 1 - Math.pow(1 - p, 3)
      setVal(Math.round(from + (target - from) * e))
      if (p < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target, durationMs])
  return val
}

function StatNum({ value }: { value: number | null }) {
  const n = useCountUp(value)
  return <>{n.toLocaleString()}</>
}

const OFFICE_FALLBACK = 'Untitled office'
const MEDALS = ['🥇', '🥈', '🥉']

export default function WallClient() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [board, setBoard] = useState<LeaderEntry[] | null>(null)
  // The viewer's own "50+" row when they're signed in but off the board.
  const [you, setYou] = useState<ViewerEntry | null>(null)
  const [roles, setRoles] = useState<RoleSlice[] | null>(null)
  const [poked, setPoked] = useState<PokedEntry[] | null>(null)
  // Login state, derived from /api/me (200 → signed in, 401 → guest).
  // null = still resolving; we render neither auth-gated control until
  // it's known so a guest never flashes "Your office" and vice versa.
  const [authed, setAuthed] = useState<boolean | null>(null)
  // Bars start at width 0 (CSS) then expand once data is in, so the
  // fill animates the same way the original mockup did.
  const [barsArmed, setBarsArmed] = useState(false)

  // The app is a fixed full-screen 3D game, so globals.css locks
  // `html, body { overflow: hidden }`. The wall is a normal long
  // document, so re-enable scrolling while it's mounted and restore the
  // lock on unmount (navigating back to the game) — inline styles beat
  // the stylesheet, and the cleanup reverts to whatever was there.
  //
  // IMPORTANT: scroll on <html> only; <body> must stay `visible` (NOT
  // auto). If body is a scroll container, the sticky right column (.side)
  // anchors to body instead of the viewport and never pins — it scrolls
  // away with the page.
  useEffect(() => {
    const html = document.documentElement
    const body = document.body
    const prev = { html: html.style.overflow, body: body.style.overflow }
    html.style.overflow = 'auto'
    body.style.overflow = 'visible'
    return () => {
      html.style.overflow = prev.html
      body.style.overflow = prev.body
    }
  }, [])

  useEffect(() => {
    let alive = true
    async function load() {
      const safe = async <T,>(url: string): Promise<T | null> => {
        try {
          const r = await fetch(url)
          if (!r.ok) return null
          return (await r.json()) as T
        } catch {
          return null
        }
      }
      const [s, b, rl, pk, isAuthed] = await Promise.all([
        safe<Stats>('/api/wall/stats'),
        safe<{ top50: LeaderEntry[]; you: ViewerEntry | null }>('/api/wall/leaderboard'),
        safe<{ roles: RoleSlice[] }>('/api/wall/roles'),
        safe<{ items: PokedEntry[] }>('/api/wall/poked'),
        // /api/me is 401 for guests — just need the ok flag here.
        fetch('/api/me').then(r => r.ok).catch(() => false),
      ])
      if (!alive) return
      if (s) setStats(s)
      setBoard(b?.top50 ?? [])
      setYou(b?.you ?? null)
      setRoles(rl?.roles ?? [])
      setPoked(pk?.items ?? [])
      setAuthed(isAuthed)
    }
    load()
    return () => { alive = false }
  }, [])

  // Arm the bar widths a tick after roles arrive (matches the mockup's
  // 150ms reveal delay).
  useEffect(() => {
    if (roles && roles.length > 0) {
      const t = setTimeout(() => setBarsArmed(true), 150)
      return () => clearTimeout(t)
    }
  }, [roles])

  const maxPct = roles && roles.length > 0 ? Math.max(...roles.map(r => r.pct), 1) : 1
  const teamsLabel = stats ? stats.teamsBuilding.toLocaleString() : '…'
  // Viewer highlighting: match the signed-in user's row by referralCode.
  // In top 50 → highlight that row; otherwise → render the "50+" footer.
  const youCode = you?.referralCode ?? null
  const youInTop = !!youCode && (board?.some(d => d.referralCode === youCode) ?? false)

  return (
    <div className={styles.page}>
      <div className={styles.wrap}>
        <header className={styles.header}>
          <div className={styles.brand}>
            <div className={styles.logo}>D</div>
            <div className={styles.name}>Diaflow <span>AI Teammates</span></div>
          </div>
          <div className={styles.headerRight}>
            {/* Only signed-in users have an office to go back to. */}
            {authed === true && (
              <a className={styles.backLink} href="/">← Your office</a>
            )}
          </div>
        </header>

        <div className={styles.titleblock}>
          <div className={styles.eyebrow}>The Wall</div>
          <h1>Everyone building their team.</h1>
          <p>Live before AI Teammates launch. Level up your office — keep what you earn.</p>
          <div className={styles.launchPill}>📅 Launching this summer</div>
        </div>

        {/* HERO STATS */}
        <div className={styles.heroStats}>
          <div className={cx(styles.stat, styles.headline)}>
            <div className={styles.statNum}><StatNum value={stats?.teamsBuilding ?? null} /></div>
            <div className={styles.statLabel}>teams building</div>
            <div className={styles.statSub}>growing daily</div>
          </div>
          <div className={styles.stat}>
            <div className={styles.statNum}><StatNum value={stats?.teammatesHired ?? null} /></div>
            <div className={styles.statLabel}>AI teammates hired</div>
          </div>
          <div className={styles.stat}>
            <div className={styles.statNum}><StatNum value={stats?.joinedThisWeek ?? null} /></div>
            <div className={styles.statLabel}>joined this week</div>
          </div>
          <div className={styles.stat}>
            <div className={styles.statNum}><StatNum value={stats?.reachedLevel3 ?? null} /></div>
            <div className={styles.statLabel}>reached Level 3</div>
            <div className={styles.statSub}>free beta unlocked</div>
          </div>
        </div>

        {/* MAIN GRID */}
        <div className={styles.grid}>
          {/* Leaderboard */}
          <div>
            <div className={styles.sectionHead}>
              <h2>Top 50</h2>
            </div>
            <div className={styles.board}>
              {board === null && <div className={styles.muted}>Loading…</div>}
              {board?.length === 0 && <div className={styles.muted}>No teams on the board yet.</div>}
              {board?.map((d, i) => {
                const topCls = i === 0 ? styles.top1 : i === 1 ? styles.top2 : i === 2 ? styles.top3 : ''
                const isYou = !!youCode && d.referralCode === youCode
                return (
                  <div key={d.referralCode} className={cx(styles.row, topCls, isYou && styles.you)}>
                    <div className={styles.rank}>
                      {i < 3 ? <span className={styles.medal}>{MEDALS[i]}</span> : i + 1}
                    </div>
                    <div className={styles.who}>
                      <div className={styles.office}>
                        {d.teamName || OFFICE_FALLBACK}
                        {isYou && <span className={styles.youTag}>YOU</span>}
                      </div>
                      {d.role && <div className={styles.role}>{d.role}</div>}
                    </div>
                    <div className={styles.lvl}>Lv {d.level}</div>
                  </div>
                )
              })}
              {/* Viewer's own row when they're outside the top 50 — pinned
                  at the bottom with a "50+" rank so they still see where
                  they stand. (When they're IN the top 50 their row above is
                  highlighted instead.) */}
              {you && !youInTop && (
                <div className={cx(styles.row, styles.you)}>
                  <div className={styles.rank}>50+</div>
                  <div className={styles.who}>
                    <div className={styles.office}>
                      {you.teamName || OFFICE_FALLBACK}
                      <span className={styles.youTag}>YOU</span>
                    </div>
                    {you.role && <div className={styles.role}>{you.role}</div>}
                  </div>
                  <div className={styles.lvl}>Lv {you.level}</div>
                </div>
              )}
            </div>
          </div>

          {/* Side */}
          <div className={styles.side}>
            {/* Guests only — signed-in users already have an office. */}
            {authed === false && (
              <div className={styles.ctaCard}>
                <h3>Not on the wall yet?</h3>
                <p>Build your office, meet your team, and start leveling up in 60 seconds.</p>
                <a className={styles.ctaBtn} href="/">Build your AI Team →</a>
              </div>
            )}

            <div className={styles.card}>
              <h3>Who&apos;s building</h3>
              <div className={styles.cardSub}>Roles across all {teamsLabel} teams</div>
              {/* Wrapper so `.roleRow:first-child` (gold top bar) targets
                  the first role, not the <h3>. */}
              <div>
                {roles === null && <div className={styles.muted}>Loading…</div>}
                {roles?.length === 0 && <div className={styles.muted}>Updating soon.</div>}
                {roles?.map((r, i) => (
                  <div key={`${r.name}-${i}`} className={styles.roleRow}>
                    <div className={styles.roleTop}>
                      <span className={styles.roleName}>{r.name}</span>
                      <span className={styles.roleCount}>{r.pct}%</span>
                    </div>
                    <div className={styles.bar}>
                      <div
                        className={styles.barFill}
                        style={{ width: barsArmed ? `${Math.round((r.pct / maxPct) * 100)}%` : 0 }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className={styles.card}>
              <h3>Most poked 👆</h3>
              <div className={styles.cardSub}>Most love received · just for fun</div>
              {/* Wrapper so `.pokeRow:last-child` (no border) targets the
                  last poke, not whatever follows in the card. */}
              <div>
                {poked === null && <div className={styles.muted}>Loading…</div>}
                {poked?.length === 0 && <div className={styles.muted}>No pokes yet.</div>}
                {poked?.map((d, i) => (
                  <div key={i} className={styles.pokeRow}>
                    <span className={styles.pokeRank}>{i + 1}</span>
                    <span className={styles.pokeOffice}>{d.teamName || OFFICE_FALLBACK}</span>
                    <span className={styles.pokeCount}>★ {d.pokes.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {authed === false && (
        <div className={styles.mobileCta}>
          <a className={styles.ctaBtn} href="/">Build your AI Team →</a>
        </div>
      )}
    </div>
  )
}
