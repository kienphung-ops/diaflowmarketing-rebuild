export interface FloorConfig {
  floor: number
  invitesRequired: number
  unlockKey: string
  label: string
}

export const FLOOR_CONFIG: FloorConfig[] = [
  { floor: 1, invitesRequired: 0, unlockKey: 'company_picture_frame', label: 'Company name picture frame' },
  { floor: 2, invitesRequired: 1, unlockKey: 'floor_lamp', label: 'Floor lamp' },
  { floor: 3, invitesRequired: 2, unlockKey: 'basic_chair_desk', label: 'Basic chair + first desk' },
  { floor: 4, invitesRequired: 4, unlockKey: 'potted_plant', label: 'Potted plant' },
  { floor: 5, invitesRequired: 6, unlockKey: 'coffee_mug', label: 'Coffee mug on desk' },
  { floor: 6, invitesRequired: 9, unlockKey: 'bookshelf', label: 'Bookshelf' },
  { floor: 7, invitesRequired: 12, unlockKey: 'printer', label: 'Printer' },
  { floor: 8, invitesRequired: 16, unlockKey: 'whiteboard', label: 'Whiteboard' },
  { floor: 9, invitesRequired: 21, unlockKey: 'mini_fridge', label: 'Mini fridge' },
  { floor: 10, invitesRequired: 27, unlockKey: 'trophy', label: 'Trophy' },
  { floor: 11, invitesRequired: 34, unlockKey: 'couch', label: 'Couch' },
  { floor: 12, invitesRequired: 42, unlockKey: 'upgraded_desk', label: 'Upgraded desk' },
  { floor: 13, invitesRequired: 51, unlockKey: 'neon_sign', label: 'Neon sign' },
  { floor: 14, invitesRequired: 61, unlockKey: 'arcade_machine', label: 'Arcade machine' },
  { floor: 15, invitesRequired: 72, unlockKey: 'living_wall', label: 'Living wall' },
  { floor: 16, invitesRequired: 84, unlockKey: 'espresso_machine', label: 'Espresso machine' },
  { floor: 17, invitesRequired: 92, unlockKey: 'ping_pong_table', label: 'Ping pong table' },
  { floor: 18, invitesRequired: 100, unlockKey: 'rooftop_terrace', label: 'Rooftop terrace' },
  { floor: 19, invitesRequired: 108, unlockKey: 'sky_lounge', label: 'Sky lounge' },
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
