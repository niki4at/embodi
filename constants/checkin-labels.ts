import type { Palette } from './design'

/**
 * Shared vocabulary for the daily check-in. The backend stores energy as
 * 1-10 and stress as 1-5; the UI presents them as named buckets (Drained ->
 * Charged, Calm -> A lot) exactly as in the Bodfit Figma file, so every
 * surface (Home context tiles, Ready summary, Finished summary) reads the
 * same words.
 */

export type SleepQuality = 'rough' | 'okay' | 'decent' | 'great'
export type EnergyBucket = 'drained' | 'low' | 'okay' | 'good' | 'charged'
export type StressBucket = 'calm' | 'some' | 'alot'
export type IntensityPreference = 'easy' | 'moderate' | 'challenging'
export type WorkoutType = 'strength' | 'mobility' | 'cardio' | 'recovery' | 'mixed'
export type TimeAvailable =
  | '10'
  | '15'
  | '20'
  | '30'
  | '40'
  | '45'
  | '50'
  | '60'

export const SLEEP_OPTIONS: {
  value: SleepQuality
  label: string
  hint: string
}[] = [
  { value: 'rough', label: '<5 h', hint: 'Rough' },
  { value: 'okay', label: '5-6 h', hint: 'Short' },
  { value: 'decent', label: '7-8 h', hint: 'Good' },
  { value: 'great', label: '+8 h', hint: 'Great' },
]

export const SLEEP_LABEL: Record<SleepQuality, string> = {
  rough: '<5 h',
  okay: '5-6 h',
  decent: '7-8 h',
  great: '+8 h',
}

export const ENERGY_OPTIONS: {
  value: EnergyBucket
  label: string
  hint: string
  level: number
  dot: keyof Palette
}[] = [
  { value: 'drained', label: 'Drained', hint: 'Keep it gentle', level: 2, dot: 'energyDrained' },
  { value: 'low', label: 'Low', hint: 'Something light', level: 4, dot: 'energyLow' },
  { value: 'okay', label: 'Okay', hint: 'A normal session', level: 6, dot: 'energyOkay' },
  { value: 'good', label: 'Good', hint: 'Ready to work', level: 8, dot: 'energyGood' },
  { value: 'charged', label: 'Charged', hint: 'Push me', level: 10, dot: 'energyCharged' },
]

export function energyBucketFromLevel(level: number): EnergyBucket {
  if (level <= 2) return 'drained'
  if (level <= 4) return 'low'
  if (level <= 6) return 'okay'
  if (level <= 8) return 'good'
  return 'charged'
}

export function energyLabelFromLevel(level: number): string {
  const bucket = energyBucketFromLevel(level)
  return ENERGY_OPTIONS.find((o) => o.value === bucket)?.label ?? 'Okay'
}

export function energyDotFromLevel(level: number, palette: Palette): string {
  const bucket = energyBucketFromLevel(level)
  const key = ENERGY_OPTIONS.find((o) => o.value === bucket)?.dot ?? 'energyOkay'
  return palette[key]
}

export const STRESS_OPTIONS: { value: StressBucket; label: string; level: number }[] = [
  { value: 'calm', label: 'Calm', level: 1 },
  { value: 'some', label: 'Some', level: 3 },
  { value: 'alot', label: 'A lot', level: 5 },
]

export function stressBucketFromLevel(level: number): StressBucket {
  if (level <= 2) return 'calm'
  if (level <= 3) return 'some'
  return 'alot'
}

export const WORKOUT_TYPE_OPTIONS: {
  value: WorkoutType
  label: string
  /** Optional focus tag added when the label narrows the type (Run -> cardio). */
  focusTag?: string
}[] = [
  { value: 'strength', label: 'Strength' },
  { value: 'mixed', label: 'Hybrid' },
  { value: 'cardio', label: 'Cardio' },
  { value: 'cardio', label: 'Run', focusTag: 'running' },
  { value: 'mobility', label: 'Mobility' },
  { value: 'recovery', label: 'Recovery' },
]

export const WORKOUT_TYPE_LABEL: Record<WorkoutType, string> = {
  strength: 'Strength',
  mixed: 'Hybrid',
  cardio: 'Cardio',
  mobility: 'Mobility',
  recovery: 'Recovery',
}

export const FOCUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'legs', label: 'Legs' },
  { value: 'glutes', label: 'Glutes' },
  { value: 'back', label: 'Back' },
  { value: 'chest', label: 'Chest' },
  { value: 'arms', label: 'Arms' },
  { value: 'core', label: 'Core' },
  { value: 'shoulders', label: 'Shoulders' },
]

export const INTENSITY_OPTIONS: {
  value: IntensityPreference
  label: string
  hint: string
}[] = [
  { value: 'easy', label: 'Easy', hint: 'RPE 5-6' },
  { value: 'moderate', label: 'Steady', hint: 'RPE 7' },
  { value: 'challenging', label: 'Hard', hint: 'RPE 8-9' },
]

export const INTENSITY_LABEL: Record<IntensityPreference, string> = {
  easy: 'Easy',
  moderate: 'Steady',
  challenging: 'Hard',
}

export const TIME_OPTIONS: TimeAvailable[] = ['10', '20', '30', '40', '50', '60']

/** Quick "Anything sore?" chips shown before the body map. */
export const QUICK_PAIN_AREAS: { id: string; label: string }[] = [
  { id: 'shoulders', label: 'Shoulders' },
  { id: 'upper-back', label: 'Upper back' },
  { id: 'neck', label: 'Neck' },
  { id: 'lower-back', label: 'Lower back' },
  { id: 'knees', label: 'Knees' },
  { id: 'wrists', label: 'Wrists' },
  { id: 'ankles', label: 'Ankles' },
  { id: 'hips', label: 'Hips' },
]

export function painDot(level: number, palette: Palette): string {
  if (level <= 3) return palette.painMild
  if (level <= 6) return palette.painModerate
  return palette.painSevere
}

/** Turn a stored pain-area id (body part or quick area) into a label. */
export function painAreaLabel(id: string): string {
  const quick = QUICK_PAIN_AREAS.find((a) => a.id === id)
  if (quick) return quick.label
  // Body-map ids are camelCase like `leftKnee`; split to words.
  const words = id
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/-/g, ' ')
    .toLowerCase()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

export function greetingForHour(hour: number): string {
  if (hour < 5) return 'Good night'
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}
