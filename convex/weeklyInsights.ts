import { v } from 'convex/values'
import OpenAI from 'openai'
import { api, internal } from './_generated/api'
import type { Doc, Id } from './_generated/dataModel'
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
  type ActionCtx,
} from './_generated/server'
import { getOpenAI, getOpenAIModel } from './openai'

/* -----------------------------------------------------------------------
 * Types & constants
 * -------------------------------------------------------------------- */

const MS_PER_DAY = 24 * 60 * 60 * 1000
const WEEK_MS = 7 * MS_PER_DAY
const ON_DEMAND_COOLDOWN_MS = 4 * 60 * 60 * 1000 // 4h between manual refreshes
const RESPONSES_ENDPOINT = '/v1/responses'

const ALLOWED_ICONS = [
  'flame.fill',
  'dumbbell.fill',
  'bolt.fill',
  'heart.fill',
  'heart',
  'figure.run',
  'figure.strengthtraining.traditional',
  'figure.flexibility',
  'figure.mind.and.body',
  'figure.yoga',
  'sparkles',
  'leaf.fill',
  'drop.fill',
  'sun.max.fill',
  'moon.fill',
  'chart.bar.fill',
  'chart.line.uptrend.xyaxis',
  'star.fill',
  'clock.fill',
  'timer',
  'calendar',
  'checkmark.circle.fill',
  'book.closed.fill',
  'plus.circle.fill',
  'arrow.up.right',
  'lungs.fill',
  'wind',
] as const

const ALLOWED_TINTS = [
  'primary',
  'success',
  'warning',
  'danger',
  'accentTeal',
  'accentPurple',
  'accentPink',
  'accentCoral',
] as const

const WEEKLY_INSIGHT_SCHEMA = {
  type: 'object' as const,
  additionalProperties: false,
  required: [
    'headline',
    'stats',
    'alignedRecommendations',
    'explorationRecommendations',
  ],
  properties: {
    headline: {
      type: 'string',
      description:
        'One short sentence that tells the user what this week was really about. Specific, warm, never generic.',
    },
    stats: {
      type: 'array',
      minItems: 4,
      maxItems: 4,
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'key',
          'label',
          'value',
          'unit',
          'icon',
          'tint',
          'trend',
          'story',
        ],
        properties: {
          key: {
            type: 'string',
            description:
              'Stable id you choose (e.g. streak, sessions, energy_avg, pain_drop, mobility_minutes, new_movement, sleep_avg, recovery_ratio).',
          },
          label: {
            type: 'string',
            description: 'Short label, max 14 chars (e.g. "Streak", "Pain drop").',
          },
          value: {
            type: 'string',
            description:
              'The headline number or short string (e.g. "7", "8.5", "-1.4", "Hips").',
          },
          unit: {
            type: 'string',
            description:
              'Unit suffix shown next to value (e.g. "days", "avg", "vs last wk"). Empty string allowed.',
          },
          icon: {
            type: 'string',
            enum: [...ALLOWED_ICONS],
          },
          tint: {
            type: 'string',
            enum: [...ALLOWED_TINTS],
          },
          trend: {
            type: ['string', 'null'],
            enum: ['up', 'down', 'flat', null],
            description:
              'Trend vs prior week, or null when there is no prior-week comparison.',
          },
          story: {
            type: ['string', 'null'],
            description:
              'Optional VERY short callout that fits inside a small card: max 55 characters / ~8 words. Must reference the user\'s actual data, not generic motivation. Return null if nothing punchy to say.',
          },
        },
      },
    },
    alignedRecommendations: {
      type: 'array',
      minItems: 2,
      maxItems: 3,
      description:
        'Workouts that match what the user already does and likes this week.',
      items: recommendationSchema(false),
    },
    explorationRecommendations: {
      type: 'array',
      minItems: 0,
      maxItems: 2,
      description:
        'Workouts in modalities the user has NOT tried yet this month, only if Embodi can track them safely and they would help. Return [] if no good fit.',
      items: recommendationSchema(true),
    },
  },
}

function recommendationSchema(isExploration: boolean) {
  const required = [
    'title',
    'durationMin',
    'moveCount',
    'modality',
    'badge',
    'badgeTint',
    'description',
    'tags',
    'reasoning',
  ]
  if (isExploration) required.push('whyNew')
  return {
    type: 'object' as const,
    additionalProperties: false,
    required,
    properties: {
      title: {
        type: 'string',
        description: 'Short workout title, max 32 chars.',
      },
      durationMin: { type: 'integer', minimum: 5, maximum: 75 },
      moveCount: { type: 'integer', minimum: 1, maximum: 12 },
      modality: {
        type: 'string',
        description:
          'Free-form modality tag (e.g. "Mobility", "Strength", "Breath", "Cardio", "Yoga").',
      },
      badge: {
        type: 'string',
        description:
          'Tone label, max 12 chars (e.g. "Gentle", "Calm", "Strong", "Spark").',
      },
      badgeTint: {
        type: 'string',
        enum: [...ALLOWED_TINTS],
      },
      description: {
        type: 'string',
        description:
          'Why-it-fits, max 140 chars. Reference the user’s own data when relevant.',
      },
      tags: {
        type: 'array',
        items: { type: 'string' },
        minItems: 1,
        maxItems: 3,
      },
      reasoning: {
        type: 'string',
        description:
          'One sentence connecting this to the user’s data or stated preference.',
      },
      ...(isExploration
        ? {
            whyNew: {
              type: 'string',
              description:
                'One sentence on why this NEW modality is worth trying this week and what they’ll learn.',
            },
          }
        : {}),
    },
  }
}

type WeeklyInsightPayload = {
  headline: string
  stats: Array<{
    key: string
    label: string
    value: string
    unit: string
    icon: string
    tint: string
    trend?: 'up' | 'down' | 'flat' | null
    story?: string | null
  }>
  alignedRecommendations: Array<{
    title: string
    durationMin: number
    moveCount: number
    modality: string
    badge: string
    badgeTint: string
    description: string
    tags: string[]
    reasoning: string
  }>
  explorationRecommendations: Array<{
    title: string
    durationMin: number
    moveCount: number
    modality: string
    badge: string
    badgeTint: string
    description: string
    tags: string[]
    reasoning: string
    whyNew: string
  }>
}

type UserContext = {
  userId: string
  weekStart: number
  weekEnd: number
  profile: {
    name: string
    age: string
    gender: string | null
    goal: string
    activityLevel: string | null
    timeAvailable: string[]
    injuries: string[]
    conditions: string[]
  }
  profileSummary: string | null
  thisWeek: {
    checkins: Array<{
      date: string
      energyLevel: number
      sleepQuality: string
      painLevel: number
      painAreas: string[]
      stressLevel: number
      workoutType: string
      intensityPreference: string
      timeAvailable: string
      notes?: string
    }>
    sessions: Array<{
      date: string
      goal: string
      modality: string
      durationMin: number
      status: string
      exerciseCount: number
      setsLogged: number
      modalitiesUsed: string[]
    }>
    totals: {
      sessionsCompleted: number
      totalDurationMin: number
      totalSetsLogged: number
      avgEnergy: number | null
      avgPain: number | null
      avgStress: number | null
      currentStreakDays: number
      modalitiesTried: string[]
    }
  }
  priorWeek: {
    sessionsCompleted: number
    avgEnergy: number | null
    avgPain: number | null
    modalitiesTried: string[]
  }
  modalitiesEverTried: string[]
  recentFeedback: Array<{
    rating: 'liked' | 'disliked'
    comment: string | null
    sections: string[]
    weekStart: number
  }>
  dataSignature: string
}

/* -----------------------------------------------------------------------
 * Time helpers
 * -------------------------------------------------------------------- */

function startOfIsoWeek(ts: number): number {
  const d = new Date(ts)
  d.setUTCHours(0, 0, 0, 0)
  const day = d.getUTCDay()
  const diff = (day + 6) % 7 // 0 (Mon) .. 6 (Sun)
  d.setUTCDate(d.getUTCDate() - diff)
  return d.getTime()
}

function dayKey(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10)
}

function average(values: number[]): number | null {
  if (values.length === 0) return null
  const total = values.reduce((s, v) => s + v, 0)
  return Math.round((total / values.length) * 10) / 10
}

function djb2Hash(input: string): string {
  let h = 5381
  for (let i = 0; i < input.length; i++) {
    h = ((h << 5) + h) ^ input.charCodeAt(i)
  }
  return (h >>> 0).toString(36)
}

/* -----------------------------------------------------------------------
 * Public queries / mutations (auth-required)
 * -------------------------------------------------------------------- */

export const getCurrentWeekInsight = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return null

    const weekStart = startOfIsoWeek(Date.now())

    const insight = await ctx.db
      .query('weekly_insights')
      .withIndex('by_userId_weekStart', (q) =>
        q.eq('userId', identity.subject).eq('weekStart', weekStart)
      )
      .first()

    if (!insight) return null

    const feedback = await ctx.db
      .query('weekly_insight_feedback')
      .withIndex('by_insightId', (q) => q.eq('insightId', insight._id))
      .order('desc')
      .first()

    return {
      _id: insight._id,
      weekStart: insight.weekStart,
      status: insight.status,
      source: insight.source,
      headline: insight.headline,
      stats: insight.stats,
      alignedRecommendations: insight.alignedRecommendations,
      explorationRecommendations: insight.explorationRecommendations,
      updatedAt: insight.updatedAt,
      feedback: feedback
        ? { rating: feedback.rating, comment: feedback.comment }
        : null,
    }
  },
})

export const submitWeeklyFeedback = mutation({
  args: {
    insightId: v.id('weekly_insights'),
    rating: v.union(v.literal('liked'), v.literal('disliked')),
    comment: v.optional(v.string()),
    sections: v.optional(v.array(v.string())),
  },
  handler: async (ctx, { insightId, rating, comment, sections }) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Not authenticated')

    const insight = await ctx.db.get(insightId)
    if (!insight || insight.userId !== identity.subject) {
      throw new Error('Insight not found')
    }

    const existing = await ctx.db
      .query('weekly_insight_feedback')
      .withIndex('by_insightId', (q) => q.eq('insightId', insightId))
      .first()

    const now = Date.now()
    if (existing) {
      await ctx.db.patch(existing._id, {
        rating,
        comment: comment ?? existing.comment,
        sections: sections ?? existing.sections,
      })
      return { feedbackId: existing._id }
    }

    const feedbackId = await ctx.db.insert('weekly_insight_feedback', {
      userId: identity.subject,
      insightId,
      weekStart: insight.weekStart,
      rating,
      comment,
      sections,
      createdAt: now,
    })
    return { feedbackId }
  },
})

export const requestRegeneration = action({
  args: { force: v.optional(v.boolean()) },
  handler: async (ctx, { force }): Promise<{ insightId: Id<'weekly_insights'> }> => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Not authenticated')

    const userId = identity.subject
    const weekStart = startOfIsoWeek(Date.now())

    if (!force) {
      const cooldown: { ok: boolean; insightId?: Id<'weekly_insights'> } =
        await ctx.runQuery(internal.weeklyInsights.checkCooldown, {
          userId,
          weekStart,
        })
      if (!cooldown.ok && cooldown.insightId) {
        return { insightId: cooldown.insightId }
      }
    }

    const insightId: Id<'weekly_insights'> = await ctx.runMutation(
      internal.weeklyInsights.upsertGeneratingInsight,
      { userId, weekStart, source: 'on_demand', dataSignature: 'pending' }
    )

    await ctx.scheduler.runAfter(0, internal.weeklyInsights.generateForUserSync, {
      userId,
      insightId,
    })

    return { insightId }
  },
})

/* -----------------------------------------------------------------------
 * Internal queries
 * -------------------------------------------------------------------- */

export const checkCooldown = internalQuery({
  args: { userId: v.string(), weekStart: v.number() },
  handler: async (ctx, { userId, weekStart }) => {
    const insight = await ctx.db
      .query('weekly_insights')
      .withIndex('by_userId_weekStart', (q) =>
        q.eq('userId', userId).eq('weekStart', weekStart)
      )
      .first()
    if (!insight) return { ok: true }
    if (insight.status === 'generating') {
      return { ok: false, insightId: insight._id }
    }
    const since = Date.now() - insight.updatedAt
    if (since < ON_DEMAND_COOLDOWN_MS) {
      return { ok: false, insightId: insight._id }
    }
    return { ok: true, insightId: insight._id }
  },
})

export const getUserContext = internalQuery({
  args: { userId: v.string(), weekStart: v.number() },
  handler: async (ctx, { userId, weekStart }): Promise<UserContext | null> => {
    const onboarding = await ctx.db
      .query('onboarding')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()
    if (!onboarding) return null

    const extended = await ctx.db
      .query('extended_profile')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()

    const weekEnd = weekStart + WEEK_MS
    const priorWeekStart = weekStart - WEEK_MS

    // Pull last ~30 days of check-ins so we can compute prior-week comparisons.
    const recentCheckins = await ctx.db
      .query('daily_checkins')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .order('desc')
      .take(60)

    const thisWeekCheckins = recentCheckins.filter(
      (c) => c.createdAt >= weekStart && c.createdAt < weekEnd
    )
    const priorWeekCheckins = recentCheckins.filter(
      (c) => c.createdAt >= priorWeekStart && c.createdAt < weekStart
    )

    // Pull last ~30 days of sessions.
    const recentSessions = await ctx.db
      .query('workout_sessions')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .order('desc')
      .take(60)

    const thisWeekSessions = recentSessions.filter(
      (s) => s.createdAt >= weekStart && s.createdAt < weekEnd
    )
    const priorWeekSessions = recentSessions.filter(
      (s) => s.createdAt >= priorWeekStart && s.createdAt < weekStart
    )

    // For each session, summarise sets logged + modalities.
    const summarizedSessions = await Promise.all(
      thisWeekSessions.map(async (session) => {
        const sets = await ctx.db
          .query('workout_sets')
          .withIndex('by_sessionId', (q) => q.eq('sessionId', session._id))
          .collect()
        const modalitiesUsed = Array.from(
          new Set(session.plan.map((p) => p.modality).filter(Boolean))
        )
        return {
          date: dayKey(session.createdAt),
          goal: session.goal,
          modality: session.modality,
          durationMin: session.durationMin,
          status: session.status,
          exerciseCount: session.plan.length,
          setsLogged: sets.length,
          modalitiesUsed,
        }
      })
    )

    const completedThisWeek = summarizedSessions.filter(
      (s) => s.status === 'completed' || s.status === 'in-progress'
    )
    const completedPriorWeek = priorWeekSessions.filter(
      (s) => s.status === 'completed' || s.status === 'in-progress'
    )

    // Streak: count consecutive days back from today with at least one completed/in-progress session.
    const sessionDayKeys = new Set(
      recentSessions
        .filter((s) => s.status === 'completed' || s.status === 'in-progress')
        .map((s) => dayKey(s.createdAt))
    )
    let streak = 0
    const cursor = new Date()
    cursor.setUTCHours(0, 0, 0, 0)
    for (let i = 0; i < 60; i++) {
      const key = cursor.toISOString().slice(0, 10)
      if (sessionDayKeys.has(key)) {
        streak += 1
        cursor.setUTCDate(cursor.getUTCDate() - 1)
      } else {
        if (i === 0) {
          cursor.setUTCDate(cursor.getUTCDate() - 1)
          continue
        }
        break
      }
    }

    const modalitiesThisWeek = Array.from(
      new Set(summarizedSessions.flatMap((s) => s.modalitiesUsed))
    )
    const modalitiesEverTried = Array.from(
      new Set(
        recentSessions.flatMap((s) =>
          s.plan.map((p) => p.modality).filter(Boolean)
        )
      )
    )
    const modalitiesPriorWeek = Array.from(
      new Set(
        priorWeekSessions.flatMap((s) =>
          s.plan.map((p) => p.modality).filter(Boolean)
        )
      )
    )

    const totalDurationMin = completedThisWeek.reduce(
      (acc, s) => acc + s.durationMin,
      0
    )
    const totalSetsLogged = completedThisWeek.reduce(
      (acc, s) => acc + s.setsLogged,
      0
    )

    const recentFeedback = await ctx.db
      .query('weekly_insight_feedback')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .order('desc')
      .take(3)

    const profile = {
      name: onboarding.name,
      age: onboarding.age,
      gender: onboarding.gender,
      goal: onboarding.goal,
      activityLevel: onboarding.activityLevel,
      timeAvailable: onboarding.timeAvailable,
      injuries: onboarding.injuries,
      conditions: onboarding.conditions,
    }

    const dataSignaturePayload = JSON.stringify({
      profile,
      profileSummaryHash: extended?.profileSummary
        ? djb2Hash(extended.profileSummary)
        : null,
      checkins: thisWeekCheckins.map((c) => ({
        d: dayKey(c.createdAt),
        e: c.energyLevel,
        p: c.painLevel,
        s: c.stressLevel,
        sl: c.sleepQuality,
        w: c.workoutType,
      })),
      sessions: summarizedSessions.map((s) => ({
        d: s.date,
        m: s.modality,
        st: s.status,
        sl: s.setsLogged,
      })),
      feedbackCount: recentFeedback.length,
    })

    return {
      userId,
      weekStart,
      weekEnd,
      profile,
      profileSummary: extended?.profileSummary ?? null,
      thisWeek: {
        checkins: thisWeekCheckins.map((c) => ({
          date: dayKey(c.createdAt),
          energyLevel: c.energyLevel,
          sleepQuality: c.sleepQuality,
          painLevel: c.painLevel,
          painAreas: c.painAreas ?? [],
          stressLevel: c.stressLevel,
          workoutType: c.workoutType,
          intensityPreference: c.intensityPreference,
          timeAvailable: c.timeAvailable,
          notes: c.notes,
        })),
        sessions: summarizedSessions,
        totals: {
          sessionsCompleted: completedThisWeek.length,
          totalDurationMin,
          totalSetsLogged,
          avgEnergy: average(thisWeekCheckins.map((c) => c.energyLevel)),
          avgPain: average(thisWeekCheckins.map((c) => c.painLevel)),
          avgStress: average(thisWeekCheckins.map((c) => c.stressLevel)),
          currentStreakDays: streak,
          modalitiesTried: modalitiesThisWeek,
        },
      },
      priorWeek: {
        sessionsCompleted: completedPriorWeek.length,
        avgEnergy: average(priorWeekCheckins.map((c) => c.energyLevel)),
        avgPain: average(priorWeekCheckins.map((c) => c.painLevel)),
        modalitiesTried: modalitiesPriorWeek,
      },
      modalitiesEverTried,
      recentFeedback: recentFeedback.map((f) => ({
        rating: f.rating,
        comment: f.comment ?? null,
        sections: f.sections ?? [],
        weekStart: f.weekStart,
      })),
      dataSignature: djb2Hash(dataSignaturePayload),
    }
  },
})

export const getInsightStatus = internalQuery({
  args: { userId: v.string(), weekStart: v.number() },
  handler: async (ctx, { userId, weekStart }) => {
    const insight = await ctx.db
      .query('weekly_insights')
      .withIndex('by_userId_weekStart', (q) =>
        q.eq('userId', userId).eq('weekStart', weekStart)
      )
      .first()
    return insight?.status ?? null
  },
})

export const listAllUserIdsWithOnboarding = internalQuery({
  args: {},
  handler: async (ctx) => {
    const docs = await ctx.db.query('onboarding').collect()
    return Array.from(new Set(docs.map((d) => d.userId)))
  },
})

export const getInsightForRouting = internalQuery({
  args: { insightId: v.id('weekly_insights') },
  handler: async (ctx, { insightId }) => {
    return await ctx.db.get(insightId)
  },
})

export const listPendingBatches = internalQuery({
  args: {},
  handler: async (ctx) => {
    const validating = await ctx.db
      .query('openai_batch_jobs')
      .withIndex('by_status', (q) => q.eq('status', 'validating'))
      .collect()
    const inProgress = await ctx.db
      .query('openai_batch_jobs')
      .withIndex('by_status', (q) => q.eq('status', 'in_progress'))
      .collect()
    const completed = await ctx.db
      .query('openai_batch_jobs')
      .withIndex('by_status', (q) => q.eq('status', 'completed'))
      .collect()
    return [...validating, ...inProgress, ...completed]
  },
})

/* -----------------------------------------------------------------------
 * Internal mutations
 * -------------------------------------------------------------------- */

export const upsertGeneratingInsight = internalMutation({
  args: {
    userId: v.string(),
    weekStart: v.number(),
    source: v.union(
      v.literal('batch'),
      v.literal('on_demand'),
      v.literal('cold_start'),
      v.literal('after_workout')
    ),
    dataSignature: v.string(),
  },
  handler: async (
    ctx,
    { userId, weekStart, source, dataSignature }
  ): Promise<Id<'weekly_insights'>> => {
    const now = Date.now()
    const existing = await ctx.db
      .query('weekly_insights')
      .withIndex('by_userId_weekStart', (q) =>
        q.eq('userId', userId).eq('weekStart', weekStart)
      )
      .first()

    if (existing) {
      await ctx.db.patch(existing._id, {
        status: 'generating',
        source,
        dataSignature,
        updatedAt: now,
      })
      return existing._id
    }

    return await ctx.db.insert('weekly_insights', {
      userId,
      weekStart,
      status: 'generating',
      source,
      dataSignature,
      stats: [],
      alignedRecommendations: [],
      explorationRecommendations: [],
      createdAt: now,
      updatedAt: now,
    })
  },
})

export const writeInsightPayload = internalMutation({
  args: {
    insightId: v.id('weekly_insights'),
    payload: v.any(),
    dataSignature: v.optional(v.string()),
  },
  handler: async (ctx, { insightId, payload, dataSignature }) => {
    const now = Date.now()
    const typed = payload as WeeklyInsightPayload
    const stats = typed.stats.map((s) => ({
      key: s.key,
      label: s.label,
      value: s.value,
      unit: s.unit,
      icon: ALLOWED_ICONS.includes(s.icon as (typeof ALLOWED_ICONS)[number])
        ? s.icon
        : 'sparkles',
      tint: ALLOWED_TINTS.includes(s.tint as (typeof ALLOWED_TINTS)[number])
        ? s.tint
        : 'primary',
      story: s.story ?? undefined,
      trend: s.trend ?? undefined,
    }))
    const aligned = typed.alignedRecommendations.map((r, i) => ({
      id: `aligned-${i}`,
      title: r.title,
      durationMin: r.durationMin,
      moveCount: r.moveCount,
      modality: r.modality,
      badge: r.badge,
      badgeTint: ALLOWED_TINTS.includes(
        r.badgeTint as (typeof ALLOWED_TINTS)[number]
      )
        ? r.badgeTint
        : 'success',
      description: r.description,
      tags: r.tags,
      reasoning: r.reasoning,
    }))
    const exploration = typed.explorationRecommendations.map((r, i) => ({
      id: `explore-${i}`,
      title: r.title,
      durationMin: r.durationMin,
      moveCount: r.moveCount,
      modality: r.modality,
      badge: r.badge,
      badgeTint: ALLOWED_TINTS.includes(
        r.badgeTint as (typeof ALLOWED_TINTS)[number]
      )
        ? r.badgeTint
        : 'accentTeal',
      description: r.description,
      tags: r.tags,
      reasoning: r.reasoning,
      whyNew: r.whyNew,
    }))
    const patch: Partial<Doc<'weekly_insights'>> = {
      status: 'ready',
      headline: typed.headline,
      stats,
      alignedRecommendations: aligned,
      explorationRecommendations: exploration,
      updatedAt: now,
      error: undefined,
    }
    if (dataSignature) patch.dataSignature = dataSignature
    await ctx.db.patch(insightId, patch)
  },
})

export const markInsightFailed = internalMutation({
  args: { insightId: v.id('weekly_insights'), error: v.string() },
  handler: async (ctx, { insightId, error }) => {
    await ctx.db.patch(insightId, {
      status: 'failed',
      error,
      updatedAt: Date.now(),
    })
  },
})

export const recordBatchJob = internalMutation({
  args: {
    openaiBatchId: v.string(),
    inputFileId: v.string(),
    weekStart: v.number(),
    routing: v.array(
      v.object({
        customId: v.string(),
        userId: v.string(),
        insightId: v.id('weekly_insights'),
      })
    ),
    requestedCount: v.number(),
  },
  handler: async (ctx, args) => {
    const now = Date.now()
    return await ctx.db.insert('openai_batch_jobs', {
      purpose: 'weekly_insights',
      openaiBatchId: args.openaiBatchId,
      inputFileId: args.inputFileId,
      status: 'validating',
      weekStart: args.weekStart,
      routing: args.routing,
      requestedCount: args.requestedCount,
      createdAt: now,
      updatedAt: now,
    })
  },
})

export const updateBatchJob = internalMutation({
  args: {
    jobId: v.id('openai_batch_jobs'),
    status: v.union(
      v.literal('validating'),
      v.literal('in_progress'),
      v.literal('completed'),
      v.literal('failed'),
      v.literal('expired'),
      v.literal('cancelled'),
      v.literal('processed')
    ),
    completedCount: v.optional(v.number()),
    failedCount: v.optional(v.number()),
    outputFileId: v.optional(v.string()),
    errorFileId: v.optional(v.string()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, { jobId, ...rest }) => {
    const patch: Partial<Doc<'openai_batch_jobs'>> = {
      ...rest,
      updatedAt: Date.now(),
    }
    await ctx.db.patch(jobId, patch)
  },
})

/* -----------------------------------------------------------------------
 * Prompt construction
 * -------------------------------------------------------------------- */

function buildSystemPrompt(): string {
  return `You are Embodi's weekly insights coach. You write a small, deeply personal "This week" stats card and a short list of recommended workouts for ONE user.

Hard rules:
- Pick the 4 stats that tell THIS user's story this week. Vary them across users and across weeks. Do not always pick streak + sessions; choose what is genuinely interesting (a pain drop, a new modality, sleep recovery, energy variance, breath-time, time of day, etc.).
- Every stat needs a clear short label and a concrete value derived from the data. If you do not have data for a stat, do not invent it. Use trend "up"/"down"/"flat" only when prior-week numbers exist.
- "story" is optional and rendered inside a tiny card: max 55 characters / ~8 words. If you can't say something punchy and concrete in that space, return null. Never pad with motivation; reference the user's actual data.
- Aligned recommendations must match modalities the user already does or asks for. Use the user's check-in workoutType + recent sessions as ground truth.
- Exploration recommendations must be modalities the user has NOT tried in the past 4 weeks AND that Embodi can track safely (Mobility, Strength, Cardio, Recovery, Mixed, Breath, Yoga). Skip exploration entirely if the user has flagged injuries, low energy, or high pain that makes a new modality unwise.
- Respect injuries and conditions. Never recommend something contraindicated.
- Do not recommend equipment the user does not have access to (use the timeAvailable + activity level as a hint and prefer "No equipment" when unsure).
- Use icon and tint values ONLY from the allowed enums in the schema.
- Tone: warm, specific, second-person ("you"). No emoji. No filler. Contractions are fine.
- Honor user feedback: if past insights were disliked, change what they reacted to (different stats, simpler recommendations, etc.). If liked, keep that quality and push further.`
}

function buildUserPrompt(ctx: UserContext): string {
  const lines: string[] = []
  lines.push('=== USER PROFILE ===')
  lines.push(JSON.stringify(ctx.profile, null, 2))
  if (ctx.profileSummary) {
    lines.push('=== EXTENDED PROFILE SUMMARY ===')
    lines.push(ctx.profileSummary)
  }
  lines.push('=== WEEK WINDOW ===')
  lines.push(
    `weekStart=${dayKey(ctx.weekStart)} weekEnd=${dayKey(ctx.weekEnd - 1)}`
  )
  lines.push('=== THIS WEEK CHECK-INS ===')
  lines.push(JSON.stringify(ctx.thisWeek.checkins, null, 2))
  lines.push('=== THIS WEEK SESSIONS ===')
  lines.push(JSON.stringify(ctx.thisWeek.sessions, null, 2))
  lines.push('=== THIS WEEK TOTALS ===')
  lines.push(JSON.stringify(ctx.thisWeek.totals, null, 2))
  lines.push('=== PRIOR WEEK SUMMARY (for trend) ===')
  lines.push(JSON.stringify(ctx.priorWeek, null, 2))
  lines.push('=== MODALITIES EVER TRIED (last ~30 days) ===')
  lines.push(JSON.stringify(ctx.modalitiesEverTried, null, 2))
  if (ctx.recentFeedback.length > 0) {
    lines.push('=== RECENT USER FEEDBACK (most recent first) ===')
    lines.push(JSON.stringify(ctx.recentFeedback, null, 2))
    lines.push(
      'Use this feedback to adjust: change what they disliked, keep what they liked, never repeat the exact same insight as last week.'
    )
  }
  lines.push('=== ALLOWED ICONS ===')
  lines.push(ALLOWED_ICONS.join(', '))
  lines.push('=== ALLOWED TINTS ===')
  lines.push(ALLOWED_TINTS.join(', '))
  lines.push(
    '\nProduce JSON matching the schema. Make the 4 stats genuinely interesting for this user this week, not a fixed template.'
  )
  return lines.join('\n')
}

function buildResponsesRequestBody(model: string, ctx: UserContext) {
  return {
    model,
    text: {
      format: {
        type: 'json_schema',
        name: 'weekly_insight',
        schema: WEEKLY_INSIGHT_SCHEMA,
      },
    },
    input: [
      { role: 'system', content: buildSystemPrompt() },
      { role: 'user', content: buildUserPrompt(ctx) },
    ],
  }
}

/* -----------------------------------------------------------------------
 * On-demand / cold-start synchronous generation (Responses API)
 * -------------------------------------------------------------------- */

export const generateForUserSync = internalAction({
  args: { userId: v.string(), insightId: v.id('weekly_insights') },
  handler: async (ctx, { userId, insightId }) => {
    try {
      const weekStart = startOfIsoWeek(Date.now())
      const userCtx = await ctx.runQuery(
        internal.weeklyInsights.getUserContext,
        { userId, weekStart }
      )
      if (!userCtx) {
        await ctx.runMutation(internal.weeklyInsights.markInsightFailed, {
          insightId,
          error: 'No onboarding data',
        })
        return
      }

      const client = getOpenAI()
      const model = getOpenAIModel()
      const body = buildResponsesRequestBody(model, userCtx)

      const response = await client.responses.create(
        body as Parameters<typeof client.responses.create>[0]
      )
      const text = extractResponsesText(response)
      if (!text) throw new Error('Empty model response')
      const parsed = JSON.parse(text) as WeeklyInsightPayload

      await ctx.runMutation(internal.weeklyInsights.writeInsightPayload, {
        insightId,
        payload: parsed,
        dataSignature: userCtx.dataSignature,
      })
    } catch (error) {
      console.error('[weeklyInsights] generateForUserSync failed', error)
      await ctx.runMutation(internal.weeklyInsights.markInsightFailed, {
        insightId,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  },
})

type NonStreamingResponse = {
  output_text?: string
  output?: Array<{
    type?: string
    content?: Array<{ type?: string; text?: string }>
  }>
}

function extractResponsesText(response: unknown): string | null {
  const r = response as NonStreamingResponse
  if (typeof r.output_text === 'string' && r.output_text.length > 0) {
    return r.output_text
  }

  for (const item of r.output ?? []) {
    if (item.type !== 'message') continue
    for (const part of item.content ?? []) {
      if (part.type === 'output_text' && part.text) return part.text
    }
  }
  return null
}

/* -----------------------------------------------------------------------
 * Regenerate after a completed workout. Scheduled from `trainer.ts` when
 * a session transitions to status='completed'. Skips if a generation is
 * already in flight, so back-to-back completions don't fire twice.
 * -------------------------------------------------------------------- */

export const regenerateAfterCompletion = internalAction({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const weekStart = startOfIsoWeek(Date.now())

    const status: string | null = await ctx.runQuery(
      internal.weeklyInsights.getInsightStatus,
      { userId, weekStart }
    )
    if (status === 'generating') {
      return { skipped: 'already_generating' as const }
    }

    const userCtx: UserContext | null = await ctx.runQuery(
      internal.weeklyInsights.getUserContext,
      { userId, weekStart }
    )
    if (!userCtx) return { skipped: 'no_context' as const }

    const insightId: Id<'weekly_insights'> = await ctx.runMutation(
      internal.weeklyInsights.upsertGeneratingInsight,
      {
        userId,
        weekStart,
        source: 'after_workout',
        dataSignature: userCtx.dataSignature,
      }
    )

    await ctx.scheduler.runAfter(
      0,
      internal.weeklyInsights.generateForUserSync,
      { userId, insightId }
    )
    return { insightId }
  },
})

/* -----------------------------------------------------------------------
 * Weekly batch kickoff (cron entry point)
 * -------------------------------------------------------------------- */

export const kickoffWeeklyBatch = internalAction({
  args: {},
  handler: async (ctx) => {
    const userIds: string[] = await ctx.runQuery(
      internal.weeklyInsights.listAllUserIdsWithOnboarding,
      {}
    )
    if (userIds.length === 0) {
      console.log('[weeklyInsights] no users with onboarding')
      return { submitted: 0 }
    }

    const weekStart = startOfIsoWeek(Date.now())
    const model = getOpenAIModel()

    const lines: string[] = []
    const routing: Array<{
      customId: string
      userId: string
      insightId: Id<'weekly_insights'>
    }> = []

    for (const userId of userIds) {
      const userCtx: UserContext | null = await ctx.runQuery(
        internal.weeklyInsights.getUserContext,
        { userId, weekStart }
      )
      if (!userCtx) continue
      // Skip users with absolutely no signal this week — nothing useful to write.
      if (
        userCtx.thisWeek.checkins.length === 0 &&
        userCtx.thisWeek.sessions.length === 0
      ) {
        continue
      }

      const insightId: Id<'weekly_insights'> = await ctx.runMutation(
        internal.weeklyInsights.upsertGeneratingInsight,
        {
          userId,
          weekStart,
          source: 'batch',
          dataSignature: userCtx.dataSignature,
        }
      )

      const customId = `wk-${weekStart}-${insightId}`
      routing.push({ customId, userId, insightId })
      lines.push(
        JSON.stringify({
          custom_id: customId,
          method: 'POST',
          url: RESPONSES_ENDPOINT,
          body: buildResponsesRequestBody(model, userCtx),
        })
      )
    }

    if (lines.length === 0) {
      console.log('[weeklyInsights] no users had data this week')
      return { submitted: 0 }
    }

    const client = getOpenAI()
    const fileContent = lines.join('\n') + '\n'
    const fileBytes = new TextEncoder().encode(fileContent)
    const inputFile = await client.files.create({
      file: await OpenAI.toFile(
        fileBytes,
        `weekly-insights-${weekStart}.jsonl`,
        { type: 'application/jsonl' }
      ),
      purpose: 'batch',
    })

    const batch = await client.batches.create({
      input_file_id: inputFile.id,
      endpoint: RESPONSES_ENDPOINT,
      completion_window: '24h',
      metadata: {
        purpose: 'weekly_insights',
        weekStart: String(weekStart),
      },
    })

    await ctx.runMutation(internal.weeklyInsights.recordBatchJob, {
      openaiBatchId: batch.id,
      inputFileId: inputFile.id,
      weekStart,
      routing,
      requestedCount: lines.length,
    })

    console.log(
      `[weeklyInsights] submitted batch ${batch.id} with ${lines.length} requests`
    )
    return { submitted: lines.length, batchId: batch.id }
  },
})

/* -----------------------------------------------------------------------
 * Polling & result processing
 * -------------------------------------------------------------------- */

export const pollPendingBatches = internalAction({
  args: {},
  handler: async (ctx) => {
    const jobs: Doc<'openai_batch_jobs'>[] = await ctx.runQuery(
      internal.weeklyInsights.listPendingBatches,
      {}
    )
    if (jobs.length === 0) return { polled: 0 }

    const client = getOpenAI()
    let processed = 0
    for (const job of jobs) {
      try {
        const batch = await client.batches.retrieve(job.openaiBatchId)
        const status = batch.status as Doc<'openai_batch_jobs'>['status']

        if (
          status === 'failed' ||
          status === 'expired' ||
          status === 'cancelled'
        ) {
          await ctx.runMutation(internal.weeklyInsights.updateBatchJob, {
            jobId: job._id,
            status,
            error: batch.errors?.data?.[0]?.message ?? `Batch ${status}`,
          })
          await failAllJobInsights(ctx, job, `Batch ${status}`)
          continue
        }

        if (status === 'in_progress' || status === 'validating') {
          await ctx.runMutation(internal.weeklyInsights.updateBatchJob, {
            jobId: job._id,
            status,
          })
          continue
        }

        if (status === 'completed') {
          if (!batch.output_file_id) {
            await ctx.runMutation(internal.weeklyInsights.updateBatchJob, {
              jobId: job._id,
              status: 'failed',
              error: 'Completed batch missing output_file_id',
            })
            await failAllJobInsights(ctx, job, 'Missing batch output')
            continue
          }

          const outputFile = await client.files.content(batch.output_file_id)
          const text = await outputFile.text()
          const lines = text.split('\n').filter((l) => l.trim().length > 0)
          const routingByCustomId = new Map(
            job.routing.map((r) => [r.customId, r])
          )

          let okCount = 0
          let errCount = 0
          for (const line of lines) {
            try {
              const entry = JSON.parse(line) as {
                custom_id: string
                response?: {
                  status_code: number
                  body?: unknown
                }
                error?: { message: string } | null
              }
              const target = routingByCustomId.get(entry.custom_id)
              if (!target) continue

              if (entry.error || !entry.response) {
                await ctx.runMutation(
                  internal.weeklyInsights.markInsightFailed,
                  {
                    insightId: target.insightId,
                    error: entry.error?.message ?? 'Empty batch response',
                  }
                )
                errCount++
                continue
              }

              const payload = parseResponsesBatchBody(entry.response.body)
              if (!payload) {
                await ctx.runMutation(
                  internal.weeklyInsights.markInsightFailed,
                  {
                    insightId: target.insightId,
                    error: 'Could not parse batch body',
                  }
                )
                errCount++
                continue
              }
              await ctx.runMutation(
                internal.weeklyInsights.writeInsightPayload,
                { insightId: target.insightId, payload }
              )
              okCount++
            } catch (lineError) {
              console.error('[weeklyInsights] bad batch line', lineError)
              errCount++
            }
          }

          await ctx.runMutation(internal.weeklyInsights.updateBatchJob, {
            jobId: job._id,
            status: 'processed',
            completedCount: okCount,
            failedCount: errCount,
            outputFileId: batch.output_file_id,
            errorFileId: batch.error_file_id ?? undefined,
          })
          processed++
        }
      } catch (error) {
        console.error('[weeklyInsights] poll error', job.openaiBatchId, error)
      }
    }
    return { polled: jobs.length, processed }
  },
})

async function failAllJobInsights(
  ctx: ActionCtx,
  job: Doc<'openai_batch_jobs'>,
  message: string
) {
  for (const route of job.routing) {
    await ctx.runMutation(internal.weeklyInsights.markInsightFailed, {
      insightId: route.insightId,
      error: message,
    })
  }
}

function parseResponsesBatchBody(body: unknown): WeeklyInsightPayload | null {
  if (!body || typeof body !== 'object') return null
  const b = body as {
    output_text?: string
    output?: Array<{
      type?: string
      content?: Array<{ type?: string; text?: string }>
    }>
  }
  let text: string | undefined = b.output_text
  if (!text && Array.isArray(b.output)) {
    for (const item of b.output) {
      if (item.type !== 'message') continue
      for (const part of item.content ?? []) {
        if (part.type === 'output_text' && part.text) {
          text = part.text
          break
        }
      }
      if (text) break
    }
  }
  if (!text) return null
  try {
    return JSON.parse(text) as WeeklyInsightPayload
  } catch {
    return null
  }
}

/* -----------------------------------------------------------------------
 * Cold-start trigger: called from the home screen when no insight exists
 * yet for this week. Cheap because it no-ops if an insight is already
 * being generated.
 * -------------------------------------------------------------------- */

export const ensureCurrentWeekInsight = action({
  args: {},
  handler: async (
    ctx
  ): Promise<{ insightId: Id<'weekly_insights'> } | { skipped: true }> => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return { skipped: true }

    const userId = identity.subject
    const weekStart = startOfIsoWeek(Date.now())

    const existing = await ctx.runQuery(api.weeklyInsights.getCurrentWeekInsight)
    if (existing && existing.status !== 'failed') {
      return { insightId: existing._id }
    }

    const userCtx: UserContext | null = await ctx.runQuery(
      internal.weeklyInsights.getUserContext,
      { userId, weekStart }
    )
    if (!userCtx) return { skipped: true }

    const insightId: Id<'weekly_insights'> = await ctx.runMutation(
      internal.weeklyInsights.upsertGeneratingInsight,
      {
        userId,
        weekStart,
        source: 'cold_start',
        dataSignature: userCtx.dataSignature,
      }
    )

    await ctx.scheduler.runAfter(0, internal.weeklyInsights.generateForUserSync, {
      userId,
      insightId,
    })

    return { insightId }
  },
})
