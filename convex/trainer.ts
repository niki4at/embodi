import { v } from 'convex/values'
import OpenAI from 'openai'
import type {
  ResponseCreateParamsNonStreaming,
  ResponseFormatTextJSONSchemaConfig,
} from 'openai/resources/responses/responses'
import { api } from './_generated/api'
import { action, mutation, query } from './_generated/server'
import {
  distillCitationsForProfile,
  searchCitationsForProfile,
  type Citation as CitationSource,
  type CitationsProfile,
} from './citations'

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

let cachedOpenAI: OpenAI | null = null
const getOpenAI = () => {
  if (cachedOpenAI) return cachedOpenAI
  const apiKey = process.env.OPEN_API_KEY
  if (!apiKey) {
    throw new Error('OPEN_API_KEY is not configured')
  }
  cachedOpenAI = new OpenAI({ apiKey })
  return cachedOpenAI
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

    const citations = await searchCitationsForProfile(profile)
    const healthFacts = await distillCitationsForProfile(profile, citations)

    const planPayload = await buildWorkoutPlan(profile, citations, healthFacts)

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
      await ctx.db.patch(args.sessionId, {
        status: 'completed',
        updatedAt: Date.now(),
      })
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

    await ctx.db.patch(args.sessionId, {
      status: 'completed',
      updatedAt: Date.now(),
    })
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

async function buildWorkoutPlan(
  profile: Profile,
  citations: Citation[],
  facts: Fact[]
): Promise<PlanPayload> {
  const client = getOpenAI()

  try {
    const planRequest: PlanResponseParams = {
      model: 'gpt-5-mini-2025-08-07',
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
              text:
                'You are an AI trainer who programs personalised sessions. ' +
                'Plans must account for sex, age, injuries, conditions, medications, and lifestyle. ' +
                'Use proven approaches and cue breath, tempo, and intent.',
            },
          ],
        },
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: [
                'Profile JSON:',
                JSON.stringify(profile),
                '\nRelevant health facts:',
                JSON.stringify(facts),
                '\nCitations (for awareness, do not invent new IDs):',
                JSON.stringify(citations),
                '\nOutput JSON matching the schema.',
              ].join(' '),
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
