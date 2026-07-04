import type { Id } from '@/convex/_generated/dataModel'

export type ProfileCard = {
  userId: string
  username: string
  displayName: string
  avatarUrl: string | null
  isPrivate: boolean
}

export type PostWorkout = {
  title: string
  modality: string
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
  myReaction: string | null
  createdAt: number
  original: OriginalPost | null
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
