// Shared flare-up / body-area region list. Kept free of React Native imports so
// both the UI and Convex backend can consume it as the single source of truth.

export interface FlareRegion {
  id: string
  label: string
}

export const FLARE_REGIONS: readonly FlareRegion[] = [
  { id: 'neck', label: 'Neck' },
  { id: 'shoulders', label: 'Shoulders' },
  { id: 'upper-back', label: 'Upper back' },
  { id: 'lower-back', label: 'Lower back' },
  { id: 'hips', label: 'Hips' },
  { id: 'knees', label: 'Knees' },
  { id: 'ankles', label: 'Ankles' },
  { id: 'wrists', label: 'Wrists' },
] as const

export const FLARE_LABELS: Record<string, string> = FLARE_REGIONS.reduce(
  (acc, region) => {
    acc[region.id] = region.label
    return acc
  },
  {} as Record<string, string>
)

/** Map region ids to human labels, falling back to the raw id. */
export function labelForRegion(id: string): string {
  return FLARE_LABELS[id] ?? id
}
