import { v } from 'convex/values'

import { api } from './_generated/api'
import type { Doc } from './_generated/dataModel'
import { action, query, type QueryCtx } from './_generated/server'
import { getOpenAI, getOpenAIModel, openAIResponsesLowLatency } from './openai'

// Scan cap mirrors exerciseStats.ts so per-exercise record lookups stay cheap.
const MAX_SESSIONS = 100

type HighlightKind = 'weight' | 'oneRm' | 'reps' | 'duration' | 'distance'

type Best = {
  weightKg: number | null
  oneRmKg: number | null
  reps: number | null
  durationSec: number | null
  distanceM: number | null
  hasData: boolean
}

const highlightValidator = v.object({
  exerciseName: v.string(),
  kind: v.union(
    v.literal('weight'),
    v.literal('oneRm'),
    v.literal('reps'),
    v.literal('duration'),
    v.literal('distance')
  ),
  value: v.number(),
  unit: v.string(),
  previous: v.union(v.number(), v.null()),
  isFirstTime: v.boolean(),
})

const insightsValidator = v.union(
  v.null(),
  v.object({
    goal: v.string(),
    modality: v.string(),
    status: v.string(),
    dateMs: v.number(),
    durationMin: v.union(v.number(), v.null()),
    plannedDurationMin: v.number(),
    workingSetsLogged: v.number(),
    totalTargetSets: v.number(),
    adherencePct: v.number(),
    totalVolumeKg: v.number(),
    totalReps: v.number(),
    totalDistanceM: v.number(),
    totalActiveSec: v.number(),
    avgRpe: v.union(v.number(), v.null()),
    exercisesCompleted: v.number(),
    bodyParts: v.array(v.string()),
    highlights: v.array(highlightValidator),
  })
)

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function max(current: number | null, next: number | undefined): number | null {
  if (next == null || !Number.isFinite(next)) return current
  if (current == null) return next
  return next > current ? next : current
}

function emptyBest(): Best {
  return {
    weightKg: null,
    oneRmKg: null,
    reps: null,
    durationSec: null,
    distanceM: null,
    hasData: false,
  }
}

// Fold a single working set into a running best. Warm-ups are excluded by the
// caller so they never inflate records.
function foldSet(best: Best, set: Doc<'workout_sets'>): void {
  best.weightKg = max(best.weightKg, set.weightKg)
  best.reps = max(best.reps, set.reps)
  best.durationSec = max(best.durationSec, set.durationSec)
  best.distanceM = max(best.distanceM, set.distanceM)
  if (set.weightKg != null && set.reps != null && set.reps > 0) {
    // Epley estimate: 1RM = w * (1 + reps / 30)
    const oneRm = Math.round(set.weightKg * (1 + set.reps / 30) * 10) / 10
    best.oneRmKg = max(best.oneRmKg, oneRm)
    best.hasData = true
  }
  if (
    set.weightKg != null ||
    set.reps != null ||
    set.durationSec != null ||
    set.distanceM != null
  ) {
    best.hasData = true
  }
}

// Walk the user's OTHER completed sessions and record the historical best for
// each requested exercise (matched by stable catalogId first, then normalized
// name). The current session is excluded so a fresh record reads as new.
async function collectHistoricalBests(
  ctx: QueryCtx,
  userId: string,
  currentSessionId: string,
  targets: {
    catalogId?: string
    norm: string
  }[]
): Promise<Best[]> {
  const bests = targets.map(() => emptyBest())
  if (targets.length === 0) return bests

  const sessions = await ctx.db
    .query('workout_sessions')
    .withIndex('by_user_status', (q) =>
      q.eq('userId', userId).eq('status', 'completed')
    )
    .order('desc')
    .take(MAX_SESSIONS)

  for (const session of sessions) {
    if (session._id === currentSessionId) continue

    // Map this session's matching exercise ids back to the target index.
    const matchByExerciseId = new Map<string, number>()
    for (const exercise of session.plan) {
      for (let i = 0; i < targets.length; i += 1) {
        const target = targets[i]
        const matches = target.catalogId
          ? exercise.catalogId === target.catalogId
          : normalize(exercise.name) === target.norm
        if (matches) matchByExerciseId.set(exercise.id, i)
      }
    }
    if (matchByExerciseId.size === 0) continue

    const sets = await ctx.db
      .query('workout_sets')
      .withIndex('by_sessionId', (q) => q.eq('sessionId', session._id))
      .collect()

    for (const set of sets) {
      if (set.isWarmup) continue
      const index = matchByExerciseId.get(set.exerciseId)
      if (index == null) continue
      foldSet(bests[index], set)
    }
  }

  return bests
}

export const getSessionInsights = query({
  args: {
    sessionId: v.id('workout_sessions'),
  },
  returns: insightsValidator,
  handler: async (ctx, { sessionId }) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return null

    const session = await ctx.db.get(sessionId)
    if (!session || session.userId !== identity.subject) return null

    const sets = await ctx.db
      .query('workout_sets')
      .withIndex('by_sessionId', (q) => q.eq('sessionId', sessionId))
      .collect()

    const workingSets = sets.filter((s) => !s.isWarmup)

    const totalTargetSets = session.plan.reduce(
      (acc, exercise) => acc + exercise.targetSets,
      0
    )

    let totalVolumeKg = 0
    let totalReps = 0
    let totalDistanceM = 0
    let totalActiveSec = 0
    let rpeSum = 0
    let rpeCount = 0
    for (const set of workingSets) {
      if (set.weightKg != null && set.reps != null) {
        totalVolumeKg += set.weightKg * set.reps
      }
      if (set.reps != null) totalReps += set.reps
      if (set.distanceM != null) totalDistanceM += set.distanceM
      if (set.durationSec != null) totalActiveSec += set.durationSec
      if (set.rpe != null) {
        rpeSum += set.rpe
        rpeCount += 1
      }
    }

    // Per-exercise current-session bests (working sets only).
    const currentBestByExerciseId = new Map<string, Best>()
    for (const set of workingSets) {
      let best = currentBestByExerciseId.get(set.exerciseId)
      if (!best) {
        best = emptyBest()
        currentBestByExerciseId.set(set.exerciseId, best)
      }
      foldSet(best, set)
    }

    // Exercises the user actually trained (had at least one working set).
    const trainedExercises = session.plan.filter((ex) =>
      currentBestByExerciseId.has(ex.id)
    )
    const bodyParts = Array.from(
      new Set(trainedExercises.map((ex) => ex.bodyPart).filter(Boolean))
    )

    const targets = trainedExercises.map((ex) => ({
      catalogId: ex.catalogId,
      norm: normalize(ex.name),
    }))
    const historicalBests = await collectHistoricalBests(
      ctx,
      identity.subject,
      sessionId,
      targets
    )

    const highlights: {
      exerciseName: string
      kind: HighlightKind
      value: number
      unit: string
      previous: number | null
      isFirstTime: boolean
    }[] = []

    trainedExercises.forEach((exercise, index) => {
      const current = currentBestByExerciseId.get(exercise.id)
      if (!current) return
      const history = historicalBests[index]
      const firstTime = !history.hasData

      const push = (
        kind: HighlightKind,
        value: number | null,
        prev: number | null,
        unit: string
      ) => {
        if (value == null) return
        if (firstTime) {
          highlights.push({
            exerciseName: exercise.name,
            kind,
            value,
            unit,
            previous: null,
            isFirstTime: true,
          })
          return
        }
        if (prev != null && value > prev) {
          highlights.push({
            exerciseName: exercise.name,
            kind,
            value,
            unit,
            previous: prev,
            isFirstTime: false,
          })
        }
      }

      // One highlight per exercise, keyed to how the movement is tracked, so
      // the section stays celebratory rather than noisy.
      switch (exercise.trackingMetric) {
        case 'weight_reps': {
          if (
            !firstTime &&
            current.weightKg != null &&
            history.weightKg != null &&
            current.weightKg > history.weightKg
          ) {
            push('weight', current.weightKg, history.weightKg, 'kg')
          } else if (
            !firstTime &&
            current.oneRmKg != null &&
            history.oneRmKg != null &&
            current.oneRmKg > history.oneRmKg
          ) {
            push('oneRm', current.oneRmKg, history.oneRmKg, 'kg')
          } else if (firstTime && current.weightKg != null) {
            push('weight', current.weightKg, null, 'kg')
          }
          break
        }
        case 'duration': {
          push('duration', current.durationSec, history.durationSec, 's')
          break
        }
        case 'distance': {
          push('distance', current.distanceM, history.distanceM, 'm')
          break
        }
        default:
          break
      }
    })

    // Real PRs before first-time notes, capped so the screen stays minimal.
    highlights.sort((a, b) => Number(a.isFirstTime) - Number(b.isFirstTime))
    const cappedHighlights = highlights.slice(0, 4)

    const durationMs =
      session.startedAt != null &&
      session.completedAt != null &&
      session.completedAt > session.startedAt
        ? session.completedAt - session.startedAt
        : null
    const durationMin =
      durationMs != null ? Math.max(1, Math.round(durationMs / 60000)) : null

    const adherencePct =
      totalTargetSets > 0
        ? Math.round((workingSets.length / totalTargetSets) * 100)
        : 0

    return {
      goal: session.goal,
      modality: session.modality,
      status: session.status,
      dateMs: session.completedAt ?? session.updatedAt,
      durationMin,
      plannedDurationMin: session.durationMin,
      workingSetsLogged: workingSets.length,
      totalTargetSets,
      adherencePct,
      totalVolumeKg: Math.round(totalVolumeKg),
      totalReps,
      totalDistanceM: Math.round(totalDistanceM),
      totalActiveSec,
      avgRpe: rpeCount > 0 ? Math.round((rpeSum / rpeCount) * 10) / 10 : null,
      exercisesCompleted: trainedExercises.length,
      bodyParts,
      highlights: cappedHighlights,
    }
  },
})

function formatHighlight(h: {
  exerciseName: string
  kind: HighlightKind
  value: number
  unit: string
  previous: number | null
  isFirstTime: boolean
}): string {
  const label =
    h.kind === 'weight'
      ? 'heaviest'
      : h.kind === 'oneRm'
        ? 'estimated 1RM'
        : h.kind === 'reps'
          ? 'most reps'
          : h.kind === 'duration'
            ? 'longest hold'
            : 'farthest'
  const value = `${h.value}${h.unit}`
  if (h.isFirstTime) return `${h.exerciseName}: first time logged (${value})`
  const prev = h.previous != null ? ` (was ${h.previous}${h.unit})` : ''
  return `${h.exerciseName}: new ${label} ${value}${prev}`
}

// Hybrid AI note: the client shows computed stats instantly and calls this to
// stream in a short coach reaction. Mirrors coachChat's Responses usage and
// fails soft (empty string) so the UI just hides the card.
export const generateSessionNote = action({
  args: {
    sessionId: v.id('workout_sessions'),
  },
  returns: v.string(),
  handler: async (ctx, { sessionId }): Promise<string> => {
    const insights = await ctx.runQuery(api.sessionInsights.getSessionInsights, {
      sessionId,
    })
    if (!insights) return ''

    const factLines: string[] = [
      `Goal: ${insights.goal}`,
      `Modality: ${insights.modality}`,
    ]
    if (insights.durationMin != null) {
      factLines.push(`Duration: ${insights.durationMin} min`)
    }
    factLines.push(
      `Working sets: ${insights.workingSetsLogged}/${insights.totalTargetSets}`,
      `Exercises: ${insights.exercisesCompleted}`
    )
    if (insights.totalVolumeKg > 0) {
      factLines.push(`Total volume: ${insights.totalVolumeKg} kg`)
    }
    if (insights.totalReps > 0) {
      factLines.push(`Total reps: ${insights.totalReps}`)
    }
    if (insights.avgRpe != null) {
      factLines.push(`Average RPE: ${insights.avgRpe}`)
    }
    if (insights.bodyParts.length > 0) {
      factLines.push(`Body parts: ${insights.bodyParts.join(', ')}`)
    }
    if (insights.highlights.length > 0) {
      factLines.push(
        'Personal records:',
        ...insights.highlights.map((h) => `- ${formatHighlight(h)}`)
      )
    }

    const instructions = `You are Embodi's strength & movement coach reacting to a client who just finished a workout.
Write ONE or TWO short sentences (max ~40 words) celebrating what they did and, if there's a record, calling it out specifically.
Be warm, direct, and specific to the numbers. No emojis, no medical claims, no generic filler, no lists. Speak to them as "you".`

    const client = getOpenAI()
    const model = getOpenAIModel()

    try {
      const response = await client.responses.create({
        model,
        ...openAIResponsesLowLatency,
        instructions,
        input: factLines.join('\n'),
      })
      return response.output_text?.trim() ?? ''
    } catch (error) {
      console.error('session note failed', error)
      return ''
    }
  },
})
