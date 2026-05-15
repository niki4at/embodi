import { ExercisePlan } from './types'

export type ExercisePhase = 'warmup' | 'main' | 'cooldown'

export type PhaseMeta = {
  key: ExercisePhase
  label: string
  emoji: string
  // Material icon used as a fallback when emoji rendering is undesirable
  icon: 'figure.flexibility' | 'dumbbell.fill' | 'heart.fill' | 'checkmark'
  /** Short, plain-language reminder shown at the top of the preview sheet. */
  tip: string
  /** Phrasing the preview sheet uses to frame the stage to the user. */
  stageHeadline: string
}

export const PHASE_META: Record<ExercisePhase, PhaseMeta> = {
  warmup: {
    key: 'warmup',
    label: 'Warm up',
    emoji: '🤸',
    icon: 'figure.flexibility',
    tip: 'Keep it gentle. Get blood moving and joints awake before the work.',
    stageHeadline: 'Wake the body up',
  },
  main: {
    key: 'main',
    label: 'Strength',
    emoji: '💪',
    icon: 'dumbbell.fill',
    tip: 'Slow on the way down, controlled on the way up. Stop a rep or two before failure.',
    stageHeadline: 'Build strength with intent',
  },
  cooldown: {
    key: 'cooldown',
    label: 'Recovery',
    emoji: '💗',
    icon: 'heart.fill',
    tip: 'Slow your breath. Long exhales tell your nervous system you’re done.',
    stageHeadline: 'Bring it back down',
  },
}

const WARMUP_NAME_KEYWORDS = [
  'warm up',
  'warm-up',
  'warmup',
  'primer',
  'activation',
  'mobility',
  'dynamic',
  'prep',
]

const COOLDOWN_NAME_KEYWORDS = [
  'cool down',
  'cool-down',
  'cooldown',
  'stretch',
  'recovery',
  'breath',
  'breathing',
  'meditation',
  'restorative',
  'savasana',
]

const WARMUP_MODALITY_KEYWORDS = [
  'warm',
  'warm-up',
  'warmup',
  'prep',
  'activation',
  'dynamic',
]

const COOLDOWN_MODALITY_KEYWORDS = [
  'cool',
  'cool-down',
  'cooldown',
  'recovery',
  'stretch',
  'breath',
  'breathing',
  'yoga',
  'meditation',
  'restorative',
]

function matchesAny(haystack: string, needles: readonly string[]): boolean {
  return needles.some(needle => haystack.includes(needle))
}

function classifyExercise(exercise: ExercisePlan): ExercisePhase {
  const name = exercise.name.toLowerCase()
  const modality = exercise.modality.toLowerCase()

  // Name is the strongest signal — users name "warm-up" and "cool-down"
  // moves explicitly, even when the AI mislabels the modality.
  if (matchesAny(name, WARMUP_NAME_KEYWORDS)) return 'warmup'
  if (matchesAny(name, COOLDOWN_NAME_KEYWORDS)) return 'cooldown'

  if (matchesAny(modality, WARMUP_MODALITY_KEYWORDS)) return 'warmup'
  if (matchesAny(modality, COOLDOWN_MODALITY_KEYWORDS)) return 'cooldown'

  return 'main'
}

/**
 * Best-effort classification of an exercise into one of three journey phases.
 * Reads the exercise name first (most reliable), falls back to modality, then
 * uses position (first warmup, last cooldown) when everything else lands in
 * the main bucket.
 */
export function derivePhases(plan: ExercisePlan[]): ExercisePhase[] {
  if (plan.length === 0) return []

  const phases: ExercisePhase[] = plan.map(classifyExercise)

  // If everything came back as "main", fall back to position: first warmup,
  // last cooldown, rest stay main. Avoids a flat session view.
  const allMain = phases.every(p => p === 'main')
  if (allMain && plan.length >= 3) {
    const promoted: ExercisePhase[] = [...phases]
    promoted[0] = 'warmup'
    promoted[plan.length - 1] = 'cooldown'
    return promoted
  }

  return phases
}

export type PhaseGroup = {
  phase: ExercisePhase
  exercises: { exercise: ExercisePlan; planIndex: number }[]
}

export function groupPlanByPhase(plan: ExercisePlan[]): PhaseGroup[] {
  const phases = derivePhases(plan)
  const order: ExercisePhase[] = ['warmup', 'main', 'cooldown']

  const groups: PhaseGroup[] = order.map(phase => ({
    phase,
    exercises: [],
  }))

  plan.forEach((exercise, planIndex) => {
    const phase = phases[planIndex]
    const group = groups.find(g => g.phase === phase)
    if (group) {
      group.exercises.push({ exercise, planIndex })
    }
  })

  return groups
}

export type PhaseProgress = {
  phase: ExercisePhase
  completed: number
  total: number
}

export function computePhaseProgress(
  plan: ExercisePlan[],
  loggedSets: { exerciseId: string }[],
): PhaseProgress[] {
  const phases = derivePhases(plan)
  const order: ExercisePhase[] = ['warmup', 'main', 'cooldown']

  return order.map(phase => {
    const exercisesInPhase = plan.filter((_, idx) => phases[idx] === phase)
    const total = exercisesInPhase.reduce((acc, ex) => acc + ex.targetSets, 0)
    const completed = loggedSets.filter(set =>
      exercisesInPhase.some(ex => ex.id === set.exerciseId),
    ).length

    return { phase, completed, total }
  })
}

export function buildExerciseMeta(exercise: ExercisePlan): string {
  if (exercise.trackingMetric === 'duration' && exercise.durationMin) {
    return `${exercise.durationMin} min`
  }
  if (exercise.trackingMetric === 'breath' && exercise.durationMin) {
    return `${exercise.durationMin} min`
  }
  return `${exercise.targetSets} set${exercise.targetSets === 1 ? '' : 's'}`
}
