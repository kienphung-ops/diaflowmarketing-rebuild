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
  /** Admin-supplied list of "what's unlocked at this floor". Each
   *  entry is a single human-readable badge (e.g. "🖼 Company name
   *  picture frame", "Office desk"). Most floors carry 1–2 entries;
   *  multi-unlock floors (F1, F2, F3, F6, F7, F17, F18, F20) carry
   *  several. Empty array = nothing special to announce. */
  unlockItems: string[]
  /** Items configured for this floor (with quantities). */
  items: FloorItemConfig[]
}
