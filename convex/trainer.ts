import { v } from 'convex/values'
import type {
  ResponseCreateParamsNonStreaming,
  ResponseFormatTextJSONSchemaConfig,
} from 'openai/resources/responses/responses'
import { api, internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
import {
  action,
  ActionCtx,
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from './_generated/server'
import {
  distillCitationsForProfile,
  searchCitationsForProfile,
  type Citation as CitationSource,
  type CitationsProfile,
} from './citations'
import { getOpenAI, getOpenAIModel, openAIResponsesLowLatency } from './openai'
import { formatCheckinForPrompt, type CheckinData } from './checkin'
import {
  computeCycleStatus,
  formatCycleForPrompt,
  type CycleStatus,
} from './cycle'

type Citation = CitationSource

type Fact = {
  text: string
  citations: Citation[]
}

type ExercisePlan = {
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
  trackingMetric: 'weight_reps' | 'duration' | 'distance' | 'breath' | 'custom'
}

type Profile = CitationsProfile

type PlanPayload = {
  goalFocus: string
  modality: string
  durationMin: number
  exercises: ExercisePlan[]
}

type CoachComment = {
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

type PlanResponseParams = ResponseCreateParamsNonStreaming & {
  text: {
    format: ResponseFormatTextJSONSchemaConfig
  }
}

const createId = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`

const generateExerciseId = () => createId('exercise')
const generateCoachId = () => createId('coach')

const exerciseArg = v.object({
  id: v.string(),
  name: v.string(),
  bodyPart: v.string(),
  modality: v.string(),
  instructions: v.string(),
  equipment: v.array(v.string()),
  targetSets: v.number(),
  targetReps: v.array(v.number()),
  tempo: v.string(),
  restSec: v.number(),
  durationMin: v.optional(v.number()),
  intensityCue: v.optional(v.string()),
  contraindications: v.optional(v.array(v.string())),
  cues: v.array(v.string()),
  trackingMetric: v.union(
    v.literal('weight_reps'),
    v.literal('duration'),
    v.literal('distance'),
    v.literal('breath'),
    v.literal('custom')
  ),
})

const citationArg = v.object({
  id: v.string(),
  title: v.string(),
  authors: v.array(v.string()),
  year: v.number(),
  source: v.string(),
  url: v.string(),
  doi: v.optional(v.string()),
  summary: v.optional(v.string()),
})

const factArg = v.object({
  text: v.string(),
  citations: v.array(citationArg),
})

const profileArg = v.object({
  name: v.string(),
  age: v.string(),
  gender: v.union(
    v.literal('male'),
    v.literal('female'),
    v.literal('prefer-not-to-say'),
    v.null()
  ),
  goal: v.string(),
  activityLevel: v.union(
    v.literal('sedentary'),
    v.literal('light'),
    v.literal('moderate'),
    v.literal('active'),
    v.literal('very-active'),
    v.null()
  ),
  timeAvailable: v.array(v.string()),
  injuries: v.array(v.string()),
  conditions: v.array(v.string()),
  medications: v.string(),
  smoking: v.union(
    v.literal('never'),
    v.literal('former'),
    v.literal('current'),
    v.null()
  ),
  alcohol: v.union(
    v.literal('never'),
    v.literal('occasionally'),
    v.literal('regularly'),
    v.null()
  ),
})

const planInputArg = v.object({
  goal: v.string(),
  modality: v.string(),
  durationMin: v.number(),
  plan: v.array(exerciseArg),
  healthFacts: v.array(factArg),
  citations: v.array(citationArg),
})

const recommendationSeedArg = v.object({
  title: v.string(),
  modality: v.string(),
  durationMin: v.number(),
  moveCount: v.number(),
  description: v.string(),
  reasoning: v.string(),
  tags: v.array(v.string()),
  source: v.union(v.literal('aligned'), v.literal('exploration')),
})

type RecommendationSeed = {
  title: string
  modality: string
  durationMin: number
  moveCount: number
  description: string
  reasoning: string
  tags: string[]
  source: 'aligned' | 'exploration'
}

export const generatePlanAndInsights = action({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error('Not authenticated')
    }

    const profileDoc = await ctx.runQuery(api.onboarding.getOnboarding, {})
    if (!profileDoc) {
      throw new Error('Onboarding data missing')
    }

    const profile: Profile = {
      name: profileDoc.name,
      age: profileDoc.age,
      gender: profileDoc.gender,
      goal: profileDoc.goal,
      activityLevel: profileDoc.activityLevel,
      timeAvailable: profileDoc.timeAvailable,
      injuries: profileDoc.injuries,
      conditions: profileDoc.conditions,
      medications: profileDoc.medications,
      smoking: profileDoc.smoking,
      alcohol: profileDoc.alcohol,
    }

    // Get the extended profile summary if available
    const extendedProfile = await ctx.runQuery(
      api.profileQuestions.getExtendedProfile,
      {}
    )
    const profileSummary = extendedProfile?.profileSummary || null

    const citations = await searchCitationsForProfile(profile)
    const healthFacts = await distillCitationsForProfile(profile, citations)

    const planPayload = await buildWorkoutPlan(
      profile,
      citations,
      healthFacts,
      profileSummary
    )

    return {
      goal: planPayload.goalFocus || profile.goal,
      modality: planPayload.modality,
      durationMin: planPayload.durationMin,
      plan: normalizeExercises(planPayload.exercises),
      healthFacts,
      citations,
    }
  },
})

export const prefetchCoachComments = action({
  args: {
    profile: profileArg,
    plan: v.array(exerciseArg),
    durationMin: v.number(),
    goal: v.string(),
  },
  handler: async (_, { profile, plan, durationMin, goal }) => {
    const comments = buildCoachComments(profile, plan, durationMin, goal)
    return comments
  },
})

export const createSessionFromPlan = mutation({
  args: planInputArg,
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error('Not authenticated')
    }

    const now = Date.now()
    const sessionId = await ctx.db.insert('workout_sessions', {
      userId: identity.subject,
      goal: args.goal,
      modality: args.modality,
      durationMin: args.durationMin,
      status: 'generated',
      plan: args.plan,
      healthFacts: args.healthFacts,
      citations: args.citations,
      createdAt: now,
      updatedAt: now,
    })

    return sessionId
  },
})

// Create a pending session immediately, returning ID so user can navigate while generation happens
export const createPendingSession = mutation({
  args: {},
  handler: async (ctx): Promise<Id<'workout_sessions'>> => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error('Not authenticated')
    }

    // Get user profile for placeholder goal directly from DB
    const onboarding = await ctx.db
      .query('onboarding')
      .withIndex('by_userId', (q) => q.eq('userId', identity.subject))
      .first()
    const goal = onboarding?.goal || 'Your personalized session'

    const now = Date.now()
    const sessionId = await ctx.db.insert('workout_sessions', {
      userId: identity.subject,
      goal,
      modality: 'generating...',
      durationMin: 0,
      status: 'generating',
      plan: [],
      healthFacts: [],
      citations: [],
      createdAt: now,
      updatedAt: now,
    })

    // Schedule the background generation with userId for auth-free queries
    await ctx.scheduler.runAfter(0, internal.trainer.generateSessionPlan, {
      sessionId,
      userId: identity.subject,
    })

    return sessionId
  },
})

// Start a fresh "today" session seeded by a weekly insights recommendation.
// The trainer will build a real plan that delivers on the recommendation
// while still respecting profile + today's check-in (if it exists).
export const startSessionFromRecommendation = mutation({
  args: { recommendation: recommendationSeedArg },
  handler: async (ctx, { recommendation }): Promise<Id<'workout_sessions'>> => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error('Not authenticated')
    }

    const userId = identity.subject

    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)
    const startOfTodayMs = startOfToday.getTime()

    const recentCheckins = await ctx.db
      .query('daily_checkins')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .order('desc')
      .take(5)
    const todaysCheckin = recentCheckins.find(
      (c) => c.createdAt >= startOfTodayMs
    )

    const now = Date.now()
    const sessionId = await ctx.db.insert('workout_sessions', {
      userId,
      goal: recommendation.title,
      modality: 'generating...',
      durationMin: recommendation.durationMin,
      status: 'generating',
      plan: [],
      healthFacts: [],
      citations: [],
      checkinId: todaysCheckin?._id,
      recommendationSeed: recommendation,
      createdAt: now,
      updatedAt: now,
    })

    if (todaysCheckin && !todaysCheckin.sessionId) {
      await ctx.db.patch(todaysCheckin._id, { sessionId })
    }

    await ctx.scheduler.runAfter(0, internal.trainer.generateSessionPlan, {
      sessionId,
      userId,
      checkinId: todaysCheckin?._id,
      recommendationSeed: recommendation,
    })

    return sessionId
  },
})

// Internal mutation to update session metadata as generation progresses
export const updateSessionMetadata = internalMutation({
  args: {
    sessionId: v.id('workout_sessions'),
    goal: v.optional(v.string()),
    modality: v.optional(v.string()),
    durationMin: v.optional(v.number()),
    healthFacts: v.optional(v.array(factArg)),
    citations: v.optional(v.array(citationArg)),
  },
  handler: async (ctx, { sessionId, ...updates }) => {
    const session = await ctx.db.get(sessionId)
    if (!session) return

    const patch: Record<string, unknown> = { updatedAt: Date.now() }
    if (updates.goal !== undefined) patch.goal = updates.goal
    if (updates.modality !== undefined) patch.modality = updates.modality
    if (updates.durationMin !== undefined)
      patch.durationMin = updates.durationMin
    if (updates.healthFacts !== undefined)
      patch.healthFacts = updates.healthFacts
    if (updates.citations !== undefined) patch.citations = updates.citations

    await ctx.db.patch(sessionId, patch)
  },
})

// Internal mutation to append a single exercise to the session plan
export const appendSessionExercise = internalMutation({
  args: {
    sessionId: v.id('workout_sessions'),
    exercise: exerciseArg,
  },
  handler: async (ctx, { sessionId, exercise }) => {
    const session = await ctx.db.get(sessionId)
    if (!session) return

    const updatedPlan = [...session.plan, exercise]
    await ctx.db.patch(sessionId, {
      plan: updatedPlan,
      updatedAt: Date.now(),
    })

    console.log(
      `[appendSessionExercise] Added exercise ${updatedPlan.length}: ${exercise.name}`
    )
  },
})

// Internal mutation to mark session as ready
export const markSessionGenerated = internalMutation({
  args: {
    sessionId: v.id('workout_sessions'),
  },
  handler: async (ctx, { sessionId }) => {
    const session = await ctx.db.get(sessionId)
    if (!session) return

    await ctx.db.patch(sessionId, {
      status: 'generated',
      updatedAt: Date.now(),
    })

    console.log(
      `[markSessionGenerated] Session ${sessionId} ready with ${session.plan.length} exercises`
    )
  },
})

// Internal mutation to mark session generation as failed
export const markSessionFailed = internalMutation({
  args: {
    sessionId: v.id('workout_sessions'),
  },
  handler: async (ctx, { sessionId }) => {
    await ctx.db.patch(sessionId, {
      status: 'failed',
      updatedAt: Date.now(),
    })
  },
})

// Internal query to get onboarding by userId (for use in scheduled actions without auth)
export const getOnboardingByUserId = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query('onboarding')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()
  },
})

// Internal query to get extended profile by userId (for use in scheduled actions without auth)
export const getExtendedProfileByUserId = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query('extended_profile')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()
  },
})

// Background action to generate the session plan
export const generateSessionPlan = internalAction({
  args: {
    sessionId: v.id('workout_sessions'),
    userId: v.string(),
    checkinId: v.optional(v.id('daily_checkins')),
    recommendationSeed: v.optional(recommendationSeedArg),
  },
  handler: async (
    ctx,
    { sessionId, userId, checkinId, recommendationSeed }
  ) => {
    try {
      // Use internal queries with userId since we don't have auth context
      const profileDoc = await ctx.runQuery(
        internal.trainer.getOnboardingByUserId,
        { userId }
      )
      if (!profileDoc) {
        throw new Error('Onboarding data missing')
      }

      const profile: Profile = {
        name: profileDoc.name,
        age: profileDoc.age,
        gender: profileDoc.gender,
        goal: profileDoc.goal,
        activityLevel: profileDoc.activityLevel,
        timeAvailable: profileDoc.timeAvailable,
        injuries: profileDoc.injuries,
        conditions: profileDoc.conditions,
        medications: profileDoc.medications,
        smoking: profileDoc.smoking,
        alcohol: profileDoc.alcohol,
      }

      // Get the extended profile summary if available
      const extendedProfile = await ctx.runQuery(
        internal.trainer.getExtendedProfileByUserId,
        { userId }
      )
      const profileSummary = extendedProfile?.profileSummary || null

      // Get check-in data if provided
      let checkinData = null
      if (checkinId) {
        checkinData = await ctx.runQuery(internal.checkin.getCheckinById, {
          checkinId,
        })
      }

      // Fetch cycle status whenever the user opted in. The opt-in toggle is
      // only exposed to users whose gender is 'female' or 'prefer-not-to-say',
      // so consent alone is enough to drive the feature.
      let cycleStatus: CycleStatus | null = null
      if (profileDoc.trackPeriod) {
        const cycleEntries = await ctx.runQuery(
          internal.cycle.getCycleEntriesByUserId,
          { userId }
        )
        if (cycleEntries.length > 0) {
          cycleStatus = computeCycleStatus(cycleEntries, Date.now())
        }
      }

      // Fetch citations and health facts first (these are quick)
      const citations = await searchCitationsForProfile(profile)
      const healthFacts = await distillCitationsForProfile(profile, citations)

      // Update session with health facts and citations right away
      await ctx.runMutation(internal.trainer.updateSessionMetadata, {
        sessionId,
        healthFacts,
        citations,
      })

      // Generate the workout plan with streaming
      const planPayload = await buildWorkoutPlanStreaming(
        ctx,
        sessionId,
        profile,
        citations,
        healthFacts,
        profileSummary,
        checkinData,
        recommendationSeed ?? null,
        cycleStatus
      )

      // Update final metadata
      await ctx.runMutation(internal.trainer.updateSessionMetadata, {
        sessionId,
        goal: planPayload.goalFocus || profile.goal,
        modality: planPayload.modality,
        durationMin: planPayload.durationMin,
      })

      // Mark as ready
      await ctx.runMutation(internal.trainer.markSessionGenerated, {
        sessionId,
      })
    } catch (error) {
      console.error('Failed to generate session plan:', error)
      await ctx.runMutation(internal.trainer.markSessionFailed, {
        sessionId,
      })
    }
  },
})

// Remove an exercise from a session's plan. Also deletes any sets that
// were logged against it so we don't leave orphans behind.
export const removeExerciseFromSession = mutation({
  args: {
    sessionId: v.id('workout_sessions'),
    exerciseId: v.string(),
  },
  handler: async (ctx, { sessionId, exerciseId }) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error('Not authenticated')
    }

    const session = await ctx.db.get(sessionId)
    if (!session || session.userId !== identity.subject) {
      throw new Error('Session not found')
    }

    const updatedPlan = session.plan.filter((ex) => ex.id !== exerciseId)
    if (updatedPlan.length === session.plan.length) return

    await ctx.db.patch(sessionId, {
      plan: updatedPlan,
      updatedAt: Date.now(),
    })

    const sets = await ctx.db
      .query('workout_sets')
      .withIndex('by_sessionId', (q) => q.eq('sessionId', sessionId))
      .collect()

    await Promise.all(
      sets
        .filter((set) => set.exerciseId === exerciseId)
        .map((set) => ctx.db.delete(set._id))
    )
  },
})

// Move an exercise to a new position in the plan. `newIndex` is the
// target zero-based position after the move (clamped to plan bounds).
export const reorderSessionExercise = mutation({
  args: {
    sessionId: v.id('workout_sessions'),
    exerciseId: v.string(),
    newIndex: v.number(),
  },
  handler: async (ctx, { sessionId, exerciseId, newIndex }) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error('Not authenticated')
    }

    const session = await ctx.db.get(sessionId)
    if (!session || session.userId !== identity.subject) {
      throw new Error('Session not found')
    }

    const currentIndex = session.plan.findIndex((ex) => ex.id === exerciseId)
    if (currentIndex === -1) return

    const targetIndex = Math.max(
      0,
      Math.min(newIndex, session.plan.length - 1)
    )
    if (targetIndex === currentIndex) return

    const newPlan = [...session.plan]
    const [moved] = newPlan.splice(currentIndex, 1)
    newPlan.splice(targetIndex, 0, moved)

    await ctx.db.patch(sessionId, {
      plan: newPlan,
      updatedAt: Date.now(),
    })
  },
})

// Reorder the plan to match a caller-supplied ordering of exercise ids.
// Drag-to-reorder UIs commit the entire phase's new order in one call so
// neighbour items animate to their final spots without intermediate flicker.
export const reorderSessionPlan = mutation({
  args: {
    sessionId: v.id('workout_sessions'),
    orderedIds: v.array(v.string()),
  },
  handler: async (ctx, { sessionId, orderedIds }) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error('Not authenticated')
    }

    const session = await ctx.db.get(sessionId)
    if (!session || session.userId !== identity.subject) {
      throw new Error('Session not found')
    }

    if (orderedIds.length !== session.plan.length) return

    const byId = new Map(session.plan.map((ex) => [ex.id, ex]))
    const newPlan: typeof session.plan = []
    for (const id of orderedIds) {
      const exercise = byId.get(id)
      if (!exercise) return
      newPlan.push(exercise)
    }

    await ctx.db.patch(sessionId, {
      plan: newPlan,
      updatedAt: Date.now(),
    })
  },
})

// Replace one exercise in a session with a new one. When the new exercise
// has a different id, any sets logged against the old exercise are removed.
export const replaceExerciseInSession = mutation({
  args: {
    sessionId: v.id('workout_sessions'),
    exerciseId: v.string(),
    newExercise: exerciseArg,
  },
  handler: async (ctx, { sessionId, exerciseId, newExercise }) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error('Not authenticated')
    }

    const session = await ctx.db.get(sessionId)
    if (!session || session.userId !== identity.subject) {
      throw new Error('Session not found')
    }

    const idx = session.plan.findIndex((ex) => ex.id === exerciseId)
    if (idx === -1) throw new Error('Exercise not in plan')

    const updatedPlan = [...session.plan]
    updatedPlan[idx] = newExercise
    await ctx.db.patch(sessionId, {
      plan: updatedPlan,
      updatedAt: Date.now(),
    })

    if (newExercise.id !== exerciseId) {
      const sets = await ctx.db
        .query('workout_sets')
        .withIndex('by_sessionId', (q) => q.eq('sessionId', sessionId))
        .collect()
      await Promise.all(
        sets
          .filter((set) => set.exerciseId === exerciseId)
          .map((set) => ctx.db.delete(set._id))
      )
    }
  },
})

// AI-powered exercise alternatives. Pass `userPrompt` to get a single
// targeted replacement; omit it to get several alternatives the user can
// pick from. Each returned exercise has a fresh id and is fully validated.
export const generateExerciseAlternatives = action({
  args: {
    sessionId: v.id('workout_sessions'),
    exerciseId: v.string(),
    userPrompt: v.optional(v.string()),
    count: v.optional(v.number()),
  },
  handler: async (
    ctx,
    { sessionId, exerciseId, userPrompt, count }
  ): Promise<ExercisePlan[]> => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error('Not authenticated')
    }

    const sessionData = await ctx.runQuery(api.trainer.getSessionWithSets, {
      sessionId,
    })
    if (!sessionData) {
      throw new Error('Session not found')
    }
    const exercise = sessionData.session.plan.find(
      (ex) => ex.id === exerciseId
    )
    if (!exercise) {
      throw new Error('Exercise not in plan')
    }

    const profileDoc = await ctx.runQuery(api.onboarding.getOnboarding, {})
    if (!profileDoc) {
      throw new Error('Onboarding data missing')
    }
    const profile: Profile = {
      name: profileDoc.name,
      age: profileDoc.age,
      gender: profileDoc.gender,
      goal: profileDoc.goal,
      activityLevel: profileDoc.activityLevel,
      timeAvailable: profileDoc.timeAvailable,
      injuries: profileDoc.injuries,
      conditions: profileDoc.conditions,
      medications: profileDoc.medications,
      smoking: profileDoc.smoking,
      alcohol: profileDoc.alcohol,
    }

    const extendedProfile = await ctx.runQuery(
      api.profileQuestions.getExtendedProfile,
      {}
    )
    const profileSummary = extendedProfile?.profileSummary ?? null

    const targetCount = Math.max(
      1,
      Math.min(count ?? (userPrompt ? 1 : 3), 4)
    )

    const otherExerciseNames = sessionData.session.plan
      .filter((ex) => ex.id !== exerciseId)
      .map((ex) => ex.name)

    const systemPrompt = `You are an AI trainer recommending replacement exercises for a personalised session.

Rules:
- Honour the client's injuries, conditions, medications, and current state.
- Match the same training intent (modality + body part) as the exercise being replaced unless the user explicitly asks for something different.
- Avoid duplicating any exercise already in the session.
- Cue breath, tempo, and intent. Use proven, evidence-aware approaches.
- Output JSON matching the schema. Generate UNIQUE exercise ids that do not collide with the one being replaced.`

    const userPromptParts: string[] = []
    if (profileSummary) {
      userPromptParts.push(
        '=== CLIENT PROFILE ===',
        profileSummary,
        '=== END PROFILE ==='
      )
    } else {
      userPromptParts.push('Profile JSON:', JSON.stringify(profile))
    }
    userPromptParts.push(
      '',
      'EXERCISE TO REPLACE:',
      JSON.stringify(exercise, null, 2),
      '',
      otherExerciseNames.length
        ? `Other exercises already in the session (don't duplicate): ${otherExerciseNames.join(', ')}`
        : '',
      '',
      userPrompt
        ? `User's specific request: "${userPrompt.slice(0, 500)}"`
        : `Generate ${targetCount} distinct alternatives the user can pick from. Cover a range of angles (different equipment / progression / regression).`,
      '',
      `Return exactly ${targetCount} alternative${targetCount > 1 ? 's' : ''}.`
    )

    const client = getOpenAI()
    const model = getOpenAIModel()

    type AlternativeResponse = { alternatives: Partial<ExercisePlan>[] }
    const altRequest: PlanResponseParams = {
      model,
      ...openAIResponsesLowLatency,
      text: {
        format: {
          type: 'json_schema',
          name: 'exercise_alternatives',
          schema: {
            type: 'object',
            additionalProperties: false,
            required: ['alternatives'],
            properties: {
              alternatives: {
                type: 'array',
                minItems: targetCount,
                maxItems: targetCount,
                items: {
                  type: 'object',
                  additionalProperties: false,
                  required: [
                    'id',
                    'name',
                    'bodyPart',
                    'modality',
                    'instructions',
                    'equipment',
                    'targetSets',
                    'targetReps',
                    'tempo',
                    'restSec',
                    'cues',
                    'trackingMetric',
                    'durationMin',
                    'intensityCue',
                    'contraindications',
                  ],
                  properties: {
                    id: { type: 'string' },
                    name: { type: 'string' },
                    bodyPart: { type: 'string' },
                    modality: { type: 'string' },
                    instructions: { type: 'string' },
                    equipment: { type: 'array', items: { type: 'string' } },
                    targetSets: { type: 'integer' },
                    targetReps: {
                      type: 'array',
                      items: { type: 'integer' },
                      minItems: 1,
                      maxItems: 3,
                    },
                    tempo: { type: 'string' },
                    restSec: { type: 'integer' },
                    durationMin: { type: 'number' },
                    intensityCue: { type: 'string' },
                    contraindications: {
                      type: 'array',
                      items: { type: 'string' },
                    },
                    cues: { type: 'array', items: { type: 'string' } },
                    trackingMetric: {
                      type: 'string',
                      enum: [
                        'weight_reps',
                        'duration',
                        'distance',
                        'breath',
                        'custom',
                      ],
                    },
                  },
                },
              },
            },
          },
        },
      },
      input: [
        {
          role: 'system',
          content: [{ type: 'input_text', text: systemPrompt }],
        },
        {
          role: 'user',
          content: [
            { type: 'input_text', text: userPromptParts.join('\n') },
          ],
        },
      ],
    }

    const response = await client.responses.parse<
      PlanResponseParams,
      AlternativeResponse
    >(altRequest)
    const parsed = response.output_parsed
    if (!parsed) {
      throw new Error('Could not generate alternatives')
    }

    // Force fresh ids so a replacement always invalidates orphaned set logs.
    const alternatives = normalizeExercises(parsed.alternatives ?? []).map(
      (ex) => ({ ...ex, id: generateExerciseId() })
    )
    return alternatives
  },
})

export const logSet = mutation({
  args: {
    sessionId: v.id('workout_sessions'),
    exerciseId: v.string(),
    setIndex: v.number(),
    weightKg: v.optional(v.number()),
    reps: v.optional(v.number()),
    rpe: v.optional(v.number()),
    durationSec: v.optional(v.number()),
    distanceM: v.optional(v.number()),
    notes: v.optional(v.string()),
    completeSession: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error('Not authenticated')
    }

    const session = await ctx.db.get(args.sessionId)
    if (!session || session.userId !== identity.subject) {
      throw new Error('Session not found')
    }

    const sets = await ctx.db
      .query('workout_sets')
      .withIndex('by_sessionId', (q) => q.eq('sessionId', args.sessionId))
      .collect()

    const existing = sets.find(
      (set) =>
        set.exerciseId === args.exerciseId && set.setIndex === args.setIndex
    )

    const payload = {
      weightKg: args.weightKg,
      reps: args.reps,
      rpe: args.rpe,
      durationSec: args.durationSec,
      distanceM: args.distanceM,
      notes: args.notes,
      completedAt: Date.now(),
    }

    if (existing) {
      await ctx.db.patch(existing._id, payload)
    } else {
      await ctx.db.insert('workout_sets', {
        sessionId: args.sessionId,
        exerciseId: args.exerciseId,
        setIndex: args.setIndex,
        ...payload,
      })
    }

    if (session.status === 'generated') {
      await ctx.db.patch(args.sessionId, {
        status: 'in-progress',
        updatedAt: Date.now(),
      })
    }

    if (args.completeSession) {
      const wasNotCompleted = session.status !== 'completed'
      await ctx.db.patch(args.sessionId, {
        status: 'completed',
        updatedAt: Date.now(),
      })
      if (wasNotCompleted) {
        await ctx.scheduler.runAfter(
          0,
          internal.weeklyInsights.regenerateAfterCompletion,
          { userId: identity.subject }
        )
      }
    }
  },
})

// Remove a single logged set. Defaults to deleting the highest-indexed
// set for the exercise, which mirrors the "− Remove set" affordance in the
// movement journey UI (it always trims the trailing extra row the user
// added). Pass `setIndex` explicitly to delete a specific set.
export const removeSet = mutation({
  args: {
    sessionId: v.id('workout_sessions'),
    exerciseId: v.string(),
    setIndex: v.optional(v.number()),
  },
  handler: async (ctx, { sessionId, exerciseId, setIndex }) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error('Not authenticated')
    }

    const session = await ctx.db.get(sessionId)
    if (!session || session.userId !== identity.subject) {
      throw new Error('Session not found')
    }

    const exerciseSets = await ctx.db
      .query('workout_sets')
      .withIndex('by_sessionId', (q) => q.eq('sessionId', sessionId))
      .collect()
      .then((rows) => rows.filter((set) => set.exerciseId === exerciseId))

    if (exerciseSets.length === 0) return

    const target =
      setIndex != null
        ? exerciseSets.find((set) => set.setIndex === setIndex)
        : exerciseSets.reduce((highest, set) =>
            set.setIndex > highest.setIndex ? set : highest,
          )

    if (!target) return

    await ctx.db.delete(target._id)
  },
})

// Make room for a new set right after `afterSetIndex`. Any logged sets
// with a higher index get bumped up by one so the inserted row appears
// in the gap. Idempotent — a no-op when no sets need shifting.
export const insertSetAfter = mutation({
  args: {
    sessionId: v.id('workout_sessions'),
    exerciseId: v.string(),
    afterSetIndex: v.number(),
  },
  handler: async (ctx, { sessionId, exerciseId, afterSetIndex }) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error('Not authenticated')
    }

    const session = await ctx.db.get(sessionId)
    if (!session || session.userId !== identity.subject) {
      throw new Error('Session not found')
    }

    const exerciseSets = await ctx.db
      .query('workout_sets')
      .withIndex('by_sessionId', (q) => q.eq('sessionId', sessionId))
      .collect()
      .then((rows) => rows.filter((set) => set.exerciseId === exerciseId))

    // Shift descending so we never collide with an existing index mid-loop.
    const toShift = exerciseSets
      .filter((set) => set.setIndex > afterSetIndex)
      .sort((a, b) => b.setIndex - a.setIndex)

    for (const set of toShift) {
      await ctx.db.patch(set._id, { setIndex: set.setIndex + 1 })
    }
  },
})

// Delete the set at `setIndex` and compact subsequent sets down by one
// so rows don't leave gaps after a swipe-to-delete. Safe when the row
// has no logged data (just performs the shift).
export const deleteSetAt = mutation({
  args: {
    sessionId: v.id('workout_sessions'),
    exerciseId: v.string(),
    setIndex: v.number(),
  },
  handler: async (ctx, { sessionId, exerciseId, setIndex }) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error('Not authenticated')
    }

    const session = await ctx.db.get(sessionId)
    if (!session || session.userId !== identity.subject) {
      throw new Error('Session not found')
    }

    const exerciseSets = await ctx.db
      .query('workout_sets')
      .withIndex('by_sessionId', (q) => q.eq('sessionId', sessionId))
      .collect()
      .then((rows) => rows.filter((set) => set.exerciseId === exerciseId))

    const target = exerciseSets.find((set) => set.setIndex === setIndex)
    if (target) {
      await ctx.db.delete(target._id)
    }

    const toShift = exerciseSets
      .filter((set) => set.setIndex > setIndex)
      .sort((a, b) => a.setIndex - b.setIndex)

    for (const set of toShift) {
      await ctx.db.patch(set._id, { setIndex: set.setIndex - 1 })
    }
  },
})

export const postSessionFeedback = mutation({
  args: {
    sessionId: v.id('workout_sessions'),
    text: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error('Not authenticated')
    }

    const session = await ctx.db.get(args.sessionId)
    if (!session || session.userId !== identity.subject) {
      throw new Error('Session not found')
    }

    await ctx.db.insert('session_feedback', {
      sessionId: args.sessionId,
      userId: identity.subject,
      text: args.text,
      createdAt: Date.now(),
    })
  },
})

export const completeSession = mutation({
  args: {
    sessionId: v.id('workout_sessions'),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error('Not authenticated')
    }

    const session = await ctx.db.get(args.sessionId)
    if (!session || session.userId !== identity.subject) {
      throw new Error('Session not found')
    }

    const wasNotCompleted = session.status !== 'completed'
    await ctx.db.patch(args.sessionId, {
      status: 'completed',
      updatedAt: Date.now(),
    })

    if (wasNotCompleted) {
      await ctx.scheduler.runAfter(
        0,
        internal.weeklyInsights.regenerateAfterCompletion,
        { userId: identity.subject }
      )
    }
  },
})

export const getSessionWithSets = query({
  args: {
    sessionId: v.id('workout_sessions'),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      return null
    }

    const session = await ctx.db.get(args.sessionId)
    if (!session || session.userId !== identity.subject) {
      return null
    }

    const sets = await ctx.db
      .query('workout_sets')
      .withIndex('by_sessionId', (q) => q.eq('sessionId', args.sessionId))
      .collect()

    return { session, sets }
  },
})

// Returns the most recent workout session created today (any status except 'failed'),
// plus a summary of progress. Used by the home screen to render a single state-aware
// CTA that reflects where the user is in their daily session lifecycle.
export const getTodaysSession = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return null

    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)
    const startOfTodayMs = startOfToday.getTime()

    const sessions = await ctx.db
      .query('workout_sessions')
      .withIndex('by_userId', (q) => q.eq('userId', identity.subject))
      .order('desc')
      .take(10)

    const todays = sessions.find(
      (session) =>
        session.createdAt >= startOfTodayMs && session.status !== 'failed'
    )
    if (!todays) return null

    const sets = await ctx.db
      .query('workout_sets')
      .withIndex('by_sessionId', (q) => q.eq('sessionId', todays._id))
      .collect()

    const totalTargetSets = todays.plan.reduce(
      (acc, exercise) => acc + exercise.targetSets,
      0
    )

    return {
      _id: todays._id,
      status: todays.status,
      goal: todays.goal,
      modality: todays.modality,
      durationMin: todays.durationMin,
      planCount: todays.plan.length,
      setsLogged: sets.length,
      totalTargetSets,
    }
  },
})

// Exercise tools for streaming function calling
const exerciseTools = [
  {
    type: 'function' as const,
    name: 'set_session_metadata',
    description:
      'Set the session goal, modality, and duration. Call this first before adding exercises.',
    strict: true,
    parameters: {
      type: 'object' as const,
      additionalProperties: false,
      properties: {
        goalFocus: {
          type: 'string',
          description: 'The main focus/goal of this session',
        },
        modality: {
          type: 'string',
          description:
            'The training modality (e.g., strength, cardio, mobility)',
        },
        durationMin: {
          type: 'number',
          description: 'Total session duration in minutes',
        },
      },
      required: ['goalFocus', 'modality', 'durationMin'],
    },
  },
  {
    type: 'function' as const,
    name: 'add_exercise',
    description:
      'Add an exercise to the workout plan. Call this for each exercise in order.',
    strict: true,
    parameters: {
      type: 'object' as const,
      additionalProperties: false,
      properties: {
        id: {
          type: 'string',
          description: 'Unique ID for this exercise (e.g., ex-1, ex-2)',
        },
        name: { type: 'string', description: 'Exercise name' },
        bodyPart: { type: 'string', description: 'Primary body part targeted' },
        modality: {
          type: 'string',
          description: 'Exercise modality (strength, cardio, mobility, etc.)',
        },
        instructions: {
          type: 'string',
          description: 'Clear instructions for performing the exercise',
        },
        equipment: {
          type: 'array',
          items: { type: 'string' },
          description: 'Required equipment',
        },
        targetSets: { type: 'integer', description: 'Number of sets' },
        targetReps: {
          type: 'array',
          items: { type: 'integer' },
          description: 'Rep range [min, max] or single value',
        },
        tempo: {
          type: 'string',
          description: 'Tempo notation (e.g., 3-1-2-1)',
        },
        restSec: {
          type: 'integer',
          description: 'Rest between sets in seconds',
        },
        durationMin: {
          type: 'number',
          description: 'Duration for timed exercises',
        },
        intensityCue: {
          type: 'string',
          description: 'Intensity guidance (e.g., RPE, % max)',
        },
        contraindications: {
          type: 'array',
          items: { type: 'string' },
          description: 'Who should avoid this exercise',
        },
        cues: {
          type: 'array',
          items: { type: 'string' },
          description: 'Coaching cues for proper form',
        },
        trackingMetric: {
          type: 'string',
          enum: ['weight_reps', 'duration', 'distance', 'breath', 'custom'],
          description: 'How to track progress',
        },
      },
      required: [
        'id',
        'name',
        'bodyPart',
        'modality',
        'instructions',
        'equipment',
        'targetSets',
        'targetReps',
        'tempo',
        'restSec',
        'cues',
        'trackingMetric',
        'durationMin',
        'intensityCue',
        'contraindications',
      ],
    },
  },
  {
    type: 'function' as const,
    name: 'finish_plan',
    description:
      'Call this when you have added all exercises to complete the workout plan.',
    strict: true,
    parameters: {
      type: 'object' as const,
      additionalProperties: false,
      properties: {},
      required: [] as string[],
    },
  },
]

async function buildWorkoutPlan(
  profile: Profile,
  citations: Citation[],
  facts: Fact[],
  profileSummary: string | null
): Promise<PlanPayload> {
  const client = getOpenAI()
  const model = getOpenAIModel()

  // Build the system prompt - enhanced when we have a profile summary
  const systemPromptText = profileSummary
    ? `You are an AI trainer who programs deeply personalised sessions based on comprehensive client assessments.

You have access to a detailed client profile summary that includes their pain levels, energy patterns, sleep quality, motivation, barriers, and training preferences. USE THIS INFORMATION to create a session that:
- Respects their current pain/discomfort levels and avoids aggravating movements
- Matches their energy and recovery state
- Aligns with their stated preferences and what motivates them
- Addresses their specific barriers and challenges
- Progresses appropriately for their confidence level

Plans must account for sex, age, injuries, conditions, medications, and lifestyle. Use proven approaches and cue breath, tempo, and intent.`
    : 'You are an AI trainer who programs personalised sessions. Plans must account for sex, age, injuries, conditions, medications, and lifestyle. Use proven approaches and cue breath, tempo, and intent.'

  // Build the user prompt using only the profile summary
  const userPromptParts: string[] = []

  if (profileSummary) {
    userPromptParts.push(
      '=== CLIENT PROFILE ===',
      profileSummary,
      '=== END PROFILE ==='
    )
  } else {
    // Fallback to basic profile if no summary available yet
    userPromptParts.push('Profile JSON:', JSON.stringify(profile))
  }

  userPromptParts.push(
    '\nRelevant health facts:',
    JSON.stringify(facts),
    '\nCitations (for awareness, do not invent new IDs):',
    JSON.stringify(citations),
    '\nOutput JSON matching the schema. Make sure exercises are appropriate for this specific client based on ALL the information provided.'
  )

  try {
    const planRequest: PlanResponseParams = {
      model,
      ...openAIResponsesLowLatency,
      text: {
        format: {
          type: 'json_schema',
          name: 'personalized_plan',
          schema: {
            type: 'object',
            additionalProperties: false,
            required: ['goalFocus', 'modality', 'durationMin', 'exercises'],
            properties: {
              goalFocus: { type: 'string' },
              modality: { type: 'string' },
              durationMin: { type: 'number' },
              exercises: {
                type: 'array',
                minItems: 4,
                items: {
                  type: 'object',
                  additionalProperties: false,
                  required: [
                    'id',
                    'name',
                    'bodyPart',
                    'modality',
                    'instructions',
                    'equipment',
                    'targetSets',
                    'targetReps',
                    'tempo',
                    'restSec',
                    'cues',
                    'trackingMetric',
                    'durationMin',
                    'intensityCue',
                    'contraindications',
                  ],
                  properties: {
                    id: { type: 'string' },
                    name: { type: 'string' },
                    bodyPart: { type: 'string' },
                    modality: { type: 'string' },
                    instructions: { type: 'string' },
                    equipment: { type: 'array', items: { type: 'string' } },
                    targetSets: { type: 'integer' },
                    targetReps: {
                      type: 'array',
                      items: { type: 'integer' },
                      minItems: 1,
                      maxItems: 3,
                    },
                    tempo: { type: 'string' },
                    restSec: { type: 'integer' },
                    durationMin: { type: 'number' },
                    intensityCue: { type: 'string' },
                    contraindications: {
                      type: 'array',
                      items: { type: 'string' },
                    },
                    cues: { type: 'array', items: { type: 'string' } },
                    trackingMetric: {
                      type: 'string',
                      enum: [
                        'weight_reps',
                        'duration',
                        'distance',
                        'breath',
                        'custom',
                      ],
                    },
                  },
                },
              },
            },
          },
        },
      },
      input: [
        {
          role: 'system',
          content: [
            {
              type: 'input_text',
              text: systemPromptText,
            },
          ],
        },
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: userPromptParts.join(' '),
            },
          ],
        },
      ],
    }

    const response = await client.responses.parse<
      PlanResponseParams,
      PlanPayload
    >(planRequest)

    const parsed = response.output_parsed
    if (!parsed) {
      throw new Error('Plan generation did not return structured output')
    }

    return {
      goalFocus: parsed.goalFocus ?? profile.goal,
      modality: parsed.modality ?? inferModality(profile),
      durationMin: parsed.durationMin ?? estimateDuration(profile),
      exercises: normalizeExercises(parsed.exercises ?? []),
    }
  } catch (error) {
    console.error('Failed to generate plan, using fallback', error)
    return fallbackPlan(profile)
  }
}

// TRUE streaming version - persists each exercise as OpenAI generates it
async function buildWorkoutPlanStreaming(
  ctx: ActionCtx,
  sessionId: Id<'workout_sessions'>,
  profile: Profile,
  citations: Citation[],
  facts: Fact[],
  profileSummary: string | null,
  checkinData: CheckinData | null = null,
  recommendationSeed: RecommendationSeed | null = null,
  cycleStatus: CycleStatus | null = null
): Promise<{ goalFocus: string; modality: string; durationMin: number }> {
  const client = getOpenAI()
  const model = getOpenAIModel()

  // Build the system prompt - enhanced when we have a profile summary and/or check-in
  let systemPromptText = profileSummary
    ? `You are an AI trainer who programs deeply personalised sessions based on comprehensive client assessments.

You have access to a detailed client profile summary that includes their pain levels, energy patterns, sleep quality, motivation, barriers, and training preferences. USE THIS INFORMATION to create a session that:
- Respects their current pain/discomfort levels and avoids aggravating movements
- Matches their energy and recovery state
- Aligns with their stated preferences and what motivates them
- Addresses their specific barriers and challenges
- Progresses appropriately for their confidence level

Plans must account for sex, age, injuries, conditions, medications, and lifestyle. Use proven approaches and cue breath, tempo, and intent.`
    : `You are an AI trainer who programs personalised sessions. Plans must account for sex, age, injuries, conditions, medications, and lifestyle. Use proven approaches and cue breath, tempo, and intent.`

  // Add check-in awareness to system prompt
  if (checkinData) {
    systemPromptText += `

CRITICAL: The client has completed a pre-session check-in reporting their state TODAY. This check-in data takes priority for session design:
- Adjust intensity based on their current energy and sleep quality
- Modify exercise selection based on current pain levels and areas
- Match the workout type and intensity to what they've requested
- Respect the time available they've specified for today`
  }

  // Add cycle-phase awareness when the user opted in and we have data.
  if (cycleStatus && cycleStatus.hasData) {
    systemPromptText += `

The client opted in to cycle-aware programming and has data logged. Use the cycle context (provided in the user message) to nudge volume, intensity, and exercise selection appropriately. Today's check-in still wins on intensity decisions when both are present.`
  }

  if (recommendationSeed) {
    const sourceLabel =
      recommendationSeed.source === 'exploration'
        ? 'a "Try something new" recommendation (a modality the user has NOT tried recently)'
        : 'an "Aligned" recommendation (matches their existing preferences)'
    systemPromptText += `

TODAY'S SESSION SEED: The user explicitly tapped ${sourceLabel} to start this session. The session you build MUST deliver on this recommendation:
- Title: "${recommendationSeed.title}"
- Modality: ${recommendationSeed.modality}
- Target duration: ${recommendationSeed.durationMin} minutes
- Target move count: ${recommendationSeed.moveCount} (±2)
- What was promised: ${recommendationSeed.description}
- Why it fits this client: ${recommendationSeed.reasoning}
- Tags: ${recommendationSeed.tags.join(', ') || 'none'}

Rules:
1. Set goalFocus to the recommendation title (or a close paraphrase that captures its spirit).
2. Match the modality and aim for the target duration within ±5 minutes.
3. Pick exercises that visibly deliver on the promise above, not generic substitutes.
4. Override the recommendation ONLY when an injury, condition, or check-in flag makes a specific exercise unsafe — and substitute a safer equivalent that still honors the spirit of the recommendation.
5. Today's check-in (if present) still wins on intensity and pain-area exclusions.`
  }

  systemPromptText += `

IMPORTANT: Use the provided tools to build the plan step by step:
1. First call set_session_metadata with the goal, modality, and duration
2. Then call add_exercise for each exercise (aim for 6-10 exercises)
3. Finally call finish_plan when done`

  // Build the user prompt
  const userPromptParts: string[] = []

  if (profileSummary) {
    userPromptParts.push(
      '=== CLIENT PROFILE ===',
      profileSummary,
      '=== END PROFILE ==='
    )
  } else {
    userPromptParts.push('Profile JSON:', JSON.stringify(profile))
  }

  // Add check-in data if available (this is TODAY's state)
  if (checkinData) {
    userPromptParts.push('\n' + formatCheckinForPrompt(checkinData))
  }

  if (cycleStatus && cycleStatus.hasData) {
    const cycleBlock = formatCycleForPrompt(cycleStatus)
    if (cycleBlock) {
      userPromptParts.push('\n' + cycleBlock)
    }
  }

  if (recommendationSeed) {
    userPromptParts.push(
      '\n=== RECOMMENDATION THE USER PICKED ===',
      JSON.stringify(recommendationSeed, null, 2),
      'Build the session around this recommendation. See system rules above.'
    )
  }

  userPromptParts.push(
    '\nRelevant health facts:',
    JSON.stringify(facts),
    '\nCitations (for awareness, do not invent new IDs):',
    JSON.stringify(citations),
    '\nCreate a personalized workout plan for this client. Call set_session_metadata first, then add_exercise for each exercise, then finish_plan.'
  )

  // Track metadata and exercises
  let metadata = {
    goalFocus: profile.goal,
    modality: inferModality(profile),
    durationMin: estimateDuration(profile),
  }
  let exerciseCount = 0
  let continueLoop = true
  let iterations = 0
  const maxIterations = 6

  try {
    console.log('[buildWorkoutPlanStreaming] Starting with model:', model)

    // True streaming: persist each tool call the moment its arguments
    // finish streaming so the UI can render exercise #1 before the rest
    // of the plan is generated.
    let previousResponseId: string | undefined
    let nextInput: unknown = [
      { role: 'system', content: systemPromptText },
      { role: 'user', content: userPromptParts.join('\n') },
    ]

    while (continueLoop && iterations < maxIterations) {
      iterations++

      const streamParams = {
        model,
        ...openAIResponsesLowLatency,
        tools: exerciseTools,
        input: nextInput,
        ...(previousResponseId
          ? { previous_response_id: previousResponseId }
          : {}),
      } as unknown as Parameters<typeof client.responses.stream>[0]

      console.log(
        `[buildWorkoutPlanStreaming] Iteration ${iterations}: starting stream`
      )

      const stream = client.responses.stream(streamParams)
      const toolResults: {
        type: 'function_call_output'
        call_id: string
        output: string
      }[] = []
      let toolCallsInThisIteration = 0

      for await (const event of stream) {
        if (event.type !== 'response.output_item.done') continue
        const item = event.item
        if (item.type !== 'function_call') continue
        toolCallsInThisIteration++

        try {
          const args = JSON.parse(item.arguments)

          switch (item.name) {
            case 'set_session_metadata':
              metadata = {
                goalFocus: args.goalFocus || profile.goal,
                modality: args.modality || inferModality(profile),
                durationMin: args.durationMin || estimateDuration(profile),
              }
              await ctx.runMutation(internal.trainer.updateSessionMetadata, {
                sessionId,
                goal: metadata.goalFocus,
                modality: metadata.modality,
                durationMin: metadata.durationMin,
              })
              console.log(
                `[buildWorkoutPlanStreaming] Set metadata: ${metadata.goalFocus}`
              )
              break

            case 'add_exercise': {
              exerciseCount++
              const exercise = normalizeExercise(args)
              await ctx.runMutation(internal.trainer.appendSessionExercise, {
                sessionId,
                exercise,
              })
              console.log(
                `[buildWorkoutPlanStreaming] Streamed exercise ${exerciseCount}: ${exercise.name}`
              )
              break
            }

            case 'finish_plan':
              continueLoop = false
              console.log(
                `[buildWorkoutPlanStreaming] Plan complete with ${exerciseCount} exercises`
              )
              break
          }

          toolResults.push({
            type: 'function_call_output',
            call_id: item.call_id,
            output: JSON.stringify({ success: true, exerciseCount }),
          })
        } catch (parseError) {
          console.error(
            `Error processing tool call ${item.name}:`,
            parseError
          )
          toolResults.push({
            type: 'function_call_output',
            call_id: item.call_id,
            output: JSON.stringify({ error: 'Failed to parse' }),
          })
        }
      }

      const finalResponse = await stream.finalResponse()
      previousResponseId = finalResponse.id

      if (!continueLoop) break
      if (toolCallsInThisIteration === 0) break

      // Feed tool results back so the model can keep going.
      nextInput = toolResults
    }

    // If no exercises were added, use fallback
    if (exerciseCount === 0) {
      console.warn('No exercises generated, using fallback')
      const fallback = fallbackPlan(profile)
      for (const exercise of fallback.exercises) {
        await ctx.runMutation(internal.trainer.appendSessionExercise, {
          sessionId,
          exercise,
        })
      }
      return {
        goalFocus: fallback.goalFocus,
        modality: fallback.modality,
        durationMin: fallback.durationMin,
      }
    }

    return metadata
  } catch (error) {
    console.error('Failed to generate plan, using fallback', error)
    const fallback = fallbackPlan(profile)
    for (const exercise of fallback.exercises) {
      await ctx.runMutation(internal.trainer.appendSessionExercise, {
        sessionId,
        exercise,
      })
    }
    return {
      goalFocus: fallback.goalFocus,
      modality: fallback.modality,
      durationMin: fallback.durationMin,
    }
  }
}

// Helper to normalize a single exercise from tool call args
function normalizeExercise(args: Partial<ExercisePlan>): ExercisePlan {
  const trackingMetric = args.trackingMetric || 'weight_reps'
  const modality = args.modality || 'strength'
  const defaultReps =
    trackingMetric === 'duration'
      ? [1]
      : trackingMetric === 'breath'
        ? [5]
        : [10, 12]

  return {
    id: args.id || `ex-${Date.now()}`,
    name: args.name || 'Exercise',
    bodyPart: args.bodyPart || 'full body',
    modality,
    instructions: args.instructions || '',
    equipment: args.equipment || [],
    targetSets: args.targetSets || 3,
    targetReps: args.targetReps || defaultReps,
    tempo: args.tempo || '2-0-2-0',
    restSec: args.restSec || 60,
    durationMin: args.durationMin,
    intensityCue: args.intensityCue,
    contraindications: args.contraindications,
    cues: args.cues || [],
    trackingMetric,
  }
}

function normalizeExercises(
  exercises: Partial<ExercisePlan>[] = []
): ExercisePlan[] {
  return exercises.map((exercise) => {
    const trackingMetric = exercise.trackingMetric || 'weight_reps'
    const modality = exercise.modality || 'strength'
    const defaultReps =
      trackingMetric === 'duration'
        ? [1]
        : modality.includes('cardio')
          ? [1]
          : [10]
    const repsArray = Array.isArray(exercise.targetReps)
      ? exercise.targetReps
      : exercise.targetReps != null
        ? [exercise.targetReps]
        : defaultReps
    return {
      id: exercise.id || generateExerciseId(),
      name: exercise.name || 'Movement Prep',
      bodyPart: exercise.bodyPart || 'Full body',
      modality,
      instructions:
        exercise.instructions ||
        'Controlled tempo, stay pain-free, and breathe through the rib cage.',
      equipment:
        exercise.equipment && exercise.equipment.length
          ? exercise.equipment
          : ['Bodyweight'],
      targetSets: exercise.targetSets || 2,
      targetReps: repsArray,
      tempo: exercise.tempo || '2-1-2',
      restSec: exercise.restSec || 45,
      durationMin: exercise.durationMin,
      intensityCue: exercise.intensityCue,
      contraindications: exercise.contraindications,
      cues: exercise.cues?.length
        ? exercise.cues
        : ['Breathe through the ribs', 'Own the end range'],
      trackingMetric,
    }
  })
}

function buildCoachComments(
  profile: Profile,
  plan: ExercisePlan[],
  durationMin: number,
  goal: string
): CoachComment[] {
  const comments: CoachComment[] = []
  const totalSets = plan.reduce((total, item) => total + item.targetSets, 0)
  const halfSetIndex = Math.ceil(totalSets / 2)
  let runningSetCount = 0

  comments.push({
    id: generateCoachId(),
    trigger: 'session_start',
    text: `Today's focus: ${goal}. Keep breath light and stay in control.`,
  })

  plan.forEach((exercise) => {
    comments.push({
      id: `coach-pre-${exercise.id}`,
      trigger: 'before_set',
      exerciseId: exercise.id,
      text: `${exercise.name}: ${exercise.cues[0] ?? 'Move smoothly'}.`,
    })

    runningSetCount += exercise.targetSets
    if (runningSetCount >= halfSetIndex) {
      comments.push({
        id: `coach-mid-${exercise.id}`,
        trigger: 'mid_session',
        delaySec: Math.max(Math.round((durationMin / 2) * 60), 60),
        text: `Halfway there, ${profile.name.split(' ')[0]}. Stay tall and check in with pain levels.`,
      })
    }

    comments.push({
      id: `coach-post-${exercise.id}`,
      trigger: 'after_set',
      exerciseId: exercise.id,
      text: `Nice work on ${exercise.name}. Shake out tension before the next block.`,
    })
  })

  comments.push({
    id: generateCoachId(),
    trigger: 'session_end',
    text: `Session done. Log how you feel so I can fine-tune recovery next time.`,
  })

  return comments
}

function inferModality(profile: Profile) {
  if (profile.goal.toLowerCase().includes('run'))
    return 'run + strength support'
  if (profile.goal.toLowerCase().includes('yoga')) return 'yoga mobility'
  if (profile.goal.toLowerCase().includes('pilates')) return 'pilates core'
  if (profile.activityLevel && profile.activityLevel === 'sedentary')
    return 'gentle strength & mobility'
  return 'strength & conditioning'
}

function estimateDuration(profile: Profile) {
  const defaultDuration = 35
  const timeSlot = profile.timeAvailable.at(0)
  if (!timeSlot) return defaultDuration
  const numeric = Number(timeSlot.replace(/[^0-9]/g, ''))
  if (!Number.isFinite(numeric)) return defaultDuration
  return Math.min(Math.max(numeric, 15), 75)
}

function fallbackPlan(profile: Profile): PlanPayload {
  const defaultExercises: ExercisePlan[] = [
    {
      id: createId('fallback'),
      name: 'Cat-Camel Mobility',
      bodyPart: 'Spine',
      modality: 'mobility',
      instructions:
        'Move slowly through flexion and extension for spinal fluidity.',
      equipment: [],
      targetSets: 2,
      targetReps: [10],
      tempo: '3-1-3',
      restSec: 30,
      cues: ['Breathe through the ribcage', 'Don’t force end range'],
      trackingMetric: 'breath',
    },
    {
      id: createId('fallback'),
      name: 'Split Squat ISO',
      bodyPart: 'Lower body',
      modality: 'strength',
      instructions: 'Hold a split squat at mid-range, drive front foot down.',
      equipment: ['Bodyweight'],
      targetSets: 3,
      targetReps: [30],
      tempo: 'ISO',
      restSec: 45,
      cues: ['Long spine', 'Front knee tracks over toes'],
      trackingMetric: 'duration',
    },
    {
      id: createId('fallback'),
      name: 'Dead Bug Reach',
      bodyPart: 'Core',
      modality: 'anti-extension',
      instructions: 'Alternate limbs while keeping lumbar spine heavy.',
      equipment: ['Bodyweight'],
      targetSets: 3,
      targetReps: [8],
      tempo: '2-1-2',
      restSec: 45,
      cues: ['Exhale to rib cage', 'Keep low back grounded'],
      trackingMetric: 'weight_reps',
    },
    {
      id: createId('fallback'),
      name: 'Breathing Ladder',
      bodyPart: 'Cardio',
      modality: 'breathwork',
      instructions: 'Box breathing: inhale 4, hold 4, exhale 6, hold 2.',
      equipment: [],
      targetSets: 4,
      targetReps: [1],
      tempo: 'Timed breath',
      restSec: 0,
      cues: ['Jaw relaxed', 'Nasal breathing'],
      trackingMetric: 'breath',
    },
  ]

  return {
    goalFocus: profile.goal,
    modality: inferModality(profile),
    durationMin: estimateDuration(profile),
    exercises: defaultExercises,
  }
}
