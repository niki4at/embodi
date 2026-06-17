import { useQuery } from 'convex/react'
import * as Haptics from 'expo-haptics'
import { router, type Href } from 'expo-router'
import React, { useCallback } from 'react'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'

import { IconSymbol } from '@/components/ui/icon-symbol'
import { CATEGORY_META, CATEGORY_ORDER } from '@/constants/challenge-meta'
import { motion, radius, spacing, typography } from '@/constants/design'
import { useTheme } from '@/constants/theme-context'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'

type ChallengeListItem = {
  _id: Id<'challenges'>
  title: string
  category: keyof typeof CATEGORY_META
  status: 'generating' | 'active' | 'completed' | 'archived' | 'failed'
  metric: { unit: string; targetValue?: number; startValue?: number }
  targetDate?: number
  weekCount: number
  percent: number
  latestValue: number | null
  completedSessions: number
}

export default function ChallengesScreen() {
  const { palette } = useTheme()
  const challenges = useQuery(api.challenges.listChallenges) as
    | ChallengeListItem[]
    | undefined

  const handleNew = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    router.push('/challenge/new' as Href)
  }, [])

  const handleOpen = useCallback((id: Id<'challenges'>) => {
    Haptics.selectionAsync()
    router.push({
      pathname: '/challenge/[id]',
      params: { id: String(id) },
    } as unknown as Href)
  }, [])

  const isLoading = challenges === undefined
  const isEmpty = !isLoading && challenges.length === 0

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: palette.bg }]}
      edges={['top']}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          entering={FadeInUp.duration(motion.duration.base)}
          style={styles.header}
        >
          <Text style={[styles.title, { color: palette.textPrimary }]}>
            Challenges
          </Text>
          <Text style={[styles.subtitle, { color: palette.textSecondary }]}>
            Set a goal and your coach builds the program around it.
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(motion.duration.base)}>
          <Pressable
            onPress={handleNew}
            style={({ pressed }) => [
              styles.newCta,
              {
                backgroundColor: palette.primary,
                opacity: pressed ? 0.92 : 1,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Create a new challenge"
          >
            <View style={styles.newCtaIcon}>
              <IconSymbol name="plus" size={20} color="#FFFFFF" />
            </View>
            <View style={styles.newCtaText}>
              <Text style={styles.newCtaTitle}>New challenge</Text>
              <Text style={styles.newCtaSubtitle}>
                Marathon, weight goal, a new habit…
              </Text>
            </View>
            <IconSymbol name="arrow.right" size={18} color="#FFFFFF" />
          </Pressable>
        </Animated.View>

        {isLoading ? (
          <View style={styles.loadingState}>
            <ActivityIndicator size="small" color={palette.primary} />
          </View>
        ) : isEmpty ? (
          <EmptyState />
        ) : (
          <View style={styles.list}>
            {challenges.map((challenge, index) => (
              <Animated.View
                key={challenge._id}
                entering={FadeInDown.duration(motion.duration.base).delay(
                  index * 50,
                )}
              >
                <ChallengeCard
                  challenge={challenge}
                  onPress={() => handleOpen(challenge._id)}
                />
              </Animated.View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

function ChallengeCard({
  challenge,
  onPress,
}: {
  challenge: ChallengeListItem
  onPress: () => void
}) {
  const { palette } = useTheme()
  const meta = CATEGORY_META[challenge.category]
  const accent = palette[meta.accent]

  const isGenerating = challenge.status === 'generating'
  const isFailed = challenge.status === 'failed'
  const isCompleted = challenge.status === 'completed'

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={[
        styles.card,
        { backgroundColor: palette.surface, borderColor: palette.border },
      ]}
    >
      <View style={styles.cardTop}>
        <View
          style={[styles.cardIcon, { backgroundColor: accent + '22' }]}
        >
          <IconSymbol
            name={isCompleted ? 'trophy.fill' : meta.icon}
            size={22}
            color={isCompleted ? palette.success : accent}
          />
        </View>
        <View style={styles.cardBody}>
          <Text
            style={[styles.cardTitle, { color: palette.textPrimary }]}
            numberOfLines={1}
          >
            {challenge.title}
          </Text>
          <Text
            style={[styles.cardMeta, { color: palette.textSecondary }]}
            numberOfLines={1}
          >
            {meta.label}
            {challenge.weekCount > 0 ? ` · ${challenge.weekCount}-week plan` : ''}
          </Text>
        </View>
        <IconSymbol
          name="chevron.right"
          size={18}
          color={palette.textTertiary}
        />
      </View>

      {isGenerating ? (
        <View style={styles.statusRow}>
          <ActivityIndicator size="small" color={palette.primary} />
          <Text style={[styles.statusText, { color: palette.textSecondary }]}>
            Building your program…
          </Text>
        </View>
      ) : isFailed ? (
        <View style={styles.statusRow}>
          <IconSymbol
            name="exclamationmark.triangle.fill"
            size={15}
            color={palette.warning}
          />
          <Text style={[styles.statusText, { color: palette.textSecondary }]}>
            Couldn&apos;t build the program. Tap to retry.
          </Text>
        </View>
      ) : (
        <View style={styles.progressBlock}>
          <View
            style={[
              styles.progressTrack,
              { backgroundColor: palette.surfaceHigh },
            ]}
          >
            <View
              style={[
                styles.progressFill,
                {
                  width: `${challenge.percent}%`,
                  backgroundColor: isCompleted ? palette.success : accent,
                },
              ]}
            />
          </View>
          <Text style={[styles.progressLabel, { color: palette.textSecondary }]}>
            {isCompleted ? 'Goal reached' : `${challenge.percent}% there`}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  )
}

function EmptyState() {
  const { palette } = useTheme()
  return (
    <View style={styles.empty}>
      <Text style={[styles.emptyTitle, { color: palette.textPrimary }]}>
        Pick something to chase
      </Text>
      <Text style={[styles.emptySubtitle, { color: palette.textSecondary }]}>
        Start a challenge and Embodi builds a multi-week program, then steers
        your daily sessions toward it.
      </Text>
      <View style={styles.exampleGrid}>
        {CATEGORY_ORDER.map((id) => {
          const meta = CATEGORY_META[id]
          const accent = palette[meta.accent]
          return (
            <View
              key={id}
              style={[
                styles.exampleChip,
                {
                  backgroundColor: palette.surface,
                  borderColor: palette.border,
                },
              ]}
            >
              <View
                style={[styles.exampleIcon, { backgroundColor: accent + '22' }]}
              >
                <IconSymbol name={meta.icon} size={16} color={accent} />
              </View>
              <Text
                style={[styles.exampleLabel, { color: palette.textPrimary }]}
                numberOfLines={1}
              >
                {meta.blurb}
              </Text>
            </View>
          )
        })}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.huge,
  },
  header: {
    paddingBottom: spacing.lg,
  },
  title: {
    ...typography.display,
    fontSize: 32,
    lineHeight: 38,
  },
  subtitle: {
    ...typography.body,
    marginTop: spacing.xs,
  },
  newCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.xl,
    padding: spacing.lg,
  },
  newCtaIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  newCtaText: {
    flex: 1,
  },
  newCtaTitle: {
    ...typography.h3,
    color: '#FFFFFF',
  },
  newCtaSubtitle: {
    ...typography.small,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 2,
  },
  loadingState: {
    paddingVertical: spacing.huge,
    alignItems: 'center',
  },
  list: {
    marginTop: spacing.xl,
    gap: spacing.md,
  },
  card: {
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.md,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  cardIcon: {
    width: 46,
    height: 46,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: {
    flex: 1,
  },
  cardTitle: {
    ...typography.bodyStrong,
    fontSize: 16,
  },
  cardMeta: {
    ...typography.small,
    marginTop: 2,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  statusText: {
    ...typography.small,
    flex: 1,
  },
  progressBlock: {
    gap: spacing.xs,
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressLabel: {
    ...typography.smallStrong,
  },
  empty: {
    marginTop: spacing.xxl,
    alignItems: 'center',
  },
  emptyTitle: {
    ...typography.h2,
    textAlign: 'center',
  },
  emptySubtitle: {
    ...typography.body,
    textAlign: 'center',
    marginTop: spacing.sm,
    maxWidth: 320,
  },
  exampleGrid: {
    marginTop: spacing.xl,
    width: '100%',
    gap: spacing.sm,
  },
  exampleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
  },
  exampleIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exampleLabel: {
    ...typography.bodyStrong,
    flex: 1,
  },
})
