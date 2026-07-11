import type { Id } from '@/convex/_generated/dataModel'

export type ProfileCard = {
  userId: string
  username: string
  displayName: string
  avatarUrl: string | null
  isPrivate: boolean
  streakWeeks: number
}

export type PostWorkout = {
  title: string
  modality: string
  trainingEnvironment?: 'home' | 'gym' | 'outdoors' | 'travel'
  durationMin: number | null
  totalVolumeKg: number
  totalReps: number
  totalDistanceM: number
  exercisesCompleted: number
  workingSets: number
  avgRpe: number | null
  bodyParts: string[]
  highlights: {
    exerciseName: string
    kind: string
    value: number
    unit: string
    isFirstTime: boolean
  }[]
  dateMs: number
}

export type ReactionKind = 'cheer' | 'fire' | 'strong' | 'clap'

export type OriginalPost = {
  _id: Id<'posts'>
  author: ProfileCard | null
  caption: string | null
  photoUrls: string[]
  workout: PostWorkout | null
  createdAt: number
}

export type FeedPost = {
  _id: Id<'posts'>
  type: 'workout' | 'repost'
  author: ProfileCard | null
  caption: string | null
  photoUrls: string[]
  workout: PostWorkout | null
  tracks: { name: string; artist: string; uri?: string }[] | null
  visibility: 'public' | 'backers'
  communityId: Id<'communities'> | null
  cheerCounts: Record<string, number>
  commentCount: number
  repostCount: number
  triedCount: number
  myReaction: string | null
  createdAt: number
  original: OriginalPost | null
}

export type WorkoutSetDetail = {
  setIndex: number
  weightKg: number | null
  reps: number | null
  rpe: number | null
  durationSec: number | null
  distanceM: number | null
  isWarmup: boolean
}

export type WorkoutExerciseDetail = {
  id: string
  name: string
  bodyPart: string
  modality: string
  targetSets: number
  trackingMetric: string
  sets: WorkoutSetDetail[]
}

export const REACTION_META: Record<
  ReactionKind,
  { emoji: string; label: string }
> = {
  cheer: { emoji: '\u{1F4AA}', label: 'Cheer' },
  fire: { emoji: '\u{1F525}', label: 'Fire' },
  strong: { emoji: '\u{1F3CB}\uFE0F', label: 'Strong' },
  clap: { emoji: '\u{1F44F}', label: 'Clap' },
}

export const REACTION_ORDER: ReactionKind[] = [
  'cheer',
  'fire',
  'strong',
  'clap',
]
