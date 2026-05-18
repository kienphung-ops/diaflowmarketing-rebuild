export interface TowerState {
  currentFloor: number
  unlockedItemKeys: string[]
  referralCode: string | null
  totalInvites: number
}

export interface TowerLandingProps extends TowerState {
  signedIn: boolean
}
