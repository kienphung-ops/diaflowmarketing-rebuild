/**
 * Default-teammate seeding helpers.
 *
 * The 3 NPCs (Iris / Mia / Leo) live in DB as RecruitedTeammate rows
 * flagged `isDefault: true` so their poke counters and any other
 * per-user state survive across sessions. This module centralises the
 * seed list + the upsert flow that runs on signup.
 */

import { prisma } from '@/lib/prisma'

export const DEFAULT_TEAMMATE_SLUGS = ['iris', 'mia', 'leo'] as const
export type DefaultTeammateSlug = (typeof DEFAULT_TEAMMATE_SLUGS)[number]

export const DEFAULT_TEAMMATES: Array<{
  slug: DefaultTeammateSlug
  name: string
  role: string
}> = [
  { slug: 'iris', name: 'Iris', role: 'AI Recruiter' },
  { slug: 'mia', name: 'Mia', role: 'Assistant' },
  { slug: 'leo', name: 'Leo', role: 'Demo Specialist' },
]

/**
 * Upsert the 3 default teammates for a user. Safe to call multiple
 * times — relies on the (userId, slug) unique constraint via
 * `prisma.upsert`. Returns nothing; failures throw.
 */
export async function seedDefaultTeammates(userId: string): Promise<void> {
  await Promise.all(
    DEFAULT_TEAMMATES.map(d =>
      prisma.recruitedTeammate.upsert({
        where: { userId_slug: { userId, slug: d.slug } },
        create: { userId, slug: d.slug, name: d.name, role: d.role, isDefault: true },
        update: {}, // never overwrite — defaults are immutable
      })
    )
  )
}
