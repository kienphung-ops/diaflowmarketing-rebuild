/**
 * Shared types for floor + item config — kept in a separate file so
 * both server (lib/floorsApi.ts) and client (lib/floorsConfigClient.ts)
 * can import the same shape without dragging Prisma into client
 * bundles.
 */

export interface FloorItemConfig {
  key: string
  label: string
  /** How many instances of this item to render on the floor. */
  quantity: number
}

export interface FloorConfigEntry {
  id: number
  invitesRequired: number
  label: string
  /** INCLUSIVE of the 3 default NPCs (Iris/Mia/Leo). */
  maxTeammates: number
  /** Optional product reward shown in the floor-detail panel. */
  productReward: string | null
  /** Free-form admin-supplied note about what's unlocked. */
  unlockItems: string | null
  /** Items configured for this floor (with quantities). */
  items: FloorItemConfig[]
}
