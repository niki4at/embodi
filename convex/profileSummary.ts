import { v } from 'convex/values'

import type { Doc } from './_generated/dataModel'
import { query, type QueryCtx } from './_generated/server'
import { getProfileByUserId } from './socialHelpers'
import {
  DEFAULT_WEEKLY_GOAL,
  normalizeRow,
  startOfIsoWeek,
} from './streaks'

/*
 * Aggregated data for the Profile tab. One query feeds the whole overview so
 * the screen holds a single subscription instead of one per card; the
 * monthly heatmap is a second, range-bounded query because its window
 * changes as the user swipes between months.
 */

/** How many recent sessions we scan for lifetime/aggregate stats. */
const STATS_SESSION_CAP = 500
/** Max completed sessions returned for one heatmap month. */
const MONTH_SESSION_CAP = 150

function actualDurationMin(session: Doc<'workout_sessions'>): number {
  if (session.startedAt && session.completedAt) {
    const minutes = Math.round((session.completedAt - session.startedAt) / 60000)
    if (minutes > 0 && minutes <= 24 * 60) return minutes
  }
  return session.durationMin
}

async function sumSetTotals(
  ctx: QueryCtx,
  sessionId: Doc<'workout_sessions'>['_id']
): Promise<{ volumeKg: number; distanceM: number; setsLogged: number }> {
  const sets = await ctx.db
    .query('workout_sets')
    .withIndex('by_sessionId', (q) => q.eq('sessionId', sessionId))
    .collect()
  let volumeKg = 0
  let distanceM = 0
  for (const set of sets) {
    const isWarmup = set.isWarmup === true || set.setType === 'warmup'
    if (!isWarmup && set.weightKg && set.reps) {
      volumeKg += set.weightKg * set.reps
    }
    if (set.distanceM) {
      distanceM += set.distanceM
    }
  }
  return { volumeKg, distanceM, setsLogged: sets.length }
}

const recentWorkoutValidator = v.object({
  _id: v.id('workout_sessions'),
  goal: v.string(),
  modality: v.string(),
  durationMin: v.number(),
  setsLogged: v.number(),
  completedAt: v.number(),
})

const routineSummaryValidator = v.object({
  _id: v.id('workout_routines'),
  name: v.string(),
  modality: v.string(),
  durationMin: v.number(),
  exerciseCount: v.number(),
})

const postPreviewValidator = v.object({
  _id: v.id('posts'),
  photoUrl: v.union(v.string(), v.null()),
  title: v.string(),
  createdAt: v.number(),
})

export const getProfileOverview = query({
  args: { now: v.number() },
  returns: v.object({
    profile: v.union(
      v.null(),
      v.object({
        username: v.string(),
        displayName: v.string(),
        bio: v.union(v.string(), v.null()),
        avatarUrl: v.union(v.string(), v.null()),
        isPrivate: v.boolean(),
        backerCount: v.number(),
        backingCount: v.number(),
        postCount: v.number(),
      })
    ),
    name: v.union(v.string(), v.null()),
    stats: v.object({
      totalWorkouts: v.number(),
      minutesThisMonth: v.number(),
      streakWeeks: v.number(),
      weeklyGoal: v.number(),
      workoutsThisWeek: v.number(),
      goalMetThisWeek: v.boolean(),
    }),
    currentFocus: v.union(
      v.null(),
      v.object({
        _id: v.id('challenges'),
        title: v.string(),
        category: v.string(),
        targetDate: v.union(v.number(), v.null()),
        weekCount: v.number(),
      })
    ),
    recentWorkouts: v.array(recentWorkoutValidator),
    routines: v.array(routineSummaryValidator),
    posts: v.array(postPreviewValidator),
  }),
  handler: async (ctx, { now }) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      return {
        profile: null,
        name: null,
        stats: {
          totalWorkouts: 0,
          minutesThisMonth: 0,
          streakWeeks: 0,
          weeklyGoal: DEFAULT_WEEKLY_GOAL,
          workoutsThisWeek: 0,
          goalMetThisWeek: false,
        },
        currentFocus: null,
        recentWorkouts: [],
        routines: [],
        posts: [],
      }
    }
    const userId = identity.subject

    const profileDoc = await getProfileByUserId(ctx, userId)
    const profile = profileDoc
      ? {
          username: profileDoc.username,
          displayName: profileDoc.displayName,
          bio: profileDoc.bio ?? null,
          avatarUrl: profileDoc.avatarStorageId
            ? await ctx.storage.getUrl(profileDoc.avatarStorageId)
            : null,
          isPrivate: profileDoc.isPrivate,
          backerCount: profileDoc.backerCount,
          backingCount: profileDoc.backingCount,
          postCount: profileDoc.postCount,
        }
      : null

    const onboarding = await ctx.db
      .query('onboarding')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()

    // Lifetime + this-month training stats from recent completed sessions.
    const completed = await ctx.db
      .query('workout_sessions')
      .withIndex('by_user_status', (q) =>
        q.eq('userId', userId).eq('status', 'completed')
      )
      .order('desc')
      .take(STATS_SESSION_CAP)

    const monthStart = new Date(now)
    monthStart.setUTCDate(1)
    monthStart.setUTCHours(0, 0, 0, 0)
    const monthStartMs = monthStart.getTime()

    let minutesThisMonth = 0
    for (const session of completed) {
      const finishedAt = session.completedAt ?? session.updatedAt
      if (finishedAt >= monthStartMs) {
        minutesThisMonth += actualDurationMin(session)
      }
    }

    const streakRow = await ctx.db
      .query('streaks')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .unique()
    const streak = streakRow ? normalizeRow(streakRow, now) : null

    const activeChallenge = await ctx.db
      .query('challenges')
      .withIndex('by_user_status', (q) =>
        q.eq('userId', userId).eq('status', 'active')
      )
      .order('desc')
      .first()

    const recentWorkouts = await Promise.all(
      completed.slice(0, 3).map(async (session) => {
        const { setsLogged } = await sumSetTotals(ctx, session._id)
        return {
          _id: session._id,
          goal: session.goal,
          modality: session.modality,
          durationMin: actualDurationMin(session),
          setsLogged,
          completedAt: session.completedAt ?? session.updatedAt,
        }
      })
    )

    const routines = (
      await ctx.db
        .query('workout_routines')
        .withIndex('by_userId', (q) => q.eq('userId', userId))
        .order('desc')
        .take(6)
    ).map((routine) => ({
      _id: routine._id,
      name: routine.name,
      modality: routine.modality,
      durationMin: routine.durationMin,
      exerciseCount: routine.plan.length,
    }))

    const posts = await Promise.all(
      (
        await ctx.db
          .query('posts')
          .withIndex('by_author_and_createdAt', (q) => q.eq('authorId', userId))
          .order('desc')
          .take(6)
      ).map(async (post) => ({
        _id: post._id,
        photoUrl:
          post.photoStorageIds.length > 0
            ? await ctx.storage.getUrl(post.photoStorageIds[0])
            : null,
        title: post.workout?.title ?? post.caption ?? 'Post',
        createdAt: post.createdAt,
      }))
    )

    return {
      profile,
      name: onboarding?.name ?? null,
      stats: {
        // Cap hit: show the cap rather than pretend it's exact.
        totalWorkouts: completed.length,
        minutesThisMonth,
        streakWeeks: streak?.currentStreakWeeks ?? 0,
        weeklyGoal: streak?.weeklyGoal ?? DEFAULT_WEEKLY_GOAL,
        workoutsThisWeek: streak?.workoutsThisWeek ?? 0,
        goalMetThisWeek: streak?.goalMetThisWeek ?? false,
      },
      currentFocus: activeChallenge
        ? {
            _id: activeChallenge._id,
            title: activeChallenge.title,
            category: activeChallenge.category,
            targetDate: activeChallenge.targetDate ?? null,
            weekCount: activeChallenge.program?.weeks.length ?? 0,
          }
        : null,
      recentWorkouts,
      routines,
      posts,
    }
  },
})

const monthlySessionValidator = v.object({
  completedAt: v.number(),
  durationMin: v.number(),
  volumeKg: v.number(),
  distanceM: v.number(),
})

/**
 * Completed sessions inside [rangeStartMs, rangeEndMs), newest first, with
 * per-session totals for the heatmap metrics. The client groups them into
 * local calendar days (server can't know the device timezone).
 */
export const getMonthlyActivity = query({
  args: {
    rangeStartMs: v.number(),
    rangeEndMs: v.number(),
  },
  returns: v.array(monthlySessionValidator),
  handler: async (ctx, { rangeStartMs, rangeEndMs }) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return []
    if (rangeEndMs <= rangeStartMs) return []

    const completed = await ctx.db
      .query('workout_sessions')
      .withIndex('by_user_status', (q) =>
        q.eq('userId', identity.subject).eq('status', 'completed')
      )
      .order('desc')
      .take(STATS_SESSION_CAP)

    const inRange = completed
      .filter((session) => {
        const finishedAt = session.completedAt ?? session.updatedAt
        return finishedAt >= rangeStartMs && finishedAt < rangeEndMs
      })
      .slice(0, MONTH_SESSION_CAP)

    return await Promise.all(
      inRange.map(async (session) => {
        const { volumeKg, distanceM } = await sumSetTotals(ctx, session._id)
        return {
          completedAt: session.completedAt ?? session.updatedAt,
          durationMin: actualDurationMin(session),
          volumeKg,
          distanceM,
        }
      })
    )
  },
})
