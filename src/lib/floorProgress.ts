/**
 * Server-side floor progression helpers.
 *
 * Floor advancement is driven by TWO kinds of action now:
 *   - invites (referral signups)  → bumps totalInvites
 *   - shares  (any share button)  → records a TaskCompletion
 *
 * Both the invite flows (signup / oauth / password / email-verify) and
 * the share flow (completeSpinTask) funnel through
 * `recomputeAndPersistFloor` so the user's currentFloor stays in sync
 * with whatever floor their progress now unlocks — see
 * `computeFloorForProgress` in lib/floors for the gate rules.
 */

import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getAllFloorsConfig, getFloorConfigById } from '@/lib/floorsApi'
import { computeFloorFromGates, computeFloorForProgress } from '@/lib/floors'

/** TaskCompletion keys that count as "the user has shared" toward a
 *  share-gated floor. Includes the spin-task share keys (share_x /
 *  share_linkedin) PLUS share_copy — copying the invite link counts as
 *  a share for floor-unlock purposes (but, unlike X/LinkedIn, grants no
 *  spin token; see creditShareUnlock). */
const SHARE_TASK_KEYS = ['share_x', 'share_linkedin', 'share_copy']

/** Source of a share action, mapped 1:1 to its TaskCompletion key. */
export type ShareSource = 'x' | 'linkedin' | 'copy'

/** Accepts either the top-level prisma client or a transaction client —
 *  PrismaClient is structurally assignable to TransactionClient for the
 *  delegate calls used here (count / findUnique / update). */
type DbClient = Prisma.TransactionClient

/** True once the user has completed at least one share task. */
export async function userHasShared(db: DbClient, userId: string): Promise<boolean> {
  const count = await db.taskCompletion.count({
    where: { userId, taskKey: { in: SHARE_TASK_KEYS } },
  })
  return count > 0
}

/**
 * Recompute a user's currentFloor from their live progress (totalInvites
 * + share status) and persist it. The stored floor only ever moves UP —
 * it never demotes a user whose floor was already higher (legacy data,
 * or a floor reached before its unlock rule changed).
 *
 * Call AFTER any totalInvites or share mutation, ideally inside the same
 * transaction so the floor can't drift out of step with the action that
 * caused it. Returns the resulting floor.
 */
export async function recomputeAndPersistFloor(
  db: DbClient,
  userId: string,
): Promise<number> {
  const [user, hasShared] = await Promise.all([
    db.user.findUnique({
      where: { id: userId },
      select: { totalInvites: true, currentFloor: true },
    }),
    userHasShared(db, userId),
  ])
  if (!user) return 1

  // Compute from the DB-backed floor catalogue (invitesRequired +
  // unlockType) so thresholds match exactly what the UI shows and respect
  // seed edits. Fall back to the static FLOOR_CONFIG if the catalogue read
  // fails for any reason — better a slightly stale gate than a thrown
  // invite/share transaction.
  let computed: number
  try {
    const floors = await getAllFloorsConfig()
    computed = computeFloorFromGates(
      floors.map(f => ({
        floor: f.id,
        invitesRequired: f.invitesRequired,
        unlockType: f.unlockType,
      })),
      { totalInvites: user.totalInvites, hasShared },
    )
  } catch (err) {
    console.warn('[floorProgress] catalogue read failed, using static gates:', err)
    computed = computeFloorForProgress({ totalInvites: user.totalInvites, hasShared })
  }
  const newFloor = Math.max(user.currentFloor, computed)

  if (newFloor !== user.currentFloor) {
    await db.user.update({
      where: { id: userId },
      data: { currentFloor: newFloor },
    })
  }
  return newFloor
}

/**
 * Whether climbing from `currentFloor` to the next floor is gated behind
 * a SHARE (vs invites). Reads the next floor's unlockType from the
 * DB-backed, cached floor catalogue — so the rule is data-driven, not
 * hard-coded to a specific floor number.
 */
export async function nextFloorRequiresShare(currentFloor: number): Promise<boolean> {
  const next = await getFloorConfigById(currentFloor + 1)
  return next?.unlockType === 'share'
}

export interface ShareUnlockResult {
  /** true when a share task was saved AND the floor was (re)computed. */
  credited: boolean
  /** The user's floor after the call (unchanged when not credited). */
  currentFloor: number
}

/**
 * Credit a share action (X / LinkedIn / Copy) toward a SHARE-gated floor.
 *
 * Guard (per product rule): only saves the TaskCompletion and advances
 * the user when the NEXT floor actually requires a share — otherwise it's
 * a no-op so we don't litter share_copy rows or touch the floor when the
 * next floor is invite-gated.
 *
 * Unlike the spin-task share path (completeSpinTask), this grants NO spin
 * token — it's purely a floor-unlock signal, which is why the Copy button
 * routes here instead of through /api/spin/task.
 */
export async function creditShareUnlock(
  userId: string,
  source: ShareSource,
): Promise<ShareUnlockResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { currentFloor: true },
  })
  if (!user) return { credited: false, currentFloor: 1 }

  // Only proceed when the next floor is share-gated.
  if (!(await nextFloorRequiresShare(user.currentFloor))) {
    return { credited: false, currentFloor: user.currentFloor }
  }

  const taskKey = `share_${source}`
  const newFloor = await prisma.$transaction(async tx => {
    try {
      await tx.taskCompletion.create({ data: { userId, taskKey } })
    } catch (err) {
      // Already recorded (unique userId+taskKey) — idempotent, keep going
      // so a repeat click still reconciles the floor.
      if (
        !(err instanceof Prisma.PrismaClientKnownRequestError) ||
        err.code !== 'P2002'
      ) {
        throw err
      }
    }
    return recomputeAndPersistFloor(tx, userId)
  })

  return { credited: true, currentFloor: newFloor }
}
