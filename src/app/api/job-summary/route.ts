/**
 * POST /api/job-summary
 *
 * Body: { job: string }
 *
 * Calls the Diaflow process API to derive a recommended role + reason
 * from a free-text job title. Public endpoint (no auth required) so
 * the anonymous Mia onboarding flow can use it; when the caller is
 * authenticated the result is also persisted onto User.recommendedRole
 * + User.reason so subsequent page loads can render the personalised
 * MiaInfoBubble copy without re-calling the upstream.
 *
 * Response:
 *   { success: true,  recommendedRole, reason } — Diaflow returned a
 *                                                  valid recommendation
 *   { success: false }                          — upstream failed /
 *                                                  malformed / timeout
 *                                                  (caller renders the
 *                                                  default Mia copy)
 */

import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { readSession } from '@/lib/auth'
import { fetchJobSummary } from '@/lib/diaflowJobApi'

export const runtime = 'nodejs'
// Polls upstream for up to ~25 s, so this can hold a connection open
// for a while. Mark dynamic so Next.js never tries to cache it.
export const dynamic = 'force-dynamic'
export const maxDuration = 30

const MAX_JOB_LEN = 200

export async function POST(req: NextRequest) {
  let job = ''
  try {
    const body = await req.json().catch(() => ({}))
    if (typeof body.job === 'string') job = body.job.trim()
  } catch {
    /* fall through to validation below */
  }
  if (!job) {
    return NextResponse.json(
      { success: false, error: 'job required' },
      { status: 400 },
    )
  }
  if (job.length > MAX_JOB_LEN) {
    job = job.slice(0, MAX_JOB_LEN)
  }

  const result = await fetchJobSummary(job)

  // Persist when the caller is signed in AND we got a real result.
  // Anonymous trial users get the values back in the response and
  // stash them in localStorage; we persist server-side on signup.
  if (result.success && result.recommendedRole && result.reason) {
    const session = await readSession()
    if (session) {
      try {
        // Two writes in parallel:
        //   1. User row — recommendedRole + reason + teamPurpose
        //   2. RecruitedTeammate (slug='mia') — keep Mia's role label
        //      in sync with the recommendation so MySquadDrawer /
        //      poke leaderboard / any teammate-list UI shows the
        //      personalised role instead of the seeded default
        //      ("Assistant").
        // `updateMany` is forgiving when the Mia row doesn't exist
        // yet (legacy accounts that pre-date the seeding): zero rows
        // updated, no error.
        await Promise.all([
          prisma.user.update({
            where: { id: session.userId },
            data: {
              recommendedRole: result.recommendedRole,
              reason: result.reason,
              // Make sure `teamPurpose` reflects the job text we used
              // — covers backfill cases where the column was empty.
              teamPurpose: job,
            },
          }),
          prisma.recruitedTeammate.updateMany({
            where: { userId: session.userId, slug: 'mia' },
            data: { role: result.recommendedRole },
          }),
        ])
      } catch (err) {
        // DB write failure shouldn't fail the response; the client
        // can still display the personalised copy from the result.
        console.warn('[api/job-summary] persist failed:', err)
      }
    }
  }

  return NextResponse.json(result)
}
