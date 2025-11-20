import { Id } from '@/convex/_generated/dataModel'

export type TrackingMetric =
  | 'weight_reps'
  | 'duration'
  | 'distance'
  | 'breath'
  | 'custom'

export type Citation = {
  id: string
  title: string
  authors: string[]
  year: number
  source: string
  url: string
  doi?: string
  summary?: string
}

export type Fact = {
  text: string
  citations: Citation[]
}

export type ExercisePlan = {
  id: string
  name: string
  bodyPart: string
  modality: string
  instructions: string
  equipment: string[]
  targetSets: number
  targetReps: number[]
  tempo: string
  restSec: number
  durationMin?: number
  intensityCue?: string
  contraindications?: string[]
  cues: string[]
  trackingMetric: TrackingMetric
}

export type WorkoutSet = {
  _id: Id<'workout_sets'>
  sessionId: Id<'workout_sessions'>
  exerciseId: string
  setIndex: number
  weightKg?: number
  reps?: number
  rpe?: number
  durationSec?: number
  distanceM?: number
  notes?: string
  completedAt: number
  _creationTime: number
}

export type CoachComment = {
  id: string
  text: string
  trigger:
    | 'session_start'
    | 'before_set'
    | 'after_set'
    | 'mid_session'
    | 'session_end'
  exerciseId?: string
  delaySec?: number
}
