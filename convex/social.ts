import { paginationOptsValidator } from 'convex/server'
import { v } from 'convex/values'
import { mergedStream, stream } from 'convex-helpers/server/stream'

import { api } from './_generated/api'
import type { Doc, Id } from './_generated/dataModel'
import { mutation, query, type QueryCtx } from './_generated/server'
import schema from './schema'
import {
  canViewContent,
  getProfileByUserId,
  getProfileCards,
  isBlockedEitherWay,
  notify,
  requireIdentity,
  type ProfileCard,
} from './socialHelpers'

const MAX_PHOTOS = 5
const MAX_CAPTION = 500
const MAX_COMMENT = 500
// Feed merges one indexed stream per followee; cap it so pathological
// accounts can't make the feed query unbounded.
const MAX_FEED_AUTHORS = 200

export const reactionKindValidator = v.union(
  v.literal('cheer'),
  v.literal('fire'),
  v.literal('strong'),
  v.literal('clap')
)

type PostDoc = Doc<'posts'>

type OriginalPostCard = {
  _id: Id<'posts'>
  author: ProfileCard | null
  caption: string | null
  photoUrls: string[]
  workout: PostDoc['workout'] | null
  createdAt: number
} | null

type PostCard = {
  _id: Id<'posts'>
  type: PostDoc['type']
  author: ProfileCard | null
  caption: string | null
  photoUrls: string[]
  workout: PostDoc['workout'] | null
  tracks: PostDoc['tracks'] | null
  visibility: PostDoc['visibility']
  communityId: Id<'communities'> | null
  cheerCounts: Record<string, number>
  commentCount: number
  repostCount: number
  myReaction: string | null
  createdAt: number
  original: OriginalPostCard
}

async function resolvePhotoUrls(
  ctx: QueryCtx,
  ids: Id<'_storage'>[]
): Promise<string[]> {
  const urls = await Promise.all(ids.map((id) => ctx.storage.getUrl(id)))
  return urls.filter((u): u is string => u !== null)
}

/** Enrich raw post docs into render-ready cards in one batched pass. */
async function buildPostCards(
  ctx: QueryCtx,
  viewerId: string,
  posts: PostDoc[]
): Promise<PostCard[]> {
  const originals = new Map<string, PostDoc>()
  await Promise.all(
    posts
      .filter((p) => p.originalPostId != null)
      .map(async (p) => {
        const original = await ctx.db.get(p.originalPostId!)
        if (original) originals.set(String(p.originalPostId), original)
      })
  )

  const authorIds = [
    ...posts.map((p) => p.authorId),
    ...Array.from(originals.values()).map((p) => p.authorId),
  ]
  const cards = await getProfileCards(ctx, authorIds)

  return await Promise.all(
    posts.map(async (post) => {
      const myReactionRow = await ctx.db
        .query('reactions')
        .withIndex('by_post_and_user', (q) =>
          q.eq('postId', post._id).eq('userId', viewerId)
        )
        .unique()

      const originalDoc = post.originalPostId
        ? (originals.get(String(post.originalPostId)) ?? null)
        : null
      const original: OriginalPostCard = originalDoc
        ? {
            _id: originalDoc._id,
            author: cards.get(originalDoc.authorId) ?? null,
            caption: originalDoc.caption ?? null,
            photoUrls: await resolvePhotoUrls(
              ctx,
              originalDoc.photoStorageIds
            ),
            workout: originalDoc.workout ?? null,
            createdAt: originalDoc.createdAt,
          }
        : null

      return {
        _id: post._id,
        type: post.type,
        author: cards.get(post.authorId) ?? null,
        caption: post.caption ?? null,
        photoUrls: await resolvePhotoUrls(ctx, post.photoStorageIds),
        workout: post.workout ?? null,
        tracks: post.tracks ?? null,
        visibility: post.visibility,
        communityId: post.communityId ?? null,
        cheerCounts: post.cheerCounts,
        commentCount: post.commentCount,
        repostCount: post.repostCount,
        myReaction: myReactionRow?.kind ?? null,
        createdAt: post.createdAt,
        original,
      }
    })
  )
}

export const generatePostPhotoUploadUrl = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    await requireIdentity(ctx)
    return await ctx.storage.generateUploadUrl()
  },
})

/**
 * Share a completed workout. Stats are snapshotted from the same insights
 * query the recap screen uses, so the feed never recomputes them.
 */
export const createPost = mutation({
  args: {
    sessionId: v.id('workout_sessions'),
    title: v.optional(v.string()),
    caption: v.optional(v.string()),
    photoStorageIds: v.array(v.id('_storage')),
    visibility: v.union(v.literal('public'), v.literal('backers')),
    communityId: v.optional(v.id('communities')),
  },
  returns: v.id('posts'),
  handler: async (ctx, args): Promise<Id<'posts'>> => {
    const identity = await requireIdentity(ctx)
    if (args.photoStorageIds.length > MAX_PHOTOS) {
      throw new Error(`Up to ${MAX_PHOTOS} photos per post`)
    }

    const profile = await getProfileByUserId(ctx, identity.subject)
    if (!profile) throw new Error('Create your profile first')

    const session = await ctx.db.get(args.sessionId)
    if (!session || session.userId !== identity.subject) {
      throw new Error('Session not found')
    }
    if (session.status !== 'completed') {
      throw new Error('Only completed workouts can be shared')
    }

    if (args.communityId) {
      const membership = await ctx.db
        .query('community_members')
        .withIndex('by_community_and_user', (q) =>
          q.eq('communityId', args.communityId!).eq('userId', identity.subject)
        )
        .unique()
      if (!membership) throw new Error('Not a member of that community')
    }

    const insights = await ctx.runQuery(
      api.sessionInsights.getSessionInsights,
      { sessionId: args.sessionId }
    )
    if (!insights) throw new Error('Could not load workout stats')

    const postId = await ctx.db.insert('posts', {
      authorId: identity.subject,
      type: 'workout',
      sessionId: args.sessionId,
      workout: {
        title: (args.title ?? insights.goal).trim().slice(0, 80) || insights.goal,
        modality: insights.modality,
        durationMin: insights.durationMin,
        totalVolumeKg: insights.totalVolumeKg,
        totalReps: insights.totalReps,
        totalDistanceM: insights.totalDistanceM,
        exercisesCompleted: insights.exercisesCompleted,
        workingSets: insights.workingSetsLogged,
        avgRpe: insights.avgRpe,
        bodyParts: insights.bodyParts,
        highlights: insights.highlights.slice(0, 3).map((h) => ({
          exerciseName: h.exerciseName,
          kind: h.kind,
          value: h.value,
          unit: h.unit,
          isFirstTime: h.isFirstTime,
        })),
        dateMs: insights.dateMs,
      },
      caption: args.caption?.trim().slice(0, MAX_CAPTION) || undefined,
      photoStorageIds: args.photoStorageIds,
      visibility: args.visibility,
      communityId: args.communityId,
      cheerCounts: {},
      commentCount: 0,
      repostCount: 0,
      createdAt: Date.now(),
    })

    await ctx.db.patch(profile._id, { postCount: profile.postCount + 1 })
    return postId
  },
})

/** Quote-repost a public post to your own backers with credit. */
export const createRepost = mutation({
  args: {
    postId: v.id('posts'),
    quote: v.optional(v.string()),
  },
  returns: v.id('posts'),
  handler: async (ctx, args): Promise<Id<'posts'>> => {
    const identity = await requireIdentity(ctx)
    const profile = await getProfileByUserId(ctx, identity.subject)
    if (!profile) throw new Error('Create your profile first')

    const original = await ctx.db.get(args.postId)
    if (!original) throw new Error('Post not found')
    if (original.type === 'repost') {
      throw new Error('Reposts of reposts are not supported')
    }
    if (original.visibility !== 'public') {
      throw new Error('Only public posts can be reposted')
    }
    if (await isBlockedEitherWay(ctx, identity.subject, original.authorId)) {
      throw new Error('Post not found')
    }
    const originalAuthor = await getProfileByUserId(ctx, original.authorId)
    if (originalAuthor?.isPrivate) {
      throw new Error('Only public posts can be reposted')
    }

    const repostId = await ctx.db.insert('posts', {
      authorId: identity.subject,
      type: 'repost',
      originalPostId: args.postId,
      caption: args.quote?.trim().slice(0, MAX_CAPTION) || undefined,
      photoStorageIds: [],
      visibility: 'public',
      cheerCounts: {},
      commentCount: 0,
      repostCount: 0,
      createdAt: Date.now(),
    })

    await ctx.db.patch(original._id, {
      repostCount: original.repostCount + 1,
    })
    await ctx.db.patch(profile._id, { postCount: profile.postCount + 1 })
    await notify(ctx, {
      userId: original.authorId,
      type: 'repost',
      actorId: identity.subject,
      message: `@${profile.username} reposted your workout`,
      postId: args.postId,
    })
    return repostId
  },
})

export const deletePost = mutation({
  args: { postId: v.id('posts') },
  returns: v.null(),
  handler: async (ctx, { postId }) => {
    const identity = await requireIdentity(ctx)
    const post = await ctx.db.get(postId)
    if (!post || post.authorId !== identity.subject) {
      throw new Error('Post not found')
    }

    for (const storageId of post.photoStorageIds) {
      await ctx.storage.delete(storageId)
    }

    // Bounded child cleanup; posts rarely exceed these caps and repeat
    // deletes are safe if they somehow do.
    const reactions = await ctx.db
      .query('reactions')
      .withIndex('by_post_and_user', (q) => q.eq('postId', postId))
      .take(500)
    for (const row of reactions) {
      await ctx.db.delete(row._id)
    }
    const comments = await ctx.db
      .query('comments')
      .withIndex('by_post', (q) => q.eq('postId', postId))
      .take(500)
    for (const row of comments) {
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

    const profile = await getProfileByUserId(ctx, identity.subject)
    if (profile) {
      await ctx.db.patch(profile._id, {
        postCount: Math.max(0, profile.postCount - 1),
      })
    }

    await ctx.db.delete(postId)
    return null
  },
})

/**
 * Home feed: your posts plus everyone you back, newest first. One indexed
 * stream per author merged by createdAt — no fan-out table, no table scans.
 */
export const getFeed = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, { paginationOpts }) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      return { page: [], isDone: true, continueCursor: '' }
    }

    const edges = await ctx.db
      .query('follows')
      .withIndex('by_follower_and_status', (q) =>
        q.eq('followerId', identity.subject).eq('status', 'active')
      )
      .take(MAX_FEED_AUTHORS)
    const authorIds = [identity.subject, ...edges.map((e) => e.followeeId)]

    const streams = authorIds.map((authorId) =>
      stream(ctx.db, schema)
        .query('posts')
        .withIndex('by_author_and_createdAt', (q) =>
          q.eq('authorId', authorId)
        )
        .order('desc')
    )
    const result = await mergedStream(streams, ['createdAt']).paginate(
      paginationOpts
    )

    return {
      ...result,
      page: await buildPostCards(ctx, identity.subject, result.page),
    }
  },
})

/** A user's post timeline for their profile page (privacy enforced). */
export const getUserPosts = query({
  args: {
    userId: v.string(),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, { userId, paginationOpts }) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      return { page: [], isDone: true, continueCursor: '' }
    }
    const subject = await getProfileByUserId(ctx, userId)
    if (!subject) {
      return { page: [], isDone: true, continueCursor: '' }
    }
    const canView = await canViewContent(ctx, identity.subject, subject)
    if (!canView) {
      return { page: [], isDone: true, continueCursor: '' }
    }
    const isBacker =
      userId === identity.subject ||
      subject.isPrivate ||
      (await ctx.db
        .query('follows')
        .withIndex('by_follower_and_followee', (q) =>
          q.eq('followerId', identity.subject).eq('followeeId', userId)
        )
        .unique())?.status === 'active'

    const result = await ctx.db
      .query('posts')
      .withIndex('by_author_and_createdAt', (q) => q.eq('authorId', userId))
      .order('desc')
      .paginate(paginationOpts)

    // Non-backers browsing a public profile only see public posts.
    const visible = result.page.filter(
      (p) => p.visibility === 'public' || isBacker
    )
    return {
      ...result,
      page: await buildPostCards(ctx, identity.subject, visible),
    }
  },
})

export const getPost = query({
  args: { postId: v.id('posts') },
  handler: async (ctx, { postId }) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return null
    const post = await ctx.db.get(postId)
    if (!post) return null

    const author = await getProfileByUserId(ctx, post.authorId)
    if (!author) return null
    if (post.authorId !== identity.subject) {
      if (!(await canViewContent(ctx, identity.subject, author))) return null
      if (post.visibility === 'backers') {
        const edge = await ctx.db
          .query('follows')
          .withIndex('by_follower_and_followee', (q) =>
            q.eq('followerId', identity.subject).eq('followeeId', post.authorId)
          )
          .unique()
        if (edge?.status !== 'active') return null
      }
    }

    const [card] = await buildPostCards(ctx, identity.subject, [post])
    return card
  },
})

/** Set/switch/clear your reaction. kind = null clears. */
export const react = mutation({
  args: {
    postId: v.id('posts'),
    kind: v.union(reactionKindValidator, v.null()),
  },
  returns: v.null(),
  handler: async (ctx, { postId, kind }) => {
    const identity = await requireIdentity(ctx)
    const post = await ctx.db.get(postId)
    if (!post) throw new Error('Post not found')

    const existing = await ctx.db
      .query('reactions')
      .withIndex('by_post_and_user', (q) =>
        q.eq('postId', postId).eq('userId', identity.subject)
      )
      .unique()

    const counts = { ...post.cheerCounts }
    const decrement = (k: string) => {
      counts[k] = Math.max(0, (counts[k] ?? 0) - 1)
      if (counts[k] === 0) delete counts[k]
    }

    if (kind === null) {
      if (existing) {
        decrement(existing.kind)
        await ctx.db.delete(existing._id)
        await ctx.db.patch(postId, { cheerCounts: counts })
      }
      return null
    }

    if (existing) {
      if (existing.kind === kind) return null
      decrement(existing.kind)
      counts[kind] = (counts[kind] ?? 0) + 1
      await ctx.db.patch(existing._id, { kind })
      await ctx.db.patch(postId, { cheerCounts: counts })
      return null
    }

    counts[kind] = (counts[kind] ?? 0) + 1
    await ctx.db.insert('reactions', {
      postId,
      userId: identity.subject,
      kind,
      createdAt: Date.now(),
    })
    await ctx.db.patch(postId, { cheerCounts: counts })

    const me = await getProfileByUserId(ctx, identity.subject)
    await notify(ctx, {
      userId: post.authorId,
      type: 'cheer',
      actorId: identity.subject,
      message: `@${me?.username ?? 'someone'} cheered your workout`,
      postId,
    })
    return null
  },
})

export const listComments = query({
  args: {
    postId: v.id('posts'),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, { postId, paginationOpts }) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      return { page: [], isDone: true, continueCursor: '' }
    }

    const result = await ctx.db
      .query('comments')
      .withIndex('by_post', (q) => q.eq('postId', postId))
      .order('desc')
      .paginate(paginationOpts)

    const cards = await getProfileCards(
      ctx,
      result.page.map((c) => c.authorId)
    )
    return {
      ...result,
      page: result.page.map((c) => ({
        _id: c._id,
        text: c.text,
        createdAt: c.createdAt,
        author: cards.get(c.authorId) ?? null,
        isMine: c.authorId === identity.subject,
      })),
    }
  },
})

export const addComment = mutation({
  args: { postId: v.id('posts'), text: v.string() },
  returns: v.null(),
  handler: async (ctx, { postId, text }) => {
    const identity = await requireIdentity(ctx)
    const trimmed = text.trim().slice(0, MAX_COMMENT)
    if (!trimmed) throw new Error('Comment cannot be empty')

    const post = await ctx.db.get(postId)
    if (!post) throw new Error('Post not found')
    if (await isBlockedEitherWay(ctx, identity.subject, post.authorId)) {
      throw new Error('Post not found')
    }

    await ctx.db.insert('comments', {
      postId,
      authorId: identity.subject,
      text: trimmed,
      createdAt: Date.now(),
    })
    await ctx.db.patch(postId, { commentCount: post.commentCount + 1 })

    const me = await getProfileByUserId(ctx, identity.subject)
    await notify(ctx, {
      userId: post.authorId,
      type: 'comment',
      actorId: identity.subject,
      message: `@${me?.username ?? 'someone'} commented: ${trimmed.slice(0, 60)}`,
      postId,
    })
    return null
  },
})

export const deleteComment = mutation({
  args: { commentId: v.id('comments') },
  returns: v.null(),
  handler: async (ctx, { commentId }) => {
    const identity = await requireIdentity(ctx)
    const comment = await ctx.db.get(commentId)
    if (!comment) return null

    const post = await ctx.db.get(comment.postId)
    const canDelete =
      comment.authorId === identity.subject ||
      post?.authorId === identity.subject
    if (!canDelete) throw new Error('Not allowed')

    await ctx.db.delete(commentId)
    if (post) {
      await ctx.db.patch(post._id, {
        commentCount: Math.max(0, post.commentCount - 1),
      })
    }
    return null
  },
})

/** Whether this session was already shared (drives recap button state). */
export const getPostForSession = query({
  args: { sessionId: v.id('workout_sessions') },
  returns: v.union(v.id('posts'), v.null()),
  handler: async (ctx, { sessionId }) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return null
    const post = await ctx.db
      .query('posts')
      .withIndex('by_session', (q) => q.eq('sessionId', sessionId))
      .first()
    if (!post || post.authorId !== identity.subject) return null
    return post._id
  },
})
