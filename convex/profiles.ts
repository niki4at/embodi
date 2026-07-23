import { v } from 'convex/values'

import { mutation, query } from './_generated/server'
import {
  USERNAME_CHANGE_COOLDOWN_MS,
  USERNAME_REGEX,
  buildSearchText,
  canViewContent,
  getFollowEdge,
  getProfileByUserId,
  getProfileByUsername as lookupUsername,
  getProfileCards,
  isBlockedEitherWay,
  notify,
  randomUsernameSuffix,
  requireIdentity,
  toProfileCard,
  usernameBaseFromName,
} from './socialHelpers'
import { getSettingsForUser } from './userSettings'

const profileCardValidator = v.object({
  userId: v.string(),
  username: v.string(),
  displayName: v.string(),
  avatarUrl: v.union(v.string(), v.null()),
  isPrivate: v.boolean(),
  streakWeeks: v.number(),
})

/**
 * Idempotently creates the caller's profile. Existing users (who onboarded
 * before social shipped) get a handle generated from their onboarding name
 * exactly once; new users claim theirs during onboarding via claimUsername.
 */
export const ensureProfile = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const identity = await requireIdentity(ctx)
    const existing = await getProfileByUserId(ctx, identity.subject)
    if (existing) {
      // Signing back in reactivates a deactivated account.
      if (existing.deactivatedAt != null) {
        await ctx.db.patch(existing._id, {
          deactivatedAt: undefined,
          updatedAt: Date.now(),
        })
      }
      return null
    }

    const onboarding = await ctx.db
      .query('onboarding')
      .withIndex('by_userId', (q) => q.eq('userId', identity.subject))
      .first()
    // Only auto-provision for users who finished onboarding; fresh sign-ups
    // go through the explicit claim step instead.
    if (!onboarding) return null

    const displayName =
      onboarding.name.trim() || (identity.name as string | undefined) || 'Mover'
    const base = usernameBaseFromName(displayName)

    let username = base
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const taken = await lookupUsername(ctx, username)
      if (!taken) break
      username = `${base}${randomUsernameSuffix(3)}`.slice(0, 20)
    }

    const now = Date.now()
    await ctx.db.insert('profiles', {
      userId: identity.subject,
      username,
      displayName,
      isPrivate: false,
      backerCount: 0,
      backingCount: 0,
      postCount: 0,
      searchText: buildSearchText(username, displayName),
      createdAt: now,
      updatedAt: now,
    })
    return null
  },
})

export const checkUsernameAvailable = query({
  args: { username: v.string() },
  returns: v.object({
    available: v.boolean(),
    reason: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, { username }) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return { available: false, reason: 'Not signed in' }

    const normalized = username.toLowerCase().trim()
    if (!USERNAME_REGEX.test(normalized)) {
      return {
        available: false,
        reason:
          'Use 3-20 characters: lowercase letters, numbers, underscores. Start with a letter.',
      }
    }
    const existing = await lookupUsername(ctx, normalized)
    if (existing && existing.userId !== identity.subject) {
      return { available: false, reason: 'That handle is taken' }
    }
    return { available: true, reason: null }
  },
})

/** Claim a handle during onboarding (creates the profile if needed). */
export const claimUsername = mutation({
  args: { username: v.string(), displayName: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx)
    const normalized = args.username.toLowerCase().trim()
    if (!USERNAME_REGEX.test(normalized)) {
      throw new Error('Invalid username format')
    }
    const taken = await lookupUsername(ctx, normalized)
    if (taken && taken.userId !== identity.subject) {
      throw new Error('That handle is taken')
    }

    const displayName = args.displayName.trim() || 'Mover'
    const now = Date.now()
    const existing = await getProfileByUserId(ctx, identity.subject)
    if (existing) {
      await ctx.db.patch(existing._id, {
        username: normalized,
        displayName,
        searchText: buildSearchText(normalized, displayName),
        updatedAt: now,
      })
    } else {
      await ctx.db.insert('profiles', {
        userId: identity.subject,
        username: normalized,
        displayName,
        isPrivate: false,
        backerCount: 0,
        backingCount: 0,
        postCount: 0,
        searchText: buildSearchText(normalized, displayName),
        createdAt: now,
        updatedAt: now,
      })
    }
    return null
  },
})

export const getMyProfile = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return null
    const profile = await getProfileByUserId(ctx, identity.subject)
    if (!profile) return null
    const card = await toProfileCard(ctx, profile, identity.subject)
    return {
      ...card,
      bio: profile.bio ?? null,
      backerCount: profile.backerCount,
      backingCount: profile.backingCount,
      postCount: profile.postCount,
      usernameUpdatedAt: profile.usernameUpdatedAt ?? null,
      deactivated: profile.deactivatedAt != null,
    }
  },
})

export const updateProfile = mutation({
  args: {
    displayName: v.optional(v.string()),
    bio: v.optional(v.string()),
    isPrivate: v.optional(v.boolean()),
    username: v.optional(v.string()),
    avatarStorageId: v.optional(v.id('_storage')),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx)
    const profile = await getProfileByUserId(ctx, identity.subject)
    if (!profile) throw new Error('Profile not found')

    const now = Date.now()
    const patch: Partial<typeof profile> = { updatedAt: now }

    if (args.displayName !== undefined) {
      patch.displayName = args.displayName.trim() || profile.displayName
    }
    if (args.bio !== undefined) {
      patch.bio = args.bio.trim().slice(0, 160)
    }
    if (args.isPrivate !== undefined) {
      patch.isPrivate = args.isPrivate
    }
    if (args.avatarStorageId !== undefined) {
      // Free the previous avatar so storage never accumulates orphans.
      if (
        profile.avatarStorageId &&
        profile.avatarStorageId !== args.avatarStorageId
      ) {
        await ctx.storage.delete(profile.avatarStorageId)
      }
      patch.avatarStorageId = args.avatarStorageId
    }

    if (args.username !== undefined) {
      const normalized = args.username.toLowerCase().trim()
      if (normalized !== profile.username) {
        if (!USERNAME_REGEX.test(normalized)) {
          throw new Error('Invalid username format')
        }
        if (
          profile.usernameUpdatedAt != null &&
          now - profile.usernameUpdatedAt < USERNAME_CHANGE_COOLDOWN_MS
        ) {
          throw new Error('You can change your handle once every 14 days')
        }
        const taken = await lookupUsername(ctx, normalized)
        if (taken && taken.userId !== identity.subject) {
          throw new Error('That handle is taken')
        }
        patch.username = normalized
        patch.usernameUpdatedAt = now
      }
    }

    const nextUsername = patch.username ?? profile.username
    const nextDisplayName = patch.displayName ?? profile.displayName
    patch.searchText = buildSearchText(nextUsername, nextDisplayName)

    await ctx.db.patch(profile._id, patch)
    return null
  },
})

export const generateAvatarUploadUrl = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    await requireIdentity(ctx)
    return await ctx.storage.generateUploadUrl()
  },
})

/** Public profile page: identity + counts + viewer relationship. */
export const getProfilePage = query({
  args: {
    username: v.string(),
    // When the owner previews their own profile "as others", we compute the
    // page exactly as a stranger (no backing relationship) would see it.
    previewAsPublic: v.optional(v.boolean()),
  },
  handler: async (ctx, { username, previewAsPublic }) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return null

    const profile = await lookupUsername(ctx, username)
    if (!profile) return null
    if (
      profile.deactivatedAt != null &&
      profile.userId !== identity.subject
    ) {
      return null
    }
    if (await isBlockedEitherWay(ctx, identity.subject, profile.userId)) {
      return null
    }

    const preview = !!previewAsPublic && profile.userId === identity.subject
    const isMe = profile.userId === identity.subject && !preview
    const edge =
      isMe || preview
        ? null
        : await getFollowEdge(ctx, identity.subject, profile.userId)
    const backsMe =
      isMe || preview
        ? false
        : (await getFollowEdge(ctx, profile.userId, identity.subject))
            ?.status === 'active'

    // In preview mode the owner is treated as a stranger so the card hides
    // exactly what strangers can't see (e.g. the streak flame).
    const card = await toProfileCard(
      ctx,
      profile,
      preview ? undefined : identity.subject
    )
    const canViewPosts = preview
      ? !profile.isPrivate
      : await canViewContent(ctx, identity.subject, profile)

    // Weekly training progress, shown only when the owner keeps their
    // activity section public (or is looking at themselves).
    const subjectSettings = await getSettingsForUser(ctx, profile.userId)
    let publicProgress: {
      workoutsThisWeek: number
      weeklyGoal: number
      streakWeeks: number
    } | null = null
    if (isMe || (canViewPosts && subjectSettings.publicActivity)) {
      const streak = await ctx.db
        .query('streaks')
        .withIndex('by_userId', (q) => q.eq('userId', profile.userId))
        .unique()
      if (streak) {
        publicProgress = {
          workoutsThisWeek: streak.workoutsThisWeek,
          weeklyGoal: streak.weeklyGoal,
          streakWeeks: streak.currentStreakWeeks,
        }
      }
    }

    return {
      ...card,
      bio: profile.bio ?? null,
      backerCount: profile.backerCount,
      backingCount: profile.backingCount,
      postCount: profile.postCount,
      isMe,
      relationship: (edge?.status ?? 'none') as 'active' | 'pending' | 'none',
      backsMe,
      canViewPosts,
      publicProgress,
    }
  },
})

/** Back someone (one-way follow). Private accounts get a pending request. */
export const backUser = mutation({
  args: { userId: v.string() },
  returns: v.null(),
  handler: async (ctx, { userId }) => {
    const identity = await requireIdentity(ctx)
    if (userId === identity.subject) throw new Error('You already back yourself')
    if (await isBlockedEitherWay(ctx, identity.subject, userId)) {
      throw new Error('Profile not found')
    }

    const target = await getProfileByUserId(ctx, userId)
    if (!target) throw new Error('Profile not found')

    const existing = await getFollowEdge(ctx, identity.subject, userId)
    if (existing) return null

    const me = await getProfileByUserId(ctx, identity.subject)
    if (!me) throw new Error('Create your profile first')

    const status = target.isPrivate ? 'pending' : 'active'
    await ctx.db.insert('follows', {
      followerId: identity.subject,
      followeeId: userId,
      status,
      createdAt: Date.now(),
    })

    if (status === 'active') {
      await ctx.db.patch(target._id, { backerCount: target.backerCount + 1 })
      await ctx.db.patch(me._id, { backingCount: me.backingCount + 1 })
      await notify(ctx, {
        userId,
        type: 'new_backer',
        actorId: identity.subject,
        message: `@${me.username} is now backing you`,
      })
    } else {
      await notify(ctx, {
        userId,
        type: 'back_request',
        actorId: identity.subject,
        message: `@${me.username} wants to back you`,
      })
    }
    return null
  },
})

export const unbackUser = mutation({
  args: { userId: v.string() },
  returns: v.null(),
  handler: async (ctx, { userId }) => {
    const identity = await requireIdentity(ctx)
    const edge = await getFollowEdge(ctx, identity.subject, userId)
    if (!edge) return null

    await ctx.db.delete(edge._id)
    if (edge.status === 'active') {
      const target = await getProfileByUserId(ctx, userId)
      const me = await getProfileByUserId(ctx, identity.subject)
      if (target) {
        await ctx.db.patch(target._id, {
          backerCount: Math.max(0, target.backerCount - 1),
        })
      }
      if (me) {
        await ctx.db.patch(me._id, {
          backingCount: Math.max(0, me.backingCount - 1),
        })
      }
    }
    return null
  },
})

export const respondToBackRequest = mutation({
  args: { followerId: v.string(), accept: v.boolean() },
  returns: v.null(),
  handler: async (ctx, { followerId, accept }) => {
    const identity = await requireIdentity(ctx)
    const edge = await getFollowEdge(ctx, followerId, identity.subject)
    if (!edge || edge.status !== 'pending') return null

    if (!accept) {
      await ctx.db.delete(edge._id)
      return null
    }

    await ctx.db.patch(edge._id, { status: 'active' })
    const me = await getProfileByUserId(ctx, identity.subject)
    const follower = await getProfileByUserId(ctx, followerId)
    if (me) {
      await ctx.db.patch(me._id, { backerCount: me.backerCount + 1 })
    }
    if (follower) {
      await ctx.db.patch(follower._id, {
        backingCount: follower.backingCount + 1,
      })
      await notify(ctx, {
        userId: followerId,
        type: 'back_accepted',
        actorId: identity.subject,
        message: `@${me?.username ?? 'they'} accepted your request`,
      })
    }
    return null
  },
})

export const listBackRequests = query({
  args: {},
  returns: v.array(profileCardValidator),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return []
    const pending = await ctx.db
      .query('follows')
      .withIndex('by_followee_and_status', (q) =>
        q.eq('followeeId', identity.subject).eq('status', 'pending')
      )
      .order('desc')
      .take(50)
    const cards = await getProfileCards(
      ctx,
      pending.map((f) => f.followerId)
    )
    return pending
      .map((f) => cards.get(f.followerId))
      .filter((c): c is NonNullable<typeof c> => c != null)
  },
})

export const listBackers = query({
  args: { userId: v.string() },
  returns: v.array(profileCardValidator),
  handler: async (ctx, { userId }) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return []
    const subject = await getProfileByUserId(ctx, userId)
    if (!subject) return []
    if (!(await canViewContent(ctx, identity.subject, subject))) return []

    const edges = await ctx.db
      .query('follows')
      .withIndex('by_followee_and_status', (q) =>
        q.eq('followeeId', userId).eq('status', 'active')
      )
      .order('desc')
      .take(100)
    const cards = await getProfileCards(
      ctx,
      edges.map((f) => f.followerId)
    )
    return edges
      .map((f) => cards.get(f.followerId))
      .filter((c): c is NonNullable<typeof c> => c != null)
  },
})

export const listBacking = query({
  args: { userId: v.string() },
  returns: v.array(profileCardValidator),
  handler: async (ctx, { userId }) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return []
    const subject = await getProfileByUserId(ctx, userId)
    if (!subject) return []
    if (!(await canViewContent(ctx, identity.subject, subject))) return []

    const edges = await ctx.db
      .query('follows')
      .withIndex('by_follower_and_status', (q) =>
        q.eq('followerId', userId).eq('status', 'active')
      )
      .order('desc')
      .take(100)
    const cards = await getProfileCards(
      ctx,
      edges.map((f) => f.followeeId)
    )
    return edges
      .map((f) => cards.get(f.followeeId))
      .filter((c): c is NonNullable<typeof c> => c != null)
  },
})

export const searchPeople = query({
  args: { term: v.string() },
  returns: v.array(profileCardValidator),
  handler: async (ctx, { term }) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return []
    const trimmed = term.trim().toLowerCase()
    if (trimmed.length < 2) return []

    const matches = await ctx.db
      .query('profiles')
      .withSearchIndex('search_people', (q) => q.search('searchText', trimmed))
      .take(20)

    const visible: typeof matches = []
    for (const profile of matches) {
      if (profile.userId === identity.subject) continue
      if (profile.deactivatedAt != null) continue
      if (await isBlockedEitherWay(ctx, identity.subject, profile.userId)) {
        continue
      }
      visible.push(profile)
    }
    return await Promise.all(visible.map((p) => toProfileCard(ctx, p)))
  },
})

export const blockUser = mutation({
  args: { userId: v.string() },
  returns: v.null(),
  handler: async (ctx, { userId }) => {
    const identity = await requireIdentity(ctx)
    if (userId === identity.subject) throw new Error('Cannot block yourself')

    const existing = await ctx.db
      .query('blocks')
      .withIndex('by_blocker_and_blocked', (q) =>
        q.eq('blockerId', identity.subject).eq('blockedId', userId)
      )
      .unique()
    if (existing) return null

    await ctx.db.insert('blocks', {
      blockerId: identity.subject,
      blockedId: userId,
      createdAt: Date.now(),
    })

    // Sever the graph in both directions and fix the counters.
    const me = await getProfileByUserId(ctx, identity.subject)
    const them = await getProfileByUserId(ctx, userId)
    const myEdge = await getFollowEdge(ctx, identity.subject, userId)
    if (myEdge) {
      await ctx.db.delete(myEdge._id)
      if (myEdge.status === 'active') {
        if (me) {
          await ctx.db.patch(me._id, {
            backingCount: Math.max(0, me.backingCount - 1),
          })
        }
        if (them) {
          await ctx.db.patch(them._id, {
            backerCount: Math.max(0, them.backerCount - 1),
          })
        }
      }
    }
    const theirEdge = await getFollowEdge(ctx, userId, identity.subject)
    if (theirEdge) {
      await ctx.db.delete(theirEdge._id)
      if (theirEdge.status === 'active') {
        if (them) {
          await ctx.db.patch(them._id, {
            backingCount: Math.max(0, them.backingCount - 1),
          })
        }
        if (me) {
          await ctx.db.patch(me._id, {
            backerCount: Math.max(0, me.backerCount - 1),
          })
        }
      }
    }
    return null
  },
})

export const unblockUser = mutation({
  args: { userId: v.string() },
  returns: v.null(),
  handler: async (ctx, { userId }) => {
    const identity = await requireIdentity(ctx)
    const block = await ctx.db
      .query('blocks')
      .withIndex('by_blocker_and_blocked', (q) =>
        q.eq('blockerId', identity.subject).eq('blockedId', userId)
      )
      .unique()
    if (block) await ctx.db.delete(block._id)
    return null
  },
})

export const listBlocked = query({
  args: {},
  returns: v.array(profileCardValidator),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return []
    const blocks = await ctx.db
      .query('blocks')
      .withIndex('by_blocker_and_blocked', (q) =>
        q.eq('blockerId', identity.subject)
      )
      .take(200)
    const cards = await getProfileCards(
      ctx,
      blocks.map((b) => b.blockedId)
    )
    return blocks
      .map((b) => cards.get(b.blockedId))
      .filter((c): c is NonNullable<typeof c> => c != null)
  },
})

export const reportContent = mutation({
  args: {
    targetType: v.union(
      v.literal('post'),
      v.literal('comment'),
      v.literal('profile'),
      v.literal('community')
    ),
    targetId: v.string(),
    reason: v.string(),
    details: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx)
    await ctx.db.insert('reports', {
      reporterId: identity.subject,
      targetType: args.targetType,
      targetId: args.targetId,
      reason: args.reason,
      details: args.details,
      status: 'open',
      createdAt: Date.now(),
    })
    return null
  },
})
