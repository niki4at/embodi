export type TrainingEnvironment = 'home' | 'gym' | 'outdoors' | 'travel'

export type EquipmentIntent = 'available' | 'bodyweight' | 'treadmill'

export type Weekday =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday'

export type TimeOfDay = 'morning' | 'evening'

export type ContextSelection = {
  trainingEnvironment: TrainingEnvironment
  equipmentIntent: EquipmentIntent
}

export type WeeklyScheduleEntry = {
  weekday: Weekday
  morning?: ContextSelection
  evening?: ContextSelection
}

export type GenericTrainingContextEvent = {
  trainingEnvironment: TrainingEnvironment
  equipmentIntent: EquipmentIntent
  workoutType?: string
  goal?: string
  localWeekday?: Weekday
  timeOfDay?: TimeOfDay
}

export type TrainingContextPrediction<T> = {
  value: T
  confidence: number
  reason: string
  source:
    | 'manual'
    | 'place'
    | 'workout_need'
    | 'weekly_rhythm'
    | 'history'
    | 'fallback'
}

export type TrainingContextSuggestion = {
  environment: TrainingContextPrediction<TrainingEnvironment>
  equipmentIntent: TrainingContextPrediction<EquipmentIntent>
}

export type TrainingContextScoringInput = {
  manualContext?: Partial<ContextSelection>
  foregroundPlaceMatch?: Partial<ContextSelection>
  workoutType?: string
  goal?: string
  weekday?: Weekday
  timeOfDay?: TimeOfDay
  weeklyRhythm?: WeeklyScheduleEntry[]
  recentEvents?: GenericTrainingContextEvent[]
  fallback: ContextSelection
}

type PredictionDimension = 'trainingEnvironment' | 'equipmentIntent'

function normalize(value: string | undefined): string {
  return value?.trim().toLowerCase() ?? ''
}

function workoutNeedsPrediction<T extends TrainingEnvironment | EquipmentIntent>(
  dimension: PredictionDimension,
  workoutType: string | undefined,
  goal: string | undefined
): TrainingContextPrediction<T> | null {
  const signal = `${normalize(workoutType)} ${normalize(goal)}`
  const treadmill = signal.includes('treadmill') || signal.includes('indoor run')
  const outdoors =
    signal.includes('outdoor') ||
    signal.includes('trail') ||
    signal.includes('road run')
  const bodyweight =
    signal.includes('bodyweight') ||
    signal.includes('calisthenics') ||
    signal.includes('no equipment')
  const gymProgression =
    signal.includes('barbell') ||
    signal.includes('powerlifting') ||
    signal.includes('heavy strength') ||
    signal.includes('max strength') ||
    signal.includes('muscle gain')

  if (dimension === 'equipmentIntent') {
    if (treadmill) {
      return {
        value: 'treadmill' as T,
        confidence: 0.82,
        reason: 'A treadmill best matches this workout',
        source: 'workout_need',
      }
    }
    if (bodyweight) {
      return {
        value: 'bodyweight' as T,
        confidence: 0.82,
        reason: 'This workout is equipment-free',
        source: 'workout_need',
      }
    }
    if (gymProgression) {
      return {
        value: 'available' as T,
        confidence: 0.74,
        reason: 'Available equipment supports this training goal',
        source: 'workout_need',
      }
    }
  }

  if (dimension === 'trainingEnvironment') {
    if (treadmill || gymProgression) {
      return {
        value: 'gym' as T,
        confidence: treadmill ? 0.82 : 0.74,
        reason: treadmill
          ? 'A gym treadmill best matches this workout'
          : 'Gym equipment supports this training goal',
        source: 'workout_need',
      }
    }
    if (outdoors) {
      return {
        value: 'outdoors' as T,
        confidence: 0.82,
        reason: 'This workout is designed for outdoors',
        source: 'workout_need',
      }
    }
  }

  return null
}

function historyPrediction<T extends TrainingEnvironment | EquipmentIntent>(
  dimension: PredictionDimension,
  events: GenericTrainingContextEvent[],
  workoutType: string | undefined,
  goal: string | undefined,
  weekday: Weekday | undefined,
  timeOfDay: TimeOfDay | undefined
): TrainingContextPrediction<T> | null {
  const scores = new Map<T, number>()
  const normalizedWorkoutType = normalize(workoutType)
  const normalizedGoal = normalize(goal)

  events.slice(0, 20).forEach((event, index) => {
    let weight = Math.max(0.2, 1 - index * 0.04)
    if (
      normalizedWorkoutType &&
      normalize(event.workoutType) === normalizedWorkoutType
    ) {
      weight += 0.75
    }
    if (normalizedGoal && normalize(event.goal) === normalizedGoal) {
      weight += 0.5
    }
    if (weekday && event.localWeekday === weekday) {
      weight += 0.75
    }
    if (timeOfDay && event.timeOfDay === timeOfDay) {
      weight += 0.35
    }
    const value = event[dimension] as T
    scores.set(value, (scores.get(value) ?? 0) + weight)
  })

  const ranked = [...scores.entries()].sort((left, right) => right[1] - left[1])
  const winner = ranked[0]
  if (!winner) return null

  const total = ranked.reduce((sum, entry) => sum + entry[1], 0)
  const share = total === 0 ? 0 : winner[1] / total
  return {
    value: winner[0],
    confidence: Number(Math.min(0.84, 0.45 + share * 0.4).toFixed(2)),
    reason: 'Matches your recent training pattern',
    source: 'history',
  }
}

function scoreDimension<T extends TrainingEnvironment | EquipmentIntent>(
  dimension: PredictionDimension,
  input: TrainingContextScoringInput
): TrainingContextPrediction<T> {
  const manualValue = input.manualContext?.[dimension] as T | undefined
  if (manualValue) {
    return {
      value: manualValue,
      confidence: 1,
      reason: 'Selected for this workout',
      source: 'manual',
    }
  }

  const placeValue = input.foregroundPlaceMatch?.[dimension] as T | undefined
  if (placeValue) {
    return {
      value: placeValue,
      confidence: 0.92,
      reason: 'Matches your current saved place',
      source: 'place',
    }
  }

  const workoutNeed = workoutNeedsPrediction<T>(
    dimension,
    input.workoutType,
    input.goal
  )
  if (workoutNeed) return workoutNeed

  const scheduleEntry = input.weeklyRhythm?.find(
    (entry) => entry.weekday === input.weekday
  )
  const scheduleValue =
    input.timeOfDay && scheduleEntry
      ? (scheduleEntry[input.timeOfDay]?.[dimension] as T | undefined)
      : undefined
  if (scheduleValue) {
    return {
      value: scheduleValue,
      confidence: 0.78,
      reason: 'Matches your weekly training rhythm',
      source: 'weekly_rhythm',
    }
  }

  const historical = historyPrediction<T>(
    dimension,
    input.recentEvents ?? [],
    input.workoutType,
    input.goal,
    input.weekday,
    input.timeOfDay
  )
  if (historical) return historical

  return {
    value: input.fallback[dimension] as T,
    confidence: 0.35,
    reason: 'Uses your default training context',
    source: 'fallback',
  }
}

export function scoreTrainingContext(
  input: TrainingContextScoringInput
): TrainingContextSuggestion {
  return {
    environment: scoreDimension<TrainingEnvironment>(
      'trainingEnvironment',
      input
    ),
    equipmentIntent: scoreDimension<EquipmentIntent>(
      'equipmentIntent',
      input
    ),
  }
}
