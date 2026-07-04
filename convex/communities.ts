import { v } from 'convex/values'

import type { Doc, Id } from './_generated/dataModel'
import {
  internalMutation,
  mutation,
  query,
  type MutationCtx,
} from './_generated/server'
import {
  getProfileByUserId,
  getProfileCards,
  notify,
  randomUsernameSuffix,
  requireIdentity,
} from './socialHelpers'

const MAX_MEMBERS = 100

const goalCategoryValidator = v.union(
  v.literal('marathon'),
  v.literal('half_marathon'),
  v.literal('ironman'),
  v.literal('consistency'),
  v.literal('custom')
)

const metricValidator = v.object({
  kind: v.union(
    v.literal('distance_km'),
    v.literal('sessions'),
    v.literal('custom')
  ),
  target: v.optional(v.number()),
  unit: v.string(),
})

type CommunityDoc = Doc<'communities'>
type MemberDoc = Doc<'community_members'>

function milestoneFor(progress: number, target: number | undefined): number {
  if (!target || target <= 0) return 0
  const pct = Math.min(100, (progress / target) * 100)
  return Math.floor(pct / 25) * 25
}

async function getMembership(
  ctx: MutationCtx,
  communityId: Id<'communities'>,
  userId: string
): Promise<MemberDoc | null> {
  return await ctx.db
    .query('community_members')
    .withIndex('by_community_and_user', (q) =>
      q.eq('communityId', communityId).eq('userId', userId)
    )
    .unique()
}

async function addMember(
  ctx: MutationCtx,
  community: CommunityDoc,
  userId: string,
  role: 'owner' | 'member'
): Promise<void> {
  const now = Date.now()
  await ctx.db.insert('community_members', {
    communityId: community._id,
    userId,
    role,
    progressValue: 0,
    sessionsCount: 0,
    lastMilestone: 0,
    lastActiveAt: now,
    joinedAt: now,
  })
  await ctx.db.patch(community._id, {
    memberCount: community.memberCount + 1,
    updatedAt: now,
  })
  const profile = await getProfileByUserId(ctx, userId)
  await ctx.db.insert('community_events', {
    communityId: community._id,
    userId,
    kind: role === 'owner' ? 'created' : 'joined',
    message:
      role === 'owner'
        ? `@${profile?.username ?? 'someone'} started the community`
        : `@${profile?.username ?? 'someone'} joined`,
    createdAt: now,
  })
}

export const createCommunity = mutation({
  args: {
    name: v.string(),
    goalCategory: goalCategoryValidator,
    goalLabel: v.string(),
    description: v.optional(v.string()),
    eventDate: v.optional(v.number()),
    metric: metricValidator,
    visibility: v.union(v.literal('invite'), v.literal('open')),
    inviteeUserIds: v.array(v.string()),
  },
  returns: v.id('communities'),
  handler: async (ctx, args): Promise<Id<'communities'>> => {
    const identity = await requireIdentity(ctx)
    const me = await getProfileByUserId(ctx, identity.subject)
    if (!me) throw new Error('Create your profile first')

    const name = args.name.trim().slice(0, 60)
    if (name.length < 3) throw new Error('Give your community a name')

    const now = Date.now()
    const communityId = await ctx.db.insert('communities', {
      name,
      creatorId: identity.subject,
      goalCategory: args.goalCategory,
      goalLabel: args.goalLabel.trim().slice(0, 60) || name,
      description: args.description?.trim().slice(0, 300) || undefined,
      eventDate: args.eventDate,
      metric: args.metric,
      inviteCode: `em${randomUsernameSuffix(8)}`,
      visibility: args.visibility,
      memberCount: 0,
      createdAt: now,
      updatedAt: now,
    })

    const community = await ctx.db.get(communityId)
    if (!community) throw new Error('Community creation failed')
    await addMember(ctx, community, identity.subject, 'owner')

    for (const inviteeId of args.inviteeUserIds.slice(0, 25)) {
      if (inviteeId === identity.subject) continue
      await notify(ctx, {
        userId: inviteeId,
        type: 'community_invite',
        actorId: identity.subject,
        message: `@${me.username} invited you to "${name}"`,
        communityId,
      })
    }
    return communityId
  },
})

export const joinCommunity = mutation({
  args: {
    communityId: v.optional(v.id('communities')),
    inviteCode: v.optional(v.string()),
  },
  returns: v.id('communities'),
  handler: async (ctx, args): Promise<Id<'communities'>> => {
    const identity = await requireIdentity(ctx)
    const me = await getProfileByUserId(ctx, identity.subject)
    if (!me) throw new Error('Create your profile first')

    let community: CommunityDoc | null = null
    if (args.inviteCode) {
      community = await ctx.db
        .query('communities')
        .withIndex('by_inviteCode', (q) =>
          q.eq('inviteCode', args.inviteCode!.trim().toLowerCase())
        )
        .unique()
    } else if (args.communityId) {
      community = await ctx.db.get(args.communityId)
      // Without a code, only open communities (or invited members via
      // notification deep link) can be joined directly.
      if (community && community.visibility !== 'open') {
        const invited = await ctx.db
          .query('notifications')
          .withIndex('by_user_and_createdAt', (q) =>
            q.eq('userId', identity.subject)
          )
          .order('desc')
          .take(100)
        const hasInvite = invited.some(
          (n) =>
            n.type === 'community_invite' &&
            n.communityId === community!._id
        )
        if (!hasInvite) throw new Error('This community is invite-only')
      }
    }
    if (!community) throw new Error('Community not found')
    if (community.memberCount >= MAX_MEMBERS) {
      throw new Error('This community is full')
    }

    const existing = await getMembership(ctx, community._id, identity.subject)
    if (existing) return community._id

    await addMember(ctx, community, identity.subject, 'member')
    await notify(ctx, {
      userId: community.creatorId,
      type: 'community_milestone',
      actorId: identity.subject,
      message: `@${me.username} joined "${community.name}"`,
      communityId: community._id,
    })
    return community._id
  },
})

export const leaveCommunity = mutation({
  args: { communityId: v.id('communities') },
  returns: v.null(),
  handler: async (ctx, { communityId }) => {
    const identity = await requireIdentity(ctx)
    const community = await ctx.db.get(communityId)
    if (!community) return null
    const membership = await getMembership(ctx, communityId, identity.subject)
    if (!membership) return null

    await ctx.db.delete(membership._id)
    const remaining = await ctx.db
      .query('community_members')
      .withIndex('by_community', (q) => q.eq('communityId', communityId))
      .take(2)

    if (remaining.length === 0) {
      // Last member out: clean up the whole community.
      const events = await ctx.db
        .query('community_events')
        .withIndex('by_community_and_createdAt', (q) =>
          q.eq('communityId', communityId)
        )
        .take(500)
      for (const event of events) {
        await ctx.db.delete(event._id)
      }
      await ctx.db.delete(communityId)
      return null
    }

    if (membership.role === 'owner') {
      await ctx.db.patch(remaining[0]._id, { role: 'owner' })
      await ctx.db.patch(communityId, {
        creatorId: remaining[0].userId,
        memberCount: Math.max(0, community.memberCount - 1),
        updatedAt: Date.now(),
      })
    } else {
      await ctx.db.patch(communityId, {
        memberCount: Math.max(0, community.memberCount - 1),
        updatedAt: Date.now(),
      })
    }
    return null
  },
})

export const inviteToCommunity = mutation({
  args: {
    communityId: v.id('communities'),
    inviteeUserIds: v.array(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, { communityId, inviteeUserIds }) => {
    const identity = await requireIdentity(ctx)
    const community = await ctx.db.get(communityId)
    if (!community) throw new Error('Community not found')
    const membership = await getMembership(ctx, communityId, identity.subject)
    if (!membership) throw new Error('Only members can invite')

    const me = await getProfileByUserId(ctx, identity.subject)
    for (const inviteeId of inviteeUserIds.slice(0, 25)) {
      if (inviteeId === identity.subject) continue
      const already = await getMembership(ctx, communityId, inviteeId)
      if (already) continue
      await notify(ctx, {
        userId: inviteeId,
        type: 'community_invite',
        actorId: identity.subject,
        message: `@${me?.username ?? 'someone'} invited you to "${community.name}"`,
        communityId,
      })
    }
    return null
  },
})

/** Your communities strip for the Challenges tab. */
export const listMyCommunities = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return []

    const memberships = await ctx.db
      .query('community_members')
      .withIndex('by_user', (q) => q.eq('userId', identity.subject))
      .take(50)

    const items = await Promise.all(
      memberships.map(async (membership) => {
        const community = await ctx.db.get(membership.communityId)
        if (!community) return null

        // A few member avatars for the card.
        const members = await ctx.db
          .query('community_members')
          .withIndex('by_community', (q) =>
            q.eq('communityId', community._id)
          )
          .take(4)
        const cards = await getProfileCards(
          ctx,
          members.map((m) => m.userId)
        )

        const target = membership.personalTarget ?? community.metric.target
        return {
          _id: community._id,
          name: community.name,
          goalCategory: community.goalCategory,
          goalLabel: community.goalLabel,
          eventDate: community.eventDate ?? null,
          metric: community.metric,
          memberCount: community.memberCount,
          myProgress: membership.progressValue,
          myTarget: target ?? null,
          myPercent:
            target && target > 0
              ? Math.min(
                  100,
                  Math.round((membership.progressValue / target) * 100)
                )
              : null,
          memberPreviews: members
            .map((m) => cards.get(m.userId))
            .filter((c): c is NonNullable<typeof c> => c != null),
        }
      })
    )
    return items.filter((i): i is NonNullable<typeof i> => i != null)
  },
})

export const getCommunityDetail = query({
  args: { communityId: v.id('communities') },
  handler: async (ctx, { communityId }) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return null

    const community = await ctx.db.get(communityId)
    if (!community) return null

    const members = await ctx.db
      .query('community_members')
      .withIndex('by_community', (q) => q.eq('communityId', communityId))
      .take(MAX_MEMBERS)
    const myMembership =
      members.find((m) => m.userId === identity.subject) ?? null
    // Non-members can preview open communities only.
    if (!myMembership && community.visibility !== 'open') return null

    const cards = await getProfileCards(
      ctx,
      members.map((m) => m.userId)
    )

    const events = myMembership
      ? await ctx.db
          .query('community_events')
          .withIndex('by_community_and_createdAt', (q) =>
            q.eq('communityId', communityId)
          )
          .order('desc')
          .take(20)
      : []

    const board = members
      .map((member) => {
        const card = cards.get(member.userId)
        const target = member.personalTarget ?? community.metric.target
        return {
          userId: member.userId,
          username: card?.username ?? 'unknown',
          displayName: card?.displayName ?? 'Unknown',
          avatarUrl: card?.avatarUrl ?? null,
          isMe: member.userId === identity.subject,
          role: member.role,
          progressValue: member.progressValue,
          sessionsCount: member.sessionsCount,
          target: target ?? null,
          percent:
            target && target > 0
              ? Math.min(
                  100,
                  Math.round((member.progressValue / target) * 100)
                )
              : null,
          lastActiveAt: member.lastActiveAt,
        }
      })
      // Progress, not ranking: alphabetical, with "you" pinned first.
      .sort((a, b) => {
        if (a.isMe !== b.isMe) return a.isMe ? -1 : 1
        return a.displayName.localeCompare(b.displayName)
      })

    return {
      _id: community._id,
      name: community.name,
      goalCategory: community.goalCategory,
      goalLabel: community.goalLabel,
      description: community.description ?? null,
      eventDate: community.eventDate ?? null,
      metric: community.metric,
      visibility: community.visibility,
      memberCount: community.memberCount,
      inviteCode: myMembership ? community.inviteCode : null,
      isMember: myMembership !== null,
      myRole: myMembership?.role ?? null,
      board,
      events: events.map((e) => ({
        _id: e._id,
        kind: e.kind,
        message: e.message,
        createdAt: e.createdAt,
      })),
    }
  },
})

/** Preview a community from an invite link before joining. */
export const getCommunityByInviteCode = query({
  args: { inviteCode: v.string() },
  handler: async (ctx, { inviteCode }) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return null
    const community = await ctx.db
      .query('communities')
      .withIndex('by_inviteCode', (q) =>
        q.eq('inviteCode', inviteCode.trim().toLowerCase())
      )
      .unique()
    if (!community) return null
    const membership = await ctx.db
      .query('community_members')
      .withIndex('by_community_and_user', (q) =>
        q.eq('communityId', community._id).eq('userId', identity.subject)
      )
      .unique()
    return {
      _id: community._id,
      name: community.name,
      goalLabel: community.goalLabel,
      eventDate: community.eventDate ?? null,
      memberCount: community.memberCount,
      isMember: membership !== null,
    }
  },
})

export const setPersonalTarget = mutation({
  args: {
    communityId: v.id('communities'),
    target: v.union(v.number(), v.null()),
  },
  returns: v.null(),
  handler: async (ctx, { communityId, target }) => {
    const identity = await requireIdentity(ctx)
    const membership = await getMembership(ctx, communityId, identity.subject)
    if (!membership) throw new Error('Not a member')
    await ctx.db.patch(membership._id, {
      personalTarget: target ?? undefined,
    })
    return null
  },
})

/** Manual progress logging for custom metrics (auto metrics ignore this). */
export const logCommunityProgress = mutation({
  args: { communityId: v.id('communities'), value: v.number() },
  returns: v.null(),
  handler: async (ctx, { communityId, value }) => {
    const identity = await requireIdentity(ctx)
    const community = await ctx.db.get(communityId)
    if (!community) throw new Error('Community not found')
    if (community.metric.kind !== 'custom') {
      throw new Error('Progress for this goal is tracked automatically')
    }
    const membership = await getMembership(ctx, communityId, identity.subject)
    if (!membership) throw new Error('Not a member')

    await applyProgress(ctx, community, membership, value, 0)
    return null
  },
})

async function applyProgress(
  ctx: MutationCtx,
  community: CommunityDoc,
  membership: MemberDoc,
  progressDelta: number,
  sessionsDelta: number
): Promise<void> {
  const now = Date.now()
  const nextProgress = Math.max(0, membership.progressValue + progressDelta)
  const nextSessions = membership.sessionsCount + sessionsDelta
  const target = membership.personalTarget ?? community.metric.target
  const nextMilestone = milestoneFor(nextProgress, target)

  await ctx.db.patch(membership._id, {
    progressValue: nextProgress,
    sessionsCount: nextSessions,
    lastMilestone: Math.max(membership.lastMilestone, nextMilestone),
    lastActiveAt: now,
  })

  if (nextMilestone > membership.lastMilestone && nextMilestone >= 25) {
    const profile = await getProfileByUserId(ctx, membership.userId)
    const username = profile?.username ?? 'someone'
    await ctx.db.insert('community_events', {
      communityId: community._id,
      userId: membership.userId,
      kind: 'milestone',
      message:
        nextMilestone >= 100
          ? `@${username} hit their goal!`
          : `@${username} is ${nextMilestone}% of the way there`,
      createdAt: now,
    })

    // Celebrate with the rest of the crew (bounded fan-out).
    const others = await ctx.db
      .query('community_members')
      .withIndex('by_community', (q) => q.eq('communityId', community._id))
      .take(25)
    for (const other of others) {
      if (other.userId === membership.userId) continue
      await notify(ctx, {
        userId: other.userId,
        type: 'community_milestone',
        actorId: membership.userId,
        message:
          nextMilestone >= 100
            ? `@${username} hit their goal in "${community.name}"`
            : `@${username} reached ${nextMilestone}% in "${community.name}"`,
        communityId: community._id,
      })
    }
  }
}

/**
 * Write-time progress: scheduled from completeSession. Bumps every
 * membership of the user, deriving distance from the session's logged sets.
 */
export const recordWorkoutForUser = internalMutation({
  args: {
    userId: v.string(),
    sessionId: v.id('workout_sessions'),
  },
  returns: v.null(),
  handler: async (ctx, { userId, sessionId }) => {
    const memberships = await ctx.db
      .query('community_members')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .take(50)
    if (memberships.length === 0) return null

    const sets = await ctx.db
      .query('workout_sets')
      .withIndex('by_sessionId', (q) => q.eq('sessionId', sessionId))
      .collect()
    const distanceKm =
      sets.reduce((acc, set) => acc + (set.distanceM ?? 0), 0) / 1000

    const profile = await getProfileByUserId(ctx, userId)
    const username = profile?.username ?? 'someone'
    const now = Date.now()

    for (const membership of memberships) {
      const community = await ctx.db.get(membership.communityId)
      if (!community) continue

      const progressDelta =
        community.metric.kind === 'distance_km'
          ? Math.round(distanceKm * 10) / 10
          : community.metric.kind === 'sessions'
            ? 1
            : 0
      await applyProgress(ctx, community, membership, progressDelta, 1)

      await ctx.db.insert('community_events', {
        communityId: community._id,
        userId,
        kind: 'workout_done',
        message:
          community.metric.kind === 'distance_km' && distanceKm > 0
            ? `@${username} logged ${Math.round(distanceKm * 10) / 10} km`
            : `@${username} completed a workout`,
        createdAt: now,
      })
    }
    return null
  },
})
