import { v } from 'convex/values'
import type {
  ResponseCreateParamsNonStreaming,
  ResponseFormatTextJSONSchemaConfig,
} from 'openai/resources/responses/responses'
import { internal } from './_generated/api'
import type { Doc, Id } from './_generated/dataModel'
import {
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
  type QueryCtx,
} from './_generated/server'
import { getOpenAI, getOpenAIModel, openAIResponsesLowLatency } from './openai'

const metricArg = v.object({
  kind: v.union(
    v.literal('body_weight'),
    v.literal('distance'),
    v.literal('frequency'),
    v.literal('duration'),
    v.literal('custom')
  ),
  unit: v.string(),
  startValue: v.optional(v.number()),
  targetValue: v.optional(v.number()),
  direction: v.union(
    v.literal('increase'),
    v.literal('decrease'),
    v.literal('maintain')
  ),
})

const categoryArg = v.union(
  v.literal('endurance'),
  v.literal('weight_loss'),
  v.literal('weight_gain'),
  v.literal('strength'),
  v.literal('habit'),
  v.literal('custom')
)

type ChallengeDoc = Doc<'challenges'>

type ProgramResponse = {
  overview: string
  weeklySessions: number
  weeks: {
    weekNumber: number
    focus: string
    summary: string
    target: string
  }[]
}

type ProgramRequestParams = ResponseCreateParamsNonStreaming & {
  text: { format: ResponseFormatTextJSONSchemaConfig }
}

const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000

function requireOwner(challenge: ChallengeDoc | null, userId: string) {
  if (!challenge || challenge.userId !== userId) {
    throw new Error('Challenge not found')
  }
  return challenge
}

// Shared progress math so the detail query and logProgress stay in sync.
function computeProgressPercent(
  challenge: ChallengeDoc,
  latestValue: number | null,
  completedSessions: number
): number {
  const m = challenge.metric
  const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)))

  if (
    m.startValue != null &&
    m.targetValue != null &&
    m.direction !== 'maintain' &&
    m.targetValue !== m.startValue &&
    latestValue != null
  ) {
    const total = Math.abs(m.targetValue - m.startValue)
    const done =
      m.direction === 'increase'
        ? latestValue - m.startValue
        : m.startValue - latestValue
    return clamp((done / total) * 100)
  }

  if (m.kind === 'frequency' && m.targetValue != null && m.targetValue > 0) {
    return clamp((completedSessions / m.targetValue) * 100)
  }

  // Fallback: reward consistency without ever auto-completing.
  return clamp(Math.min(90, completedSessions * 10))
}

async function getLatestManualValue(
  ctx: QueryCtx,
  challengeId: Id<'challenges'>
): Promise<number | null> {
  const entries = await ctx.db
    .query('challenge_progress')
    .withIndex('by_challenge', (q) => q.eq('challengeId', challengeId))
    .collect()
  const manual = entries
    .filter((e) => e.source === 'manual')
    .sort((a, b) => b.recordedAt - a.recordedAt)
  return manual.length > 0 ? manual[0].value : null
}

async function countCompletedSessionsSince(
  ctx: QueryCtx,
  userId: string,
  since: number
): Promise<number> {
  const completed = await ctx.db
    .query('workout_sessions')
    .withIndex('by_user_status', (q) =>
      q.eq('userId', userId).eq('status', 'completed')
    )
    .collect()
  return completed.filter((s) => s.updatedAt >= since).length
}

export const createChallenge = mutation({
  args: {
    title: v.string(),
    category: categoryArg,
    description: v.string(),
    metric: metricArg,
    targetDate: v.optional(v.number()),
  },
  returns: v.id('challenges'),
  handler: async (ctx, args): Promise<Id<'challenges'>> => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error('Not authenticated')
    }

    const now = Date.now()
    const challengeId = await ctx.db.insert('challenges', {
      userId: identity.subject,
      title: args.title,
      category: args.category,
      description: args.description,
      metric: args.metric,
      targetDate: args.targetDate,
      status: 'generating',
      createdAt: now,
      updatedAt: now,
    })

    await ctx.scheduler.runAfter(
      0,
      internal.challenges.generateChallengeProgram,
      { challengeId, userId: identity.subject }
    )

    return challengeId
  },
})

export const getChallengeByIdInternal = internalQuery({
  args: { challengeId: v.id('challenges') },
  handler: async (ctx, { challengeId }) => {
    return await ctx.db.get(challengeId)
  },
})

export const patchChallengeProgram = internalMutation({
  args: {
    challengeId: v.id('challenges'),
    program: v.object({
      overview: v.string(),
      weeklySessions: v.number(),
      weeks: v.array(
        v.object({
          weekNumber: v.number(),
          focus: v.string(),
          summary: v.string(),
          target: v.string(),
        })
      ),
    }),
  },
  handler: async (ctx, { challengeId, program }) => {
    await ctx.db.patch(challengeId, {
      program,
      status: 'active',
      error: undefined,
      updatedAt: Date.now(),
    })
  },
})

export const markChallengeFailed = internalMutation({
  args: { challengeId: v.id('challenges'), error: v.string() },
  handler: async (ctx, { challengeId, error }) => {
    await ctx.db.patch(challengeId, {
      status: 'failed',
      error,
      updatedAt: Date.now(),
    })
  },
})

export const generateChallengeProgram = internalAction({
  args: { challengeId: v.id('challenges'), userId: v.string() },
  handler: async (ctx, { challengeId, userId }) => {
    try {
      const challenge = await ctx.runQuery(
        internal.challenges.getChallengeByIdInternal,
        { challengeId }
      )
      if (!challenge) {
        throw new Error('Challenge missing')
      }

      const profileDoc = await ctx.runQuery(
        internal.trainer.getOnboardingByUserId,
        { userId }
      )
      const extendedProfile = await ctx.runQuery(
        internal.trainer.getExtendedProfileByUserId,
        { userId }
      )
      const profileSummary = extendedProfile?.profileSummary ?? null

      // Decide a sensible program length: from target date if present, else 8.
      const now = Date.now()
      let weekCount = 8
      if (challenge.targetDate && challenge.targetDate > now) {
        weekCount = Math.round((challenge.targetDate - now) / MS_PER_WEEK)
      }
      weekCount = Math.max(4, Math.min(16, weekCount))

      const m = challenge.metric
      const targetText =
        m.targetValue != null
          ? `${m.direction} toward ${m.targetValue} ${m.unit}${
              m.startValue != null ? ` (currently ${m.startValue} ${m.unit})` : ''
            }`
          : `${m.direction} ${m.unit}`

      const systemPrompt = `You are an AI coach who designs safe, progressive multi-week training programs for everyday people.

Rules:
- Build a ${weekCount}-week program that realistically moves the client toward their goal.
- Progress load/volume gradually and bake in lighter recovery weeks.
- Respect the client's age, injuries, conditions, medications, and lifestyle.
- Each week needs a short focus label, a 1-2 sentence summary, and a concrete weekly target.
- Keep language warm, direct, and free of medical claims.
- Output JSON matching the schema exactly.`

      const userParts: string[] = []
      userParts.push(
        '=== GOAL ===',
        `Title: ${challenge.title}`,
        `Category: ${challenge.category}`,
        `Description: ${challenge.description || '(none provided)'}`,
        `Metric: ${m.kind} measured in ${m.unit}`,
        `Target: ${targetText}`,
        challenge.targetDate
          ? `Deadline: ${new Date(challenge.targetDate).toDateString()}`
          : 'Deadline: open-ended',
        ''
      )
      if (profileSummary) {
        userParts.push('=== CLIENT PROFILE ===', profileSummary, '')
      } else if (profileDoc) {
        userParts.push(
          '=== CLIENT PROFILE ===',
          JSON.stringify({
            age: profileDoc.age,
            gender: profileDoc.gender,
            goal: profileDoc.goal,
            activityLevel: profileDoc.activityLevel,
            injuries: profileDoc.injuries,
            conditions: profileDoc.conditions,
          }),
          ''
        )
      }
      userParts.push(
        `Produce exactly ${weekCount} weeks (weekNumber 1..${weekCount}) plus a short overview and a recommended weekly session count.`
      )

      const client = getOpenAI()
      const model = getOpenAIModel()

      const request: ProgramRequestParams = {
        model,
        ...openAIResponsesLowLatency,
        text: {
          format: {
            type: 'json_schema',
            name: 'challenge_program',
            schema: {
              type: 'object',
              additionalProperties: false,
              required: ['overview', 'weeklySessions', 'weeks'],
              properties: {
                overview: { type: 'string' },
                weeklySessions: { type: 'integer' },
                weeks: {
                  type: 'array',
                  minItems: weekCount,
                  maxItems: weekCount,
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    required: ['weekNumber', 'focus', 'summary', 'target'],
                    properties: {
                      weekNumber: { type: 'integer' },
                      focus: { type: 'string' },
                      summary: { type: 'string' },
                      target: { type: 'string' },
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
            content: [{ type: 'input_text', text: userParts.join('\n') }],
          },
        ],
      }

      const response = await client.responses.parse<
        ProgramRequestParams,
        ProgramResponse
      >(request)
      const parsed = response.output_parsed
      if (!parsed) {
        throw new Error('Could not generate a program')
      }

      await ctx.runMutation(internal.challenges.patchChallengeProgram, {
        challengeId,
        program: {
          overview: parsed.overview,
          weeklySessions: parsed.weeklySessions,
          weeks: parsed.weeks
            .slice()
            .sort((a, b) => a.weekNumber - b.weekNumber),
        },
      })
    } catch (error) {
      console.error('Failed to generate challenge program:', error)
      await ctx.runMutation(internal.challenges.markChallengeFailed, {
        challengeId,
        error:
          error instanceof Error ? error.message : 'Program generation failed',
      })
    }
  },
})

export const listChallenges = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      return []
    }

    const challenges = await ctx.db
      .query('challenges')
      .withIndex('by_userId', (q) => q.eq('userId', identity.subject))
      .order('desc')
      .collect()

    const visible = challenges.filter((c) => c.status !== 'archived')

    return await Promise.all(
      visible.map(async (challenge) => {
        const latestValue = await getLatestManualValue(ctx, challenge._id)
        const completedSessions = await countCompletedSessionsSince(
          ctx,
          identity.subject,
          challenge.createdAt
        )
        return {
          _id: challenge._id,
          title: challenge.title,
          category: challenge.category,
          status: challenge.status,
          metric: challenge.metric,
          targetDate: challenge.targetDate,
          weekCount: challenge.program?.weeks.length ?? 0,
          percent: computeProgressPercent(
            challenge,
            latestValue,
            completedSessions
          ),
          latestValue,
          completedSessions,
        }
      })
    )
  },
})

export const getChallengeDetail = query({
  args: { challengeId: v.id('challenges') },
  handler: async (ctx, { challengeId }) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      return null
    }

    const challenge = await ctx.db.get(challengeId)
    if (!challenge || challenge.userId !== identity.subject) {
      return null
    }

    const entries = (
      await ctx.db
        .query('challenge_progress')
        .withIndex('by_challenge', (q) => q.eq('challengeId', challengeId))
        .collect()
    ).sort((a, b) => a.recordedAt - b.recordedAt)

    const manualEntries = entries.filter((e) => e.source === 'manual')
    const latestValue =
      manualEntries.length > 0
        ? manualEntries[manualEntries.length - 1].value
        : null
    const completedSessions = await countCompletedSessionsSince(
      ctx,
      identity.subject,
      challenge.createdAt
    )

    return {
      challenge,
      entries,
      latestValue,
      completedSessions,
      percent: computeProgressPercent(
        challenge,
        latestValue,
        completedSessions
      ),
    }
  },
})

export const logProgress = mutation({
  args: {
    challengeId: v.id('challenges'),
    value: v.number(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, { challengeId, value, note }) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error('Not authenticated')
    }

    const challenge = requireOwner(
      await ctx.db.get(challengeId),
      identity.subject
    )

    const now = Date.now()
    await ctx.db.insert('challenge_progress', {
      userId: identity.subject,
      challengeId,
      value,
      unit: challenge.metric.unit,
      note,
      source: 'manual',
      recordedAt: now,
    })

    // Auto-complete when the goal is reached (only for measurable targets).
    const completedSessions = await countCompletedSessionsSince(
      ctx,
      identity.subject,
      challenge.createdAt
    )
    const percent = computeProgressPercent(challenge, value, completedSessions)
    if (
      percent >= 100 &&
      challenge.status === 'active' &&
      challenge.metric.targetValue != null
    ) {
      await ctx.db.patch(challengeId, {
        status: 'completed',
        updatedAt: now,
      })
    } else {
      await ctx.db.patch(challengeId, { updatedAt: now })
    }
  },
})

export const archiveChallenge = mutation({
  args: { challengeId: v.id('challenges') },
  handler: async (ctx, { challengeId }) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error('Not authenticated')
    }
    requireOwner(await ctx.db.get(challengeId), identity.subject)
    await ctx.db.patch(challengeId, {
      status: 'archived',
      updatedAt: Date.now(),
    })
  },
})

export const deleteChallenge = mutation({
  args: { challengeId: v.id('challenges') },
  handler: async (ctx, { challengeId }) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error('Not authenticated')
    }
    requireOwner(await ctx.db.get(challengeId), identity.subject)

    const entries = await ctx.db
      .query('challenge_progress')
      .withIndex('by_challenge', (q) => q.eq('challengeId', challengeId))
      .collect()
    for (const entry of entries) {
      await ctx.db.delete(entry._id)
    }
    await ctx.db.delete(challengeId)
  },
})

// Used by the trainer to nudge the daily session toward an active goal.
export const getActiveChallengeByUserId = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const active = await ctx.db
      .query('challenges')
      .withIndex('by_user_status', (q) =>
        q.eq('userId', userId).eq('status', 'active')
      )
      .order('desc')
      .first()
    return active
  },
})
