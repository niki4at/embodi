import { useQuery } from 'convex/react'
import * as Haptics from 'expo-haptics'
import { router, type Href } from 'expo-router'
import React, { useCallback, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'

import { useFloatingTabBarInset } from '@/components/navigation/floating-tab-bar'
import { TogetherSection } from '@/components/social/together-section'
import { BodfitWordmark } from '@/components/ui/bodfit-logo'
import { GradientText } from '@/components/ui/gradient-text'
import { PillButton } from '@/components/ui/pill-button'
import { Chip } from '@/components/ui/primitives'
import { CATEGORY_META, CATEGORY_ORDER } from '@/constants/challenge-meta'
import { gradients, motion, spacing, typography } from '@/constants/design'
import { fonts } from '@/constants/fonts'
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

type Filter = 'in-progress' | 'done' | 'archived'

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'in-progress', label: 'In-progress' },
  { id: 'done', label: 'Done' },
  { id: 'archived', label: 'Archived' },
]

function weeksElapsed(createdWeeks: number, targetDate?: number): number {
  if (!targetDate || createdWeeks === 0) return 1
  const remaining = Math.max(0, targetDate - Date.now()) / (7 * 24 * 60 * 60 * 1000)
  return Math.min(createdWeeks, Math.max(1, Math.round(createdWeeks - remaining) + 1))
}

export default function ChallengesScreen() {
  const { palette } = useTheme()
  const tabBarInset = useFloatingTabBarInset()
  const challenges = useQuery(api.challenges.listChallenges) as
    | ChallengeListItem[]
    | undefined
  const [filter, setFilter] = useState<Filter>('in-progress')

  const handleNew = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {})
    router.push('/challenge/new' as Href)
  }, [])

  const handleOpen = useCallback((id: Id<'challenges'>) => {
    Haptics.selectionAsync().catch(() => {})
    router.push({
      pathname: '/challenge/[id]',
      params: { id: String(id) },
    } as unknown as Href)
  }, [])

  const inProgress = useMemo(
    () =>
      (challenges ?? []).filter(
        (c) => c.status === 'active' || c.status === 'generating' || c.status === 'failed',
      ),
    [challenges],
  )
  const done = useMemo(
    () => (challenges ?? []).filter((c) => c.status === 'completed'),
    [challenges],
  )
  const visible = filter === 'in-progress' ? inProgress : filter === 'done' ? done : []

  const isLoading = challenges === undefined

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: palette.bg }]} edges={['top']}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: tabBarInset }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInUp.duration(motion.duration.base)}>
          <View style={styles.topBar}>
            <Text style={[styles.topBarLabel, { color: palette.textPrimary }]}>
              GOALS {'\u00b7'} {inProgress.length} in progress
            </Text>
            <BodfitWordmark variant="header" />
          </View>

          <View style={styles.masthead} accessibilityRole="header" accessibilityLabel="The challenges">
            <Text style={[styles.mastheadThe, { color: palette.textPrimary }]} allowFontScaling={false}>
              THE
            </Text>
            <GradientText
              fontFamily={fonts.masthead}
              fontSize={28}
              lineHeight={34}
              letterSpacing={0.5}
              colors={gradients.hero}
              outline
              accessibilityLabel="Challenges"
            >
              CHALLENGES
            </GradientText>
          </View>
          <Text style={[styles.subtitle, { color: palette.textSecondary }]}>
            Your coach replans each one after every session
          </Text>
        </Animated.View>

        <View style={[styles.filters, { borderBottomColor: palette.divider }]} accessibilityRole="tablist">
          {FILTERS.map((item) => {
            const active = item.id === filter
            return (
              <Pressable
                key={item.id}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {})
                  setFilter(item.id)
                }}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                style={styles.filterTab}
              >
                <Text
                  style={[
                    styles.filterLabel,
                    { color: active ? palette.textPrimary : palette.textSecondary },
                  ]}
                >
                  {item.label}
                </Text>
                <View
                  style={[
                    styles.filterUnderline,
                    { backgroundColor: active ? palette.textPrimary : 'transparent' },
                  ]}
                />
              </Pressable>
            )
          })}
        </View>

        {isLoading ? (
          <View style={styles.loadingState}>
            <ActivityIndicator size="small" color={palette.primary} />
          </View>
        ) : visible.length === 0 ? (
          <EmptyState filter={filter} />
        ) : (
          <View>
            {visible.map((challenge, index) => (
              <Animated.View
                key={challenge._id}
                entering={FadeInDown.duration(motion.duration.base).delay(index * 40)}
              >
                <ChallengeRow challenge={challenge} onPress={() => handleOpen(challenge._id)} />
              </Animated.View>
            ))}
          </View>
        )}

        <View style={styles.cta}>
          <PillButton variant="gradient" label="Create a new challenge" onPress={handleNew} />
        </View>

        <TogetherSection />
      </ScrollView>
    </SafeAreaView>
  )
}

function ChallengeRow({
  challenge,
  onPress,
}: {
  challenge: ChallengeListItem
  onPress: () => void
}) {
  const { palette } = useTheme()
  const meta = CATEGORY_META[challenge.category]
  const isGenerating = challenge.status === 'generating'
  const isFailed = challenge.status === 'failed'
  const isCompleted = challenge.status === 'completed'
  const accent =
    challenge.category === 'endurance' || challenge.category === 'weight_loss'
      ? palette.primary
      : palette.accent
  const week = weeksElapsed(challenge.weekCount, challenge.targetDate)

  const detail = (() => {
    if (isGenerating) return 'Coach is building your program'
    if (isFailed) return 'Could not build the program. Tap to retry.'
    const parts: string[] = []
    if (challenge.weekCount > 0) parts.push(`Week ${week} of ${challenge.weekCount}`)
    if (challenge.metric.targetValue !== undefined) {
      const current =
        challenge.latestValue ?? challenge.metric.startValue ?? 0
      parts.push(
        `${current.toLocaleString()} ${challenge.metric.unit} of ${challenge.metric.targetValue.toLocaleString()} ${challenge.metric.unit}`,
      )
    } else {
      parts.push(`${challenge.completedSessions} sessions logged`)
    }
    return parts.join(' \u00b7 ')
  })()

  const nextUp = challenge.targetDate
    ? new Date(challenge.targetDate).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      })
    : null

  const footer = `${meta.label.toUpperCase()} \u00b7 ${
    isCompleted ? 'Done' : challenge.percent >= 50 ? 'On pace' : 'Getting started'
  }`

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${challenge.title}. ${challenge.percent} percent. ${detail}`}
      style={({ pressed }) => [
        styles.row,
        { borderBottomColor: palette.divider },
        pressed && { opacity: 0.7 },
      ]}
    >
      <View style={styles.rowTop}>
        {isGenerating ? (
          <ActivityIndicator size="small" color={accent} />
        ) : (
          <Text style={[styles.percent, { color: isCompleted ? palette.success : accent }]}>
            {challenge.percent}%
          </Text>
        )}
        {nextUp ? (
          <Text style={[styles.nextUp, { color: palette.textPrimary }]}>{nextUp}</Text>
        ) : null}
      </View>
      <Text style={[styles.rowTitle, { color: palette.textPrimary }]} numberOfLines={1}>
        {challenge.title}
      </Text>
      <Text style={[styles.rowDetail, { color: palette.textSecondary }]} numberOfLines={1}>
        {detail}
      </Text>
      {!isGenerating ? (
        <View
          style={[styles.track, { backgroundColor: palette.surfaceHigh }]}
          accessibilityRole="progressbar"
          accessibilityValue={{ min: 0, max: 100, now: challenge.percent }}
        >
          <View
            style={[
              styles.fill,
              {
                width: `${Math.max(2, Math.min(100, challenge.percent))}%`,
                backgroundColor: isCompleted ? palette.success : accent,
              },
            ]}
          />
        </View>
      ) : null}
      <Text style={[styles.rowFooter, { color: palette.textSecondary }]}>{footer}</Text>
    </Pressable>
  )
}

function EmptyState({ filter }: { filter: Filter }) {
  const { palette } = useTheme()
  if (filter !== 'in-progress') {
    return (
      <View style={styles.empty}>
        <Text style={[styles.emptyBody, { color: palette.textSecondary }]}>
          {filter === 'done'
            ? 'Finished challenges land here.'
            : 'Archived challenges land here.'}
        </Text>
      </View>
    )
  }
  return (
    <View style={styles.empty}>
      <Text style={[styles.emptyTitle, { color: palette.textPrimary }]}>Pick something to chase</Text>
      <Text style={[styles.emptyBody, { color: palette.textSecondary }]}>
        Start a challenge and Bodfit builds a multi-week program, then steers your daily sessions
        toward it.
      </Text>
      <View style={styles.exampleChips}>
        {CATEGORY_ORDER.map((id) => (
          <Chip
            key={id}
            label={CATEGORY_META[id].blurb}
            onPress={() =>
              router.push({
                pathname: '/challenge/new',
                params: { category: id },
              } as unknown as Href)
            }
          />
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  scrollContent: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  topBarLabel: {
    ...typography.mono,
  },
  masthead: {
    gap: 0,
  },
  mastheadThe: {
    fontFamily: fonts.masthead,
    fontSize: 26,
    lineHeight: 30,
    letterSpacing: 0.5,
  },
  subtitle: {
    ...typography.small,
    fontSize: 14,
    marginTop: spacing.sm,
  },
  filters: {
    flexDirection: 'row',
    gap: spacing.xl,
    marginTop: spacing.xl,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  filterTab: {
    paddingTop: 6,
    gap: 8,
  },
  filterLabel: {
    ...typography.smallStrong,
  },
  filterUnderline: {
    height: 2,
    borderRadius: 1,
  },
  loadingState: {
    paddingVertical: spacing.huge,
    alignItems: 'center',
  },
  row: {
    paddingVertical: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 4,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  percent: {
    fontFamily: fonts.displaySemiBold,
    fontSize: 26,
    lineHeight: 32,
    letterSpacing: -0.5,
  },
  nextUp: {
    ...typography.smallStrong,
    fontSize: 12,
  },
  rowTitle: {
    ...typography.bodyStrong,
    fontSize: 16,
  },
  rowDetail: {
    ...typography.small,
  },
  track: {
    height: 3,
    borderRadius: 2,
    marginTop: spacing.sm,
    marginRight: '20%',
    overflow: 'hidden',
  },
  fill: {
    height: 3,
    borderRadius: 2,
  },
  rowFooter: {
    ...typography.mono,
    fontSize: 10,
    letterSpacing: 0.8,
    marginTop: spacing.sm,
  },
  cta: {
    marginTop: spacing.xxl,
  },
  empty: {
    paddingVertical: spacing.xxl,
    gap: spacing.sm,
  },
  emptyTitle: {
    ...typography.h3,
  },
  emptyBody: {
    ...typography.small,
    fontSize: 14,
  },
  exampleChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
})
