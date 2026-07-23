import { v } from 'convex/values'

import { internalMutation, query } from './_generated/server'
import { canViewContent, getProfileByUsername } from './socialHelpers'
import { getSettingsForUser } from './userSettings'

/*
 * Deterministic, sourced achievements. Rules run after each completed workout
 * (scheduled from trainer completion paths) and only ever read bounded data.
 * Recovery milestones are private by default and reward rest and returning —
 * never exercising through pain.
 */

export type AchievementCategory =
  | 'consistency'
  | 'performance'
  | 'exploration'
  | 'challenges'
  | 'community'
  | 'recovery'

export type AchievementSourceType =
  | 'session'
  | 'streak'
  | 'challenge'
  | 'community'
  | 'profile'

export interface AchievementDefinition {
  key: string
  category: AchievementCategory
  title: string
  description: string
  sourceType: AchievementSourceType
  isPrivate: boolean
}

export const ACHIEVEMENT_DEFINITIONS: readonly AchievementDefinition[] = [
  // Consistency
  {
    key: 'first_workout',
    category: 'consistency',
    title: 'First movement',
    description: 'Completed your first session',
    sourceType: 'session',
    isPrivate: false,
  },
  {
    key: 'workouts_10',
    category: 'consistency',
    title: 'Ten sessions in',
    description: 'Completed 10 sessions',
    sourceType: 'session',
    isPrivate: false,
  },
  {
    key: 'workouts_50',
    category: 'consistency',
    title: 'Fifty strong',
    description: 'Completed 50 sessions',
    sourceType: 'session',
    isPrivate: false,
  },
  {
    key: 'workouts_100',
    category: 'consistency',
    title: 'Century club',
    description: 'Completed 100 sessions',
    sourceType: 'session',
    isPrivate: false,
  },
  {
    key: 'streak_4',
    category: 'consistency',
    title: 'One month rhythm',
    description: 'Hit your weekly goal 4 weeks in a row',
    sourceType: 'streak',
    isPrivate: false,
  },
  {
    key: 'streak_12',
    category: 'consistency',
    title: 'A season of showing up',
    description: 'Hit your weekly goal 12 weeks in a row',
    sourceType: 'streak',
    isPrivate: false,
  },
  // Performance
  {
    key: 'hour_session',
    category: 'performance',
    title: 'The long haul',
    description: 'Trained for 60+ minutes in one session',
    sourceType: 'session',
    isPrivate: false,
  },
  {
    key: 'volume_5000',
    category: 'performance',
    title: 'Heavy day',
    description: 'Moved 5,000 kg of volume in one session',
    sourceType: 'session',
    isPrivate: false,
  },
  {
    key: 'distance_10k',
    category: 'performance',
    title: 'Double digits',
    description: 'Covered 10 km in one session',
    sourceType: 'session',
    isPrivate: false,
  },
  // Exploration
  {
    key: 'modalities_3',
    category: 'exploration',
    title: 'Well rounded',
    description: 'Trained three different ways',
    sourceType: 'session',
    isPrivate: false,
  },
  {
    key: 'custom_builder',
    category: 'exploration',
    title: 'Your own blueprint',
    description: 'Completed a session you built yourself',
    sourceType: 'session',
    isPrivate: false,
  },
  // Challenges
  {
    key: 'challenge_complete',
    category: 'challenges',
    title: 'Challenge conquered',
    description: 'Completed a personal challenge',
    sourceType: 'challenge',
    isPrivate: false,
  },
  // Community
  {
    key: 'community_join',
    category: 'community',
    title: 'Better together',
    description: 'Joined a challenge community',
    sourceType: 'community',
    isPrivate: false,
  },
  {
    key: 'first_share',
    category: 'community',
    title: 'Out loud',
    description: 'Shared your first workout',
    sourceType: 'profile',
    isPrivate: false,
  },
  // Recovery (private by default)
  {
    key: 'comeback',
    category: 'recovery',
    title: 'The comeback',
    description: 'Returned to movement after two weeks away',
    sourceType: 'session',
    isPrivate: true,
  },
  {
    key: 'recovery_session',
    category: 'recovery',
    title: 'Rest is training',
    description: 'Completed a dedicated recovery session',
    sourceType: 'session',
    isPrivate: true,
  },
] as const

const DEFINITION_BY_KEY = new Map(
  ACHIEVEMENT_DEFINITIONS.map((definition) => [definition.key, definition])
)

/** Everything the rules need, gathered with bounded reads. */
export interface EvaluationFacts {
  /** Completed sessions, most recent first, capped at 101. */
  completedCount: number
  /** Modality of the just-completed session. */
  sessionModality: string
  sessionSource: 'custom' | 'coach' | null
  sessionDurationMin: number
  sessionVolumeKg: number
  sessionDistanceM: number
  /** Distinct modalities across recent completed sessions. */
  distinctModalities: number
  /** Gap in ms between this session and the previous completed one. */
  gapSincePreviousMs: number | null
  currentStreakWeeks: number
  hasCompletedChallenge: boolean
  hasJoinedCommunity: boolean
  postCount: number
}

/** Pure rule evaluation: returns the keys earned given the facts. */
export function earnedKeys(facts: EvaluationFacts): string[] {
  const keys: string[] = []
  if (facts.completedCount >= 1) keys.push('first_workout')
  if (facts.completedCount >= 10) keys.push('workouts_10')
  if (facts.completedCount >= 50) keys.push('workouts_50')
  if (facts.completedCount >= 100) keys.push('workouts_100')
  if (facts.currentStreakWeeks >= 4) keys.push('streak_4')
  if (facts.currentStreakWeeks >= 12) keys.push('streak_12')
  if (facts.sessionDurationMin >= 60) keys.push('hour_session')
  if (facts.sessionVolumeKg >= 5000) keys.push('volume_5000')
  if (facts.sessionDistanceM >= 10000) keys.push('distance_10k')
  if (facts.distinctModalities >= 3) keys.push('modalities_3')
  if (facts.sessionSource === 'custom') keys.push('custom_builder')
  if (facts.hasCompletedChallenge) keys.push('challenge_complete')
  if (facts.hasJoinedCommunity) keys.push('community_join')
  if (facts.postCount >= 1) keys.push('first_share')
  if (
    facts.gapSincePreviousMs !== null &&
    facts.gapSincePreviousMs >= 14 * 24 * 60 * 60 * 1000
  ) {
    keys.push('comeback')
  }
  if (facts.sessionModality.toLowerCase() === 'recovery') {
    keys.push('recovery_session')
  }
  return keys
}

/**
 * Evaluate all rules after a completed workout and insert any newly earned
 * achievements. Scheduled from the trainer completion paths.
 */
export const evaluateAfterCompletion = internalMutation({
  args: {
    userId: v.string(),
    sessionId: v.id('workout_sessions'),
  },
  returns: v.null(),
  handler: async (ctx, { userId, sessionId }) => {
    const session = await ctx.db.get(sessionId)
    if (!session || session.userId !== userId) return null
    if (session.status !== 'completed') return null

    // Bounded reads: enough recent sessions to satisfy the largest threshold.
    const recentCompleted = await ctx.db
      .query('workout_sessions')
      .withIndex('by_user_status', (q) =>
        q.eq('userId', userId).eq('status', 'completed')
      )
      .order('desc')
      .take(101)

    const sets = await ctx.db
      .query('workout_sets')
      .withIndex('by_sessionId', (q) => q.eq('sessionId', sessionId))
      .collect()

    let volumeKg = 0
    let distanceM = 0
    for (const set of sets) {
      if (set.isWarmup || set.setType === 'warmup') continue
      if (set.weightKg != null && set.reps != null) {
        volumeKg += set.weightKg * set.reps
      }
      if (set.distanceM != null) distanceM += set.distanceM
    }

    const others = recentCompleted.filter((row) => row._id !== sessionId)
    const completedAt = session.completedAt ?? Date.now()
    const previous = others
      .map((row) => row.completedAt ?? row.createdAt)
      .filter((time) => time < completedAt)
      .sort((a, b) => b - a)[0]

    const streak = await ctx.db
      .query('streaks')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .unique()

    const completedChallenge = await ctx.db
      .query('challenges')
      .withIndex('by_user_status', (q) =>
        q.eq('userId', userId).eq('status', 'completed')
      )
      .first()

    const membership = await ctx.db
      .query('community_members')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .first()

    const profile = await ctx.db
      .query('profiles')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .unique()

    const facts: EvaluationFacts = {
      completedCount: recentCompleted.length,
      sessionModality: session.modality,
      sessionSource: session.source ?? null,
      sessionDurationMin: session.durationMin,
      sessionVolumeKg: volumeKg,
      sessionDistanceM: distanceM,
      distinctModalities: new Set(
        recentCompleted.map((row) => row.modality.toLowerCase())
      ).size,
      gapSincePreviousMs: previous != null ? completedAt - previous : null,
      currentStreakWeeks: streak?.currentStreakWeeks ?? 0,
      hasCompletedChallenge: completedChallenge !== null,
      hasJoinedCommunity: membership !== null,
      postCount: profile?.postCount ?? 0,
    }

    const existing = await ctx.db
      .query('achievements')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .collect()
    const existingKeys = new Set(existing.map((row) => row.key))

    for (const key of earnedKeys(facts)) {
      if (existingKeys.has(key)) continue
      const definition = DEFINITION_BY_KEY.get(key)
      if (!definition) continue
      await ctx.db.insert('achievements', {
        userId,
        key,
        category: definition.category,
        title: definition.title,
        description: definition.description,
        earnedAt: completedAt,
        sourceType: definition.sourceType,
        sourceId:
          definition.sourceType === 'session' ? String(sessionId) : undefined,
        isPrivate: definition.isPrivate,
      })
    }
    return null
  },
})

const achievementValidator = v.object({
  _id: v.id('achievements'),
  key: v.string(),
  category: v.union(
    v.literal('consistency'),
    v.literal('performance'),
    v.literal('exploration'),
    v.literal('challenges'),
    v.literal('community'),
    v.literal('recovery')
  ),
  title: v.string(),
  description: v.string(),
  earnedAt: v.number(),
  sourceType: v.union(
    v.literal('session'),
    v.literal('streak'),
    v.literal('challenge'),
    v.literal('community'),
    v.literal('profile')
  ),
  isPrivate: v.boolean(),
})

/** The owner's achievements, newest first (private ones included). */
export const listMine = query({
  args: {},
  returns: v.array(achievementValidator),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return []

    const rows = await ctx.db
      .query('achievements')
      .withIndex('by_userId', (q) => q.eq('userId', identity.subject))
      .collect()

    return rows
      .sort((a, b) => b.earnedAt - a.earnedAt)
      .map((row) => ({
        _id: row._id,
        key: row.key,
        category: row.category,
        title: row.title,
        description: row.description,
        earnedAt: row.earnedAt,
        sourceType: row.sourceType,
        isPrivate: row.isPrivate,
      }))
  },
})

/**
 * Public achievements shown on someone's profile. Private milestones
 * (recovery) never leave the owner's own view, and the whole section
 * respects the owner's publicAchievements setting.
 */
export const listForProfile = query({
  args: {
    username: v.string(),
    previewAsPublic: v.optional(v.boolean()),
  },
  returns: v.array(achievementValidator),
  handler: async (ctx, { username, previewAsPublic }) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return []

    const profile = await getProfileByUsername(ctx, username)
    if (!profile) return []
    if (!(await canViewContent(ctx, identity.subject, profile))) return []

    const isMe = profile.userId === identity.subject && !previewAsPublic
    const settings = await getSettingsForUser(ctx, profile.userId)
    if (!isMe && !settings.publicAchievements) return []

    const rows = await ctx.db
      .query('achievements')
      .withIndex('by_userId', (q) => q.eq('userId', profile.userId))
      .collect()

    return rows
      .filter((row) => !row.isPrivate)
      .sort((a, b) => b.earnedAt - a.earnedAt)
      .slice(0, 30)
      .map((row) => ({
        _id: row._id,
        key: row.key,
        category: row.category,
        title: row.title,
        description: row.description,
        earnedAt: row.earnedAt,
        sourceType: row.sourceType,
        isPrivate: row.isPrivate,
      }))
  },
})
