/**
 * Prisma seed — Floor + Item + FloorItem.
 *
 * Idempotent: every row is an upsert keyed by its natural key
 * (Floor.id, Item.key, FloorItem(floorId,itemId)). Safe to re-run; the
 * floor_items reseed is full-replace (delete + insert) so prior
 * mistakes don't linger.
 *
 * Run: `npx prisma db seed`
 * Wired via prisma.config.ts → migrations.seed.
 *
 * Why a separate seed when the migration already INSERTs the same data?
 *   - `prisma migrate reset` wipes everything; this script restores it.
 *   - Admins can tweak labels / thresholds / item quantities here and
 *     re-run without touching migration history.
 *
 * SEMANTIC: floor_items is a PER-FLOOR list — each row tells the
 * renderer "this item appears on this floor". To get the natural
 * gamification progression ("more stuff as you climb"), every item is
 * seeded onto its unlock floor AND every floor above. So:
 *
 *   company_picture_frame → F1..F20  (unlocks at F1, persists upward)
 *   floor_lamp            → F2..F20  (unlocks at F2)
 *   ...
 *   penthouse             → F20       (only at the top)
 *
 * Result: F1 has 1 item, F20 has all 20.
 */

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

/**
 * Floor catalogue — invitesRequired thresholds, labels, and max
 * teammate caps. The label here mirrors the canonical floor name shown
 * in MySquadDrawer; `maxTeammates` is INCLUSIVE of the 3 default NPCs.
 */
const FLOORS = [
  // Source-of-truth: requirements/new_items.md. The renderer
  // (FloorItems.tsx) keys off the per-item `key` strings further below,
  // so any addition/removal here must be mirrored in the ITEMS array
  // AND its matching mesh component in FloorItems.tsx.
  //
  // `unlockItems` is now a Postgres text[] — one badge per array
  // entry. Floors that historically read "X + Y" become ['X', 'Y'].
  { id: 1,  invitesRequired: 0,   label: 'Company name picture frame',     maxTeammates: 3,  unlockItems: ['🖼 Company name picture frame', '1 desk'] },
  // F2 is unlocked by SHARING (any share button), not by invites — see
  // `unlockType` + computeFloorForProgress. invitesRequired is kept for
  // the anonymous trial preview / display fallback only.
  { id: 2,  invitesRequired: 0,   unlockType: 'share', label: 'Floor lamp + basic chair',       maxTeammates: 4,  unlockItems: ['💡 Floor lamp', 'Basic chair'] },
  // F3: 2nd "basic chair + desk" pair. These are 2 SEPARATE items
  // (office_desk + basic_chair) now, not the retired composite.
  { id: 3,  invitesRequired: 1,   label: 'Basic chair + desk',             maxTeammates: 5,  unlockItems: ['🪑 Basic chair + desk'], productReward: '🚀Free early beta' },
  { id: 4,  invitesRequired: 2,   label: 'Potted plant',                    maxTeammates: 5,  unlockItems: ['🌿 Potted plant'] },
  // F5: 3rd "basic chair + desk" pair (cap). From here on the user
  // has 3 office workstations.
  { id: 5,  invitesRequired: 3,   label: 'Coffee mug + basic chair + desk', maxTeammates: 6,  unlockItems: ['☕ Coffee mug on desk', 'Basic chair + desk'] },
  // F6: chair upgrade beat — ALL basic chairs become high-back
  // executive (giám đốc) chairs. Same workstation slots, plusher
  // seating. See ExecutiveChair mesh + the basic_chair → 0 /
  // executive_chair → 3 swap in ITEMS below.
  { id: 6,  invitesRequired: 4,   label: 'Bookshelf + upgraded chairs',     maxTeammates: 6,  unlockItems: ['📚 Bookshelf', 'Upgraded extra chair'] },
  { id: 7,  invitesRequired: 6,  label: 'Printer',             maxTeammates: 7,  unlockItems: ['🖨 Printer'],productReward: '🎁 1 month Pro free' },
  { id: 8,  invitesRequired: 8,  label: 'Whiteboard with diagrams',        maxTeammates: 7,  unlockItems: ['📋 Whiteboard with diagrams'] },
  { id: 9,  invitesRequired: 10,  label: 'Mini fridge',                     maxTeammates: 8,  unlockItems: ['🧃 Mini fridge'] },
  // F10 + F11 swapped vs the old seed — spec puts the couch first
  // (lounge area at slot-tier 8) and the trophy at the next tier (9).
  { id: 10, invitesRequired: 13,  label: 'Couch / lounge area',             maxTeammates: 8,  unlockItems: ['🛋 Couch / lounge area'] },
  { id: 11, invitesRequired: 16,  label: 'Trophy on shelf',                 maxTeammates: 9,  unlockItems: ['🏆 Trophy on shelf'], productReward:'🎁 2 months Pro free' },
  { id: 12, invitesRequired: 19,  label: 'Upgraded dark wood desk',         maxTeammates: 9,  unlockItems: ['🪵 Upgraded dark wood desk'] },
  { id: 13, invitesRequired: 23,  label: 'Neon sign on wall',               maxTeammates: 10, unlockItems: ['🌟 Neon sign on wall'] },
  // 2-mo reward moved from F15 → F14 per spec; F15 no longer carries
  // a product reward.
  { id: 14, invitesRequired: 27,  label: 'Arcade machine',                  maxTeammates: 10, unlockItems: ['🕹 Arcade machine'] },
  { id: 15, invitesRequired: 31,  label: 'Floor-to-ceiling windows',        maxTeammates: 11, unlockItems: ['🪟 Floor-to-ceiling windows'], productReward: '🎁 3 months Pro free'},
  // F16 is now a tea-table beat (the simple round table). Living wall
  // moved one floor up to share F17 with the ping-pong table.
  { id: 16, invitesRequired: 36,  label: 'Tea table',                       maxTeammates: 11, unlockItems: ['🍵 Tea table'] },
  { id: 17, invitesRequired: 41,  label: 'Living wall + ping pong table',   maxTeammates: 12, unlockItems: ['🌿 Living wall', 'Ping pong table'] },
  { id: 18, invitesRequired: 46,  label: 'Espresso machine + coffee area',  maxTeammates: 12, unlockItems: ['☕ Espresso machine', 'Coffee area'] },
  // Rooftop terrace was replaced by the DJ stand — same z=19 slot,
  // different vibe.
  { id: 19, invitesRequired: 51, label: 'DJ stand',                        maxTeammates: 13, unlockItems: ['🎵 DJ stand'] },
  { id: 20, invitesRequired: 56, label: 'Full penthouse',                  maxTeammates: 14, unlockItems: ['👑 Full penthouse'], productReward: '🎁 4 months Pro free · ⭐ Featured' },
]

const MAX_FLOOR = 20

/**
 * Item catalogue. `key` MUST match what the scene renderer
 * (src/components/scene/environment/FloorItems.tsx) consumes — do not
 * rename keys without updating that file. `unlockFloor` is the lowest
 * floor where this item first appears; the seed code below replicates
 * the row from `unlockFloor` up to MAX_FLOOR so each climbed floor
 * shows everything unlocked so far. `quantity` is the per-floor count
 * the renderer multiplies (e.g. basic_chair_desk × 4 → 4 desks).
 *
 * Per-floor quantity overrides: pass `quantityByFloor` to set specific
 * floors. Any floor in [unlockFloor..MAX_FLOOR] not listed there falls
 * back to the default `quantity` field. Example: basic_chair_desk
 * starts at 1 desk on F3, grows to 4 on F4 (team expansion), then
 * settles at 3 on F5+.
 */
const ITEMS = [
  { key: 'company_picture_frame', label: 'Company name picture frame',  unlockFloor: 1,  quantity: 1 },
  // office_desk: present F1..F11 with a ramping count (1 → 3 across
  // F1, F2, F3-F4=2, F5-F11=3). From F12 onward the seed sets
  // quantity to 0 so the dark-wood upgraded_desk takes over visually.
  // Implemented via a tight quantityByFloor map + default 0.
  {
    key: 'office_desk',
    label: 'Office desk',
    unlockFloor: 1,
    quantity: 0, // default = "gone" (covers F12..F20)
    quantityByFloor: { 1: 1, 2: 1, 3: 2, 4: 2, 5: 3, 6: 3, 7: 3, 8: 3, 9: 3, 10: 3, 11: 3 },
  },
  { key: 'floor_lamp',            label: 'Floor lamp',                  unlockFloor: 2,  quantity: 1 },
  // basic_chair: F2=1, F3=2, F4=2, F5=3 — paired with office_desk.
  // At F6+ EVERY basic chair is upgraded to the executive chair, so
  // quantity drops back to 0 (default) and executive_chair fills
  // the same workstation slots. Same upgrade pattern the desk uses
  // at F12 (office_desk → upgraded_desk).
  {
    key: 'basic_chair',
    label: 'Basic chair',
    unlockFloor: 2,
    quantity: 0, // default = "gone" once chairs upgrade (covers F6..F20)
    quantityByFloor: { 2: 1, 3: 2, 4: 2, 5: 3 },
  },
  // F6 onwards: ALL chairs are now executive (giám đốc / high-back
  // leather director's chair). Quantity 3 matches the F5 basic_chair
  // count so the F6 unlock visually swaps the 3 seats — see
  // ExecutiveChair mesh.
  { key: 'executive_chair',       label: 'Executive chair',             unlockFloor: 6,  quantity: 3 },
  { key: 'potted_plant',          label: 'Potted plant',                unlockFloor: 4,  quantity: 1 },
  { key: 'coffee_mug',            label: 'Coffee mug on desk',          unlockFloor: 5,  quantity: 1 },
  { key: 'bookshelf',             label: 'Bookshelf',                   unlockFloor: 6,  quantity: 1 },
  { key: 'printer',               label: 'Printer',                     unlockFloor: 7,  quantity: 1 },
  { key: 'whiteboard',            label: 'Whiteboard with diagrams',    unlockFloor: 8,  quantity: 1 },
  { key: 'mini_fridge',           label: 'Mini fridge',                 unlockFloor: 9,  quantity: 1 },
  // Couch + trophy SWAPPED vs old seed — see FLOORS table above.
  { key: 'couch',                 label: 'Couch / lounge area',         unlockFloor: 10, quantity: 1 },
  { key: 'trophy',                label: 'Trophy on shelf',             unlockFloor: 11, quantity: 1 },
  // upgraded_desk: replaces office_desk visually at F12+. Quantity 3
  // matches the office_desk count at F5..F11 so the swap is
  // 1-to-1 — same workstation slots, dark wood finish.
  { key: 'upgraded_desk',         label: 'Upgraded dark wood desk',     unlockFloor: 12, quantity: 3 },
  { key: 'neon_sign',             label: 'Neon sign on wall',           unlockFloor: 13, quantity: 1 },
  { key: 'arcade_machine',        label: 'Arcade machine',              unlockFloor: 14, quantity: 1 },
  { key: 'floor_ceiling_windows', label: 'Floor-to-ceiling windows',    unlockFloor: 15, quantity: 1 },
  // F16 is now a tea table (new mesh); living_wall moves up to F17.
  { key: 'tea_table',             label: 'Tea table',                   unlockFloor: 16, quantity: 1 },
  { key: 'living_wall',           label: 'Living wall',                 unlockFloor: 17, quantity: 1 },
  { key: 'ping_pong_table',       label: 'Ping pong table',             unlockFloor: 17, quantity: 1 },
  { key: 'espresso_machine',      label: 'Espresso machine',            unlockFloor: 18, quantity: 1 },
  // F19's rooftop_terrace retired in favour of the DJ stand. The
  // rooftop_terrace mesh in FloorItems.tsx is also gone now — if you
  // resurrect this floor, add it back in both places.
  { key: 'dj_stand',              label: 'DJ stand',                    unlockFloor: 19, quantity: 1 },
  { key: 'penthouse',             label: 'Full penthouse',              unlockFloor: 20, quantity: 1 },
]

/**
 * Spin wheel wedge catalogue — admin-editable rewards + odds.
 *
 * Mirrors the original hardcoded WEDGE_DEFS (Direct cash EV $1.14, cash
 * hit rate 70 %, spin-again 30 %, jackpot 1 %). Weights are relative —
 * the picker renormalises at runtime, so admins can change any weight
 * without re-balancing the rest.
 *
 * `type` semantics:
 *   credit → `amount` is cents added to spinCreditCents (subject to the
 *            $50 cap).
 *   spin   → `amount` is spin tokens granted; landing on this wedge
 *            triggers the free re-spin (chain depth 1).
 *
 * New reward kinds (e.g. "item", "product", "tokens") can be added
 * later without touching the schema — only the picker / outcome
 * resolver in lib/spin learns how to apply them.
 */
// Spin-wheel wedges. Both `weight` and `firstWeight` are percentages by
// convention (the picker normalises, so any positive integer works).
//   • weight       → applied to every spin AFTER the user's first.
//   • firstWeight  → applied to the FIRST spin (anon teaser + the
//                    user's very first authenticated spin). Tuned to
//                    bias toward "good first impression" — more
//                    jackpot / cash, fewer spin_again re-rolls.
// Edit either column in this file, in Prisma Studio, or via SQL —
// the wedge cache picks up changes within ~60 s.
const SPIN_WEDGES = [
  { key: 'cash_50c',   label: '$0.50',       type: 'credit', amount: 50,   weight: 30, firstWeight: 0, color: '#3b2f6b', sortOrder: 0 },
  { key: 'cash_1',     label: '$1',          type: 'credit', amount: 100,  weight: 30, firstWeight: 0, color: '#4c3a8c', sortOrder: 1 },
  { key: 'cash_2',     label: '$2',          type: 'credit', amount: 200,  weight: 12, firstWeight: 50, color: '#6d4bd8', sortOrder: 2 },
  { key: 'cash_3',     label: '$3',          type: 'credit', amount: 300,  weight: 5,  firstWeight: 30, color: '#8b5cf6', sortOrder: 3 },
  { key: 'cash_5',     label: '$5',          type: 'credit', amount: 500,  weight: 2,  firstWeight: 19,  color: '#a78bfa', sortOrder: 4 },
  { key: 'spin_again', label: 'Spin again',  type: 'spin',   amount: 1,    weight: 20, firstWeight: 0,  color: '#1f2147', sortOrder: 5 },
  { key: 'jackpot',    label: 'JACKPOT $25', type: 'credit', amount: 2500, weight: 1,  firstWeight: 1,  color: '#fbbf24', sortOrder: 6 },
]

async function main() {
  console.log('▶ Seeding Floor / Item / FloorItem…')

  // ─── 1. Floors ─────────────────────────────────────────────────────
  for (const f of FLOORS) {
    await prisma.floor.upsert({
      where: { id: f.id },
      create: {
        id: f.id,
        invitesRequired: f.invitesRequired,
        unlockType: f.unlockType ?? 'invite',
        label: f.label,
        maxTeammates: f.maxTeammates,
        // Coerce `undefined` (field omitted in the FLOORS entry above)
        // to `null` / `[]` so the upsert ALWAYS sets the column. Without
        // this, Prisma's update path treats `undefined` as "leave this
        // column alone", which meant prior seed runs leaked stale
        // `productReward` / `unlockItems` values that we'd intended
        // to clear (e.g. moving "1 mo free" from F6 → F7 didn't clear
        // F6's old reward).
        productReward: f.productReward ?? null,
        unlockItems: f.unlockItems ?? [],
      },
      update: {
        invitesRequired: f.invitesRequired,
        unlockType: f.unlockType ?? 'invite',
        label: f.label,
        maxTeammates: f.maxTeammates,
        productReward: f.productReward ?? null,
        unlockItems: f.unlockItems ?? [],
      },
    })
  }
  console.log(`  ✓ ${FLOORS.length} floors`)

  // ─── 2. Items ──────────────────────────────────────────────────────
  for (const it of ITEMS) {
    await prisma.item.upsert({
      where: { key: it.key },
      create: { key: it.key, label: it.label },
      update: { label: it.label },
    })
  }
  console.log(`  ✓ ${ITEMS.length} items`)

  // ─── 3. FloorItem joins — full replace ─────────────────────────────
  // Wipe-then-insert so any prior mis-seeded rows don't linger. Cheap
  // since the table is tiny (≤ 210 rows) and only the seed touches it.
  await prisma.floorItem.deleteMany({})
  const items = await prisma.item.findMany({ select: { id: true, key: true } })
  const itemIdByKey = Object.fromEntries(items.map(i => [i.key, i.id]))

  const rows = []
  for (const it of ITEMS) {
    const itemId = itemIdByKey[it.key]
    if (!itemId) continue
    // Cumulative-inclusive: item appears on every floor from its
    // unlock onwards, so a user on floor N sees everything unlocked at
    // floors 1..N (because floor N's row already contains them all).
    // `quantityByFloor` overrides the default on specific floors.
    const overrides = it.quantityByFloor ?? {}
    for (let fid = it.unlockFloor; fid <= MAX_FLOOR; fid++) {
      const quantity = overrides[fid] ?? it.quantity
      rows.push({ floorId: fid, itemId, quantity })
    }
  }
  if (rows.length) {
    await prisma.floorItem.createMany({ data: rows, skipDuplicates: true })
  }
  console.log(`  ✓ ${rows.length} floor↔item joins`)

  // ─── 4. Spin wedges ────────────────────────────────────────────────
  // Upsert by `key` so admins can tweak amount/weight/color in this
  // file and re-run without losing the row id (which would orphan
  // SpinResult.wedge values keyed by the same string — those still
  // join by key, but keeping ids stable avoids surprising churn).
  for (const w of SPIN_WEDGES) {
    await prisma.spinWedge.upsert({
      where: { key: w.key },
      create: w,
      update: {
        label: w.label,
        type: w.type,
        amount: w.amount,
        weight: w.weight,
        firstWeight: w.firstWeight,
        color: w.color,
        sortOrder: w.sortOrder,
        // Don't touch `enabled` on update — once an admin disables a
        // wedge in production we don't want a reseed to silently
        // re-enable it.
      },
    })
  }
  console.log(`  ✓ ${SPIN_WEDGES.length} spin wedges`)

  // ─── 4b. App config defaults ───────────────────────────────────────
  // Generic key/value settings (app_config table). Seed DEFAULTS only —
  // `update: {}` so a re-run never clobbers a value an admin changed
  // live. `value` is JSONB; a bare string id is stored as a JSON string.
  //   - leo_youtube_id: Leo's intro-video YouTube ID (migrated off the
  //     old NEXT_PUBLIC_YOUTUBE_ID env var). Blank → /leo_video.mp4.
  const APP_CONFIG_DEFAULTS = [
    { key: 'leo_youtube_id', value: 'loE-Hk8Bmh4' },
  ]
  for (const c of APP_CONFIG_DEFAULTS) {
    await prisma.appConfig.upsert({
      where: { key: c.key },
      create: { key: c.key, value: c.value },
      update: {}, // never overwrite an admin-set value on reseed
    })
  }
  console.log(`  ✓ ${APP_CONFIG_DEFAULTS.length} app config defaults`)

  // ─── 5. Bust the floors API cache ─────────────────────────────────
  // /api/floors sits behind a 3-tier cache (in-process memo → Redis →
  // DB). The in-process layer dies with this script naturally, but
  // Redis would keep serving the old shape until its TTL. Wiping the
  // canonical key here means a fresh seed is visible on the very next
  // API request — no manual flush step.
  // Lazy-imported so a missing REDIS_DB env doesn't crash the seed.
  if (process.env.REDIS_DB) {
    try {
      const { default: Redis } = await import('ioredis')
      const redis = new Redis(process.env.REDIS_DB, { lazyConnect: false })
      await redis.del('floors:v1:all', 'spin:wedges:v1')
      await redis.quit()
      console.log('  ✓ Redis floors + spin wedges cache busted')
    } catch (err) {
      console.warn('  ⚠ Redis flush failed (non-fatal):', err.message)
    }
  }

  console.log('✔ Seed complete.')
}

main()
  .catch(err => {
    console.error('✗ Seed failed:', err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
