/**
 * Throwaway test-data generator for the /wall page UI.
 *
 * NOT a seed — this is a standalone dev helper. It inserts a batch of
 * fake users (with recruited teammates + pokes) plus a sample
 * "Who's building" breakdown so every section of /wall has something to
 * render against a real DB. Idempotent: re-running first deletes the
 * previous batch (all rows tagged by the walltest e-mail prefix), so it
 * never piles up duplicates.
 *
 *   node scripts/wall-test-data.mjs            # insert ~60 users
 *   node scripts/wall-test-data.mjs 120        # insert 120
 *   node scripts/wall-test-data.mjs --clean    # delete the batch only
 *
 * Cleanup (also runnable straight in SQL):
 *   DELETE FROM users WHERE email LIKE 'walltest+%@diaflow.test';
 *   (recruited_teammates cascade-delete with their user)
 */

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

const EMAIL_PREFIX = 'walltest+' // marker used for find/cleanup
const EMAIL_DOMAIN = '@diaflow.test'

const TEAM_NAMES = [
  'Midnight Dev', 'Solo Rocket', 'Northbeam', 'Quiet Hours', 'Loop & Co', 'Bright Pixel',
  'Studio Nova', 'The Lab', 'Honest Work', 'Drift HQ', 'Fox & Field', 'Tiny Empire',
  'Late Night Labs', 'Orbit Nine', 'Maker House', 'Slate', 'Wildcard', 'Ember Studio',
  'Good Signal', 'Paper Plane', 'Anchor & Co', 'Velvet Ops', 'The Workshop', 'Glasswing',
  'Kindling', 'Brisk', 'Tidewater', 'Sunday Build', 'North Star Co', 'Clever Fox',
  'Saltbox', 'Hatch', 'Lumen', 'Field Notes', 'Cobalt', 'The Forge', 'Driftwood',
  'Open Door', 'Hummingbird', 'Tinker Co', 'Marigold', 'Bricklane', 'Even Keel',
  'Pocket HQ', 'Foundry', 'Wander', 'Copper & Co', 'Stillwater', 'Bluebird Labs', 'The Co-op',
]
const ROLES = [
  'Founder / CEO', 'Marketing Manager', 'Software Engineer', 'Operations Lead',
  'Product Manager', 'Sales / BD', 'Recruiter', 'Designer', 'Agency Owner',
  'Consultant', 'Indie Hacker', 'Customer Success',
]
const TEAMMATE_ROLES = [
  'Operations Assistant', 'AI Bio Writer', 'Voice Specialist', 'Demo Specialist',
  'Customer Success Lead', 'Content Producer', 'Growth Hacker', 'Product Designer',
  'Engineering Buddy', 'Researcher', 'Marketing Strategist',
]
const TEAMMATE_NAMES = [
  'Alex', 'Sam', 'Jordan', 'Riley', 'Casey', 'Morgan', 'Taylor', 'Jamie', 'Quinn',
  'Avery', 'Parker', 'Rowan', 'Sky', 'Drew', 'Reese', 'Sage', 'Devon', 'Blair',
]
const COUNTRIES = ['US', 'VN', 'GB', 'IN', 'DE', 'SG', 'BR', 'CA', 'AU', 'FR']

// Sample "Who's building" ratio (matches the mockup), stored in app_config
// under the same key + shape the /api/wall/roles route reads.
const ROLE_BREAKDOWN = [
  { name: 'Founder / CEO', pct: 31 },
  { name: 'Marketing Manager', pct: 19 },
  { name: 'Software Engineer', pct: 14 },
  { name: 'Operations Lead', pct: 10 },
  { name: 'Product Manager', pct: 8 },
  { name: 'Sales / BD', pct: 6 },
  { name: 'Recruiter', pct: 4 },
  { name: 'Designer', pct: 4 },
  { name: 'Other', pct: 5 },
]

const pick = arr => arr[Math.floor(Math.random() * arr.length)]
const randInt = (lo, hi) => lo + Math.floor(Math.random() * (hi - lo + 1))
const usedCodes = new Set()
function uniqueCode() {
  let c
  do {
    c = 'WT' + Math.random().toString(36).slice(2, 8).toUpperCase()
  } while (usedCodes.has(c))
  usedCodes.add(c)
  return c
}

async function clean() {
  const res = await prisma.user.deleteMany({
    where: { email: { startsWith: EMAIL_PREFIX } },
  })
  // Teammates cascade-delete with their user (schema onDelete: Cascade).
  console.log(`Removed ${res.count} previous walltest user(s).`)
}

async function main() {
  const args = process.argv.slice(2)
  if (args.includes('--clean')) {
    await clean()
    return
  }
  const count = Number(args.find(a => /^\d+$/.test(a))) || 60

  // Floor rows must exist — User.currentFloor is a FK to Floor.id.
  const floors = await prisma.floor.findMany({
    select: { id: true, invitesRequired: true },
    orderBy: { invitesRequired: 'asc' },
  })
  if (floors.length === 0) {
    throw new Error('No Floor rows found. Run `npx prisma db seed` first.')
  }
  const levelFor = invites => {
    let lvl = floors[0].id
    for (const f of floors) if (invites >= f.invitesRequired) lvl = f.id
    return lvl
  }
  // Top floor's invite threshold — invite counts are scaled to this so
  // the generated levels spread realistically across the whole tower
  // (1 → max) instead of everyone saturating at the top level.
  const maxReq = floors[floors.length - 1].invitesRequired || 60

  // Fresh batch each run.
  await clean()

  const now = Date.now()
  const DAY = 24 * 60 * 60 * 1000

  let teammatesCreated = 0
  for (let i = 0; i < count; i++) {
    // Descending invite curve scaled to the real top-floor threshold +
    // jitter — top user sits just above max (top level), decaying down so
    // levels span the whole tower and the Top 50 has a believable spread.
    const invites = Math.max(0, Math.round(maxReq * 1.05 * Math.pow(0.93, i) + randInt(-2, 2)))
    const currentFloor = levelFor(invites)
    // ~1/3 of users signed up within the last 7 days (drives the
    // "joined this week" stat); the rest spread over ~90 days.
    const ageDays = i % 3 === 0 ? randInt(0, 6) : randInt(7, 90)
    const createdAt = new Date(now - ageDays * DAY)

    const user = await prisma.user.create({
      data: {
        email: `${EMAIL_PREFIX}${i}${EMAIL_DOMAIN}`,
        referralCode: uniqueCode(),
        teamName: pick(TEAM_NAMES),
        teamPurpose: pick(ROLES),
        country: pick(COUNTRIES),
        totalInvites: invites,
        currentFloor,
        publicVisible: true,
        emailVerified: createdAt,
        createdAt,
      },
      select: { id: true },
    })

    // 2–6 recruited teammates each, with random pokes. A handful of
    // users get a big poke spike so "Most poked" has clear leaders.
    const nMates = randInt(2, 6)
    const pokeBoost = Math.random() < 0.15 ? randInt(150, 400) : 0
    const mates = Array.from({ length: nMates }, () => ({
      userId: user.id,
      name: pick(TEAMMATE_NAMES),
      role: pick(TEAMMATE_ROLES),
      pokes: randInt(0, 90) + pokeBoost,
    }))
    await prisma.recruitedTeammate.createMany({ data: mates })
    teammatesCreated += mates.length
  }

  // "Who's building" breakdown — same key + shape /api/wall/roles reads.
  await prisma.appConfig.upsert({
    where: { key: 'wall_role_breakdown' },
    create: {
      key: 'wall_role_breakdown',
      value: { roles: ROLE_BREAKDOWN, updatedAt: new Date(now).toISOString() },
    },
    update: {
      value: { roles: ROLE_BREAKDOWN, updatedAt: new Date(now).toISOString() },
    },
  })

  console.log(`Inserted ${count} walltest users + ${teammatesCreated} teammates.`)
  console.log('Set app_config["wall_role_breakdown"].')
  console.log('NOTE: /api/wall/* is Redis-cached ~120s — wait up to 2 min (or flush Redis) to see fresh numbers.')
  console.log("Cleanup: node scripts/wall-test-data.mjs --clean")
}

main()
  .catch(e => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
