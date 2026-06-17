import type { IconSymbol } from '@/components/ui/icon-symbol'
import type { ExercisePlan } from '@/components/trainer/types'

export type LibraryCategory =
  | 'all'
  | 'strength'
  | 'mobility'
  | 'cardio'
  | 'recovery'

export type ExerciseModality = Exclude<LibraryCategory, 'all'>

export type IconName = Parameters<typeof IconSymbol>[0]['name']

// Body groups the catalog is organized around. These map onto the tappable
// regions of the body figure so a user can pick "what they want to train".
export type BodyGroup =
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'arms'
  | 'core'
  | 'glutes'
  | 'legs'
  | 'fullBody'
  | 'cardio'
  | 'mobility'
  | 'recovery'

export interface ExerciseEntry {
  id: string
  name: string
  group: BodyGroup
  bodyPart: string
  equipment: string
  modality: ExerciseModality
  iconName: IconName
}

export interface BodyGroupMeta {
  id: BodyGroup
  label: string
  icon: IconName
}

export const BODY_GROUPS: BodyGroupMeta[] = [
  { id: 'chest', label: 'Chest', icon: 'figure.strengthtraining.traditional' },
  { id: 'back', label: 'Back', icon: 'figure.strengthtraining.traditional' },
  { id: 'shoulders', label: 'Shoulders', icon: 'dumbbell.fill' },
  { id: 'arms', label: 'Arms', icon: 'dumbbell.fill' },
  { id: 'core', label: 'Core', icon: 'figure.cooldown' },
  { id: 'glutes', label: 'Glutes', icon: 'figure.strengthtraining.traditional' },
  { id: 'legs', label: 'Legs', icon: 'figure.strengthtraining.traditional' },
  { id: 'fullBody', label: 'Full body', icon: 'bolt.fill' },
  { id: 'cardio', label: 'Cardio', icon: 'figure.run' },
  { id: 'mobility', label: 'Mobility', icon: 'figure.flexibility' },
  { id: 'recovery', label: 'Recovery', icon: 'leaf.fill' },
]

export const BODY_GROUP_LABELS: Record<BodyGroup, string> = BODY_GROUPS.reduce(
  (acc, g) => {
    acc[g.id] = g.label
    return acc
  },
  {} as Record<BodyGroup, string>,
)

export const ICON_BY_MODALITY: Record<ExerciseModality, IconName> = {
  strength: 'dumbbell.fill',
  mobility: 'figure.flexibility',
  cardio: 'figure.run',
  recovery: 'leaf.fill',
}

function ex(
  id: string,
  name: string,
  group: BodyGroup,
  bodyPart: string,
  equipment: string,
  modality: ExerciseModality,
  iconName?: IconName,
): ExerciseEntry {
  return {
    id,
    name,
    group,
    bodyPart,
    equipment,
    modality,
    iconName: iconName ?? ICON_BY_MODALITY[modality],
  }
}

export const CATALOG_EXERCISES: ExerciseEntry[] = [
  // Chest
  ex('chest-barbell-bench', 'Barbell bench press', 'chest', 'Chest', 'Barbell', 'strength'),
  ex('chest-db-bench', 'Dumbbell bench press', 'chest', 'Chest', 'Dumbbell', 'strength'),
  ex('chest-incline-db', 'Incline dumbbell press', 'chest', 'Upper chest', 'Dumbbell', 'strength'),
  ex('chest-push-up', 'Push-up', 'chest', 'Chest', 'Bodyweight', 'strength'),
  ex('chest-incline-push-up', 'Incline push-up', 'chest', 'Chest', 'Bodyweight', 'strength'),
  ex('chest-fly', 'Dumbbell chest fly', 'chest', 'Chest', 'Dumbbell', 'strength'),
  ex('chest-cable-crossover', 'Cable crossover', 'chest', 'Chest', 'Cable', 'strength'),
  ex('chest-machine-press', 'Machine chest press', 'chest', 'Chest', 'Machine', 'strength'),
  ex('chest-dip', 'Chest dip', 'chest', 'Lower chest', 'Bodyweight', 'strength'),
  ex('chest-pec-deck', 'Pec deck', 'chest', 'Chest', 'Machine', 'strength'),
  ex('chest-svend-press', 'Svend press', 'chest', 'Inner chest', 'Plate', 'strength'),

  // Back
  ex('back-deadlift', 'Deadlift', 'back', 'Posterior chain', 'Barbell', 'strength'),
  ex('back-bent-row', 'Bent-over row', 'back', 'Mid back', 'Barbell', 'strength'),
  ex('back-pull-up', 'Pull-up', 'back', 'Lats', 'Bodyweight', 'strength'),
  ex('back-lat-pulldown', 'Lat pulldown', 'back', 'Lats', 'Cable', 'strength'),
  ex('back-seated-row', 'Seated cable row', 'back', 'Mid back', 'Cable', 'strength'),
  ex('back-db-row', 'Single-arm dumbbell row', 'back', 'Lats', 'Dumbbell', 'strength'),
  ex('back-t-bar-row', 'T-bar row', 'back', 'Mid back', 'Barbell', 'strength'),
  ex('back-face-pull', 'Face pull', 'back', 'Upper back', 'Cable', 'strength'),
  ex('back-inverted-row', 'Inverted row', 'back', 'Mid back', 'Bodyweight', 'strength'),
  ex('back-straight-arm', 'Straight-arm pulldown', 'back', 'Lats', 'Cable', 'strength'),
  ex('back-superman', 'Superman hold', 'back', 'Lower back', 'Bodyweight', 'strength'),

  // Shoulders
  ex('sh-overhead-press', 'Overhead press', 'shoulders', 'Shoulders', 'Barbell', 'strength'),
  ex('sh-db-press', 'Dumbbell shoulder press', 'shoulders', 'Shoulders', 'Dumbbell', 'strength'),
  ex('sh-lateral-raise', 'Lateral raise', 'shoulders', 'Side delts', 'Dumbbell', 'strength'),
  ex('sh-front-raise', 'Front raise', 'shoulders', 'Front delts', 'Dumbbell', 'strength'),
  ex('sh-rear-fly', 'Rear delt fly', 'shoulders', 'Rear delts', 'Dumbbell', 'strength'),
  ex('sh-arnold-press', 'Arnold press', 'shoulders', 'Shoulders', 'Dumbbell', 'strength'),
  ex('sh-upright-row', 'Upright row', 'shoulders', 'Shoulders', 'Barbell', 'strength'),
  ex('sh-cable-lateral', 'Cable lateral raise', 'shoulders', 'Side delts', 'Cable', 'strength'),
  ex('sh-pike-push-up', 'Pike push-up', 'shoulders', 'Shoulders', 'Bodyweight', 'strength'),
  ex('sh-landmine-press', 'Landmine press', 'shoulders', 'Shoulders', 'Barbell', 'strength'),

  // Arms
  ex('arm-bb-curl', 'Barbell biceps curl', 'arms', 'Biceps', 'Barbell', 'strength'),
  ex('arm-db-curl', 'Dumbbell curl', 'arms', 'Biceps', 'Dumbbell', 'strength'),
  ex('arm-hammer-curl', 'Hammer curl', 'arms', 'Biceps', 'Dumbbell', 'strength'),
  ex('arm-pushdown', 'Triceps pushdown', 'arms', 'Triceps', 'Cable', 'strength'),
  ex('arm-oh-extension', 'Overhead triceps extension', 'arms', 'Triceps', 'Dumbbell', 'strength'),
  ex('arm-skull-crusher', 'Skull crusher', 'arms', 'Triceps', 'Barbell', 'strength'),
  ex('arm-concentration', 'Concentration curl', 'arms', 'Biceps', 'Dumbbell', 'strength'),
  ex('arm-close-grip-bench', 'Close-grip bench press', 'arms', 'Triceps', 'Barbell', 'strength'),
  ex('arm-cable-curl', 'Cable curl', 'arms', 'Biceps', 'Cable', 'strength'),
  ex('arm-bench-dip', 'Bench dip', 'arms', 'Triceps', 'Bodyweight', 'strength'),

  // Core
  ex('core-plank', 'Plank', 'core', 'Core', 'Bodyweight', 'strength'),
  ex('core-dead-bug', 'Dead bug', 'core', 'Core', 'Bodyweight', 'strength'),
  ex('core-bird-dog', 'Bird dog', 'core', 'Core', 'Bodyweight', 'strength'),
  ex('core-hanging-knee-raise', 'Hanging knee raise', 'core', 'Lower abs', 'Bodyweight', 'strength'),
  ex('core-cable-crunch', 'Cable crunch', 'core', 'Abs', 'Cable', 'strength'),
  ex('core-russian-twist', 'Russian twist', 'core', 'Obliques', 'Dumbbell', 'strength'),
  ex('core-side-plank', 'Side plank', 'core', 'Obliques', 'Bodyweight', 'strength'),
  ex('core-mountain-climber', 'Mountain climber', 'core', 'Core', 'Bodyweight', 'strength'),
  ex('core-hollow-hold', 'Hollow hold', 'core', 'Core', 'Bodyweight', 'strength'),
  ex('core-ab-wheel', 'Ab wheel rollout', 'core', 'Core', 'Ab wheel', 'strength'),

  // Glutes
  ex('glute-hip-thrust', 'Hip thrust', 'glutes', 'Glutes', 'Barbell', 'strength'),
  ex('glute-bridge', 'Glute bridge', 'glutes', 'Glutes', 'Bodyweight', 'strength'),
  ex('glute-bulgarian', 'Bulgarian split squat', 'glutes', 'Glutes', 'Dumbbell', 'strength'),
  ex('glute-rdl', 'Romanian deadlift', 'glutes', 'Glutes', 'Barbell', 'strength'),
  ex('glute-cable-kickback', 'Cable kickback', 'glutes', 'Glutes', 'Cable', 'strength'),
  ex('glute-step-up', 'Step-up', 'glutes', 'Glutes', 'Dumbbell', 'strength'),
  ex('glute-curtsy-lunge', 'Curtsy lunge', 'glutes', 'Glutes', 'Bodyweight', 'strength'),
  ex('glute-frog-pump', 'Frog pump', 'glutes', 'Glutes', 'Bodyweight', 'strength'),
  ex('glute-clamshell', 'Banded clamshell', 'glutes', 'Glutes', 'Band', 'strength'),
  ex('glute-sumo-deadlift', 'Sumo deadlift', 'glutes', 'Glutes', 'Barbell', 'strength'),

  // Legs
  ex('legs-back-squat', 'Back squat', 'legs', 'Quads', 'Barbell', 'strength'),
  ex('legs-front-squat', 'Front squat', 'legs', 'Quads', 'Barbell', 'strength'),
  ex('legs-goblet-squat', 'Goblet squat', 'legs', 'Quads', 'Dumbbell', 'strength'),
  ex('legs-leg-press', 'Leg press', 'legs', 'Quads', 'Machine', 'strength'),
  ex('legs-walking-lunge', 'Walking lunge', 'legs', 'Legs', 'Dumbbell', 'strength'),
  ex('legs-leg-extension', 'Leg extension', 'legs', 'Quads', 'Machine', 'strength'),
  ex('legs-leg-curl', 'Leg curl', 'legs', 'Hamstrings', 'Machine', 'strength'),
  ex('legs-calf-raise', 'Calf raise', 'legs', 'Calves', 'Machine', 'strength'),
  ex('legs-box-squat', 'Box squat', 'legs', 'Quads', 'Barbell', 'strength'),
  ex('legs-wall-sit', 'Wall sit', 'legs', 'Quads', 'Bodyweight', 'strength'),

  // Full body
  ex('fb-burpee', 'Burpee', 'fullBody', 'Full body', 'Bodyweight', 'cardio', 'bolt.fill'),
  ex('fb-kb-swing', 'Kettlebell swing', 'fullBody', 'Full body', 'Kettlebell', 'strength'),
  ex('fb-clean-press', 'Clean and press', 'fullBody', 'Full body', 'Barbell', 'strength'),
  ex('fb-thruster', 'Thruster', 'fullBody', 'Full body', 'Barbell', 'strength'),
  ex('fb-devils-press', "Devil's press", 'fullBody', 'Full body', 'Dumbbell', 'strength'),
  ex('fb-turkish-get-up', 'Turkish get-up', 'fullBody', 'Full body', 'Kettlebell', 'strength'),
  ex('fb-bear-crawl', 'Bear crawl', 'fullBody', 'Full body', 'Bodyweight', 'cardio', 'bolt.fill'),
  ex('fb-man-maker', 'Man maker', 'fullBody', 'Full body', 'Dumbbell', 'strength'),
  ex('fb-wall-ball', 'Wall ball', 'fullBody', 'Full body', 'Medicine ball', 'strength'),
  ex('fb-sled-push', 'Sled push', 'fullBody', 'Full body', 'Sled', 'cardio', 'bolt.fill'),

  // Cardio
  ex('cardio-treadmill-run', 'Treadmill run', 'cardio', 'Full body', 'Treadmill', 'cardio'),
  ex('cardio-incline-walk', 'Incline walk', 'cardio', 'Legs', 'Treadmill', 'cardio', 'figure.walk'),
  ex('cardio-rower', 'Zone 2 rower', 'cardio', 'Full body', 'Rower', 'cardio'),
  ex('cardio-assault-bike', 'Assault bike', 'cardio', 'Full body', 'Air bike', 'cardio', 'bicycle'),
  ex('cardio-cycling', 'Stationary cycling', 'cardio', 'Legs', 'Bike', 'cardio', 'bicycle'),
  ex('cardio-jump-rope', 'Jump rope', 'cardio', 'Full body', 'Rope', 'cardio', 'bolt.fill'),
  ex('cardio-stair-climber', 'Stair climber', 'cardio', 'Legs', 'Machine', 'cardio', 'figure.walk'),
  ex('cardio-elliptical', 'Elliptical', 'cardio', 'Full body', 'Machine', 'cardio'),
  ex('cardio-swim', 'Swimming', 'cardio', 'Full body', 'Pool', 'cardio', 'figure.pool.swim'),
  ex('cardio-shadow-box', 'Shadow boxing', 'cardio', 'Full body', 'None', 'cardio', 'bolt.fill'),

  // Mobility
  ex('mob-90-90', '90/90 hip flow', 'mobility', 'Hips', 'Bodyweight', 'mobility'),
  ex('mob-thoracic-rotations', 'Thoracic rotations', 'mobility', 'Upper back', 'Bodyweight', 'mobility'),
  ex('mob-cat-camel', 'Cat-camel', 'mobility', 'Spine', 'Bodyweight', 'mobility'),
  ex('mob-worlds-greatest', "World's greatest stretch", 'mobility', 'Full body', 'Bodyweight', 'mobility'),
  ex('mob-hip-flexor', 'Hip flexor stretch', 'mobility', 'Hips', 'Bodyweight', 'mobility'),
  ex('mob-shoulder-dislocates', 'Shoulder dislocates', 'mobility', 'Shoulders', 'Band', 'mobility'),
  ex('mob-ankle-rocks', 'Ankle rocks', 'mobility', 'Ankles', 'Bodyweight', 'mobility'),
  ex('mob-couch-stretch', 'Couch stretch', 'mobility', 'Hips', 'Bodyweight', 'mobility'),
  ex('mob-deep-squat-hold', 'Deep squat hold', 'mobility', 'Hips', 'Bodyweight', 'mobility'),
  ex('mob-downward-dog', 'Downward dog', 'mobility', 'Full body', 'Bodyweight', 'mobility'),

  // Recovery
  ex('rec-box-breathing', 'Box breathing', 'recovery', 'Nervous system', 'None', 'recovery', 'wind'),
  ex('rec-foam-roll-quads', 'Foam roll · quads', 'recovery', 'Legs', 'Foam roller', 'recovery', 'drop.fill'),
  ex('rec-foam-roll-back', 'Foam roll · back', 'recovery', 'Back', 'Foam roller', 'recovery', 'drop.fill'),
  ex('rec-diaphragmatic', 'Diaphragmatic breathing', 'recovery', 'Nervous system', 'None', 'recovery', 'lungs.fill'),
  ex('rec-legs-up-wall', 'Legs up the wall', 'recovery', 'Legs', 'None', 'recovery'),
  ex('rec-childs-pose', "Child's pose", 'recovery', 'Back', 'Bodyweight', 'recovery'),
  ex('rec-foam-roll-calf', 'Foam roll · calves', 'recovery', 'Calves', 'Foam roller', 'recovery', 'drop.fill'),
  ex('rec-body-scan', 'Guided body scan', 'recovery', 'Nervous system', 'None', 'recovery', 'wind'),
  ex('rec-neck-release', 'Neck release', 'recovery', 'Neck', 'None', 'recovery'),
  ex('rec-pigeon-pose', 'Pigeon pose', 'recovery', 'Hips', 'Bodyweight', 'recovery'),
]

export const EXERCISES_BY_GROUP: Record<BodyGroup, ExerciseEntry[]> =
  BODY_GROUPS.reduce(
    (acc, g) => {
      acc[g.id] = CATALOG_EXERCISES.filter((e) => e.group === g.id)
      return acc
    },
    {} as Record<BodyGroup, ExerciseEntry[]>,
  )

let idCounter = 0
function makeExerciseId(): string {
  idCounter += 1
  return `exercise-${Date.now().toString(36)}-${idCounter.toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 6)}`
}

function trackingFor(modality: string): ExercisePlan['trackingMetric'] {
  switch (modality) {
    case 'cardio':
      return 'distance'
    case 'mobility':
      return 'duration'
    case 'recovery':
      return 'breath'
    default:
      return 'weight_reps'
  }
}

// Map a hand-picked library entry onto a full ExercisePlan with sensible
// defaults. Mirrors createCustomSession on the backend so the build-your-own
// flow and the in-session swap produce identical-feeling exercises.
export function libraryEntryToExercisePlan(entry: {
  id?: string
  name: string
  bodyPart: string
  modality: string
  equipment: string
}): ExercisePlan {
  const isStrength = entry.modality === 'strength'
  return {
    id: makeExerciseId(),
    catalogId: entry.id,
    name: entry.name,
    bodyPart: entry.bodyPart,
    modality: entry.modality,
    instructions: 'Move with control and stop if anything sharp shows up.',
    equipment: entry.equipment ? [entry.equipment] : [],
    targetSets: 3,
    targetReps: isStrength ? [8, 10, 12] : [10],
    tempo: isStrength ? '2-0-2' : 'controlled',
    restSec: isStrength ? 75 : 45,
    durationMin: isStrength ? undefined : 5,
    cues: [],
    trackingMetric: trackingFor(entry.modality),
  }
}
