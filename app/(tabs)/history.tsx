import { usePaginatedQuery, useQuery } from 'convex/react'
import * as Haptics from 'expo-haptics'
import { router, type Href } from 'expo-router'
import React, { useMemo } from 'react'
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'

import { IconSymbol } from '@/components/ui/icon-symbol'
import { motion, radius, spacing, typography } from '@/constants/design'
import { useTheme } from '@/constants/theme-context'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'

type HistoryEntry = {
  _id: Id<'workout_sessions'>
  goal: string
  modality: string
  durationMin: number
  status: 'completed' | 'discarded'
  setsLogged: number
  totalTargetSets: number
  completedAt: number
  createdAt: number
}

type HistoryGroup = {
  key: string
  label: string
  items: HistoryEntry[]
}

function formatDateLabel(ms: number): string {
  const day = new Date(ms)
  day.setHours(0, 0, 0, 0)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diffDays = Math.round((today.getTime() - day.getTime()) / 86_400_000)
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  return day.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

function groupByDay(entries: HistoryEntry[]): HistoryGroup[] {
  const groups: HistoryGroup[] = []
  const byKey = new Map<string, HistoryGroup>()
  for (const entry of entries) {
    const key = new Date(entry.completedAt).toISOString().slice(0, 10)
    let group = byKey.get(key)
    if (!group) {
      group = { key, label: formatDateLabel(entry.completedAt), items: [] }
      byKey.set(key, group)
      groups.push(group)
    }
    group.items.push(entry)
  }
  return groups
}

export default function HistoryScreen() {
  const { palette, resolved } = useTheme()
  const stats = useQuery(api.trainer.getWorkoutStats)
  const { results, status, loadMore } = usePaginatedQuery(
    api.trainer.getWorkoutHistory,
    {},
    { initialNumItems: 20 },
  )

  const groups = useMemo(
    () => groupByDay(results as HistoryEntry[]),
    [results],
  )

  const handleOpenRecap = (sessionId: Id<'workout_sessions'>) => {
    Haptics.selectionAsync()
    const recapHref = {
      pathname: '/session/recap',
      params: { sessionId: String(sessionId) },
    } as unknown as Href
    router.push(recapHref)
  }

  const isLoadingInitial = status === 'LoadingFirstPage'
  const isEmpty = !isLoadingInitial && results.length === 0

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: palette.bg }]}
      edges={['top']}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <Animated.View
          entering={FadeInUp.duration(motion.duration.base)}
          style={styles.header}
        >
          <Text style={[styles.title, { color: palette.textPrimary }]}>
            History
          </Text>
          <Text style={[styles.subtitle, { color: palette.textSecondary }]}>
            Every session you&apos;ve logged
          </Text>
        </Animated.View>

        <Animated.View
          entering={FadeInDown.duration(motion.duration.base)}
          style={styles.statsRow}
        >
          <View
            style={[
              styles.statCard,
              { backgroundColor: palette.surface, borderColor: palette.border },
            ]}
          >
            <Text style={[styles.statValue, { color: palette.textPrimary }]}>
              {stats?.totalWorkouts ?? '—'}
            </Text>
            <Text style={[styles.statLabel, { color: palette.textSecondary }]}>
              Workouts
            </Text>
          </View>
          <View
            style={[
              styles.statCard,
              { backgroundColor: palette.surface, borderColor: palette.border },
            ]}
          >
            <View style={styles.statValueRow}>
              <IconSymbol name="flame.fill" size={18} color={palette.primary} />
              <Text style={[styles.statValue, { color: palette.textPrimary }]}>
                {stats?.currentStreak ?? '—'}
              </Text>
            </View>
            <Text style={[styles.statLabel, { color: palette.textSecondary }]}>
              Day streak
            </Text>
          </View>
        </Animated.View>

        {isLoadingInitial && (
          <View style={styles.centerBlock}>
            <ActivityIndicator size="large" color={palette.primary} />
          </View>
        )}

        {isEmpty && (
          <Animated.View
            entering={FadeInDown.duration(motion.duration.base)}
            style={[
              styles.emptyCard,
              { backgroundColor: palette.surface, borderColor: palette.border },
            ]}
          >
            <View
              style={[
                styles.emptyIcon,
                { backgroundColor: palette.primaryMuted },
              ]}
            >
              <IconSymbol
                name="clock.arrow.circlepath"
                size={28}
                color={palette.primary}
              />
            </View>
            <Text style={[styles.emptyTitle, { color: palette.textPrimary }]}>
              No workouts yet
            </Text>
            <Text style={[styles.emptyBody, { color: palette.textSecondary }]}>
              Finish a session and it&apos;ll show up here.
            </Text>
          </Animated.View>
        )}

        {groups.map((group, groupIndex) => (
          <Animated.View
            key={group.key}
            entering={FadeInDown.delay(groupIndex * 40).duration(
              motion.duration.base,
            )}
            style={styles.group}
          >
            <Text
              style={[styles.groupLabel, { color: palette.textTertiary }]}
            >
              {group.label.toUpperCase()}
            </Text>
            {group.items.map((entry) => {
              const isDiscarded = entry.status === 'discarded'
              return (
                <TouchableOpacity
                  key={entry._id}
                  onPress={() => handleOpenRecap(entry._id)}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={`View recap for ${entry.goal}`}
                  style={[
                    styles.row,
                    {
                      backgroundColor: palette.surface,
                      borderColor: palette.border,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.rowIcon,
                      {
                        backgroundColor: isDiscarded
                          ? palette.dangerMuted
                          : palette.successMuted,
                      },
                    ]}
                  >
                    <IconSymbol
                      name={isDiscarded ? 'trash' : 'checkmark'}
                      size={18}
                      color={isDiscarded ? palette.danger : palette.success}
                    />
                  </View>
                  <View style={styles.rowText}>
                    <Text
                      style={[styles.rowTitle, { color: palette.textPrimary }]}
                      numberOfLines={1}
                    >
                      {entry.goal}
                    </Text>
                    <Text
                      style={[
                        styles.rowMeta,
                        { color: palette.textSecondary },
                      ]}
                      numberOfLines={1}
                    >
                      {entry.modality} {'\u00b7'} {entry.durationMin} min{' '}
                      {'\u00b7'} {entry.setsLogged} sets
                    </Text>
                  </View>
                  {isDiscarded ? (
                    <Text
                      style={[
                        styles.discardedTag,
                        {
                          color: palette.danger,
                          backgroundColor: palette.dangerMuted,
                        },
                      ]}
                    >
                      Discarded
                    </Text>
                  ) : (
                    <IconSymbol
                      name="chevron.right"
                      size={16}
                      color={palette.textTertiary}
                    />
                  )}
                </TouchableOpacity>
              )
            })}
          </Animated.View>
        ))}

        {status === 'CanLoadMore' && (
          <TouchableOpacity
            onPress={() => loadMore(20)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Load more workouts"
            style={[
              styles.loadMore,
              { borderColor: palette.border, backgroundColor: palette.surface },
            ]}
          >
            <Text style={[styles.loadMoreText, { color: palette.primary }]}>
              Load more
            </Text>
          </TouchableOpacity>
        )}

        {status === 'LoadingMore' && (
          <View style={styles.centerBlock}>
            <ActivityIndicator
              size="small"
              color={resolved === 'dark' ? palette.white : palette.primary}
            />
          </View>
        )}

        <View style={styles.bottomSpacing} />
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxxl,
  },
  header: {
    marginBottom: spacing.xl,
  },
  title: {
    ...typography.h1,
  },
  subtitle: {
    ...typography.small,
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  statCard: {
    flex: 1,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    alignItems: 'flex-start',
  },
  statValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  statValue: {
    ...typography.h1,
  },
  statLabel: {
    ...typography.small,
    marginTop: 2,
  },
  centerBlock: {
    paddingVertical: spacing.xxl,
    alignItems: 'center',
  },
  group: {
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  groupLabel: {
    ...typography.caption,
    marginBottom: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
  },
  rowTitle: {
    ...typography.bodyStrong,
  },
  rowMeta: {
    ...typography.small,
    marginTop: 2,
  },
  discardedTag: {
    ...typography.caption,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  emptyCard: {
    alignItems: 'center',
    padding: spacing.xxl,
    borderRadius: radius.xl,
    borderWidth: 1,
    gap: spacing.sm,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  emptyTitle: {
    ...typography.h2,
  },
  emptyBody: {
    ...typography.small,
    textAlign: 'center',
  },
  loadMore: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    marginTop: spacing.sm,
  },
  loadMoreText: {
    ...typography.smallStrong,
  },
  bottomSpacing: {
    height: spacing.huge,
  },
})
