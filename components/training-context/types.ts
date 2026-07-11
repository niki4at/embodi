export const TRAINING_ENVIRONMENTS = [
  'home',
  'gym',
  'outdoors',
  'travel',
] as const

export const EQUIPMENT_INTENTS = [
  'available',
  'bodyweight',
  'treadmill',
] as const

export const CONTEXT_TAGS = ['limited-space', 'busy-gym', 'quiet'] as const

export type TrainingEnvironment = (typeof TRAINING_ENVIRONMENTS)[number]
export type EquipmentIntent = (typeof EQUIPMENT_INTENTS)[number]
export type TrainingContextTag = (typeof CONTEXT_TAGS)[number]
export type ContextSuggestionSource =
  | 'manual'
  | 'place'
  | 'workout_need'
  | 'weekly_rhythm'
  | 'history'
  | 'fallback'

export type EquipmentSnapshotItem = {
  catalogKey: string
  label: string
  details?: string
  capabilities?: {
    weightMinKg?: number
    weightMaxKg?: number
    adjustable?: boolean
    incline?: boolean
    speedControl?: boolean
    resistanceLevels?: number
    quantity?: number
    resistance?: string
    dimensions?: string
  }
}

export type TrainingContextSelection = {
  trainingEnvironment: TrainingEnvironment
  equipmentIntent: EquipmentIntent
  contextTags: TrainingContextTag[]
  suggestionSource: ContextSuggestionSource
  suggestionReason: string
  equipmentSnapshot: EquipmentSnapshotItem[]
  unavailableEquipment: string[]
}

export type WorkoutType =
  | 'strength'
  | 'mobility'
  | 'cardio'
  | 'recovery'
  | 'mixed'

export const TRAINING_ENVIRONMENT_LABELS: Record<TrainingEnvironment, string> = {
  home: 'Home',
  gym: 'Gym',
  outdoors: 'Outdoors',
  travel: 'Travel',
}

export const EQUIPMENT_INTENT_LABELS: Record<EquipmentIntent, string> = {
  available: 'Available equipment',
  bodyweight: 'Bodyweight',
  treadmill: 'Treadmill',
}

export const CONTEXT_TAG_LABELS: Record<TrainingContextTag, string> = {
  'limited-space': 'Limited space',
  'busy-gym': 'Busy gym',
  quiet: 'Keep it quiet',
}

export function isTrainingEnvironment(
  value: string | string[] | undefined,
): value is TrainingEnvironment {
  return (
    typeof value === 'string' &&
    TRAINING_ENVIRONMENTS.some((environment) => environment === value)
  )
}

export function isEquipmentIntent(
  value: string | string[] | undefined,
): value is EquipmentIntent {
  return (
    typeof value === 'string' &&
    EQUIPMENT_INTENTS.some((intent) => intent === value)
  )
}

export function requiresTrainingContextConfirmation(
  confidence: number | undefined,
  confirmed: boolean,
): boolean {
  return confidence !== undefined && confidence < 0.5 && !confirmed
}

export function formatTrainingContext(
  value: Pick<
    TrainingContextSelection,
    'trainingEnvironment' | 'equipmentIntent' | 'contextTags'
  >,
): string {
  const parts = [
    TRAINING_ENVIRONMENT_LABELS[value.trainingEnvironment],
    EQUIPMENT_INTENT_LABELS[value.equipmentIntent],
    ...value.contextTags.map((tag) => CONTEXT_TAG_LABELS[tag]),
  ]
  return parts.join(' · ')
}

type ResolveTrainingContextInput = {
  workoutType: WorkoutType
  preferredEnvironment?: TrainingEnvironment
  preferredEquipmentIntent?: EquipmentIntent
  requestedEnvironment?: TrainingEnvironment
  requestedEquipmentIntent?: EquipmentIntent
  equipmentSnapshot?: EquipmentSnapshotItem[]
}

export function resolveTrainingContext({
  workoutType,
  preferredEnvironment,
  preferredEquipmentIntent,
  requestedEnvironment,
  requestedEquipmentIntent,
  equipmentSnapshot = [],
}: ResolveTrainingContextInput): TrainingContextSelection {
  const normalizedEquipment = equipmentSnapshot.map((item) =>
    `${item.catalogKey} ${item.label}`.toLowerCase(),
  )
  const hasTreadmill = normalizedEquipment.some((item) =>
    item.includes('treadmill'),
  )

  let trainingEnvironment =
    requestedEnvironment ?? preferredEnvironment ?? 'home'
  let equipmentIntent =
    requestedEquipmentIntent ??
    (workoutType === 'cardio' ? undefined : preferredEquipmentIntent)
  let suggestionReason = requestedEnvironment
    ? 'Using the place you selected.'
    : preferredEnvironment
      ? `Based on your usual ${TRAINING_ENVIRONMENT_LABELS[
          preferredEnvironment
        ].toLowerCase()} training.`
      : 'Home is a flexible starting point. You can change it.'
  let suggestionSource = requestedEnvironment || requestedEquipmentIntent
    ? ('manual' as const)
    : preferredEnvironment
      ? ('weekly_rhythm' as const)
      : ('fallback' as const)

  if (!equipmentIntent && workoutType === 'cardio') {
    if (hasTreadmill && trainingEnvironment !== 'outdoors') {
      equipmentIntent = 'treadmill'
      suggestionReason = 'Treadmill fits the cardio session you chose.'
    } else {
      trainingEnvironment = requestedEnvironment ?? 'outdoors'
      equipmentIntent = 'bodyweight'
      suggestionReason = 'Outdoor cardio fits your session without equipment.'
    }
    suggestionSource = 'fallback'
  }

  if (!equipmentIntent) {
    equipmentIntent =
      trainingEnvironment === 'home' && equipmentSnapshot.length === 0
        ? 'bodyweight'
        : 'available'
  }

  return {
    trainingEnvironment,
    equipmentIntent,
    contextTags: [],
    suggestionSource,
    suggestionReason,
    equipmentSnapshot,
    unavailableEquipment: [],
  }
}
