import type { Doc } from './_generated/dataModel'
import { internal } from './_generated/api'
import type { MutationCtx, QueryCtx } from './_generated/server'

export const USERNAME_REGEX = /^[a-z][a-z0-9_]{2,19}$/
export const USERNAME_CHANGE_COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000

export type ProfileDoc = Doc<'profiles'>

/** Public card shape sent to clients wherever a person is rendered. */
export type ProfileCard = {
  userId: string
  username: string
  displayName: string
  avatarUrl: string | null
  isPrivate: boolean
  /** Current weekly workout streak (0 = no active streak). */
  streakWeeks: number
}

export async function requireIdentity(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) {
    throw new Error('Not authenticated')
  }
  return identity
}

export async function getProfileByUserId(
  ctx: QueryCtx | MutationCtx,
  userId: string
): Promise<ProfileDoc | null> {
  return await ctx.db
    .query('profiles')
    .withIndex('by_userId', (q) => q.eq('userId', userId))
    .unique()
}

export async function getProfileByUsername(
  ctx: QueryCtx | MutationCtx,
  username: string
): Promise<ProfileDoc | null> {
  return await ctx.db
    .query('profiles')
    .withIndex('by_username', (q) => q.eq('username', username.toLowerCase()))
    .unique()
}

export async function toProfileCard(
  ctx: QueryCtx | MutationCtx,
  profile: ProfileDoc
): Promise<ProfileCard> {
  const streak = await ctx.db
    .query('streaks')
    .withIndex('by_userId', (q) => q.eq('userId', profile.userId))
    .unique()
  return {
    userId: profile.userId,
    username: profile.username,
    displayName: profile.displayName,
    avatarUrl: profile.avatarStorageId
      ? await ctx.storage.getUrl(profile.avatarStorageId)
      : null,
    isPrivate: profile.isPrivate,
    streakWeeks: streak?.currentStreakWeeks ?? 0,
  }
}

/** Batch-resolve profile cards for a set of user ids (deduped). */
export async function getProfileCards(
  ctx: QueryCtx | MutationCtx,
  userIds: string[]
): Promise<Map<string, ProfileCard>> {
  const unique = Array.from(new Set(userIds))
  const cards = new Map<string, ProfileCard>()
  await Promise.all(
    unique.map(async (userId) => {
      const profile = await getProfileByUserId(ctx, userId)
      if (profile) {
        cards.set(userId, await toProfileCard(ctx, profile))
      }
    })
  )
  return cards
}

export async function getFollowEdge(
  ctx: QueryCtx | MutationCtx,
  followerId: string,
  followeeId: string
): Promise<Doc<'follows'> | null> {
  return await ctx.db
    .query('follows')
    .withIndex('by_follower_and_followee', (q) =>
      q.eq('followerId', followerId).eq('followeeId', followeeId)
    )
    .unique()
}

export async function isBlockedEitherWay(
  ctx: QueryCtx | MutationCtx,
  a: string,
  b: string
): Promise<boolean> {
  const [ab, ba] = await Promise.all([
    ctx.db
      .query('blocks')
      .withIndex('by_blocker_and_blocked', (q) =>
        q.eq('blockerId', a).eq('blockedId', b)
      )
      .unique(),
    ctx.db
      .query('blocks')
      .withIndex('by_blocker_and_blocked', (q) =>
        q.eq('blockerId', b).eq('blockedId', a)
      )
      .unique(),
  ])
  return ab !== null || ba !== null
}

/** Whether viewer can see the subject's backers-only content. */
export async function canViewContent(
  ctx: QueryCtx | MutationCtx,
  viewerId: string,
  subject: ProfileDoc
): Promise<boolean> {
  if (viewerId === subject.userId) return true
  if (await isBlockedEitherWay(ctx, viewerId, subject.userId)) return false
  if (!subject.isPrivate) return true
  const edge = await getFollowEdge(ctx, viewerId, subject.userId)
  return edge?.status === 'active'
}

/**
 * Insert an in-app notification and schedule the push send. Self-notifications
 * are dropped so acting on your own content stays silent.
 */
export async function notify(
  ctx: MutationCtx,
  args: {
    userId: string
    type: Doc<'notifications'>['type']
    actorId: string
    message: string
    postId?: Doc<'posts'>['_id']
    communityId?: Doc<'communities'>['_id']
  }
): Promise<void> {
  if (args.userId === args.actorId) return
  await ctx.db.insert('notifications', {
    userId: args.userId,
    type: args.type,
    actorId: args.actorId,
    postId: args.postId,
    communityId: args.communityId,
    message: args.message,
    read: false,
    createdAt: Date.now(),
  })
  await ctx.scheduler.runAfter(0, internal.notifications.sendPush, {
    userId: args.userId,
    title: 'Embodi',
    body: args.message,
    type: args.type,
    postId: args.postId ? String(args.postId) : undefined,
    communityId: args.communityId ? String(args.communityId) : undefined,
  })
}

const USERNAME_SUFFIX_ALPHABET = '23456789abcdefghjkmnpqrstuvwxyz'

export function randomUsernameSuffix(length: number): string {
  let out = ''
  for (let i = 0; i < length; i += 1) {
    out +=
      USERNAME_SUFFIX_ALPHABET[
        Math.floor(Math.random() * USERNAME_SUFFIX_ALPHABET.length)
      ]
  }
  return out
}

/** Turn a display name into a valid username base ('Sara K.' -> 'sarak'). */
export function usernameBaseFromName(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 16)
  if (base.length >= 3 && /^[a-z]/.test(base)) return base
  return `mover${randomUsernameSuffix(4)}`
}

export function buildSearchText(username: string, displayName: string): string {
  return `${username} ${displayName}`.toLowerCase()
}
