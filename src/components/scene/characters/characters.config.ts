import type { CharacterConfig } from '@/types/scene'

export const EMPTY_DESK_POSITION: [number, number, number] = [-3.5, 0, -0.8]

export const CHARACTERS: CharacterConfig[] = [
  {
    slug: 'mia',
    name: 'Mia',
    role: 'Assistant',
    position: [0, -0.05, 0.3],
    deskPosition: [0, 0, -0.8],
    hairColor: '#8B4513',
    skinColor: '#FDBCB4',
    clothesColor: '#4A90D9',
    glowColor: '#a855f7',
    idleAnimation: 'typing',
  },
  {
    slug: 'iris',
    name: 'Iris',
    role: 'AI Recruiter',
    position: [-1.5, -0.05, 1.8],
    deskPosition: [1.5, 0, 1.2], // dummy, not rendered
    hairColor: '#1C1C1C',
    skinColor: '#8D5524',
    clothesColor: '#1a2744',
    glowColor: '#06b6d4',
    idleAnimation: 'headturn',
    hasDeskAndChair: false,
    rotationY: 0,
    hasTie: true,
    tieColor: '#dc2626',
  },
  {
    slug: 'leo',
    name: 'Leo',
    role: 'Demo Specialist',
    position: [3.5, -0.05, 0.3],
    deskPosition: [3.5, 0, -0.8],
    hairColor: '#2C2C54',
    skinColor: '#F1C27D',
    clothesColor: '#6C5CE7',
    glowColor: '#f59e0b',
    idleAnimation: 'wave',
  },
]
