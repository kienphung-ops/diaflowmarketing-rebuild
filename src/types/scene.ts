export type CharacterSlug = 'mia' | 'iris' | 'leo' | `recruited-${number}`

export interface CharacterConfig {
  slug: CharacterSlug
  name: string
  role: string
  position: [number, number, number]
  deskPosition: [number, number, number]
  hairColor: string
  skinColor: string
  clothesColor: string
  glowColor: string
  idleAnimation: 'typing' | 'headturn' | 'wave'
  glbPath?: string
  hasDeskAndChair?: boolean  // false = character has no desk in scene
  rotationY?: number         // defaults to Math.PI (faces desk); 0 = faces camera
  hasTie?: boolean
  tieColor?: string
}
