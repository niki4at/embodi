import { v } from 'convex/values'

import { api, internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
import {
  action,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from './_generated/server'
import { formatCheckinForPrompt } from './checkin'
import { computeCycleStatus, formatCycleForPrompt } from './cycle'
import { getOpenAI, getOpenAIModel, openAIResponsesLowLatency } from './openai'

const messageValidator = v.object({
  _id: v.id('coach_messages'),
  _creationTime: v.number(),
  threadId: v.id('coach_threads'),
  role: v.union(v.literal('user'), v.literal('assistant')),
  content: v.string(),
  createdAt: v.number(),
})

// ---------------------------------------------------------------------------
// Reads (reactive)
// ---------------------------------------------------------------------------
export const getThread = query({
  args: { catalogId: v.string() },
  returns: v.union(
    v.object({
      _id: v.id('coach_threads'),
      messageCount: v.number(),
    }),
    v.null()
  ),
  handler: async (ctx, { catalogId }) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return null
    const thread = await ctx.db
      .query('coach_threads')
      .withIndex('by_user_scope', (q) =>
        q
          .eq('userId', identity.subject)
          .eq('scopeType', 'exercise')
          .eq('catalogId', catalogId)
      )
      .first()
    if (!thread) return null
    const messages = await ctx.db
      .query('coach_messages')
      .withIndex('by_thread', (q) => q.eq('threadId', thread._id))
      .collect()
    return { _id: thread._id, messageCount: messages.length }
  },
})

export const getMessages = query({
  args: { catalogId: v.string() },
  returns: v.array(messageValidator),
  handler: async (ctx, { catalogId }) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return []
    const thread = await ctx.db
      .query('coach_threads')
      .withIndex('by_user_scope', (q) =>
        q
          .eq('userId', identity.subject)
          .eq('scopeType', 'exercise')
          .eq('catalogId', catalogId)
      )
      .first()
    if (!thread) return []
    return await ctx.db
      .query('coach_messages')
      .withIndex('by_thread', (q) => q.eq('threadId', thread._id))
      .order('asc')
      .collect()
  },
})

// ---------------------------------------------------------------------------
// Internal helpers used by the action (actions can't touch the db directly)
// ---------------------------------------------------------------------------
export const ensureThread = internalMutation({
  args: { userId: v.string(), catalogId: v.string() },
  returns: v.object({
    threadId: v.id('coach_threads'),
    lastResponseId: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, { userId, catalogId }) => {
    const existing = await ctx.db
      .query('coach_threads')
      .withIndex('by_user_scope', (q) =>
        q
          .eq('userId', userId)
          .eq('scopeType', 'exercise')
          .eq('catalogId', catalogId)
      )
      .first()
    if (existing) {
      return {
        threadId: existing._id,
        lastResponseId: existing.lastResponseId ?? null,
      }
    }
    const now = Date.now()
    const threadId = await ctx.db.insert('coach_threads', {
      userId,
      scopeType: 'exercise',
      catalogId,
      createdAt: now,
      updatedAt: now,
    })
    return { threadId, lastResponseId: null }
  },
})

export const appendMessage = internalMutation({
  args: {
    threadId: v.id('coach_threads'),
    role: v.union(v.literal('user'), v.literal('assistant')),
    content: v.string(),
    lastResponseId: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, { threadId, role, content, lastResponseId }) => {
    await ctx.db.insert('coach_messages', {
      threadId,
      role,
      content,
      createdAt: Date.now(),
    })
    const patch: { updatedAt: number; lastResponseId?: string } = {
      updatedAt: Date.now(),
    }
    if (lastResponseId) patch.lastResponseId = lastResponseId
    await ctx.db.patch(threadId, patch)
    return null
  },
})

export const getOnboardingByUserId = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query('onboarding')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()
  },
})

// ---------------------------------------------------------------------------
// Send a message: builds full per-exercise context and chains the reply.
// ---------------------------------------------------------------------------
export const sendCoachMessage = action({
  args: {
    catalogId: v.string(),
    exerciseName: v.string(),
    text: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, { catalogId, exerciseName, text }) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error('Not authenticated')
    }
    const userId = identity.subject

    const trimmed = text.trim()
    if (trimmed.length === 0) {
      throw new Error('Message is empty')
    }

    const { threadId, lastResponseId } = await ctx.runMutation(
      internal.coachChat.ensureThread,
      { userId, catalogId }
    )

    // Persist the user's message immediately so the UI shows it.
    await ctx.runMutation(internal.coachChat.appendMessage, {
      threadId,
      role: 'user',
      content: trimmed,
    })

    // ---- Gather grounding context ----
    const [onboarding, extendedProfile, media, history, checkin] =
      await Promise.all([
        ctx.runQuery(internal.coachChat.getOnboardingByUserId, { userId }),
        ctx.runQuery(api.profileQuestions.getExtendedProfile, {}),
        ctx.runQuery(api.exerciseMedia.getExerciseMedia, { catalogId }),
        ctx.runQuery(api.exerciseStats.getExerciseHistory, {
          catalogId,
          name: exerciseName,
        }),
        ctx.runQuery(api.checkin.getTodaysCheckin, {}),
      ])

    const activeChallenge = await ctx.runQuery(
      internal.challenges.getActiveChallengeByUserId,
      { userId }
    )

    let cycleBlock = ''
    if (onboarding?.trackPeriod) {
      const cycleEntries = await ctx.runQuery(
        internal.cycle.getCycleEntriesByUserId,
        { userId }
      )
      if (cycleEntries.length > 0) {
        const status = computeCycleStatus(cycleEntries, Date.now())
        cycleBlock = formatCycleForPrompt(status) ?? ''
      }
    }

    const contextParts: string[] = []

    if (extendedProfile?.profileSummary) {
      contextParts.push(
        '=== CLIENT PROFILE ===',
        extendedProfile.profileSummary,
        '=== END PROFILE ==='
      )
    } else if (onboarding) {
      contextParts.push(
        'Client basics:',
        JSON.stringify({
          name: onboarding.name,
          age: onboarding.age,
          gender: onboarding.gender,
          goal: onboarding.goal,
          activityLevel: onboarding.activityLevel,
          injuries: onboarding.injuries,
          conditions: onboarding.conditions,
        })
      )
    }

    contextParts.push(
      '',
      `=== EXERCISE: ${exerciseName} ===`,
      media?.target ? `Primary muscle: ${media.target}` : '',
      media?.secondaryMuscles && media.secondaryMuscles.length > 0
        ? `Secondary: ${media.secondaryMuscles.join(', ')}`
        : '',
      media?.instructions && media.instructions.length > 0
        ? `How-to: ${media.instructions.join(' ')}`
        : ''
    )

    if (history) {
      const r = history.records
      const recordLines = [
        r.totalSessions > 0
          ? `Logged ${r.totalSessions} session(s), ${r.totalSets} set(s).`
          : 'No logged history for this exercise yet.',
        r.heaviestWeightKg != null ? `Heaviest: ${r.heaviestWeightKg} kg` : '',
        r.estimatedOneRepMaxKg != null
          ? `Est. 1RM: ${r.estimatedOneRepMaxKg} kg`
          : '',
        r.bestSetVolumeKg != null ? `Best set volume: ${r.bestSetVolumeKg} kg` : '',
        r.bestReps != null ? `Best reps: ${r.bestReps}` : '',
        r.longestDurationSec != null
          ? `Longest hold/duration: ${r.longestDurationSec}s`
          : '',
        r.farthestDistanceM != null
          ? `Farthest distance: ${r.farthestDistanceM} m`
          : '',
      ].filter(Boolean)
      contextParts.push('', '=== THIS EXERCISE — MY RECORDS ===', ...recordLines)

      if (history.entries.length > 0) {
        const recent = history.entries.slice(0, 3).map((entry) => {
          const sets = entry.sets
            .map((s) => {
              if (s.weightKg != null && s.reps != null)
                return `${s.weightKg}kg x ${s.reps}`
              if (s.reps != null) return `${s.reps} reps`
              if (s.durationSec != null) return `${s.durationSec}s`
              if (s.distanceM != null) return `${s.distanceM}m`
              return ''
            })
            .filter(Boolean)
            .join(', ')
          return `- ${new Date(entry.performedAt).toISOString().slice(0, 10)}: ${sets}`
        })
        contextParts.push('Recent sessions:', ...recent)
      }
    }

    if (checkin) {
      contextParts.push('', formatCheckinForPrompt(checkin))
    }

    if (cycleBlock) {
      contextParts.push('', cycleBlock)
    }

    if (activeChallenge) {
      contextParts.push(
        '',
        '=== ACTIVE GOAL ===',
        `${activeChallenge.title} (${activeChallenge.category})`,
        activeChallenge.description ?? ''
      )
    }

    const systemPrompt = `You are Embodi's strength & movement coach, chatting with a client about ONE specific exercise: "${exerciseName}".

You have their profile, today's check-in, this exercise's personal records and recent history, and any active goal. Ground every answer in those real numbers when relevant (e.g. suggest a load based on their heaviest set or estimated 1RM).

Rules:
- Be warm, direct, and concise. Short paragraphs or tight bullets. No fluff, no medical diagnosis.
- Honour their injuries, conditions, pain areas, and today's energy/pain. If something is unsafe, say so and offer a safer variation.
- When they ask "what should I lift / how many reps", give a concrete starting recommendation tied to their history, then a simple progression.
- If they have no history for this exercise, give a sensible beginner-friendly starting point and say it's a starting estimate.
- Stay on this exercise unless they clearly ask about something else.

CONTEXT:
${contextParts.filter((p) => p !== '').join('\n')}`

    const client = getOpenAI()
    const model = getOpenAIModel()

    let reply = ''
    let responseId: string | undefined
    try {
      const response = await client.responses.create({
        model,
        ...openAIResponsesLowLatency,
        instructions: systemPrompt,
        input: trimmed,
        ...(lastResponseId ? { previous_response_id: lastResponseId } : {}),
      })
      reply = response.output_text?.trim() ?? ''
      responseId = response.id
    } catch (error) {
      console.error('coach reply failed', error)
      reply =
        "I hit a snag reaching my brain just now. Give it another go in a moment."
    }

    if (reply.length === 0) {
      reply = 'Tell me a bit more and I can give you a sharper answer.'
    }

    await ctx.runMutation(internal.coachChat.appendMessage, {
      threadId,
      role: 'assistant',
      content: reply,
      lastResponseId: responseId,
    })

    return null
  },
})

// Clear a thread (used by the chat UI's reset affordance).
export const clearThread = mutation({
  args: { catalogId: v.string() },
  returns: v.null(),
  handler: async (ctx, { catalogId }) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error('Not authenticated')
    }
    const thread = await ctx.db
      .query('coach_threads')
      .withIndex('by_user_scope', (q) =>
        q
          .eq('userId', identity.subject)
          .eq('scopeType', 'exercise')
          .eq('catalogId', catalogId)
      )
      .first()
    if (!thread) return null

    const messages = await ctx.db
      .query('coach_messages')
      .withIndex('by_thread', (q) => q.eq('threadId', thread._id))
      .collect()
    for (const message of messages) {
      await ctx.db.delete(message._id)
    }
    await ctx.db.patch(thread._id, {
      lastResponseId: undefined,
      updatedAt: Date.now(),
    })
    return null
  },
})

// Internal type guard exported for potential reuse.
export type CoachMessageId = Id<'coach_messages'>
