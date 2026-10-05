import type { SummaryRow } from '@/components/ui/primitives'
import {
  energyLabelFromLevel,
  INTENSITY_LABEL,
  painAreaLabel,
  SLEEP_LABEL,
  WORKOUT_TYPE_LABEL,
  type IntensityPreference,
  type SleepQuality,
  type WorkoutType,
} from '@/constants/checkin-labels'
import type { Palette } from '@/constants/design'
import { TRAINING_ENVIRONMENT_LABELS } from '@/components/training-context'

type CheckinLike = {
  sleepQuality?: SleepQuality | string
  energyLevel?: number
  painAreas?: string[]
  painLevel?: number
  workoutType?: WorkoutType | string
  intensityPreference?: IntensityPreference | string
  focusAreas?: string[]
  timeAvailable?: string
  trainingEnvironment?: string
  equipmentSnapshot?: { label: string }[]
  equipmentIntent?: string
} | null | undefined

type SessionLike = {
  durationMin?: number
  trainingEnvironment?: string
  equipmentIntent?: string
  equipmentSnapshot?: { label: string }[]
  modality?: string
} | null | undefined

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

/**
 * The six-line "Sleep / Energy / Body / Workout / Time / Set up" summary that
 * appears on the building, ready, and finished screens. Rows with no data
 * are dropped so the list never shows placeholders.
 */
export function buildCheckinSummary(
  checkin: CheckinLike,
  session: SessionLike,
  palette: Palette,
  options: { includeSleep?: boolean } = {},
): SummaryRow[] {
  const rows: SummaryRow[] = []
  const includeSleep = options.includeSleep ?? true

  if (includeSleep && checkin?.sleepQuality) {
    rows.push({
      label: 'Sleep',
      value: SLEEP_LABEL[checkin.sleepQuality as SleepQuality] ?? titleCase(checkin.sleepQuality),
      dot: palette.energyLow,
    })
  }
  if (checkin?.energyLevel !== undefined) {
    rows.push({
      label: 'Energy',
      value: energyLabelFromLevel(checkin.energyLevel),
      dot: palette.energyCharged,
    })
  }
  const body =
    checkin?.painAreas && checkin.painAreas.length > 0
      ? checkin.painAreas.map(painAreaLabel).join(', ')
      : checkin
        ? 'Nothing sore'
        : null
  if (body) {
    rows.push({ label: 'Body', value: body, dot: palette.accent })
  }
  if (checkin?.workoutType) {
    const type =
      WORKOUT_TYPE_LABEL[checkin.workoutType as WorkoutType] ??
      titleCase(checkin.workoutType)
    const intensity = checkin.intensityPreference
      ? INTENSITY_LABEL[checkin.intensityPreference as IntensityPreference] ??
        titleCase(checkin.intensityPreference)
      : null
    const focus =
      checkin.focusAreas && checkin.focusAreas.length > 0
        ? checkin.focusAreas
            .filter((f) => f !== 'running')
            .map(titleCase)
            .join(', ')
        : null
    rows.push({
      label: 'Workout',
      value: [type, intensity, focus].filter(Boolean).join(' \u00b7 '),
      dot: palette.primary,
    })
  } else if (session?.modality && session.modality !== 'generating...') {
    rows.push({ label: 'Workout', value: session.modality, dot: palette.primary })
  }
  const minutes = session?.durationMin ?? (checkin?.timeAvailable ? parseInt(checkin.timeAvailable, 10) : null)
  if (minutes) {
    rows.push({ label: 'Time', value: `${minutes} min`, dot: palette.energyDrained })
  }
  const environment = session?.trainingEnvironment ?? checkin?.trainingEnvironment
  if (environment) {
    const label =
      TRAINING_ENVIRONMENT_LABELS[environment as keyof typeof TRAINING_ENVIRONMENT_LABELS] ??
      titleCase(environment)
    const snapshot = session?.equipmentSnapshot ?? checkin?.equipmentSnapshot ?? []
    const intent = session?.equipmentIntent ?? checkin?.equipmentIntent
    const gear =
      snapshot.length > 0
        ? snapshot.slice(0, 2).map((item) => item.label).join(', ')
        : intent === 'bodyweight'
          ? 'Bodyweight'
          : intent === 'treadmill'
            ? 'Treadmill'
            : null
    rows.push({
      label: 'Set up',
      value: gear ? `${label} \u00b7 ${gear}` : label,
      dot: palette.energyOkay,
    })
  }
  return rows
}
