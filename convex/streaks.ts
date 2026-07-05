import { v } from 'convex/values'

import type { Doc } from './_generated/dataModel'
import {
  internalMutation,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from './_generated/server'
import { internal } from './_generated/api'

/*
 * Weekly workout streaks. A streak is the number of consecutive weeks the
 * user hit their personal weekly workout goal (default 3 workouts/week).
 * The current week keeps the streak alive even before its goal is met; the
 * streak only breaks once a full week passes without hitting the goal.
 */

const WEEK_MS = 7 * 24 * 60 * 60 * 1000
export const DEFAULT_WEEKLY_GOAL = 3
// How far back we scan completed sessions when creating a streak row for a
// user who trained before streaks shipped.
const BACKFILL_SESSION_CAP = 200
const HISTORY_WEEKS = 12

/** Monday 00:00 UTC of the week containing ts (matches weeklyInsights). */
function startOfIsoWeek(ts: number): number {
  const d = new Date(ts)
  d.setUTCHours(0, 0, 0, 0)
  const day = d.getUTCDay()
  const diff = (day + 6) % 7 // 0 (Mon) .. 6 (Sun)
  d.setUTCDate(d.getUTCDate() - diff)
  return d.getTime()
}

type StreakSnapshot = {
  weeklyGoal: number
  currentStreakWeeks: number
  longestStreakWeeks: number
  weekStartMs: number
  workoutsThisWeek: number
  goalMetThisWeek: boolean
}

/**
 * Project a stored row onto the week containing `now`. A row can be stale if
 * the user hasn't trained (or the cron hasn't run) since the week rolled
 * over: the current-week counters reset and a missed week kills the streak.
 */
function normalizeRow(row: Doc<'streaks'>, now: number): StreakSnapshot {
  const thisWeek = startOfIsoWeek(now)
  if (row.weekStartMs >= thisWeek) {
    return {
      weeklyGoal: row.weeklyGoal,
      currentStreakWeeks: row.currentStreakWeeks,
      longestStreakWeeks: row.longestStreakWeeks,
      weekStartMs: row.weekStartMs,
      workoutsThisWeek: row.workoutsThisWeek,
      goalMetThisWeek: row.goalMetThisWeek,
    }
  }
  const elapsedWeeks = Math.round((thisWeek - row.weekStartMs) / WEEK_MS)
  const survives = elapsedWeeks === 1 && row.goalMetThisWeek
  return {
    weeklyGoal: row.weeklyGoal,
    currentStreakWeeks: survives ? row.currentStreakWeeks : 0,
    longestStreakWeeks: row.longestStreakWeeks,
    weekStartMs: thisWeek,
    workoutsThisWeek: 0,
    goalMetThisWeek: false,
  }
}

/** Per-week completed-workout counts from the user's session history. */
async function collectWeeklyCounts(
  ctx: QueryCtx | MutationCtx,
  userId: string
): Promise<Map<number, number>> {
  const sessions = await ctx.db
    .query('workout_sessions')
    .withIndex('by_user_status', (q) =>
      q.eq('userId', userId).eq('status', 'completed')
    )
    .order('desc')
    .take(BACKFILL_SESSION_CAP)

  const counts = new Map<number, number>()
  for (const session of sessions) {
    const ts = session.completedAt ?? session.updatedAt
    const week = startOfIsoWeek(ts)
    counts.set(week, (counts.get(week) ?? 0) + 1)
  }
  return counts
}

/** Rebuild a full streak snapshot from session history. */
function snapshotFromCounts(
  counts: Map<number, number>,
  weeklyGoal: number,
  now: number
): StreakSnapshot {
  const thisWeek = startOfIsoWeek(now)
  const workoutsThisWeek = counts.get(thisWeek) ?? 0
  const goalMetThisWeek = workoutsThisWeek >= weeklyGoal

  // Current streak: walk backwards from this week (if met) or last week.
  let currentStreakWeeks = 0
  let cursor = goalMetThisWeek ? thisWeek : thisWeek - WEEK_MS
  while ((counts.get(cursor) ?? 0) >= weeklyGoal) {
    currentStreakWeeks += 1
    cursor -= WEEK_MS
  }

  // Longest streak across the scanned history.
  let longestStreakWeeks = currentStreakWeeks
  const metWeeks = Array.from(counts.entries())
    .filter(([, count]) => count >= weeklyGoal)
    .map(([week]) => week)
    .sort((a, b) => a - b)
  let run = 0
  let prev: number | null = null
  for (const week of metWeeks) {
    run = prev != null && week - prev === WEEK_MS ? run + 1 : 1
    if (run > longestStreakWeeks) longestStreakWeeks = run
    prev = week
  }

  return {
    weeklyGoal,
    currentStreakWeeks,
    longestStreakWeeks,
    weekStartMs: thisWeek,
    workoutsThisWeek,
    goalMetThisWeek,
  }
}

async function getStreakRow(
  ctx: QueryCtx | MutationCtx,
  userId: string
): Promise<Doc<'streaks'> | null> {
  return await ctx.db
    .query('streaks')
    .withIndex('by_userId', (q) => q.eq('userId', userId))
    .unique()
}

/**
 * Create-or-refresh the row so it reflects the week containing `now`.
 * `justBackfilled` is true when the row was rebuilt from session history,
 * meaning any session completed earlier in this transaction is already
 * counted.
 */
async function ensureStreakRow(
  ctx: MutationCtx,
  userId: string,
  now: number
): Promise<{ row: Doc<'streaks'>; justBackfilled: boolean }> {
  const existing = await getStreakRow(ctx, userId)
  if (existing) {
    const normalized = normalizeRow(existing, now)
    if (normalized.weekStartMs !== existing.weekStartMs) {
      await ctx.db.patch(existing._id, {
        currentStreakWeeks: normalized.currentStreakWeeks,
        weekStartMs: normalized.weekStartMs,
        workoutsThisWeek: normalized.workoutsThisWeek,
        goalMetThisWeek: normalized.goalMetThisWeek,
        updatedAt: now,
      })
      return { row: (await ctx.db.get(existing._id))!, justBackfilled: false }
    }
    return { row: existing, justBackfilled: false }
  }

  const counts = await collectWeeklyCounts(ctx, userId)
  const snapshot = snapshotFromCounts(counts, DEFAULT_WEEKLY_GOAL, now)
  const id = await ctx.db.insert('streaks', {
    userId,
    weeklyGoal: snapshot.weeklyGoal,
    currentStreakWeeks: snapshot.currentStreakWeeks,
    longestStreakWeeks: snapshot.longestStreakWeeks,
    weekStartMs: snapshot.weekStartMs,
    workoutsThisWeek: snapshot.workoutsThisWeek,
    goalMetThisWeek: snapshot.goalMetThisWeek,
    updatedAt: now,
  })
  return { row: (await ctx.db.get(id))!, justBackfilled: true }
}

export type WorkoutStreakResult = {
  weeklyGoal: number
  currentStreakWeeks: number
  longestStreakWeeks: number
  workoutsThisWeek: number
  goalMetThisWeek: boolean
  /** True when this workout pushed the week over the goal (celebrate!). */
  streakIncremented: boolean
}

/**
 * Fold one completed workout into the user's streak. Called inline from the
 * session-completion mutations so the result can reach the recap screen.
 */
export async function applyWorkoutCompletion(
  ctx: MutationCtx,
  userId: string,
  now: number
): Promise<WorkoutStreakResult> {
  const { row, justBackfilled } = await ensureStreakRow(ctx, userId, now)

  // The backfill path rebuilds from session history, which already includes
  // the session completed earlier in this transaction — don't double count.
  let workoutsThisWeek = row.workoutsThisWeek
  if (!justBackfilled) {
    workoutsThisWeek += 1
  }

  let currentStreakWeeks = row.currentStreakWeeks
  let longestStreakWeeks = row.longestStreakWeeks
  let goalMetThisWeek = row.goalMetThisWeek
  let streakIncremented = false

  if (!goalMetThisWeek && workoutsThisWeek >= row.weeklyGoal) {
    goalMetThisWeek = true
    currentStreakWeeks += 1
    streakIncremented = true
    if (currentStreakWeeks > longestStreakWeeks) {
      longestStreakWeeks = currentStreakWeeks
    }
  } else if (
    justBackfilled &&
    goalMetThisWeek &&
    workoutsThisWeek === row.weeklyGoal
  ) {
    // First workout after streaks shipped happened to complete the week.
    streakIncremented = true
  }

  await ctx.db.patch(row._id, {
    workoutsThisWeek,
    currentStreakWeeks,
    longestStreakWeeks,
    goalMetThisWeek,
    updatedAt: now,
  })

  return {
    weeklyGoal: row.weeklyGoal,
    currentStreakWeeks,
    longestStreakWeeks,
    workoutsThisWeek,
    goalMetThisWeek,
    streakIncremented,
  }
}

/** Display streak for a set of users (feed cards, leaderboard, profiles). */
export async function getStreakWeeksForUsers(
  ctx: QueryCtx | MutationCtx,
  userIds: string[]
): Promise<Map<string, number>> {
  const unique = Array.from(new Set(userIds))
  const map = new Map<string, number>()
  await Promise.all(
    unique.map(async (userId) => {
      const row = await getStreakRow(ctx, userId)
      if (row) map.set(userId, row.currentStreakWeeks)
    })
  )
  return map
}

/** This-week workout counts + streaks for a set of users (leaderboard). */
export async function getWeeklyActivityForUsers(
  ctx: QueryCtx | MutationCtx,
  userIds: string[],
  now: number
): Promise<Map<string, { workoutsThisWeek: number; streakWeeks: number }>> {
  const unique = Array.from(new Set(userIds))
  const map = new Map<string, { workoutsThisWeek: number; streakWeeks: number }>()
  await Promise.all(
    unique.map(async (userId) => {
      const row = await getStreakRow(ctx, userId)
      if (!row) return
      const snapshot = normalizeRow(row, now)
      map.set(userId, {
        workoutsThisWeek: snapshot.workoutsThisWeek,
        streakWeeks: snapshot.currentStreakWeeks,
      })
    })
  )
  return map
}

const weekHistoryValidator = v.array(
  v.object({
    weekStartMs: v.number(),
    count: v.number(),
    goalMet: v.boolean(),
  })
)

export const getMyStreak = query({
  args: { now: v.number() },
  returns: v.union(
    v.null(),
    v.object({
      weeklyGoal: v.number(),
      currentStreakWeeks: v.number(),
      longestStreakWeeks: v.number(),
      weekStartMs: v.number(),
      workoutsThisWeek: v.number(),
      goalMetThisWeek: v.boolean(),
      recentWeeks: weekHistoryValidator,
    })
  ),
  handler: async (ctx, { now }) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return null

    const row = await getStreakRow(ctx, identity.subject)
    const counts = await collectWeeklyCounts(ctx, identity.subject)
    const weeklyGoal = row?.weeklyGoal ?? DEFAULT_WEEKLY_GOAL
    const snapshot = row
      ? normalizeRow(row, now)
      : snapshotFromCounts(counts, weeklyGoal, now)

    const thisWeek = startOfIsoWeek(now)
    const recentWeeks: { weekStartMs: number; count: number; goalMet: boolean }[] =
      []
    for (let i = HISTORY_WEEKS - 1; i >= 0; i -= 1) {
      const weekStartMs = thisWeek - i * WEEK_MS
      const count =
        weekStartMs === snapshot.weekStartMs
          ? Math.max(snapshot.workoutsThisWeek, counts.get(weekStartMs) ?? 0)
          : (counts.get(weekStartMs) ?? 0)
      recentWeeks.push({
        weekStartMs,
        count,
        goalMet: count >= weeklyGoal,
      })
    }

    return {
      weeklyGoal: snapshot.weeklyGoal,
      currentStreakWeeks: snapshot.currentStreakWeeks,
      longestStreakWeeks: snapshot.longestStreakWeeks,
      weekStartMs: snapshot.weekStartMs,
      workoutsThisWeek: snapshot.workoutsThisWeek,
      goalMetThisWeek: snapshot.goalMetThisWeek,
      recentWeeks,
    }
  },
})

/** Backfill/refresh the caller's streak row (home screen bootstrap). */
export const ensureStreak = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Not authenticated')
    await ensureStreakRow(ctx, identity.subject, Date.now())
    return null
  },
})

export const setWeeklyGoal = mutation({
  args: { goal: v.number() },
  returns: v.null(),
  handler: async (ctx, { goal }) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Not authenticated')
    const clamped = Math.min(7, Math.max(1, Math.round(goal)))

    const now = Date.now()
    const { row } = await ensureStreakRow(ctx, identity.subject, now)

    // Lowering the goal below what's already logged this week can complete
    // the week on the spot.
    let { currentStreakWeeks, longestStreakWeeks, goalMetThisWeek } = row
    if (!goalMetThisWeek && row.workoutsThisWeek >= clamped) {
      goalMetThisWeek = true
      currentStreakWeeks += 1
      if (currentStreakWeeks > longestStreakWeeks) {
        longestStreakWeeks = currentStreakWeeks
      }
    }

    await ctx.db.patch(row._id, {
      weeklyGoal: clamped,
      currentStreakWeeks,
      longestStreakWeeks,
      goalMetThisWeek,
      updatedAt: now,
    })
    return null
  },
})

/**
 * Weekly cron (Monday just after midnight UTC): roll every row into the new
 * week so lapsed streaks read as 0 everywhere without per-read normalization.
 * Processes in pages and reschedules itself until done.
 */
export const finalizeLapsedStreaks = internalMutation({
  args: { cursor: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, { cursor }) => {
    const now = Date.now()
    const thisWeek = startOfIsoWeek(now)

    const page = await ctx.db.query('streaks').paginate({
      numItems: 200,
      cursor: cursor ?? null,
    })

    for (const row of page.page) {
      if (row.weekStartMs >= thisWeek) continue
      const normalized = normalizeRow(row, now)
      await ctx.db.patch(row._id, {
        currentStreakWeeks: normalized.currentStreakWeeks,
        weekStartMs: normalized.weekStartMs,
        workoutsThisWeek: normalized.workoutsThisWeek,
        goalMetThisWeek: normalized.goalMetThisWeek,
        updatedAt: now,
      })
    }

    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, internal.streaks.finalizeLapsedStreaks, {
        cursor: page.continueCursor,
      })
    }
    return null
  },
})
