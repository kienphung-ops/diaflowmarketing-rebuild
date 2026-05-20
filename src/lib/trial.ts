/**
 * Trial state — anonymous "play before sign up" mode.
 *
 * Stores onboarding progress + simulated invites in localStorage. Discarded
 * on sign-up (the new account starts fresh at Floor 1 with 0 invites; trial
 * is an educational preview, not a way to pre-load progress).
 */

import { computeFloorForInvites, getUnlockedItemKeysForFloor } from './floors'

export type OnboardingStep = 'iris' | 'mia' | 'leo' | 'done'

export interface TrialState {
  /** Onboarding state machine — Iris → Mia → Leo → done. */
  onboardingStep: OnboardingStep
  teamName: string | null
  /** Free-form description from Mia step (what the team builds). */
  teamPurpose: string | null
  email: string | null
  /** Gamification — simulated invites + derived floor. */
  totalInvites: number
  currentFloor: number
  unlockedItemKeys: string[]
}

const STORAGE_KEY = 'diaflow_trial_state'

export function defaultTrialState(): TrialState {
  return {
    onboardingStep: 'iris',
    teamName: null,
    teamPurpose: null,
    email: null,
    totalInvites: 0,
    currentFloor: 1,
    unlockedItemKeys: ['company_picture_frame'],
  }
}

export function readTrialState(): TrialState | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<TrialState>
    if (typeof parsed.totalInvites !== 'number') return null
    // Always re-derive currentFloor + unlockedItemKeys from totalInvites
    // so the saved blob can never go stale relative to FLOOR_CONFIG (e.g.
    // when invite thresholds change between deploys, or when an older
    // saved state was capped at a lower floor by a bug).
    const totalInvites = parsed.totalInvites
    const currentFloor = computeFloorForInvites(totalInvites)
    const unlockedItemKeys = getUnlockedItemKeysForFloor(currentFloor).map(u => u.itemKey)
    return {
      onboardingStep: (parsed.onboardingStep as OnboardingStep) ?? 'iris',
      teamName: parsed.teamName ?? null,
      teamPurpose: parsed.teamPurpose ?? null,
      email: parsed.email ?? null,
      totalInvites,
      currentFloor,
      unlockedItemKeys,
    }
  } catch {
    return null
  }
}

export function saveTrialState(state: TrialState): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    /* ignore */
  }
}

export function clearTrialState(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

export function advanceTrialInvites(prev: TrialState): TrialState {
  const totalInvites = prev.totalInvites + 1
  const currentFloor = computeFloorForInvites(totalInvites)
  const unlockedItemKeys = getUnlockedItemKeysForFloor(currentFloor).map(u => u.itemKey)
  return { ...prev, totalInvites, currentFloor, unlockedItemKeys }
}

export function nextOnboardingStep(step: OnboardingStep): OnboardingStep {
  if (step === 'iris') return 'mia'
  if (step === 'mia') return 'leo'
  if (step === 'leo') return 'done'
  return 'done'
}
