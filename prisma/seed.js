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
  { id: 1,  invitesRequired: 0,   label: 'Company name picture frame', maxTeammates: 3, unlock_items:"Company name picture frame" },
  { id: 2,  invitesRequired: 1,   label: 'Floor lamp',                  maxTeammates: 4, unlock_items:"Floor lamp" },
  { id: 3,  invitesRequired: 2,   label: 'Basic chair + first desk',    maxTeammates: 5, unlock_items:"Basic chair + first desk", product_reward:"Free beta access" },
  { id: 4,  invitesRequired: 4,   label: 'Potted plant',                maxTeammates: 5, unlock_items:"Potted plant" },
  { id: 5,  invitesRequired: 6,   label: 'Coffee mug on desk',          maxTeammates: 6, unlock_items:"Coffee mug on desk" },
  { id: 6,  invitesRequired: 9,   label: 'Bookshelf',                   maxTeammates: 6, unlock_items:"Bookshelf", product_reward:"1 mo free" },
  { id: 7,  invitesRequired: 12,  label: 'Printer',                     maxTeammates: 7, unlock_items:"Printer" },
  { id: 8,  invitesRequired: 16,  label: 'Whiteboard',                  maxTeammates: 7, unlock_items:"Whiteboard" },
  { id: 9,  invitesRequired: 21,  label: 'Mini fridge',                 maxTeammates: 8, unlock_items:"Mini fridge" },
  { id: 10, invitesRequired: 27,  label: 'Trophy',                      maxTeammates: 8, unlock_items:"Trophy" },
  { id: 11, invitesRequired: 34,  label: 'Couch / lounge area',         maxTeammates: 9, unlock_items:"Couch / lounge area" },
  { id: 12, invitesRequired: 42,  label: 'Upgraded desk (dark wood)',   maxTeammates: 9, unlock_items:"Upgraded desk (dark wood)" },
  { id: 13, invitesRequired: 51,  label: 'Neon sign',                   maxTeammates: 10, unlock_items:"Neon sign" },
  { id: 14, invitesRequired: 61,  label: 'Arcade machine',              maxTeammates: 10, unlock_items:"Arcade machine" },
  { id: 15, invitesRequired: 72,  label: 'Floor-to-ceiling windows',    maxTeammates: 11, unlock_items:"Floor-to-ceiling windows", product_reward:"2 mo free" },
  { id: 16, invitesRequired: 84,  label: 'Living wall',                 maxTeammates: 11, unlock_items:"Living wall" },
  { id: 17, invitesRequired: 90,  label: 'Espresso machine',            maxTeammates: 12, unlock_items:"Espresso machine" },
  { id: 18, invitesRequired: 96,  label: 'Ping pong table',             maxTeammates: 12, unlock_items:"Ping pong table" },
  { id: 19, invitesRequired: 102, label: 'Rooftop terrace',             maxTeammates: 13, unlock_items:"Rooftop terrace" },
  { id: 20, invitesRequired: 108, label: 'Full penthouse',              maxTeammates: 14, unlock_items:"🏆 Full penthouse", product_reward:"3-mo free + featured" },
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
  { key: 'floor_lamp',            label: 'Floor lamp',                  unlockFloor: 2,  quantity: 1 },
  {
    key: 'basic_chair_desk',
    label: 'Basic chair + first desk',
    unlockFloor: 3,
    // Default for F5..F20.
    quantity: 3,
    // Per-floor overrides — F3 starts the user with a single desk, F4
    // jumps to four for a "team expansion" beat, F5+ settles at three.
    quantityByFloor: { 3: 1, 4: 2 },
  },
  { key: 'potted_plant',          label: 'Potted plant',                unlockFloor: 4,  quantity: 1 },
  { key: 'coffee_mug',            label: 'Coffee mug on desk',          unlockFloor: 5,  quantity: 1 },
  { key: 'bookshelf',             label: 'Bookshelf',                   unlockFloor: 6,  quantity: 1 },
  { key: 'printer',               label: 'Printer',                     unlockFloor: 7,  quantity: 1 },
  { key: 'whiteboard',            label: 'Whiteboard',                  unlockFloor: 8,  quantity: 1 },
  { key: 'mini_fridge',           label: 'Mini fridge',                 unlockFloor: 9,  quantity: 1 },
  { key: 'trophy',                label: 'Trophy',                      unlockFloor: 10, quantity: 1 },
  { key: 'couch',                 label: 'Couch / lounge area',         unlockFloor: 11, quantity: 1 },
  { key: 'upgraded_desk',         label: 'Upgraded desk (dark wood)',   unlockFloor: 12, quantity: 1 },
  { key: 'neon_sign',             label: 'Neon sign',                   unlockFloor: 13, quantity: 1 },
  { key: 'arcade_machine',        label: 'Arcade machine',              unlockFloor: 14, quantity: 1 },
  { key: 'floor_ceiling_windows', label: 'Floor-to-ceiling windows',    unlockFloor: 15, quantity: 1 },
  { key: 'living_wall',           label: 'Living wall',                 unlockFloor: 16, quantity: 1 },
  { key: 'espresso_machine',      label: 'Espresso machine',            unlockFloor: 17, quantity: 1 },
  { key: 'ping_pong_table',       label: 'Ping pong table',             unlockFloor: 18, quantity: 1 },
  { key: 'rooftop_terrace',       label: 'Rooftop terrace',             unlockFloor: 19, quantity: 1 },
  { key: 'penthouse',             label: 'Full penthouse',              unlockFloor: 20, quantity: 1 },
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
        label: f.label,
        maxTeammates: f.maxTeammates,
        product_reward: f.product_reward,
        unlock_items: f.unlock_items,
      },
      update: {
        invitesRequired: f.invitesRequired,
        label: f.label,
        maxTeammates: f.maxTeammates,
        product_reward: f.product_reward,
        unlock_items: f.unlock_items,
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
