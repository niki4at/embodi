import { useMutation } from 'convex/react'
import * as Haptics from 'expo-haptics'
import { Image } from 'expo-image'
import { router } from 'expo-router'
import React, { useState } from 'react'
import {
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native'
import Animated, { ZoomIn } from 'react-native-reanimated'

import { Avatar } from '@/components/social/avatar'
import {
  REACTION_META,
  REACTION_ORDER,
  type FeedPost,
  type PostWorkout,
  type ReactionKind,
} from '@/components/social/types'
import { WorkoutStatCard } from '@/components/social/workout-stat-card'
import { StreakFlame } from '@/components/streak/streak-flame'
import { IconSymbol } from '@/components/ui/icon-symbol'
import { motion, radius, spacing, typography } from '@/constants/design'
import { useTheme } from '@/constants/theme-context'
import { api } from '@/convex/_generated/api'
import { timeAgo } from '@/utils/timeAgo'

function StatStrip({ workout }: { workout: PostWorkout }) {
  const { palette } = useTheme()
  const items: string[] = []
  if (workout.trainingEnvironment) {
    items.push(
      workout.trainingEnvironment.charAt(0).toUpperCase() +
        workout.trainingEnvironment.slice(1),
    )
  }
  if (workout.durationMin != null) items.push(`${workout.durationMin} min`)
  if (workout.totalVolumeKg > 0) {
    items.push(`${workout.totalVolumeKg.toLocaleString()} kg`)
  }
  if (workout.totalDistanceM > 0) {
    items.push(
      workout.totalDistanceM >= 1000
        ? `${(Math.round(workout.totalDistanceM / 100) / 10).toLocaleString()} km`
        : `${workout.totalDistanceM} m`
    )
  }
  items.push(`${workout.exercisesCompleted} exercises`)
  const prCount = workout.highlights.filter((h) => !h.isFirstTime).length

  return (
    <View style={stripStyles.row}>
      <Text style={[stripStyles.text, { color: palette.textSecondary }]}>
        {items.join('  \u00b7  ')}
      </Text>
      {prCount > 0 ? (
        <View
          style={[stripStyles.pr, { backgroundColor: palette.warningMuted }]}
        >
          <IconSymbol name="trophy.fill" size={11} color={palette.warning} />
          <Text style={[stripStyles.prText, { color: palette.warning }]}>
            {prCount} PR{prCount > 1 ? 's' : ''}
          </Text>
        </View>
      ) : null}
    </View>
  )
}

const stripStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  text: {
    ...typography.smallStrong,
    flexShrink: 1,
  },
  pr: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  prText: {
    ...typography.caption,
  },
})

function PhotoCarousel({
  urls,
  width,
}: {
  urls: string[]
  width: number
}) {
  const { palette } = useTheme()
  const [index, setIndex] = useState(0)
  const height = Math.round(width * 1.05)

  return (
    <View>
      <Animated.ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => {
          setIndex(Math.round(e.nativeEvent.contentOffset.x / width))
        }}
      >
        {urls.map((url) => (
          <Image
            key={url}
            source={{ uri: url }}
            style={{ width, height, borderRadius: radius.xl }}
            contentFit="cover"
            transition={150}
            cachePolicy="memory-disk"
          />
        ))}
      </Animated.ScrollView>
      {urls.length > 1 ? (
        <View style={carouselStyles.dots}>
          {urls.map((url, i) => (
            <View
              key={url}
              style={[
                carouselStyles.dot,
                {
                  backgroundColor:
                    i === index ? palette.white : 'rgba(255,255,255,0.45)',
                },
              ]}
            />
          ))}
        </View>
      ) : null}
    </View>
  )
}

const carouselStyles = StyleSheet.create({
  dots: {
    position: 'absolute',
    bottom: spacing.md,
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 5,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
})

/**
 * A feed post: author row, photo carousel or gradient stat hero, caption,
 * cheer bar with an animated reaction picker, comments, and quote-repost.
 */
export function PostCard({
  post,
  myUserId,
  inDetail = false,
}: {
  post: FeedPost
  myUserId: string | null
  /** In post-detail we don't navigate on body tap and show full caption. */
  inDetail?: boolean
}) {
  const { palette } = useTheme()
  const { width: screenWidth } = useWindowDimensions()
  const contentWidth = screenWidth - spacing.xl * 2

  const react = useMutation(api.social.react)
  const createRepost = useMutation(api.social.createRepost)
  const deletePost = useMutation(api.social.deletePost)
  const blockUser = useMutation(api.profiles.blockUser)
  const reportContent = useMutation(api.profiles.reportContent)

  const [pickerOpen, setPickerOpen] = useState(false)
  const [repostOpen, setRepostOpen] = useState(false)
  const [quote, setQuote] = useState('')
  const [reposting, setReposting] = useState(false)

  const isMine = myUserId != null && post.author?.userId === myUserId
  const isRepost = post.type === 'repost'
  const displayWorkout = isRepost ? post.original?.workout : post.workout
  const displayPhotos = isRepost
    ? (post.original?.photoUrls ?? [])
    : post.photoUrls
  const totalCheers = Object.values(post.cheerCounts).reduce(
    (sum, n) => sum + n,
    0
  )

  const openPost = () => {
    if (inDetail) return
    router.push({ pathname: '/post/[id]', params: { id: String(post._id) } })
  }

  const openComments = () => {
    router.push({
      pathname: '/post/[id]/comments',
      params: { id: String(post._id) },
    })
  }

  const openAuthor = (username?: string) => {
    if (!username) return
    router.push({ pathname: '/u/[username]', params: { username } })
  }

  const handleReact = (kind: ReactionKind | null) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setPickerOpen(false)
    react({ postId: post._id, kind }).catch(() => {})
  }

  const handleRepost = async () => {
    if (reposting) return
    setReposting(true)
    try {
      await createRepost({
        postId: isRepost && post.original ? post.original._id : post._id,
        quote: quote.trim() || undefined,
      })
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      setRepostOpen(false)
      setQuote('')
    } catch (error) {
      Alert.alert(
        'Could not repost',
        error instanceof Error
          ? error.message.replace(/^.*Error: /, '')
          : 'Try again.'
      )
    } finally {
      setReposting(false)
    }
  }

  const openMenu = () => {
    void Haptics.selectionAsync()
    if (isMine) {
      Alert.alert('Your post', undefined, [
        {
          text: 'Delete post',
          style: 'destructive',
          onPress: () => {
            deletePost({ postId: post._id }).catch(() => {})
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ])
      return
    }
    const authorName = post.author ? `@${post.author.username}` : 'this person'
    Alert.alert('Post options', undefined, [
      {
        text: 'Report post',
        onPress: () => {
          reportContent({
            targetType: 'post',
            targetId: String(post._id),
            reason: 'inappropriate',
          })
            .then(() => Alert.alert('Reported', 'Thanks, we will review it.'))
            .catch(() => {})
        },
      },
      {
        text: `Block ${authorName}`,
        style: 'destructive',
        onPress: () => {
          if (!post.author) return
          blockUser({ userId: post.author.userId }).catch(() => {})
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ])
  }

  const authorRow = (
    author: FeedPost['author'],
    createdAt: number,
    small = false
  ) => (
    <View style={styles.authorRow}>
      <Pressable
        onPress={() => openAuthor(author?.username)}
        style={styles.authorTap}
        accessibilityRole="button"
        accessibilityLabel={`View ${author?.displayName ?? 'profile'}`}
      >
        <Avatar
          url={author?.avatarUrl}
          name={author?.displayName ?? '?'}
          size={small ? 30 : 40}
        />
        <View style={styles.authorText}>
          <View style={styles.authorNameRow}>
            <Text
              style={[
                small ? typography.smallStrong : typography.bodyStrong,
                styles.authorName,
                { color: palette.textPrimary },
              ]}
              numberOfLines={1}
            >
              {author?.displayName ?? 'Unknown'}
            </Text>
            {author && author.streakWeeks > 0 ? (
              <StreakFlame weeks={author.streakWeeks} size="sm" />
            ) : null}
          </View>
          <Text
            style={[typography.small, { color: palette.textTertiary }]}
            numberOfLines={1}
          >
            @{author?.username ?? 'unknown'} {'\u00b7'} {timeAgo(createdAt)}
          </Text>
        </View>
      </Pressable>
      {!small ? (
        <Pressable
          onPress={openMenu}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Post options"
        >
          <IconSymbol
            name="ellipsis"
            size={18}
            color={palette.textTertiary}
          />
        </Pressable>
      ) : null}
    </View>
  )

  return (
    <Pressable
      onPress={openPost}
      disabled={inDetail}
      style={[
        styles.card,
        { backgroundColor: palette.surface, borderColor: palette.border },
      ]}
      accessibilityRole={inDetail ? undefined : 'button'}
      accessibilityLabel={inDetail ? undefined : 'Open workout details'}
    >
      {isRepost ? (
        <View style={styles.repostHint}>
          <IconSymbol
            name="arrow.2.squarepath"
            size={13}
            color={palette.textTertiary}
          />
          <Text style={[typography.small, { color: palette.textTertiary }]}>
            {post.author?.displayName ?? 'Someone'} reposted
          </Text>
        </View>
      ) : null}

      {authorRow(
        isRepost ? (post.original?.author ?? null) : post.author,
        isRepost ? (post.original?.createdAt ?? post.createdAt) : post.createdAt
      )}

      {isRepost && post.caption ? (
        <Text
          style={[styles.caption, { color: palette.textPrimary }]}
          numberOfLines={inDetail ? undefined : 4}
        >
          {post.caption}
        </Text>
      ) : null}

      <Pressable onPress={openPost} disabled={inDetail}>
        <View style={styles.media}>
          {displayPhotos.length > 0 ? (
            <PhotoCarousel
              urls={displayPhotos}
              width={contentWidth - spacing.lg * 2}
            />
          ) : displayWorkout ? (
            <WorkoutStatCard workout={displayWorkout} />
          ) : null}
        </View>

        {displayPhotos.length > 0 && displayWorkout ? (
          <View style={styles.stripWrap}>
            <StatStrip workout={displayWorkout} />
          </View>
        ) : null}

        {!isRepost && post.caption ? (
          <Text
            style={[styles.caption, { color: palette.textPrimary }]}
            numberOfLines={inDetail ? undefined : 4}
          >
            {post.caption}
          </Text>
        ) : null}
      </Pressable>

      <View style={styles.actionsRow}>
        <Pressable
          onPress={() =>
            handleReact(post.myReaction ? null : 'cheer')
          }
          onLongPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
            setPickerOpen(true)
          }}
          style={[
            styles.actionButton,
            {
              backgroundColor: post.myReaction
                ? palette.primaryMuted
                : palette.surfaceAlt,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel={post.myReaction ? 'Remove cheer' : 'Cheer'}
        >
          <Text style={styles.actionEmoji}>
            {post.myReaction
              ? REACTION_META[post.myReaction as ReactionKind]?.emoji
              : REACTION_META.cheer.emoji}
          </Text>
          <Text
            style={[
              typography.smallStrong,
              {
                color: post.myReaction
                  ? palette.primary
                  : palette.textSecondary,
              },
            ]}
          >
            {totalCheers > 0 ? totalCheers : 'Cheer'}
          </Text>
        </Pressable>

        <Pressable
          onPress={openComments}
          style={[styles.actionButton, { backgroundColor: palette.surfaceAlt }]}
          accessibilityRole="button"
          accessibilityLabel="Comments"
        >
          <IconSymbol
            name="bubble.left"
            size={16}
            color={palette.textSecondary}
          />
          <Text
            style={[typography.smallStrong, { color: palette.textSecondary }]}
          >
            {post.commentCount > 0 ? post.commentCount : 'Comment'}
          </Text>
        </Pressable>

        {!isMine || isRepost ? (
          <Pressable
            onPress={() => {
              void Haptics.selectionAsync()
              setRepostOpen(true)
            }}
            style={[
              styles.actionButton,
              { backgroundColor: palette.surfaceAlt },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Repost"
          >
            <IconSymbol
              name="arrow.2.squarepath"
              size={16}
              color={palette.textSecondary}
            />
            <Text
              style={[
                typography.smallStrong,
                { color: palette.textSecondary },
              ]}
            >
              {post.repostCount > 0 ? post.repostCount : 'Repost'}
            </Text>
          </Pressable>
        ) : null}

        {post.triedCount > 0 ? (
          <View
            style={[
              styles.actionButton,
              styles.triedPill,
              { backgroundColor: palette.successMuted },
            ]}
          >
            <IconSymbol name="figure.run" size={14} color={palette.success} />
            <Text style={[typography.smallStrong, { color: palette.success }]}>
              {post.triedCount} tried
            </Text>
          </View>
        ) : null}
      </View>

      {Object.keys(post.cheerCounts).length > 1 ? (
        <View style={styles.cheerBreakdown}>
          {REACTION_ORDER.filter((k) => (post.cheerCounts[k] ?? 0) > 0).map(
            (k) => (
              <Text
                key={k}
                style={[typography.small, { color: palette.textTertiary }]}
              >
                {REACTION_META[k].emoji} {post.cheerCounts[k]}
              </Text>
            )
          )}
        </View>
      ) : null}

      {pickerOpen ? (
        <Animated.View
          entering={ZoomIn.duration(motion.duration.quick)}
          style={[
            styles.picker,
            {
              backgroundColor: palette.bgElevated,
              borderColor: palette.border,
            },
          ]}
        >
          {REACTION_ORDER.map((kind) => (
            <Pressable
              key={kind}
              onPress={() => handleReact(kind)}
              style={styles.pickerOption}
              accessibilityRole="button"
              accessibilityLabel={REACTION_META[kind].label}
            >
              <Text style={styles.pickerEmoji}>
                {REACTION_META[kind].emoji}
              </Text>
            </Pressable>
          ))}
          <Pressable
            onPress={() => setPickerOpen(false)}
            style={styles.pickerOption}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel="Close reactions"
          >
            <IconSymbol name="xmark" size={16} color={palette.textTertiary} />
          </Pressable>
        </Animated.View>
      ) : null}

      <Modal
        visible={repostOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setRepostOpen(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setRepostOpen(false)}
        >
          <Pressable
            style={[
              styles.repostSheet,
              {
                backgroundColor: palette.bgElevated,
                borderColor: palette.border,
              },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={[typography.h3, { color: palette.textPrimary }]}>
              Repost with a note
            </Text>
            <TextInput
              value={quote}
              onChangeText={setQuote}
              placeholder="Add something (optional)"
              placeholderTextColor={palette.textTertiary}
              multiline
              maxLength={280}
              style={[
                styles.quoteInput,
                {
                  backgroundColor: palette.surface,
                  borderColor: palette.border,
                  color: palette.textPrimary,
                },
              ]}
            />
            <View style={styles.repostActions}>
              <Pressable
                onPress={() => setRepostOpen(false)}
                style={[
                  styles.repostButton,
                  { backgroundColor: palette.surfaceAlt },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Cancel repost"
              >
                <Text
                  style={[
                    typography.bodyStrong,
                    { color: palette.textSecondary },
                  ]}
                >
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                onPress={handleRepost}
                disabled={reposting}
                style={[
                  styles.repostButton,
                  { backgroundColor: palette.primary },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Repost"
              >
                <Text style={[typography.bodyStrong, { color: '#FFFFFF' }]}>
                  {reposting ? 'Reposting\u2026' : 'Repost'}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.xxl,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.md,
  },
  repostHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  authorTap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  authorText: {
    flex: 1,
  },
  authorNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  authorName: {
    flexShrink: 1,
  },
  triedPill: {
    marginLeft: 'auto',
  },
  media: {
    borderRadius: radius.xl,
    overflow: 'hidden',
  },
  stripWrap: {
    marginTop: spacing.md,
  },
  caption: {
    ...typography.body,
    marginTop: spacing.sm,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  actionEmoji: {
    fontSize: 14,
  },
  cheerBreakdown: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  picker: {
    position: 'absolute',
    bottom: 56,
    left: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  pickerOption: {
    padding: spacing.sm,
  },
  pickerEmoji: {
    fontSize: 22,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  repostSheet: {
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: spacing.xl,
    gap: spacing.lg,
  },
  quoteInput: {
    ...typography.body,
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    minHeight: 72,
    textAlignVertical: 'top',
  },
  repostActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  repostButton: {
    flex: 1,
    alignItems: 'center',
    borderRadius: radius.pill,
    paddingVertical: 12,
  },
})
