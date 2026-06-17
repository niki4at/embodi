import { v } from 'convex/values'

import type { Doc, Id } from './_generated/dataModel'
import { internalQuery, query, type QueryCtx } from './_generated/server'

// Cap how far back we scan so the per-exercise lookups stay cheap even for
// users with long histories. 100 completed sessions is plenty for records.
const MAX_SESSIONS = 100

type TrackingMetric =
  | 'weight_reps'
  | 'duration'
  | 'distance'
  | 'breath'
  | 'custom'

type SetEntry = {
  setIndex: number
  weightKg?: number
  reps?: number
  rpe?: number
  durationSec?: number
  distanceM?: number
}

type HistoryEntry = {
  sessionId: Id<'workout_sessions'>
  performedAt: number
  sets: SetEntry[]
}

type ExerciseRecords = {
  totalSessions: number
  totalSets: number
  lastPerformedAt: number | null
  heaviestWeightKg: number | null
  bestSetVolumeKg: number | null
  estimatedOneRepMaxKg: number | null
  bestReps: number | null
  longestDurationSec: number | null
  farthestDistanceM: number | null
}

const recordsValidator = v.object({
  totalSessions: v.number(),
  totalSets: v.number(),
  lastPerformedAt: v.union(v.number(), v.null()),
  heaviestWeightKg: v.union(v.number(), v.null()),
  bestSetVolumeKg: v.union(v.number(), v.null()),
  estimatedOneRepMaxKg: v.union(v.number(), v.null()),
  bestReps: v.union(v.number(), v.null()),
  longestDurationSec: v.union(v.number(), v.null()),
  farthestDistanceM: v.union(v.number(), v.null()),
})

const setEntryValidator = v.object({
  setIndex: v.number(),
  weightKg: v.optional(v.number()),
  reps: v.optional(v.number()),
  rpe: v.optional(v.number()),
  durationSec: v.optional(v.number()),
  distanceM: v.optional(v.number()),
})

const historyValidator = v.object({
  trackingMetric: v.string(),
  records: recordsValidator,
  entries: v.array(
    v.object({
      sessionId: v.id('workout_sessions'),
      performedAt: v.number(),
      sets: v.array(setEntryValidator),
    })
  ),
})

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function emptyRecords(): ExerciseRecords {
  return {
    totalSessions: 0,
    totalSets: 0,
    lastPerformedAt: null,
    heaviestWeightKg: null,
    bestSetVolumeKg: null,
    estimatedOneRepMaxKg: null,
    bestReps: null,
    longestDurationSec: null,
    farthestDistanceM: null,
  }
}

function max(current: number | null, next: number | undefined): number | null {
  if (next == null || !Number.isFinite(next)) return current
  if (current == null) return next
  return next > current ? next : current
}

// Walks the user's completed sessions, gathers every set logged against the
// matching exercise (by stable catalogId first, then normalized name), and
// returns the per-session history plus aggregate personal records.
async function collectExerciseStats(
  ctx: QueryCtx,
  userId: string,
  catalogId: string | undefined,
  name: string
): Promise<{
  trackingMetric: TrackingMetric
  records: ExerciseRecords
  entries: HistoryEntry[]
}> {
  const sessions = await ctx.db
    .query('workout_sessions')
    .withIndex('by_user_status', (q) =>
      q.eq('userId', userId).eq('status', 'completed')
    )
    .order('desc')
    .take(MAX_SESSIONS)

  const targetName = normalize(name)
  let trackingMetric: TrackingMetric = 'weight_reps'
  const entries: HistoryEntry[] = []
  const allSets: SetEntry[] = []

  for (const session of sessions) {
    const matchIds = new Set<string>()
    let matchedTracking: TrackingMetric | null = null
    for (const exercise of session.plan) {
      const matches = catalogId
        ? exercise.catalogId === catalogId
        : normalize(exercise.name) === targetName
      if (matches) {
        matchIds.add(exercise.id)
        matchedTracking = exercise.trackingMetric
      }
    }
    if (matchIds.size === 0) continue
    if (matchedTracking) trackingMetric = matchedTracking

    const sets = await ctx.db
      .query('workout_sets')
      .withIndex('by_sessionId', (q) => q.eq('sessionId', session._id))
      .collect()

    const exerciseSets = sets
      .filter((s: Doc<'workout_sets'>) => matchIds.has(s.exerciseId))
      .sort((a, b) => a.setIndex - b.setIndex)
      .map((s) => ({
        setIndex: s.setIndex,
        weightKg: s.weightKg,
        reps: s.reps,
        rpe: s.rpe,
        durationSec: s.durationSec,
        distanceM: s.distanceM,
      }))

    if (exerciseSets.length === 0) continue

    entries.push({
      sessionId: session._id,
      performedAt: session.updatedAt,
      sets: exerciseSets,
    })
    allSets.push(...exerciseSets)
  }

  const records = emptyRecords()
  records.totalSessions = entries.length
  records.totalSets = allSets.length
  records.lastPerformedAt = entries.length > 0 ? entries[0].performedAt : null

  for (const set of allSets) {
    records.heaviestWeightKg = max(records.heaviestWeightKg, set.weightKg)
    records.bestReps = max(records.bestReps, set.reps)
    records.longestDurationSec = max(records.longestDurationSec, set.durationSec)
    records.farthestDistanceM = max(records.farthestDistanceM, set.distanceM)
    if (set.weightKg != null && set.reps != null && set.reps > 0) {
      const volume = set.weightKg * set.reps
      records.bestSetVolumeKg = max(records.bestSetVolumeKg, volume)
      // Epley estimate: 1RM = w * (1 + reps / 30)
      const oneRm = set.weightKg * (1 + set.reps / 30)
      records.estimatedOneRepMaxKg = max(
        records.estimatedOneRepMaxKg,
        Math.round(oneRm * 10) / 10
      )
    }
  }

  return { trackingMetric, records, entries }
}

export const getExerciseHistory = query({
  args: {
    catalogId: v.optional(v.string()),
    name: v.string(),
  },
  returns: historyValidator,
  handler: async (ctx, { catalogId, name }) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      return { trackingMetric: 'weight_reps', records: emptyRecords(), entries: [] }
    }
    return await collectExerciseStats(ctx, identity.subject, catalogId, name)
  },
})

export const getExerciseRecords = query({
  args: {
    catalogId: v.optional(v.string()),
    name: v.string(),
  },
  returns: v.object({
    trackingMetric: v.string(),
    records: recordsValidator,
  }),
  handler: async (ctx, { catalogId, name }) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      return { trackingMetric: 'weight_reps', records: emptyRecords() }
    }
    const { trackingMetric, records } = await collectExerciseStats(
      ctx,
      identity.subject,
      catalogId,
      name
    )
    return { trackingMetric, records }
  },
})

// Builder prefill: for each requested exercise, find the most recent
// completed session it appears in and return the targets the user last
// trained with (logged set count + a representative rep target + planned
// rest). Returns null per item when there's no history. One pass over the
// recent sessions keeps it cheap even with several exercises selected.
const lastTargetValidator = v.union(
  v.object({
    sets: v.number(),
    reps: v.number(),
    restSec: v.number(),
  }),
  v.null()
)

export const getLastTargetsForExercises = query({
  args: {
    items: v.array(
      v.object({
        catalogId: v.optional(v.string()),
        name: v.string(),
      })
    ),
  },
  returns: v.array(lastTargetValidator),
  handler: async (ctx, { items }) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity || items.length === 0) {
      return items.map(() => null)
    }

    const sessions = await ctx.db
      .query('workout_sessions')
      .withIndex('by_user_status', (q) =>
        q.eq('userId', identity.subject).eq('status', 'completed')
      )
      .order('desc')
      .take(MAX_SESSIONS)

    const targets: { catalog?: string; targetName: string }[] = items.map(
      (it) => ({ catalog: it.catalogId, targetName: normalize(it.name) })
    )
    const results: ({ sets: number; reps: number; restSec: number } | null)[] =
      items.map(() => null)
    const remaining = new Set(items.map((_, i) => i))

    for (const session of sessions) {
      if (remaining.size === 0) break

      let setsCache: Doc<'workout_sets'>[] | null = null
      for (const index of [...remaining]) {
        const target = targets[index]
        const planMatch = session.plan.find((ex) =>
          target.catalog
            ? ex.catalogId === target.catalog
            : normalize(ex.name) === target.targetName
        )
        if (!planMatch) continue

        if (setsCache === null) {
          setsCache = await ctx.db
            .query('workout_sets')
            .withIndex('by_sessionId', (q) => q.eq('sessionId', session._id))
            .collect()
        }
        const logged = setsCache
          .filter((s) => s.exerciseId === planMatch.id)
          .sort((a, b) => a.setIndex - b.setIndex)

        const repsFromLog = logged
          .map((s) => s.reps)
          .filter((r): r is number => r != null && r > 0)
        const plannedReps = Array.isArray(planMatch.targetReps)
          ? (planMatch.targetReps[0] ?? 10)
          : planMatch.targetReps
        const reps =
          repsFromLog.length > 0
            ? repsFromLog[repsFromLog.length - 1]
            : plannedReps
        const sets =
          logged.length > 0 ? logged.length : Math.max(1, planMatch.targetSets)

        results[index] = {
          sets,
          reps: Math.round(reps),
          restSec: Math.max(0, Math.round(planMatch.restSec)),
        }
        remaining.delete(index)
      }
    }

    return results
  },
})

// Used by the coach chat to ground replies in the user's real numbers.
export const getExerciseStatsForUser = internalQuery({
  args: {
    userId: v.string(),
    catalogId: v.optional(v.string()),
    name: v.string(),
  },
  returns: historyValidator,
  handler: async (ctx, { userId, catalogId, name }) => {
    return await collectExerciseStats(ctx, userId, catalogId, name)
  },
})
