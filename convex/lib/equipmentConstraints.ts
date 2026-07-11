export type TrainingEnvironment = 'home' | 'gym' | 'outdoors' | 'travel'
export type EquipmentIntent = 'available' | 'bodyweight' | 'treadmill'

export type TrainingContext = {
  trainingEnvironment?: TrainingEnvironment
  equipmentIntent?: EquipmentIntent
  contextTags?: string[]
  equipmentSnapshot?: Array<
    | string
    | {
        catalogKey: string
        label: string
      }
  >
  unavailableEquipment?: string[]
}

const NO_EQUIPMENT = new Set([
  '',
  'none',
  'no equipment',
  'bodyweight',
  'body weight',
])

const EQUIPMENT_ALIASES: Record<string, string> = {
  dumbbells: 'dumbbell',
  'adjustable dumbbells': 'dumbbell',
  barbells: 'barbell',
  kettlebells: 'kettlebell',
  'resistance bands': 'resistance band',
  'resistance band set': 'resistance band',
  bands: 'resistance band',
  'yoga mat': 'mat',
  mats: 'mat',
  benches: 'bench',
  'adjustable bench': 'bench',
  'pull-up bar': 'pull up bar',
  'pullup bar': 'pull up bar',
  treadmill: 'treadmill',
  treadmills: 'treadmill',
  cables: 'cable',
  'cable machine': 'cable',
  'cable station': 'cable',
  'functional trainer': 'cable',
  machines: 'machine',
  'stationary bike': 'bike',
  'exercise bike': 'bike',
  'rowing machine': 'rower',
  'squat rack': 'rack',
  'power rack': 'rack',
  trx: 'suspension trainer',
  straps: 'suspension trainer',
  'trx straps': 'suspension trainer',
}

export function normalizeEquipmentName(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[–—]/g, '-')
    .replace(/[-_]/g, ' ')
    .replace(/\s+/g, ' ')
  return EQUIPMENT_ALIASES[normalized] ?? normalized
}

function normalizedSet(values: string[] | undefined): Set<string> {
  return new Set((values ?? []).map(normalizeEquipmentName))
}

function equipmentSnapshotLabels(
  values: TrainingContext['equipmentSnapshot'],
): string[] {
  return (values ?? []).flatMap((value) =>
    typeof value === 'string' ? [value] : [value.catalogKey, value.label],
  )
}

export function describeTrainingConstraints(context: TrainingContext): string {
  if (!context.trainingEnvironment || !context.equipmentIntent) return ''

  const availableLabels = equipmentSnapshotLabels(context.equipmentSnapshot)
  const available = availableLabels.length
    ? availableLabels.join(', ')
    : 'none saved'
  const unavailable = context.unavailableEquipment?.length
    ? context.unavailableEquipment.join(', ')
    : 'none'
  const tags = context.contextTags?.length
    ? context.contextTags.join(', ')
    : 'none'

  const rules =
    context.equipmentIntent === 'bodyweight'
      ? 'Use bodyweight only. Do not prescribe machines, weights, bands, a mat, or other equipment.'
      : context.equipmentIntent === 'treadmill'
        ? 'The main cardio work must use a treadmill. Bodyweight warm-up and cooldown movements are allowed.'
        : context.trainingEnvironment === 'gym'
          ? 'Assume standard full-gym access, except equipment listed as unavailable.'
          : `This is a hard equipment boundary. Use bodyweight or an item in the available list only. Owning equipment does not require you to use it.`

  return [
    '=== TRAINING CONTEXT ===',
    `- Place: ${context.trainingEnvironment}`,
    `- Equipment intent: ${context.equipmentIntent}`,
    `- Available equipment snapshot: ${available}`,
    `- Temporarily unavailable: ${unavailable}`,
    `- Context needs: ${tags}`,
    `- Rule: ${rules}`,
    'Treat these constraints as authoritative for every exercise.',
    '=== END TRAINING CONTEXT ===',
  ].join('\n')
}

export function exerciseFitsTrainingContext(
  equipment: string[],
  context: TrainingContext,
): boolean {
  if (!context.trainingEnvironment || !context.equipmentIntent) return true

  const required = equipment
    .map(normalizeEquipmentName)
    .filter((item) => !NO_EQUIPMENT.has(item))
  if (required.length === 0) return true

  const unavailable = normalizedSet(context.unavailableEquipment)
  if (required.some((item) => unavailable.has(item))) return false

  if (context.equipmentIntent === 'bodyweight') return false

  if (context.equipmentIntent === 'treadmill') {
    return required.every((item) => item === 'treadmill')
  }

  if (context.trainingEnvironment === 'gym') return true

  const available = normalizedSet(
    equipmentSnapshotLabels(context.equipmentSnapshot),
  )
  return required.every((item) => available.has(item))
}
