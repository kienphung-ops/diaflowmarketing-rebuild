export interface FloorConfig {
  floor: number
  invitesRequired: number
  unlockKey: string
  label: string
}

// Per planning.md section 3.1 — invite thresholds + decor unlocked + max
// teammates allowed (in FLOOR_MAX_TEAMMATES below).
export const FLOOR_CONFIG: FloorConfig[] = [
  { floor: 1, invitesRequired: 0, unlockKey: 'company_picture_frame', label: 'Company name picture frame' },
  { floor: 2, invitesRequired: 1, unlockKey: 'floor_lamp', label: 'Floor lamp' },
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

export function computeFloorForInvites(totalInvites: number): number {
  let result = 1
  for (const cfg of FLOOR_CONFIG) {
    if (totalInvites >= cfg.invitesRequired) result = cfg.floor
    else break
  }
  return result
}

export function getFloorConfig(floor: number): FloorConfig | undefined {
  return FLOOR_CONFIG.find(c => c.floor === floor)
}

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
