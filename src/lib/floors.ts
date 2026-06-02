/** How a floor is unlocked. "invite" = needs `invitesRequired` referrals
 *  (default). "share" = needs the user to have shared at least once. */
export type UnlockType = 'invite' | 'share'

export interface FloorConfig {
  floor: number
  invitesRequired: number
  /** Defaults to 'invite' when omitted. */
  unlockType?: UnlockType
  unlockKey: string
  label: string
}

// Per planning.md section 3.1 — invite thresholds + decor unlocked + max
// teammates allowed (in FLOOR_MAX_TEAMMATES below).
export const FLOOR_CONFIG: FloorConfig[] = [
  { floor: 1, invitesRequired: 0, unlockKey: 'company_picture_frame', label: 'Company name picture frame' },
  { floor: 2, invitesRequired: 1, unlockType: 'share', unlockKey: 'floor_lamp', label: 'Floor lamp' },
  { floor: 3, invitesRequired: 2, unlockKey: 'basic_chair_desk', label: 'Basic chair + first desk' },
  { floor: 4, invitesRequired: 6, unlockKey: 'potted_plant', label: 'Potted plant' },
  { floor: 5, invitesRequired: 9, unlockKey: 'coffee_mug', label: 'Coffee mug on desk' },
  { floor: 6, invitesRequired: 12, unlockKey: 'bookshelf', label: 'Bookshelf' },
  { floor: 7, invitesRequired: 16, unlockKey: 'printer', label: 'Printer' },
  { floor: 8, invitesRequired: 21, unlockKey: 'whiteboard', label: 'Whiteboard' },
  { floor: 9, invitesRequired: 27, unlockKey: 'mini_fridge', label: 'Mini fridge' },
  { floor: 10, invitesRequired: 34, unlockKey: 'trophy', label: 'Trophy' },
  { floor: 11, invitesRequired: 42, unlockKey: 'couch', label: 'Couch / lounge area' },
  { floor: 12, invitesRequired: 51, unlockKey: 'upgraded_desk', label: 'Upgraded desk (dark wood)' },
  { floor: 13, invitesRequired: 61, unlockKey: 'neon_sign', label: 'Neon sign' },
  { floor: 14, invitesRequired: 72, unlockKey: 'arcade_machine', label: 'Arcade machine' },
  { floor: 15, invitesRequired: 84, unlockKey: 'floor_ceiling_windows', label: 'Floor-to-ceiling windows' },
  { floor: 16, invitesRequired: 90, unlockKey: 'living_wall', label: 'Living wall' },
  { floor: 17, invitesRequired: 96, unlockKey: 'espresso_machine', label: 'Espresso machine' },
  { floor: 18, invitesRequired: 102, unlockKey: 'ping_pong_table', label: 'Ping pong table' },
  { floor: 19, invitesRequired: 108, unlockKey: 'rooftop_terrace', label: 'Rooftop terrace' },
  { floor: 20, invitesRequired: 115, unlockKey: 'penthouse', label: 'Full penthouse' },
]

/**
 * Invite-only floor gate. Ignores `unlockType` and looks purely at invite
 * thresholds. Used by the anonymous trial preview (lib/trial.ts), which
 * has no notion of "has the user shared" — it just simulates invites to
 * show the climb. Production progression uses `computeFloorForProgress`.
 */
export function computeFloorForInvites(totalInvites: number): number {
  let result = 1
  for (const cfg of FLOOR_CONFIG) {
    if (totalInvites >= cfg.invitesRequired) result = cfg.floor
    else break
  }
  return result
}

export interface UnlockProgress {
  totalInvites: number
  hasShared: boolean
}

export interface FloorGate {
  floor: number
  invitesRequired: number
  unlockType?: UnlockType
}

/**
 * Requirement-aware floor gate (production). Computes the highest floor a
 * user has unlocked from a list of gates (floor + invitesRequired +
 * unlockType). Rules:
 *
 *   - 'invite' (default): reached when totalInvites >= invitesRequired.
 *     Invite floors form a contiguous chain (thresholds increase), so we
 *     stop at the first invite floor the user can't afford.
 *   - 'share': reached ONLY by sharing. A share-gated floor does NOT
 *     block higher invite floors — if the user's invites already qualify
 *     them for a higher floor, the chain carries them past the share gate.
 *
 * Example (F2 = share, F3 needs 1 invite):
 *   - shared, 0 invites      → F2
 *   - not shared, 1 invite   → F3  (invites skip the share gate)
 *   - not shared, 0 invites  → F1
 *
 * Pass DB-backed gates (see recomputeAndPersistFloor) so thresholds match
 * what the UI shows; FLOOR_CONFIG is the static fallback.
 */
export function computeFloorFromGates(
  gates: FloorGate[],
  { totalInvites, hasShared }: UnlockProgress,
): number {
  let result = 1
  for (const g of [...gates].sort((a, b) => a.floor - b.floor)) {
    if (g.floor === 1) continue
    if (g.unlockType === 'share') {
      // Share gate: reached if shared, but never blocks the invite chain.
      if (hasShared) result = Math.max(result, g.floor)
      continue
    }
    if (totalInvites >= g.invitesRequired) {
      result = Math.max(result, g.floor)
    } else {
      break
    }
  }
  return result
}

/** Static-config convenience wrapper over `computeFloorFromGates`. */
export function computeFloorForProgress(progress: UnlockProgress): number {
  return computeFloorFromGates(
    FLOOR_CONFIG.map(c => ({
      floor: c.floor,
      invitesRequired: c.invitesRequired,
      unlockType: c.unlockType,
    })),
    progress,
  )
}

export function getFloorConfig(floor: number): FloorConfig | undefined {
  return FLOOR_CONFIG.find(c => c.floor === floor)
}

/**
 * Static fallback for "items visible on floor N". Returns the cumulative
 * set (every floor 1..N's unlock key) because the static `FLOOR_CONFIG`
 * snapshot only stores ONE item per floor — so the cumulative roll-up
 * is the equivalent of the cumulative-inclusive DB seed used in
 * production (see prisma/seed.mjs).
 *
 * The live DB-backed code path (lib/floorsApi → useFloorItems) is
 * per-floor non-cumulative since the floor_items table already lists
 * everything visible at each floor explicitly.
 */
export function getUnlockedItemKeysForFloor(floor: number): { itemKey: string; floor: number }[] {
  return FLOOR_CONFIG.filter(c => c.floor <= floor).map(c => ({ itemKey: c.unlockKey, floor: c.floor }))
}

/** Max teammates per floor — INCLUDES 3 default NPCs (Iris/Mia/Leo). */
export const DEFAULT_NPC_COUNT = 3

export const FLOOR_MAX_TEAMMATES: Record<number, number> = {
  1: 4, 2: 4, 3: 5, 4: 6, 5: 6,
  6: 7, 7: 7, 8: 8, 9: 8, 10: 9,
  11: 9, 12: 10, 13: 10, 14: 11, 15: 11,
  16: 12, 17: 12, 18: 13, 19: 13, 20: 14,
}

export function getMaxTeammates(floor: number): number {
  return FLOOR_MAX_TEAMMATES[floor] ?? 4
}

export function getRecruitSlotsAvailable(floor: number, recruitedCount: number): number {
  const max = getMaxTeammates(floor)
  return Math.max(0, max - DEFAULT_NPC_COUNT - recruitedCount)
}

/**
 * Total teammate count for the "X / Y teammates" badge.
 *
 * Handles both flows uniformly:
 *  - Signed-in users: the `teammates` array already contains the 3
 *    default NPCs as DB rows (isDefault=true) plus N user-recruited.
 *    Just return its length.
 *  - Anonymous trial users: `teammates` is empty (trial recruits aren't
 *    persisted), but the 3 NPCs are still visually rendered, so we
 *    add `DEFAULT_NPC_COUNT` on top of the array length.
 *
 * Detection: if any row has `isDefault: true`, the array already
 * includes the NPCs; otherwise it doesn't.
 */
export function computeTeammateCount(teammates: { isDefault?: boolean }[]): number {
  const includesDefaults = teammates.some(t => t.isDefault)
  if (includesDefaults) return teammates.length
  return DEFAULT_NPC_COUNT + teammates.length
}

/**
 * Returns just the user-recruited teammates (excludes the 3 default
 * NPCs). Used by OfficeScene to avoid double-rendering Iris/Mia/Leo
 * and by slot-math to compute "how many more can you add".
 */
export function filterCustomTeammates<T extends { isDefault?: boolean }>(
  teammates: T[]
): T[] {
  return teammates.filter(t => !t.isDefault)
}
