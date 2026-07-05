import { useMutation, useQuery } from 'convex/react'
import * as Haptics from 'expo-haptics'
import { Image } from 'expo-image'
import { router, useLocalSearchParams } from 'expo-router'
import React, { useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'

import { Avatar } from '@/components/social/avatar'
import { MuscleFigure } from '@/components/social/muscle-figure'
import { TryWorkoutSheet } from '@/components/social/try-workout-sheet'
import {
  REACTION_META,
  type FeedPost,
  type WorkoutExerciseDetail,
  type WorkoutSetDetail,
} from '@/components/social/types'
import { WorkoutStatCard } from '@/components/social/workout-stat-card'
import { StreakFlame } from '@/components/streak/streak-flame'
import { IconSymbol } from '@/components/ui/icon-symbol'
import { radius, spacing, typography } from '@/constants/design'
import { useTheme } from '@/constants/theme-context'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import { timeAgo } from '@/utils/timeAgo'

function formatSet(set: WorkoutSetDetail): string {
  const parts: string[] = []
  if (set.weightKg != null) parts.push(`${set.weightKg} kg`)
  if (set.reps != null) parts.push(`${set.reps} reps`)
  if (set.durationSec != null) parts.push(`${set.durationSec}s`)
  if (set.distanceM != null) parts.push(`${set.distanceM} m`)
  if (set.rpe != null) parts.push(`RPE ${set.rpe}`)
  return parts.length ? parts.join(' \u00b7 ') : 'Logged'
}

function ExerciseBreakdownCard({
  exercise,
}: {
  exercise: WorkoutExerciseDetail
}) {
  const { palette } = useTheme()
  let warmupCount = 0
  let workingCount = 0
  const labeledSets = exercise.sets.map((set) => {
    if (set.isWarmup) {
      warmupCount += 1
      return { set, label: `Warm-up ${warmupCount}`, isWarmup: true }
    }
    workingCount += 1
    return { set, label: `Set ${workingCount}`, isWarmup: false }
  })

  return (
    <View
      style={[
        styles.exerciseCard,
        { backgroundColor: palette.surface, borderColor: palette.border },
      ]}
    >
      <View style={styles.exerciseHeader}>
        <Text
          style={[typography.bodyStrong, { color: palette.textPrimary }]}
          numberOfLines={2}
        >
          {exercise.name}
        </Text>
        <Text style={[typography.small, { color: palette.textTertiary }]}>
          {exercise.bodyPart}
        </Text>
      </View>
      {labeledSets.length === 0 ? (
        <Text style={[typography.small, { color: palette.textTertiary }]}>
          No sets logged
        </Text>
      ) : (
        labeledSets.map(({ set, label, isWarmup }) => (
          <View
            key={`${exercise.id}-${set.setIndex}`}
            style={[styles.setRow, { borderTopColor: palette.divider }]}
          >
            <Text
              style={[
                styles.setNumber,
                {
                  color: isWarmup ? palette.warning : palette.textTertiary,
                },
              ]}
            >
              {label}
            </Text>
            <Text style={[styles.setValue, { color: palette.textSecondary }]}>
              {formatSet(set)}
            </Text>
          </View>
        ))
      )}
    </View>
  )
}

export default function WorkoutDetailScreen() {
  const { palette, shadows } = useTheme()
  const insets = useSafeAreaInsets()
  const { width: screenWidth } = useWindowDimensions()
  const params = useLocalSearchParams<{ id?: string }>()
  const postId =
    typeof params.id === 'string' ? (params.id as Id<'posts'>) : undefined

  const post = useQuery(api.social.getPost, postId ? { postId } : 'skip') as
    | FeedPost
    | null
    | undefined
  const detail = useQuery(
    api.social.getPostWorkoutDetail,
    postId ? { postId } : 'skip'
  )
  const myProfile = useQuery(api.profiles.getMyProfile)
  const react = useMutation(api.social.react)

  const [trySheetOpen, setTrySheetOpen] = useState(false)

  const isRepost = post?.type === 'repost'
  const author = isRepost ? (post?.original?.author ?? null) : (post?.author ?? null)
  const workout = isRepost ? post?.original?.workout : post?.workout
  const photos = isRepost ? (post?.original?.photoUrls ?? []) : (post?.photoUrls ?? [])
  const caption = isRepost ? post?.original?.caption : post?.caption
  const createdAt = isRepost
    ? (post?.original?.createdAt ?? post?.createdAt)
    : post?.createdAt
  const isMine =
    myProfile != null && author != null && author.userId === myProfile.userId
  const totalCheers = post
    ? Object.values(post.cheerCounts).reduce((sum, n) => sum + n, 0)
    : 0
  const canTry = detail?.canTry === true && !isMine
  const photoWidth = screenWidth - spacing.xl * 2

  const handleCheer = () => {
    if (!post) return
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    react({ postId: post._id, kind: post.myReaction ? null : 'cheer' }).catch(
      () => {}
    )
  }

  const openComments = () => {
    if (!postId) return
    router.push({ pathname: '/post/[id]/comments', params: { id: postId } })
  }

  const openAuthor = () => {
    if (!author) return
    router.push({
      pathname: '/u/[username]',
      params: { username: author.username },
    })
  }

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: palette.bg }]}
      edges={['top']}
    >
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <IconSymbol
            name="chevron.left"
            size={22}
            color={palette.textPrimary}
          />
        </Pressable>
        <Text style={[typography.h3, { color: palette.textPrimary }]}>
          Workout
        </Text>
        <View style={{ width: 22 }} />
      </View>

      {post === undefined ? (
        <View style={styles.centered}>
          <ActivityIndicator size="small" color={palette.primary} />
        </View>
      ) : post === null ? (
        <View style={styles.centered}>
          <Text style={[typography.body, { color: palette.textSecondary }]}>
            This post is not available.
          </Text>
        </View>
      ) : (
        <>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[
              styles.scrollContent,
              {
                paddingBottom:
                  (canTry ? 96 : spacing.xl) + Math.max(insets.bottom, spacing.md),
              },
            ]}
          >
            <Pressable
              onPress={openAuthor}
              style={styles.authorRow}
              accessibilityRole="button"
              accessibilityLabel={`View ${author?.displayName ?? 'profile'}`}
            >
              <Avatar
                url={author?.avatarUrl}
                name={author?.displayName ?? '?'}
                size={44}
              />
              <View style={styles.authorText}>
                <View style={styles.authorNameRow}>
                  <Text
                    style={[
                      typography.bodyStrong,
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
                  @{author?.username ?? 'unknown'} {'\u00b7'}{' '}
                  {createdAt ? timeAgo(createdAt) : ''}
                </Text>
              </View>
            </Pressable>

            {photos.length > 0 ? (
              <ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                style={styles.photoScroll}
              >
                {photos.map((url) => (
                  <Image
                    key={url}
                    source={{ uri: url }}
                    style={{
                      width: photoWidth,
                      height: Math.round(photoWidth * 0.75),
                      borderRadius: radius.xl,
                      marginRight: spacing.sm,
                    }}
                    contentFit="cover"
                    transition={150}
                    cachePolicy="memory-disk"
                  />
                ))}
              </ScrollView>
            ) : null}

            {caption ? (
              <Text style={[styles.caption, { color: palette.textPrimary }]}>
                {caption}
              </Text>
            ) : null}

            {workout ? <WorkoutStatCard workout={workout} /> : null}

            {workout && workout.bodyParts.length > 0 ? (
              <View
                style={[
                  styles.musclesCard,
                  {
                    backgroundColor: palette.surface,
                    borderColor: palette.border,
                  },
                ]}
              >
                <View style={styles.musclesText}>
                  <Text
                    style={[typography.smallStrong, { color: palette.textPrimary }]}
                  >
                    Muscles hit
                  </Text>
                  <Text
                    style={[typography.small, { color: palette.textSecondary }]}
                  >
                    {workout.bodyParts.join(' \u00b7 ')}
                  </Text>
                </View>
                <MuscleFigure
                  bodyParts={workout.bodyParts}
                  height={84}
                  highlightColor={palette.primary}
                  baseColor={palette.surfaceHigh}
                />
              </View>
            ) : null}

            {post.triedCount > 0 ? (
              <View style={styles.triedRow}>
                <IconSymbol
                  name="figure.run"
                  size={15}
                  color={palette.success}
                />
                <Text
                  style={[typography.smallStrong, { color: palette.success }]}
                >
                  {post.triedCount}{' '}
                  {post.triedCount === 1 ? 'person has' : 'people have'} tried
                  this workout
                </Text>
              </View>
            ) : null}

            {detail === undefined ? (
              <ActivityIndicator
                size="small"
                color={palette.primary}
                style={styles.breakdownSpinner}
              />
            ) : detail && detail.exercises.length > 0 ? (
              <View style={styles.breakdown}>
                <Text
                  style={[styles.sectionLabel, { color: palette.textTertiary }]}
                >
                  WORKOUT BREAKDOWN
                </Text>
                {detail.exercises.map((exercise) => (
                  <ExerciseBreakdownCard
                    key={exercise.id}
                    exercise={exercise}
                  />
                ))}
              </View>
            ) : null}

            <View style={styles.actionsRow}>
              <Pressable
                onPress={handleCheer}
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
                  {REACTION_META.cheer.emoji}
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
                style={[
                  styles.actionButton,
                  { backgroundColor: palette.surfaceAlt },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Comments"
              >
                <IconSymbol
                  name="bubble.left"
                  size={16}
                  color={palette.textSecondary}
                />
                <Text
                  style={[
                    typography.smallStrong,
                    { color: palette.textSecondary },
                  ]}
                >
                  Comments{post.commentCount > 0 ? ` (${post.commentCount})` : ''}
                </Text>
              </Pressable>
            </View>
          </ScrollView>

          {canTry && postId ? (
            <View
              style={[
                styles.footer,
                {
                  backgroundColor: palette.bg,
                  borderTopColor: palette.divider,
                  paddingBottom: Math.max(insets.bottom, spacing.md),
                },
              ]}
            >
              <TouchableOpacity
                onPress={() => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
                  setTrySheetOpen(true)
                }}
                style={[
                  styles.tryButton,
                  shadows.md,
                  { backgroundColor: palette.primary },
                ]}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Try this workout"
              >
                <IconSymbol name="bolt.fill" size={18} color={palette.white} />
                <Text style={[styles.tryButtonText, { color: palette.white }]}>
                  Try this workout
                </Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {postId ? (
            <TryWorkoutSheet
              visible={trySheetOpen}
              postId={postId}
              workoutTitle={workout?.title ?? 'Workout'}
              onClose={() => setTrySheetOpen(false)}
            />
          ) : null}
        </>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  scrollContent: {
    paddingHorizontal: spacing.xl,
    gap: spacing.lg,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
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
  photoScroll: {
    borderRadius: radius.xl,
  },
  caption: {
    ...typography.body,
  },
  musclesCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.lg,
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: spacing.lg,
  },
  musclesText: {
    flex: 1,
    gap: spacing.xs,
  },
  triedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  breakdownSpinner: {
    marginVertical: spacing.lg,
  },
  breakdown: {
    gap: spacing.md,
  },
  sectionLabel: {
    ...typography.caption,
  },
  exerciseCard: {
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: spacing.lg,
  },
  exerciseHeader: {
    marginBottom: spacing.sm,
    gap: 1,
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: spacing.md,
  },
  setNumber: {
    ...typography.smallStrong,
  },
  setValue: {
    ...typography.small,
    flexShrink: 1,
    textAlign: 'right',
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
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  actionEmoji: {
    fontSize: 14,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  tryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radius.pill,
    paddingVertical: spacing.lg,
  },
  tryButtonText: {
    ...typography.button,
  },
})
