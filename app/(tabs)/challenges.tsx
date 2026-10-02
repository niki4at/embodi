import { useQuery } from 'convex/react'
import * as Haptics from 'expo-haptics'
import { LinearGradient } from 'expo-linear-gradient'
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
import { CATEGORY_META } from '@/constants/challenge-meta'
import { gradients, motion } from '@/constants/design'
import { fonts } from '@/constants/fonts'
import { useTheme } from '@/constants/theme-context'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import { currentWeekIndex } from '@/utils/challenge-week'

type ChallengeListItem = {
  _id: Id<'challenges'>
  title: string
  category: keyof typeof CATEGORY_META
  status: 'generating' | 'active' | 'completed' | 'archived' | 'failed'
  metric: { unit: string; targetValue?: number; startValue?: number }
  targetDate?: number
  createdAt: number
  weekCount: number
  weekFocuses: string[]
  percent: number
  latestValue: number | null
  completedSessions: number
}

type CommunityListItem = {
  _id: Id<'communities'>
  name: string
  goalLabel: string
  eventDate: number | null
  metric: { unit: string; target?: number }
  memberCount: number
  myProgress: number
  myTarget: number | null
  myPercent: number | null
}

type Filter = 'in-progress' | 'done' | 'archived'

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'in-progress', label: 'In-progress' },
  { id: 'done', label: 'Done' },
  { id: 'archived', label: 'Archived' },
]

/**
 * Spacing below mirrors the bodyfyt "challenges" frame (36:226, 415pt wide):
 * header 59, masthead 88/115, subtitle 152, tabs 199, tab rule 218, one
 * challenge row every 130pt, Create button 33pt under the last row, GROUP
 * CHALLENGES 45pt under the button, then 29pt group rows beside the FAB.
 */
export default function ChallengesScreen() {
  const { palette } = useTheme()
  const tabBarInset = useFloatingTabBarInset()
  const challenges = useQuery(api.challenges.listChallenges) as
    | ChallengeListItem[]
    | undefined
  const communities = useQuery(api.communities.listMyCommunities) as
    | CommunityListItem[]
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
  const archived = useMemo(
    () => (challenges ?? []).filter((c) => c.status === 'archived'),
    [challenges],
  )
  const visible =
    filter === 'in-progress' ? inProgress : filter === 'done' ? done : archived
  const sharedVisible = filter === 'in-progress' ? communities ?? [] : []

  const isLoading = challenges === undefined
  const rule = palette.borderStrong

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: palette.bg }]} edges={['top']}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: tabBarInset }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInUp.duration(motion.duration.base)} style={styles.header}>
          <View style={styles.topBar}>
            <Text style={[styles.topBarLabel, { color: palette.textPrimary }]}>
              GOALS {'\u00b7'} {inProgress.length} in progress
            </Text>
            <BodfitWordmark variant="header" />
          </View>

          <View style={styles.masthead} accessibilityRole="header" accessibilityLabel="The challenges">
            <Text style={[styles.mastheadThe, { color: palette.textPrimary }]} maxFontSizeMultiplier={1.3}>
              THE
            </Text>
            <GradientText
              fontFamily={fonts.masthead}
              fontSize={27}
              lineHeight={29}
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

        <View style={[styles.filters, { borderBottomColor: rule }]} accessibilityRole="tablist">
          {FILTERS.map((item) => {
            const active = item.id === filter
            return (
              <Pressable
                key={item.id}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {})
                  setFilter(item.id)
                }}
                hitSlop={{ top: 10, bottom: 4, left: 8, right: 8 }}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
              >
                <Text
                  style={[
                    styles.filterLabel,
                    active ? styles.filterLabelActive : null,
                    { color: active ? palette.textPrimary : palette.textSecondary },
                  ]}
                >
                  {item.label}
                </Text>
              </Pressable>
            )
          })}
        </View>

        {isLoading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color={palette.primary} />
          </View>
        ) : visible.length === 0 && sharedVisible.length === 0 ? (
          <EmptyRow filter={filter} onPress={handleNew} />
        ) : (
          <View>
            {visible.map((challenge, index) => (
              <Animated.View
                key={challenge._id}
                entering={FadeInDown.duration(motion.duration.base).delay(index * 40)}
              >
                <ChallengeRow
                  challenge={challenge}
                  first={index === 0}
                  onPress={() => handleOpen(challenge._id)}
                />
              </Animated.View>
            ))}
            {sharedVisible.map((community, index) => (
              <Animated.View
                key={community._id}
                entering={FadeInDown.duration(motion.duration.base).delay(
                  (visible.length + index) * 40,
                )}
              >
                <CommunityRow
                  community={community}
                  first={visible.length === 0 && index === 0}
                  onPress={() =>
                    router.push({
                      pathname: '/community/[id]',
                      params: { id: String(community._id) },
                    } as unknown as Href)
                  }
                />
              </Animated.View>
            ))}
          </View>
        )}

        <Pressable
          onPress={handleNew}
          accessibilityRole="button"
          accessibilityLabel="Create a new challenge"
          style={({ pressed }) => [styles.cta, pressed && { opacity: 0.85 }]}
        >
          <LinearGradient
            colors={[...gradients.cta]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.ctaFill}
          >
            <Text style={styles.ctaLabel}>Create a new challenge</Text>
          </LinearGradient>
        </Pressable>

        <TogetherSection />
      </ScrollView>
    </SafeAreaView>
  )
}

/**
 * One challenge entry: percent with the next date on the right, title, a
 * Week / progress line, a 3pt track, and the mono category tag. Rows after
 * the first are separated by the same 0.5pt rule that sits under the tabs.
 */
function RowShell({
  first,
  children,
  onPress,
  accessibilityLabel,
  hasBadge = false,
}: {
  first: boolean
  children: React.ReactNode
  onPress: () => void
  accessibilityLabel: string
  hasBadge?: boolean
}) {
  const { palette } = useTheme()
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        styles.row,
        hasBadge && styles.rowWithBadge,
        !first && { borderTopWidth: 0.5, borderTopColor: palette.borderStrong },
        pressed && { opacity: 0.7 },
      ]}
    >
      {children}
    </Pressable>
  )
}

function ProgressTrack({ percent, color }: { percent: number; color: string }) {
  const { palette } = useTheme()
  return (
    <View
      style={[styles.track, { backgroundColor: palette.track }]}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: percent }}
    >
      {percent > 0 ? (
        <View
          style={[
            styles.fill,
            { width: `${Math.max(2, Math.min(100, percent))}%`, backgroundColor: color },
          ]}
        />
      ) : null}
    </View>
  )
}

function ChallengeRow({
  challenge,
  first,
  onPress,
}: {
  challenge: ChallengeListItem
  first: boolean
  onPress: () => void
}) {
  const { palette } = useTheme()
  const meta = CATEGORY_META[challenge.category]
  const isGenerating = challenge.status === 'generating'
  const isFailed = challenge.status === 'failed'
  const isCompleted = challenge.status === 'completed'
  const isArchived = challenge.status === 'archived'
  const accent =
    challenge.category === 'endurance' || challenge.category === 'weight_loss'
      ? palette.primary
      : palette.accent
  const week = currentWeekIndex(challenge.createdAt, challenge.weekCount) + 1
  const statusColor = isCompleted ? palette.success : isArchived ? palette.textTertiary : accent

  const detail = (() => {
    if (isGenerating) return 'Coach is building your program'
    if (isFailed) return 'Could not build the program. Tap to retry.'
    const parts: string[] = []
    if (challenge.weekCount > 0) parts.push(`Week ${week} of ${challenge.weekCount}`)
    if (challenge.metric.targetValue !== undefined) {
      const current = challenge.latestValue ?? challenge.metric.startValue ?? 0
      const unit = challenge.metric.unit
      parts.push(
        `${current.toLocaleString()}${unit} out of ${challenge.metric.targetValue.toLocaleString()}${unit} done`,
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
    isArchived
      ? 'Archived'
      : isCompleted
        ? 'Done'
        : challenge.percent >= 50
          ? 'On pace'
          : 'Getting started'
  }`

  return (
    <RowShell
      first={first}
      onPress={onPress}
      accessibilityLabel={`${challenge.title}. ${challenge.percent} percent. ${detail}`}
    >
      <View style={styles.rowTop}>
        {isGenerating ? (
          <View style={styles.percentSlot}>
            <ActivityIndicator size="small" color={accent} />
          </View>
        ) : (
          <Text style={[styles.percent, { color: statusColor }]}>{challenge.percent}%</Text>
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
      <ProgressTrack percent={isGenerating ? 0 : challenge.percent} color={statusColor} />
      <Text style={[styles.rowFooter, { color: palette.textSecondary }]}>{footer}</Text>
    </RowShell>
  )
}

function CommunityRow({
  community,
  first,
  onPress,
}: {
  community: CommunityListItem
  first: boolean
  onPress: () => void
}) {
  const { palette } = useTheme()
  const percent = community.myPercent
  const nextUp = community.eventDate
    ? new Date(community.eventDate).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      })
    : null
  const unit = community.metric.unit
  const detail = community.myTarget
    ? `${community.myProgress.toLocaleString()}${unit} out of ${community.myTarget.toLocaleString()}${unit} done`
    : `${community.myProgress.toLocaleString()}${unit} logged`
  return (
    <RowShell
      first={first}
      hasBadge
      onPress={() => {
        Haptics.selectionAsync().catch(() => {})
        onPress()
      }}
      accessibilityLabel={`${community.name}. Shared challenge with ${community.memberCount} members. ${detail}`}
    >
      <View style={styles.rowTop}>
        <Text style={[styles.percent, { color: palette.accent }]}>
          {percent !== null ? `${percent}%` : community.myProgress.toLocaleString()}
        </Text>
        {nextUp ? (
          <Text style={[styles.nextUp, { color: palette.textPrimary }]}>{nextUp}</Text>
        ) : null}
      </View>
      <Text style={[styles.rowTitle, { color: palette.textPrimary }]} numberOfLines={1}>
        {community.name}
      </Text>
      <Text style={[styles.rowDetail, { color: palette.textSecondary }]} numberOfLines={1}>
        {detail}
      </Text>
      <ProgressTrack
        percent={percent ?? 0}
        color={percent !== null && percent >= 100 ? palette.success : palette.accent}
      />
      <View style={styles.rowFooterRow}>
        <Text style={[styles.rowFooter, { color: palette.textSecondary }]} numberOfLines={1}>
          {community.goalLabel.toUpperCase()}
        </Text>
        <View style={[styles.sharedBadge, { borderColor: palette.accent }]}>
          <Text style={[styles.sharedBadgeText, { color: palette.textPrimary }]}>
            Shared challenge {'\u00b7'} {community.memberCount}{' '}
            {community.memberCount === 1 ? 'member' : 'members'}
          </Text>
        </View>
      </View>
    </RowShell>
  )
}

/**
 * The frame has no empty state, so an empty tab keeps the exact row anatomy
 * (percent, title, line, track, tag) to hold the 130pt rhythm instead of
 * collapsing the list.
 */
function EmptyRow({ filter, onPress }: { filter: Filter; onPress: () => void }) {
  const { palette } = useTheme()
  const copy =
    filter === 'in-progress'
      ? {
          value: '0%',
          title: 'Pick something to chase',
          detail: 'Your coach builds a multi-week program around it',
          tag: 'NO CHALLENGES YET',
        }
      : filter === 'done'
        ? {
            value: '0',
            title: 'Nothing finished yet',
            detail: 'Completed challenges land here',
            tag: 'DONE \u00b7 0',
          }
        : {
            value: '0',
            title: 'Nothing archived',
            detail: 'Archived challenges land here',
            tag: 'ARCHIVED \u00b7 0',
          }
  return (
    <RowShell first onPress={onPress} accessibilityLabel={`${copy.title}. ${copy.detail}`}>
      <View style={styles.rowTop}>
        <Text style={[styles.percent, { color: palette.textTertiary }]}>{copy.value}</Text>
      </View>
      <Text style={[styles.rowTitle, { color: palette.textPrimary }]} numberOfLines={1}>
        {copy.title}
      </Text>
      <Text style={[styles.rowDetail, { color: palette.textSecondary }]} numberOfLines={1}>
        {copy.detail}
      </Text>
      <ProgressTrack percent={0} color={palette.primary} />
      <Text style={[styles.rowFooter, { color: palette.textSecondary }]}>{copy.tag}</Text>
    </RowShell>
  )
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  scrollContent: {
    paddingTop: 12,
  },
  header: {
    paddingLeft: 26,
    paddingRight: 44,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 17,
  },
  topBarLabel: {
    fontFamily: fonts.mono,
    fontSize: 12,
    lineHeight: 17,
  },
  masthead: {
    marginTop: 12,
  },
  mastheadThe: {
    fontFamily: fonts.masthead,
    fontSize: 25,
    lineHeight: 27,
  },
  subtitle: {
    fontFamily: fonts.uiRegular,
    fontSize: 11,
    lineHeight: 14,
    marginTop: 8,
  },
  filters: {
    flexDirection: 'row',
    gap: 23,
    marginTop: 33,
    marginRight: 18,
    paddingLeft: 20,
    paddingBottom: 4,
    borderBottomWidth: 0.5,
  },
  filterLabel: {
    fontFamily: fonts.uiMedium,
    fontSize: 12,
    lineHeight: 15,
  },
  filterLabelActive: {
    fontFamily: fonts.uiSemiBold,
  },
  loadingRow: {
    height: 130,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    paddingTop: 19,
    paddingBottom: 22,
    paddingLeft: 20,
    paddingRight: 31,
    marginRight: 15,
  },
  rowWithBadge: {
    paddingBottom: 10,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  percentSlot: {
    height: 28,
    justifyContent: 'center',
  },
  percent: {
    fontFamily: fonts.displaySemiBold,
    fontSize: 22,
    lineHeight: 28,
  },
  nextUp: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 9,
    lineHeight: 11,
    marginTop: 3,
  },
  rowTitle: {
    fontFamily: fonts.displayBold,
    fontSize: 11,
    lineHeight: 14,
  },
  rowDetail: {
    fontFamily: fonts.uiRegular,
    fontSize: 9,
    lineHeight: 11,
    marginTop: 2,
  },
  track: {
    height: 3,
    borderRadius: 1.5,
    marginTop: 10,
    marginRight: 52,
    overflow: 'hidden',
  },
  fill: {
    height: 3,
    borderRadius: 1.5,
  },
  rowFooter: {
    fontFamily: fonts.mono,
    fontSize: 9,
    lineHeight: 12,
    marginTop: 9,
    flexShrink: 1,
  },
  rowFooterRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  sharedBadge: {
    height: 13,
    marginTop: 17,
    marginRight: -14,
    paddingHorizontal: 7,
    borderRadius: 30,
    borderWidth: 0.5,
    backgroundColor: 'rgba(201, 145, 241, 0.4)',
    justifyContent: 'center',
  },
  sharedBadgeText: {
    fontFamily: fonts.uiRegular,
    fontSize: 7,
    lineHeight: 9,
  },
  cta: {
    marginTop: 11,
    marginLeft: 24,
    marginRight: 61,
    height: 34,
    borderRadius: 15,
    overflow: 'hidden',
  },
  ctaFill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaLabel: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 15,
    lineHeight: 19,
    color: '#FFFFFF',
  },
})
