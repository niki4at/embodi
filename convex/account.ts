import { v } from 'convex/values'

import { internal } from './_generated/api'
import {
  internalMutation,
  mutation,
  query,
  type MutationCtx,
} from './_generated/server'

/*
 * Account deletion.
 *
 * `deleteAccount` runs in the user's own request: it authenticates, removes
 * the public profile immediately (so the account disappears from search,
 * feeds, and profile pages), then schedules `purgeUserData` to erase every
 * remaining user-owned row in batches. The batched job survives the Clerk
 * identity being deleted client-side because it runs as an internal function
 * keyed by the captured userId.
 */

/** Max rows a single purge invocation touches before rescheduling. */
const BATCH = 100
/** Sessions are heavier (sets + feedback per session), so use a smaller cap. */
const SESSION_BATCH = 10
const POST_BATCH = 20
const MEMBERSHIP_BATCH = 10

type StepResult = { done: boolean }

type PurgeStep = {
  name: string
  run: (ctx: MutationCtx, userId: string) => Promise<StepResult>
}

/** Deletes my reactions on posts, fixing the posts' cheer counters. */
const reactionsStep: PurgeStep = {
  name: 'reactions',
  run: async (ctx, userId) => {
    const rows = await ctx.db
      .query('reactions')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .take(BATCH)
    for (const reaction of rows) {
      const post = await ctx.db.get(reaction.postId)
      if (post && post.authorId !== userId) {
        const counts = { ...post.cheerCounts }
        counts[reaction.kind] = Math.max(0, (counts[reaction.kind] ?? 0) - 1)
        if (counts[reaction.kind] === 0) delete counts[reaction.kind]
        await ctx.db.patch(post._id, { cheerCounts: counts })
      }
      await ctx.db.delete(reaction._id)
    }
    return { done: rows.length < BATCH }
  },
}

/** Deletes my comments on posts, fixing the posts' comment counters. */
const commentsStep: PurgeStep = {
  name: 'comments',
  run: async (ctx, userId) => {
    const rows = await ctx.db
      .query('comments')
      .withIndex('by_author', (q) => q.eq('authorId', userId))
      .take(BATCH)
    for (const comment of rows) {
      const post = await ctx.db.get(comment.postId)
      if (post && post.authorId !== userId) {
        await ctx.db.patch(post._id, {
          commentCount: Math.max(0, post.commentCount - 1),
        })
      }
      await ctx.db.delete(comment._id)
    }
    return { done: rows.length < BATCH }
  },
}

/** Deletes my posts plus their photos, reactions, and comments. */
const postsStep: PurgeStep = {
  name: 'posts',
  run: async (ctx, userId) => {
    const rows = await ctx.db
      .query('posts')
      .withIndex('by_author_and_createdAt', (q) => q.eq('authorId', userId))
      .take(POST_BATCH)
    for (const post of rows) {
      for (const storageId of post.photoStorageIds) {
        await ctx.storage.delete(storageId)
      }
      const postReactions = await ctx.db
        .query('reactions')
        .withIndex('by_post_and_user', (q) => q.eq('postId', post._id))
        .collect()
      for (const row of postReactions) {
        await ctx.db.delete(row._id)
      }
      const postComments = await ctx.db
        .query('comments')
        .withIndex('by_post', (q) => q.eq('postId', post._id))
        .collect()
      for (const row of postComments) {
        await ctx.db.delete(row._id)
      }
      const tries = await ctx.db
        .query('post_tries')
        .withIndex('by_post', (q) => q.eq('postId', post._id))
        .collect()
      for (const row of tries) {
        await ctx.db.delete(row._id)
      }
      if (post.type === 'repost' && post.originalPostId) {
        const original = await ctx.db.get(post.originalPostId)
        if (original) {
          await ctx.db.patch(original._id, {
            repostCount: Math.max(0, original.repostCount - 1),
          })
        }
      }
      await ctx.db.delete(post._id)
    }
    return { done: rows.length < POST_BATCH }
  },
}

/** Rows recording that I tried other people's workouts. */
const postTriesStep: PurgeStep = {
  name: 'post_tries',
  run: async (ctx, userId) => {
    const rows = await ctx.db
      .query('post_tries')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .take(BATCH)
    for (const row of rows) {
      const post = await ctx.db.get(row.postId)
      if (post && post.authorId !== userId && post.triedCount) {
        await ctx.db.patch(post._id, {
          triedCount: Math.max(0, post.triedCount - 1),
        })
      }
      await ctx.db.delete(row._id)
    }
    return { done: rows.length < BATCH }
  },
}

/** Follow edges I created, fixing the other side's backer counter. */
const followsOutStep: PurgeStep = {
  name: 'follows_out',
  run: async (ctx, userId) => {
    const rows = await ctx.db
      .query('follows')
      .withIndex('by_follower_and_followee', (q) => q.eq('followerId', userId))
      .take(BATCH)
    for (const edge of rows) {
      if (edge.status === 'active') {
        const followee = await ctx.db
          .query('profiles')
          .withIndex('by_userId', (q) => q.eq('userId', edge.followeeId))
          .unique()
        if (followee) {
          await ctx.db.patch(followee._id, {
            backerCount: Math.max(0, followee.backerCount - 1),
          })
        }
      }
      await ctx.db.delete(edge._id)
    }
    return { done: rows.length < BATCH }
  },
}

/** Follow edges pointing at me, fixing the other side's backing counter. */
const followsInStep: PurgeStep = {
  name: 'follows_in',
  run: async (ctx, userId) => {
    const rows = await ctx.db
      .query('follows')
      .withIndex('by_followee_and_status', (q) => q.eq('followeeId', userId))
      .take(BATCH)
    for (const edge of rows) {
      if (edge.status === 'active') {
        const follower = await ctx.db
          .query('profiles')
          .withIndex('by_userId', (q) => q.eq('userId', edge.followerId))
          .unique()
        if (follower) {
          await ctx.db.patch(follower._id, {
            backingCount: Math.max(0, follower.backingCount - 1),
          })
        }
      }
      await ctx.db.delete(edge._id)
    }
    return { done: rows.length < BATCH }
  },
}

/** Community memberships: transfer ownership or clean up empty groups. */
const membershipsStep: PurgeStep = {
  name: 'memberships',
  run: async (ctx, userId) => {
    const rows = await ctx.db
      .query('community_members')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .take(MEMBERSHIP_BATCH)
    for (const membership of rows) {
      const community = await ctx.db.get(membership.communityId)
      await ctx.db.delete(membership._id)
      if (!community) continue
      const remaining = await ctx.db
        .query('community_members')
        .withIndex('by_community', (q) =>
          q.eq('communityId', membership.communityId)
        )
        .take(2)
      if (remaining.length === 0) {
        const events = await ctx.db
          .query('community_events')
          .withIndex('by_community_and_createdAt', (q) =>
            q.eq('communityId', membership.communityId)
          )
          .collect()
        for (const event of events) {
          await ctx.db.delete(event._id)
        }
        await ctx.db.delete(community._id)
      } else {
        if (membership.role === 'owner') {
          await ctx.db.patch(remaining[0]._id, { role: 'owner' })
          await ctx.db.patch(community._id, {
            creatorId: remaining[0].userId,
          })
        }
        await ctx.db.patch(community._id, {
          memberCount: Math.max(0, community.memberCount - 1),
          updatedAt: Date.now(),
        })
      }
    }
    return { done: rows.length < MEMBERSHIP_BATCH }
  },
}

/** Notifications delivered to me. */
const notificationsStep: PurgeStep = {
  name: 'notifications',
  run: async (ctx, userId) => {
    const rows = await ctx.db
      .query('notifications')
      .withIndex('by_user_and_createdAt', (q) => q.eq('userId', userId))
      .take(BATCH)
    for (const row of rows) {
      await ctx.db.delete(row._id)
    }
    return { done: rows.length < BATCH }
  },
}

/** Notifications where I'm the actor (so other inboxes drop my name). */
const notificationsActorStep: PurgeStep = {
  name: 'notifications_actor',
  run: async (ctx, userId) => {
    const rows = await ctx.db
      .query('notifications')
      .withIndex('by_actor', (q) => q.eq('actorId', userId))
      .take(BATCH)
    for (const row of rows) {
      await ctx.db.delete(row._id)
    }
    return { done: rows.length < BATCH }
  },
}

const pushTokensStep: PurgeStep = {
  name: 'push_tokens',
  run: async (ctx, userId) => {
    const rows = await ctx.db
      .query('push_tokens')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .take(BATCH)
    for (const row of rows) {
      await ctx.db.delete(row._id)
    }
    return { done: rows.length < BATCH }
  },
}

const blocksStep: PurgeStep = {
  name: 'blocks',
  run: async (ctx, userId) => {
    const mine = await ctx.db
      .query('blocks')
      .withIndex('by_blocker_and_blocked', (q) => q.eq('blockerId', userId))
      .take(BATCH)
    for (const row of mine) {
      await ctx.db.delete(row._id)
    }
    const ofMe = await ctx.db
      .query('blocks')
      .withIndex('by_blocked', (q) => q.eq('blockedId', userId))
      .take(BATCH)
    for (const row of ofMe) {
      await ctx.db.delete(row._id)
    }
    return { done: mine.length < BATCH && ofMe.length < BATCH }
  },
}

const reportsStep: PurgeStep = {
  name: 'reports',
  run: async (ctx, userId) => {
    const rows = await ctx.db
      .query('reports')
      .withIndex('by_reporter', (q) => q.eq('reporterId', userId))
      .take(BATCH)
    for (const row of rows) {
      await ctx.db.delete(row._id)
    }
    return { done: rows.length < BATCH }
  },
}

/** Workout sessions plus their sets and feedback. */
const sessionsStep: PurgeStep = {
  name: 'sessions',
  run: async (ctx, userId) => {
    const rows = await ctx.db
      .query('workout_sessions')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .take(SESSION_BATCH)
    for (const session of rows) {
      const sets = await ctx.db
        .query('workout_sets')
        .withIndex('by_sessionId', (q) => q.eq('sessionId', session._id))
        .collect()
      for (const set of sets) {
        await ctx.db.delete(set._id)
      }
      const feedback = await ctx.db
        .query('session_feedback')
        .withIndex('by_sessionId', (q) => q.eq('sessionId', session._id))
        .collect()
      for (const fb of feedback) {
        await ctx.db.delete(fb._id)
      }
      await ctx.db.delete(session._id)
    }
    return { done: rows.length < SESSION_BATCH }
  },
}

const checkinsStep: PurgeStep = {
  name: 'checkins',
  run: async (ctx, userId) => {
    const rows = await ctx.db
      .query('daily_checkins')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .take(BATCH)
    for (const row of rows) {
      await ctx.db.delete(row._id)
    }
    return { done: rows.length < BATCH }
  },
}

const routinesStep: PurgeStep = {
  name: 'routines',
  run: async (ctx, userId) => {
    const rows = await ctx.db
      .query('workout_routines')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .take(BATCH)
    for (const row of rows) {
      await ctx.db.delete(row._id)
    }
    return { done: rows.length < BATCH }
  },
}

const challengesStep: PurgeStep = {
  name: 'challenges',
  run: async (ctx, userId) => {
    const progress = await ctx.db
      .query('challenge_progress')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .take(BATCH)
    for (const row of progress) {
      await ctx.db.delete(row._id)
    }
    const challenges = await ctx.db
      .query('challenges')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .take(BATCH)
    for (const row of challenges) {
      await ctx.db.delete(row._id)
    }
    return { done: progress.length < BATCH && challenges.length < BATCH }
  },
}

const insightsStep: PurgeStep = {
  name: 'weekly_insights',
  run: async (ctx, userId) => {
    const feedback = await ctx.db
      .query('weekly_insight_feedback')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .take(BATCH)
    for (const row of feedback) {
      await ctx.db.delete(row._id)
    }
    const insights = await ctx.db
      .query('weekly_insights')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .take(BATCH)
    for (const row of insights) {
      await ctx.db.delete(row._id)
    }
    return { done: feedback.length < BATCH && insights.length < BATCH }
  },
}

const coachThreadsStep: PurgeStep = {
  name: 'coach_threads',
  run: async (ctx, userId) => {
    const threads = await ctx.db
      .query('coach_threads')
      .withIndex('by_user_scope', (q) => q.eq('userId', userId))
      .take(MEMBERSHIP_BATCH)
    for (const thread of threads) {
      const messages = await ctx.db
        .query('coach_messages')
        .withIndex('by_thread', (q) => q.eq('threadId', thread._id))
        .collect()
      for (const message of messages) {
        await ctx.db.delete(message._id)
      }
      await ctx.db.delete(thread._id)
    }
    return { done: threads.length < MEMBERSHIP_BATCH }
  },
}

const equipmentStep: PurgeStep = {
  name: 'equipment',
  run: async (ctx, userId) => {
    const uploads = await ctx.db
      .query('equipment_photo_uploads')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .take(BATCH)
    for (const upload of uploads) {
      await ctx.storage.delete(upload.storageId)
      await ctx.db.delete(upload._id)
    }
    const equipment = await ctx.db
      .query('user_equipment')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .take(BATCH)
    for (const item of equipment) {
      if (
        item.photoStorageId &&
        !uploads.some((upload) => upload.storageId === item.photoStorageId)
      ) {
        await ctx.storage.delete(item.photoStorageId)
      }
      await ctx.db.delete(item._id)
    }
    return { done: uploads.length < BATCH && equipment.length < BATCH }
  },
}

const trainingContextStep: PurgeStep = {
  name: 'training_context',
  run: async (ctx, userId) => {
    const places = await ctx.db
      .query('training_places')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .take(BATCH)
    for (const row of places) {
      await ctx.db.delete(row._id)
    }
    const events = await ctx.db
      .query('training_context_events')
      .withIndex('by_userId_and_createdAt', (q) => q.eq('userId', userId))
      .take(BATCH)
    for (const row of events) {
      await ctx.db.delete(row._id)
    }
    return { done: places.length < BATCH && events.length < BATCH }
  },
}

const cycleStep: PurgeStep = {
  name: 'cycle_entries',
  run: async (ctx, userId) => {
    const rows = await ctx.db
      .query('cycle_entries')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .take(BATCH)
    for (const row of rows) {
      await ctx.db.delete(row._id)
    }
    return { done: rows.length < BATCH }
  },
}

const achievementsStep: PurgeStep = {
  name: 'achievements',
  run: async (ctx, userId) => {
    const rows = await ctx.db
      .query('achievements')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .take(BATCH)
    for (const row of rows) {
      await ctx.db.delete(row._id)
    }
    return { done: rows.length < BATCH }
  },
}

const profileDataStep: PurgeStep = {
  name: 'profile_data',
  run: async (ctx, userId) => {
    const questions = await ctx.db
      .query('profile_questions')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .take(BATCH)
    for (const row of questions) {
      await ctx.db.delete(row._id)
    }
    const answers = await ctx.db
      .query('profile_answers')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .take(BATCH)
    for (const row of answers) {
      await ctx.db.delete(row._id)
    }
    return { done: questions.length < BATCH && answers.length < BATCH }
  },
}

/** Small one-row-per-user tables, deleted together in a single pass. */
const singletonsStep: PurgeStep = {
  name: 'singletons',
  run: async (ctx, userId) => {
    const onboarding = await ctx.db
      .query('onboarding')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()
    if (onboarding) await ctx.db.delete(onboarding._id)

    const extendedProfile = await ctx.db
      .query('extended_profile')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()
    if (extendedProfile) await ctx.db.delete(extendedProfile._id)

    const trainingPreferences = await ctx.db
      .query('training_preferences')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .unique()
    if (trainingPreferences) await ctx.db.delete(trainingPreferences._id)

    const flareUp = await ctx.db
      .query('flare_ups')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .unique()
    if (flareUp) await ctx.db.delete(flareUp._id)

    const streak = await ctx.db
      .query('streaks')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .unique()
    if (streak) await ctx.db.delete(streak._id)

    const settings = await ctx.db
      .query('user_settings')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .unique()
    if (settings) await ctx.db.delete(settings._id)

    const customExercises = await ctx.db
      .query('custom_exercises')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .collect()
    for (const row of customExercises) {
      await ctx.db.delete(row._id)
    }

    return { done: true }
  },
}

/** Ordered purge pipeline. Social rows first so counters settle early. */
const PURGE_STEPS: PurgeStep[] = [
  reactionsStep,
  commentsStep,
  postsStep,
  postTriesStep,
  followsOutStep,
  followsInStep,
  membershipsStep,
  notificationsStep,
  notificationsActorStep,
  pushTokensStep,
  blocksStep,
  reportsStep,
  sessionsStep,
  checkinsStep,
  routinesStep,
  challengesStep,
  insightsStep,
  coachThreadsStep,
  equipmentStep,
  trainingContextStep,
  cycleStep,
  achievementsStep,
  profileDataStep,
  singletonsStep,
]

/**
 * Batched cleanup job. Runs one step per invocation (bounded row count) and
 * reschedules itself until every step reports done.
 */
export const purgeUserData = internalMutation({
  args: {
    userId: v.string(),
    stepIndex: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, { userId, stepIndex }) => {
    if (stepIndex >= PURGE_STEPS.length) return null

    const step = PURGE_STEPS[stepIndex]
    const { done } = await step.run(ctx, userId)

    const nextIndex = done ? stepIndex + 1 : stepIndex
    if (nextIndex < PURGE_STEPS.length) {
      await ctx.scheduler.runAfter(0, internal.account.purgeUserData, {
        userId,
        stepIndex: nextIndex,
      })
    }
    return null
  },
})

/**
 * Permanently deletes the calling user's account.
 *
 * Hides the public profile immediately, then schedules the batched purge of
 * every user-owned table and storage asset. Scoped strictly to the caller;
 * other users' data stays untouched (their counters are repaired as the purge
 * removes cross-user rows). The Clerk identity itself is deleted on the
 * client via `user.delete()` after this mutation succeeds.
 */
export const deleteAccount = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error('Not authenticated')
    }

    const userId = identity.subject

    // Hide the public identity right away.
    const profile = await ctx.db
      .query('profiles')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .unique()
    if (profile) {
      if (profile.avatarStorageId) {
        await ctx.storage.delete(profile.avatarStorageId)
      }
      await ctx.db.delete(profile._id)
    }

    await ctx.scheduler.runAfter(0, internal.account.purgeUserData, {
      userId,
      stepIndex: 0,
    })

    return null
  },
})

/**
 * Temporary deactivation: hides the public profile and posts and pauses
 * social notifications while keeping every row intact. Reactivated on the
 * next sign-in by ensureProfile.
 */
export const deactivateAccount = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Not authenticated')

    const profile = await ctx.db
      .query('profiles')
      .withIndex('by_userId', (q) => q.eq('userId', identity.subject))
      .unique()
    if (profile && profile.deactivatedAt == null) {
      await ctx.db.patch(profile._id, {
        deactivatedAt: Date.now(),
        updatedAt: Date.now(),
      })
    }
    return null
  },
})

/** Reactivate a deactivated account. Called automatically after sign-in. */
export const reactivateAccount = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Not authenticated')

    const profile = await ctx.db
      .query('profiles')
      .withIndex('by_userId', (q) => q.eq('userId', identity.subject))
      .unique()
    if (profile && profile.deactivatedAt != null) {
      await ctx.db.patch(profile._id, {
        deactivatedAt: undefined,
        updatedAt: Date.now(),
      })
    }
    return null
  },
})

/**
 * Forget everything the coach has learned: AI profile answers, pending
 * question sets, and the generated coach summary. Onboarding health basics
 * stay (they're edited in Health & coaching, not "memory").
 */
export const clearCoachMemory = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Not authenticated')
    const userId = identity.subject

    const answers = await ctx.db
      .query('profile_answers')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .collect()
    for (const row of answers) {
      await ctx.db.delete(row._id)
    }

    const questions = await ctx.db
      .query('profile_questions')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .collect()
    for (const row of questions) {
      await ctx.db.delete(row._id)
    }

    const extended = await ctx.db
      .query('extended_profile')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()
    if (extended) {
      await ctx.db.patch(extended._id, {
        profileSummary: undefined,
        hasPainAssessment: undefined,
        hasRedFlags: undefined,
        completedCategories: undefined,
        updatedAt: Date.now(),
      })
    }
    return null
  },
})

/**
 * Reset AI recommendations: clears weekly insights and their feedback so the
 * next generation starts from a clean slate.
 */
export const resetRecommendations = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Not authenticated')
    const userId = identity.subject

    const feedback = await ctx.db
      .query('weekly_insight_feedback')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .collect()
    for (const row of feedback) {
      await ctx.db.delete(row._id)
    }

    const insights = await ctx.db
      .query('weekly_insights')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .collect()
    for (const row of insights) {
      await ctx.db.delete(row._id)
    }
    return null
  },
})

/** Caps keep the export within Convex read limits. */
const EXPORT_SESSION_CAP = 500

/**
 * Full account export as a JSON-serializable object the client can save or
 * share. Covers profile, health, settings, workouts (capped at the most
 * recent 500 sessions), routines, challenges, achievements, and streaks.
 */
export const exportData = query({
  args: { now: v.number() },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, { now }) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return null
    const userId = identity.subject

    const strip = <T extends Record<string, unknown>>(row: T) => {
      const { _id, _creationTime, userId: _owner, ...rest } = row as T & {
        _id: unknown
        _creationTime: unknown
        userId?: unknown
      }
      return rest
    }

    const onboarding = await ctx.db
      .query('onboarding')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()
    const profile = await ctx.db
      .query('profiles')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .unique()
    const settings = await ctx.db
      .query('user_settings')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .unique()
    const answers = await ctx.db
      .query('profile_answers')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .collect()
    const streak = await ctx.db
      .query('streaks')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .unique()
    const routines = await ctx.db
      .query('workout_routines')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .collect()
    const challenges = await ctx.db
      .query('challenges')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .collect()
    const achievements = await ctx.db
      .query('achievements')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .collect()

    const sessions = await ctx.db
      .query('workout_sessions')
      .withIndex('by_user_status', (q) =>
        q.eq('userId', userId).eq('status', 'completed')
      )
      .order('desc')
      .take(EXPORT_SESSION_CAP)

    const workouts = []
    for (const session of sessions) {
      const sets = await ctx.db
        .query('workout_sets')
        .withIndex('by_sessionId', (q) => q.eq('sessionId', session._id))
        .collect()
      workouts.push({
        goal: session.goal,
        modality: session.modality,
        durationMin: session.durationMin,
        completedAt: session.completedAt ?? null,
        startedAt: session.startedAt ?? null,
        exercises: session.plan.map((exercise) => ({
          name: exercise.name,
          bodyPart: exercise.bodyPart,
          modality: exercise.modality,
        })),
        sets: sets.map((set) => ({
          exerciseId: set.exerciseId,
          setIndex: set.setIndex,
          weightKg: set.weightKg ?? null,
          reps: set.reps ?? null,
          rpe: set.rpe ?? null,
          durationSec: set.durationSec ?? null,
          distanceM: set.distanceM ?? null,
          isWarmup: set.isWarmup ?? false,
          completedAt: set.completedAt,
        })),
      })
    }

    return JSON.stringify(
      {
        exportedAt: new Date(now).toISOString(),
        profile: profile ? strip(profile) : null,
        onboarding: onboarding ? strip(onboarding) : null,
        settings: settings ? strip(settings) : null,
        coachAnswers: answers.map(strip),
        streak: streak ? strip(streak) : null,
        routines: routines.map(strip),
        challenges: challenges.map(strip),
        achievements: achievements.map(strip),
        workouts,
        note:
          workouts.length === EXPORT_SESSION_CAP
            ? `Workout export capped at the most recent ${EXPORT_SESSION_CAP} sessions.`
            : undefined,
      },
      null,
      2
    )
  },
})
