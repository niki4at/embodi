import { IconSymbol } from '@/components/ui/icon-symbol'
import { motion, radius, spacing, typography, type Palette } from '@/constants/design'
import { useTheme } from '@/constants/theme-context'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import { useAction, useMutation, useQuery } from 'convex/react'
import * as Haptics from 'expo-haptics'
import { router, type Href } from 'expo-router'
import React, { memo, useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated'

type IconName = React.ComponentProps<typeof IconSymbol>['name']

type Stat = {
  key: string
  label: string
  value: string
  unit: string
  icon: string
  tint: string
  story?: string
  trend?: string
}

type Recommendation = {
  id: string
  title: string
  durationMin: number
  moveCount: number
  modality: string
  badge: string
  badgeTint: string
  description: string
  tags: string[]
  reasoning: string
}

type ExplorationRecommendation = Recommendation & { whyNew: string }

type Insight = {
  _id: Id<'weekly_insights'>
  weekStart: number
  status: 'generating' | 'ready' | 'failed'
  source: 'batch' | 'on_demand' | 'cold_start'
  headline?: string
  stats: Stat[]
  alignedRecommendations: Recommendation[]
  explorationRecommendations: ExplorationRecommendation[]
  updatedAt: number
  feedback: { rating: 'liked' | 'disliked'; comment?: string } | null
}

const FALLBACK_ICON: IconName = 'sparkles'

function resolveTint(palette: Palette, tintKey: string): string {
  const map: Record<string, string> = {
    primary: palette.primary,
    success: palette.success,
    warning: palette.warning,
    danger: palette.danger,
    accentTeal: palette.accentTeal,
    accentPurple: palette.accentPurple,
    accentPink: palette.accentPink,
    accentCoral: palette.accentCoral,
  }
  return map[tintKey] ?? palette.primary
}

function resolveIcon(name: string): IconName {
  return (name as IconName) || FALLBACK_ICON
}

export const WeeklyInsightsSection = memo(function WeeklyInsightsSection() {
  const { palette } = useTheme()
  const insight = useQuery(api.weeklyInsights.getCurrentWeekInsight) as
    | Insight
    | null
    | undefined

  const ensureCurrent = useAction(api.weeklyInsights.ensureCurrentWeekInsight)
  const requestRegeneration = useAction(
    api.weeklyInsights.requestRegeneration
  )
  const submitFeedback = useMutation(api.weeklyInsights.submitWeeklyFeedback)

  const [isRefreshing, setIsRefreshing] = useState(false)
  const [hasTriggeredColdStart, setHasTriggeredColdStart] = useState(false)
  const [pendingRecId, setPendingRecId] = useState<string | null>(null)

  // Cold start: ask backend to generate if we have no insight yet for this week.
  useEffect(() => {
    if (insight === null && !hasTriggeredColdStart) {
      setHasTriggeredColdStart(true)
      ensureCurrent({}).catch((error) => {
        console.warn('[weekly-insights] cold start failed', error)
      })
    }
  }, [insight, hasTriggeredColdStart, ensureCurrent])

  const handleRefresh = useCallback(async () => {
    if (isRefreshing) return
    setIsRefreshing(true)
    try {
      await Haptics.selectionAsync()
      await requestRegeneration({ force: true })
    } catch (error) {
      console.warn('[weekly-insights] refresh failed', error)
    } finally {
      setIsRefreshing(false)
    }
  }, [isRefreshing, requestRegeneration])

  const handleRecommendationPress = useCallback(
    async (
      rec: Recommendation | ExplorationRecommendation,
      source: 'aligned' | 'exploration'
    ) => {
      if (pendingRecId) return
      setPendingRecId(rec.id)
      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
        const seed = {
          title: rec.title,
          modality: rec.modality,
          durationMin: rec.durationMin,
          moveCount: rec.moveCount,
          description: rec.description,
          reasoning: rec.reasoning,
          tags: rec.tags,
          source,
        }
        const checkinHref = {
          pathname: '/checkin',
          params: { rec: JSON.stringify(seed) },
        } as unknown as Href
        router.push(checkinHref)
      } catch (error) {
        console.warn('[weekly-insights] navigate to checkin failed', error)
        await Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Error
        )
      } finally {
        // Reset shortly after navigation to clear pending UI without blocking back-nav.
        setTimeout(() => setPendingRecId(null), 600)
      }
    },
    [pendingRecId]
  )

  const handleFeedback = useCallback(
    async (rating: 'liked' | 'disliked') => {
      if (!insight || insight.status !== 'ready') return
      try {
        await Haptics.impactAsync(
          rating === 'liked'
            ? Haptics.ImpactFeedbackStyle.Light
            : Haptics.ImpactFeedbackStyle.Soft
        )
        await submitFeedback({ insightId: insight._id, rating })
      } catch (error) {
        console.warn('[weekly-insights] feedback failed', error)
      }
    },
    [insight, submitFeedback]
  )

  if (insight === undefined) {
    return <WeeklyInsightsSkeleton />
  }

  const isGenerating =
    insight === null || (insight && insight.status === 'generating')
  const isFailed = insight && insight.status === 'failed'
  const ready = insight && insight.status === 'ready' ? insight : null

  return (
    <View>
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionHeaderLeft}>
            <Text style={[styles.sectionTitle, { color: palette.textPrimary }]}>
              This week
            </Text>
            <View style={styles.aiBadge}>
              <IconSymbol name="sparkles" size={11} color={palette.primary} />
              <Text style={[styles.aiBadgeText, { color: palette.primary }]}>
                AI for you
              </Text>
            </View>
          </View>
          {insight?.status === 'generating' ? (
            <ActivityIndicator size="small" color={palette.textTertiary} />
          ) : null}
        </View>

        {isGenerating && <WeeklyInsightsSkeleton />}

        {isFailed && (
          <View
            style={[
              styles.errorCard,
              { backgroundColor: palette.surface, borderColor: palette.border },
            ]}
          >
            <Text
              style={[
                styles.errorTitle,
                { color: palette.textPrimary },
              ]}
            >
              We couldn’t build your weekly insight
            </Text>
            <Text style={[styles.errorBody, { color: palette.textSecondary }]}>
              Tap below to try again. We’ll use the latest data we have for you.
            </Text>
            <TouchableOpacity
              onPress={handleRefresh}
              activeOpacity={0.85}
              style={[styles.retryButton, { backgroundColor: palette.primary }]}
            >
              <IconSymbol name="arrow.clockwise" size={14} color="#FFFFFF" />
              <Text style={styles.retryButtonText}>Try again</Text>
            </TouchableOpacity>
          </View>
        )}

        {ready && (
          <Animated.View entering={FadeIn.duration(motion.duration.base)}>
            {ready.headline ? (
              <Text
                style={[styles.headline, { color: palette.textSecondary }]}
              >
                {ready.headline}
              </Text>
            ) : null}
            <View style={styles.statsList}>
              {Array.from({
                length: Math.ceil(ready.stats.length / 2),
              }).map((_, rowIdx) => {
                const rowStats = ready.stats.slice(
                  rowIdx * 2,
                  rowIdx * 2 + 2
                )
                return (
                  <View key={`row-${rowIdx}`} style={styles.statsRow}>
                    {rowStats.map((stat, colIdx) => (
                      <Animated.View
                        key={`${stat.key}-${rowIdx}-${colIdx}`}
                        entering={FadeInDown.delay(
                          (rowIdx * 2 + colIdx) * 60
                        ).duration(motion.duration.base)}
                        style={styles.statCardWrapper}
                      >
                        <StatCard stat={stat} />
                      </Animated.View>
                    ))}
                    {rowStats.length === 1 ? (
                      <View style={styles.statCardWrapper} />
                    ) : null}
                  </View>
                )
              })}
            </View>
          </Animated.View>
        )}
      </View>

      {ready && ready.alignedRecommendations.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: palette.textPrimary }]}>
              Recommended for you
            </Text>
            <Text
              style={[styles.sectionMeta, { color: palette.textTertiary }]}
            >
              Tap to start
            </Text>
          </View>
          {ready.alignedRecommendations.map((rec, idx) => (
            <Animated.View
              key={rec.id}
              entering={FadeInDown.delay(idx * 80).duration(
                motion.duration.base
              )}
            >
              <RecommendedCard
                rec={rec}
                isPending={pendingRecId === rec.id}
                isAnyPending={pendingRecId !== null}
                onPress={() => handleRecommendationPress(rec, 'aligned')}
              />
            </Animated.View>
          ))}
        </View>
      )}

      {ready && ready.explorationRecommendations.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: palette.textPrimary }]}>
              Try something new
            </Text>
            <Text
              style={[styles.sectionMeta, { color: palette.textTertiary }]}
            >
              Tap to start
            </Text>
          </View>
          {ready.explorationRecommendations.map((rec, idx) => (
            <Animated.View
              key={rec.id}
              entering={FadeInDown.delay(idx * 80).duration(
                motion.duration.base
              )}
            >
              <RecommendedCard
                rec={rec}
                exploration
                isPending={pendingRecId === rec.id}
                isAnyPending={pendingRecId !== null}
                onPress={() =>
                  handleRecommendationPress(rec, 'exploration')
                }
              />
            </Animated.View>
          ))}
        </View>
      )}

      {ready && (
        <FeedbackRow
          rating={ready.feedback?.rating ?? null}
          onSelect={handleFeedback}
        />
      )}
    </View>
  )
})

interface StatCardProps {
  stat: Stat
}

const StatCard = memo(function StatCard({ stat }: StatCardProps) {
  const { palette } = useTheme()
  const tint = resolveTint(palette, stat.tint)
  const trendIcon: IconName | null =
    stat.trend === 'up'
      ? 'arrow.up.right'
      : stat.trend === 'down'
        ? 'chevron.down'
        : null
  return (
    <View
      style={[
        styles.statCard,
        { backgroundColor: palette.surface, borderColor: palette.border },
      ]}
    >
      <View style={styles.statHeader}>
        <Text
          style={[styles.statLabel, { color: palette.textSecondary }]}
          numberOfLines={1}
        >
          {stat.label}
        </Text>
        <View style={[styles.statIcon, { backgroundColor: tint + '22' }]}>
          <IconSymbol name={resolveIcon(stat.icon)} size={12} color={tint} />
        </View>
      </View>
      <View style={styles.statValueRow}>
        <Text
          style={[styles.statValue, { color: palette.textPrimary }]}
          numberOfLines={1}
        >
          {stat.value}
        </Text>
        <Text style={[styles.statUnit, { color: palette.textTertiary }]}>
          {stat.unit}
        </Text>
        {trendIcon ? (
          <IconSymbol
            name={trendIcon}
            size={12}
            color={palette.textTertiary}
          />
        ) : null}
      </View>
      {stat.story ? (
        <Text style={[styles.statStory, { color: palette.textTertiary }]}>
          {stat.story}
        </Text>
      ) : null}
    </View>
  )
})

interface RecommendedCardProps {
  rec: Recommendation | ExplorationRecommendation
  exploration?: boolean
  isPending: boolean
  isAnyPending: boolean
  onPress: () => void
}

const RecommendedCard = memo(function RecommendedCard({
  rec,
  exploration,
  isPending,
  isAnyPending,
  onPress,
}: RecommendedCardProps) {
  const { palette } = useTheme()
  const tint = resolveTint(palette, rec.badgeTint)
  const whyNew = (rec as ExplorationRecommendation).whyNew
  const dimmed = isAnyPending && !isPending
  return (
    <TouchableOpacity
      style={[
        styles.recCard,
        {
          backgroundColor: palette.surface,
          borderColor: isPending ? palette.primary : palette.border,
          opacity: dimmed ? 0.55 : 1,
        },
      ]}
      activeOpacity={0.85}
      onPress={onPress}
      disabled={isAnyPending}
      accessibilityRole="button"
      accessibilityLabel={`Start session: ${rec.title}`}
      accessibilityHint="Builds today’s session using this recommendation as the starting point"
    >
      <View style={styles.recHeader}>
        <View style={styles.recHeaderLeft}>
          <Text style={[styles.recTitle, { color: palette.textPrimary }]}>
            {rec.title}
          </Text>
          <Text style={[styles.recMeta, { color: palette.textTertiary }]}>
            {rec.durationMin} min · {rec.moveCount}{' '}
            {rec.moveCount === 1 ? 'move' : 'moves'} · {rec.modality}
          </Text>
        </View>
        {isPending ? (
          <View
            style={[
              styles.badge,
              { backgroundColor: palette.primaryMuted, flexDirection: 'row', gap: 6, alignItems: 'center' },
            ]}
          >
            <ActivityIndicator size="small" color={palette.primary} />
            <Text style={[styles.badgeText, { color: palette.primary }]}>
              Opening
            </Text>
          </View>
        ) : (
          <View style={[styles.badge, { backgroundColor: tint + '22' }]}>
            <Text style={[styles.badgeText, { color: tint }]}>{rec.badge}</Text>
          </View>
        )}
      </View>
      <Text style={[styles.recDescription, { color: palette.textSecondary }]}>
        {rec.description}
      </Text>
      {exploration && whyNew ? (
        <View
          style={[
            styles.whyNewRow,
            { backgroundColor: palette.surfaceAlt },
          ]}
        >
          <IconSymbol
            name="sparkles"
            size={12}
            color={palette.accentPurple}
          />
          <Text
            style={[styles.whyNewText, { color: palette.textSecondary }]}
          >
            {whyNew}
          </Text>
        </View>
      ) : null}
      <View style={styles.recFooter}>
        <View style={styles.recTags}>
          {rec.tags.map((t) => (
            <View
              key={t}
              style={[styles.tag, { backgroundColor: palette.surfaceAlt }]}
            >
              <Text style={[styles.tagText, { color: palette.textSecondary }]}>
                {t}
              </Text>
            </View>
          ))}
        </View>
        <View style={styles.recCta}>
          <Text style={[styles.recCtaText, { color: palette.primary }]}>
            {isPending ? 'Opening…' : 'Check in & start'}
          </Text>
          <IconSymbol
            name="arrow.right"
            size={14}
            color={palette.primary}
          />
        </View>
      </View>
    </TouchableOpacity>
  )
})

interface FeedbackRowProps {
  rating: 'liked' | 'disliked' | null
  onSelect: (rating: 'liked' | 'disliked') => void
}

const FeedbackRow = memo(function FeedbackRow({
  rating,
  onSelect,
}: FeedbackRowProps) {
  const { palette } = useTheme()
  return (
    <View
      style={[
        styles.feedbackRow,
        { backgroundColor: palette.surface, borderColor: palette.border },
      ]}
    >
      <Text
        style={[styles.feedbackText, { color: palette.textSecondary }]}
        numberOfLines={2}
      >
        {rating === 'liked'
          ? 'Thanks. We’ll keep this style for next week.'
          : rating === 'disliked'
            ? 'Got it. Next week’s view will switch things up.'
            : 'Was this week’s view useful?'}
      </Text>
      <View style={styles.feedbackButtons}>
        <FeedbackButton
          icon={rating === 'liked' ? 'hand.thumbsup.fill' : 'hand.thumbsup'}
          active={rating === 'liked'}
          onPress={() => onSelect('liked')}
          accessibilityLabel="I like this week's view"
        />
        <FeedbackButton
          icon={
            rating === 'disliked'
              ? 'hand.thumbsdown.fill'
              : 'hand.thumbsdown'
          }
          active={rating === 'disliked'}
          onPress={() => onSelect('disliked')}
          accessibilityLabel="I don't like this week's view"
        />
      </View>
    </View>
  )
})

interface FeedbackButtonProps {
  icon: IconName
  active: boolean
  onPress: () => void
  accessibilityLabel: string
}

function FeedbackButton({
  icon,
  active,
  onPress,
  accessibilityLabel,
}: FeedbackButtonProps) {
  const { palette } = useTheme()
  const color = active ? palette.primary : palette.textTertiary
  const bg = active ? palette.primaryMuted : palette.surfaceAlt
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={[styles.feedbackButton, { backgroundColor: bg }]}
      hitSlop={4}
    >
      <IconSymbol name={icon} size={16} color={color} />
    </TouchableOpacity>
  )
}

const WeeklyInsightsSkeleton = memo(function WeeklyInsightsSkeleton() {
  const { palette } = useTheme()
  return (
    <View>
      <View
        style={[
          styles.skeletonHeadline,
          { backgroundColor: palette.surfaceAlt },
        ]}
      />
      <View style={styles.statsList}>
        {[0, 1].map((rowIdx) => (
          <View key={`skeleton-row-${rowIdx}`} style={styles.statsRow}>
            {[0, 1].map((colIdx) => (
              <View
                key={`skeleton-${rowIdx}-${colIdx}`}
                style={styles.statCardWrapper}
              >
                <View
                  style={[
                    styles.statCard,
                    {
                      backgroundColor: palette.surface,
                      borderColor: palette.border,
                      minHeight: 130,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.skeletonLine,
                      { backgroundColor: palette.surfaceAlt, width: '50%' },
                    ]}
                  />
                  <View
                    style={[
                      styles.skeletonLine,
                      {
                        backgroundColor: palette.surfaceAlt,
                        width: '70%',
                        height: 22,
                        marginTop: spacing.md,
                      },
                    ]}
                  />
                </View>
              </View>
            ))}
          </View>
        ))}
      </View>
    </View>
  )
})

const styles = StyleSheet.create({
  section: {
    marginTop: spacing.xxxl,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  sectionTitle: {
    ...typography.h3,
  },
  aiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255, 107, 107, 0.10)',
  },
  aiBadgeText: {
    ...typography.caption,
  },
  linkText: {
    ...typography.smallStrong,
  },
  sectionMeta: {
    ...typography.small,
  },
  headline: {
    ...typography.body,
    marginBottom: spacing.lg,
  },
  statsList: {
    gap: spacing.md,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'stretch',
  },
  statCardWrapper: {
    flex: 1,
  },
  statCard: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  statHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  statLabel: {
    ...typography.smallStrong,
    flex: 1,
    marginRight: spacing.xs,
  },
  statIcon: {
    width: 22,
    height: 22,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    columnGap: 6,
  },
  statValue: {
    ...typography.metric,
  },
  statUnit: {
    ...typography.small,
    flexShrink: 1,
  },
  statStory: {
    ...typography.small,
    fontSize: 12,
    lineHeight: 16,
    marginTop: spacing.sm,
  },
  recCard: {
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
  },
  recHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  recHeaderLeft: {
    flex: 1,
    paddingRight: spacing.md,
  },
  recTitle: {
    ...typography.bodyStrong,
    marginBottom: 2,
  },
  recMeta: {
    ...typography.small,
  },
  badge: {
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  badgeText: {
    ...typography.caption,
  },
  recDescription: {
    ...typography.small,
    marginBottom: spacing.md,
  },
  whyNewRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.md,
    alignItems: 'flex-start',
  },
  whyNewText: {
    ...typography.small,
    flex: 1,
  },
  recFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  recTags: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
    flex: 1,
  },
  recCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  recCtaText: {
    ...typography.smallStrong,
  },
  tag: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.sm,
  },
  tagText: {
    ...typography.small,
    fontWeight: '600',
  },
  feedbackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  feedbackText: {
    ...typography.small,
    flex: 1,
  },
  feedbackButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  feedbackButton: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorCard: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.md,
  },
  errorTitle: {
    ...typography.bodyStrong,
  },
  errorBody: {
    ...typography.small,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  retryButtonText: {
    ...typography.smallStrong,
    color: '#FFFFFF',
  },
  skeletonHeadline: {
    height: 18,
    borderRadius: radius.sm,
    marginBottom: spacing.lg,
    width: '80%',
  },
  skeletonLine: {
    height: 12,
    borderRadius: radius.xs,
  },
})
