import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import type { Id } from './_generated/dataModel'

// Fresh, unique id for each exercise when a routine is instantiated into a
// live session. Mirrors the scheme used in convex/trainer.ts so logged sets
// stay keyed to a session-unique exercise id.
const generateExerciseId = () =>
  `exercise-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`

// Lightweight projection for the routines list — the UI only needs the label,
// modality, duration, and how many moves are in the routine.
export const listRoutines = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id('workout_routines'),
      name: v.string(),
      goal: v.string(),
      modality: v.string(),
      durationMin: v.number(),
      exerciseCount: v.number(),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
  ),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error('Not authenticated')
    }
    const routines = await ctx.db
      .query('workout_routines')
      .withIndex('by_userId', (q) => q.eq('userId', identity.subject))
      .collect()
    return routines
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((routine) => ({
        _id: routine._id,
        name: routine.name,
        goal: routine.goal,
        modality: routine.modality,
        durationMin: routine.durationMin,
        exerciseCount: routine.plan.length,
        createdAt: routine.createdAt,
        updatedAt: routine.updatedAt,
      }))
  },
})

// Snapshot a session's plan into a reusable routine. Sets are never copied —
// they belong to live sessions only.
export const saveRoutineFromSession = mutation({
  args: {
    sessionId: v.id('workout_sessions'),
    name: v.string(),
  },
  returns: v.id('workout_routines'),
  handler: async (ctx, { sessionId, name }): Promise<Id<'workout_routines'>> => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error('Not authenticated')
    }

    const session = await ctx.db.get(sessionId)
    if (!session) {
      throw new Error('Session not found')
    }
    if (session.userId !== identity.subject) {
      throw new Error('Unauthorized')
    }
    if (session.plan.length === 0) {
      throw new Error('This workout has no exercises to save')
    }

    const trimmedName = name.trim()
    if (!trimmedName) {
      throw new Error('Give your routine a name')
    }

    // Drop the per-session soft-skip flag so the routine always starts fresh.
    const plan = session.plan.map((exercise) => {
      const next = { ...exercise }
      delete next.skipped
      return next
    })

    const now = Date.now()
    const routineId = await ctx.db.insert('workout_routines', {
      userId: identity.subject,
      name: trimmedName,
      goal: session.goal,
      modality: session.modality,
      durationMin: session.durationMin,
      plan,
      sourceSessionId: sessionId,
      createdAt: now,
      updatedAt: now,
    })
    return routineId
  },
})

// Build a brand-new live session from a saved routine. Mirrors
// createCustomSession: regenerate exercise ids, mark source 'custom' so the
// session skips the "ready" screen and phase grouping, and land the user
// straight in the live session.
export const startSessionFromRoutine = mutation({
  args: { routineId: v.id('workout_routines') },
  returns: v.id('workout_sessions'),
  handler: async (ctx, { routineId }): Promise<Id<'workout_sessions'>> => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error('Not authenticated')
    }

    const routine = await ctx.db.get(routineId)
    if (!routine) {
      throw new Error('Routine not found')
    }
    if (routine.userId !== identity.subject) {
      throw new Error('Unauthorized')
    }

    const plan = routine.plan.map((exercise) => {
      const next = { ...exercise, id: generateExerciseId() }
      delete next.skipped
      return next
    })

    const now = Date.now()
    const sessionId = await ctx.db.insert('workout_sessions', {
      userId: identity.subject,
      goal: routine.name,
      modality: routine.modality,
      durationMin: routine.durationMin,
      status: 'generated',
      source: 'custom',
      plan,
      healthFacts: [],
      citations: [],
      createdAt: now,
      updatedAt: now,
    })
    return sessionId
  },
})

export const renameRoutine = mutation({
  args: {
    routineId: v.id('workout_routines'),
    name: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, { routineId, name }) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error('Not authenticated')
    }

    const routine = await ctx.db.get(routineId)
    if (!routine) {
      throw new Error('Routine not found')
    }
    if (routine.userId !== identity.subject) {
      throw new Error('Unauthorized')
    }

    const trimmedName = name.trim()
    if (!trimmedName) {
      throw new Error('Give your routine a name')
    }

    await ctx.db.patch(routineId, {
      name: trimmedName,
      updatedAt: Date.now(),
    })
    return null
  },
})

export const deleteRoutine = mutation({
  args: { routineId: v.id('workout_routines') },
  returns: v.null(),
  handler: async (ctx, { routineId }) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error('Not authenticated')
    }

    const routine = await ctx.db.get(routineId)
    if (!routine) {
      throw new Error('Routine not found')
    }
    if (routine.userId !== identity.subject) {
      throw new Error('Unauthorized')
    }

    await ctx.db.delete(routineId)
    return null
  },
})
