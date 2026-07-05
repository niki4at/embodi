import { useMutation, useQuery } from 'convex/react'
import * as Haptics from 'expo-haptics'
import React, { useEffect, useState } from 'react'
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import Animated, {
  Easing,
  SlideInDown,
  SlideOutDown,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { FLAME_LIT } from '@/components/streak/streak-flame'
import { IconSymbol } from '@/components/ui/icon-symbol'
import { radius, spacing, typography } from '@/constants/design'
import { useTheme } from '@/constants/theme-context'
import { api } from '@/convex/_generated/api'

const GOAL_OPTIONS = [1, 2, 3, 4, 5, 6, 7]

function formatWeekLabel(weekStartMs: number): string {
  const date = new Date(weekStartMs)
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

/**
 * Bottom sheet with the full streak story: current streak, this week's
 * progress toward the goal, the goal picker, and a 12-week history strip.
 */
export function StreakSheet({
  visible,
  onClose,
}: {
  visible: boolean
  onClose: () => void
}) {
  const { palette, shadows } = useTheme()
  const insets = useSafeAreaInsets()

  // Freeze "now" per open so the query stays cacheable while the sheet is up.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (visible) setNow(Date.now())
  }, [visible])
  const streak = useQuery(api.streaks.getMyStreak, visible ? { now } : 'skip')
  const setWeeklyGoal = useMutation(api.streaks.setWeeklyGoal)
  const [savingGoal, setSavingGoal] = useState<number | null>(null)

  const handlePickGoal = async (goal: number) => {
    if (savingGoal !== null || goal === streak?.weeklyGoal) return
    setSavingGoal(goal)
    try {
      await setWeeklyGoal({ goal })
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    } catch (error) {
      console.error('set weekly goal error', error)
    } finally {
      setSavingGoal(null)
    }
  }

  const lit = streak ? streak.goalMetThisWeek : false
  const flameColor = lit ? FLAME_LIT : palette.textTertiary
  const progress = streak
    ? Math.min(1, streak.workoutsThisWeek / Math.max(1, streak.weeklyGoal))
    : 0

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <Animated.View
          entering={SlideInDown.duration(280).easing(
            Easing.bezier(0.22, 1, 0.36, 1),
          )}
          exiting={SlideOutDown.duration(220).easing(
            Easing.bezier(0.4, 0, 1, 1),
          )}
          style={[
            styles.panel,
            shadows.lg,
            {
              paddingBottom: Math.max(insets.bottom, spacing.lg) + spacing.md,
              backgroundColor: palette.bgElevated,
              borderColor: palette.border,
            },
          ]}
        >
          <View
            style={[styles.handle, { backgroundColor: palette.borderStrong }]}
          />

          <View style={styles.hero}>
            <IconSymbol name="flame.fill" size={56} color={flameColor} />
            <Text style={[styles.heroCount, { color: palette.textPrimary }]}>
              {streak?.currentStreakWeeks ?? 0}
            </Text>
            <Text style={[styles.heroLabel, { color: palette.textSecondary }]}>
              week streak
            </Text>
            <Text
              style={[styles.heroCaption, { color: palette.textTertiary }]}
            >
              {streak
                ? lit
                  ? 'Goal met this week — flame is lit!'
                  : `${streak.workoutsThisWeek} of ${streak.weeklyGoal} workouts this week`
                : ' '}
            </Text>
          </View>

          <View
            style={[
              styles.progressTrack,
              { backgroundColor: palette.surfaceAlt },
            ]}
          >
            <View
              style={[
                styles.progressFill,
                {
                  backgroundColor: lit ? FLAME_LIT : palette.primary,
                  width: `${Math.round(progress * 100)}%`,
                },
              ]}
            />
          </View>

          <View style={styles.statsRow}>
            <View
              style={[styles.statBox, { backgroundColor: palette.surfaceAlt }]}
            >
              <Text style={[styles.statValue, { color: palette.textPrimary }]}>
                {streak?.longestStreakWeeks ?? 0}
              </Text>
              <Text style={[styles.statLabel, { color: palette.textTertiary }]}>
                Longest streak
              </Text>
            </View>
            <View
              style={[styles.statBox, { backgroundColor: palette.surfaceAlt }]}
            >
              <Text style={[styles.statValue, { color: palette.textPrimary }]}>
                {streak?.workoutsThisWeek ?? 0}
              </Text>
              <Text style={[styles.statLabel, { color: palette.textTertiary }]}>
                Workouts this week
              </Text>
            </View>
          </View>

          <Text style={[styles.sectionTitle, { color: palette.textPrimary }]}>
            Weekly goal
          </Text>
          <Text style={[styles.sectionHint, { color: palette.textTertiary }]}>
            Hit this many workouts each week to keep the flame alive.
          </Text>
          <View style={styles.goalRow}>
            {GOAL_OPTIONS.map((goal) => {
              const selected = streak?.weeklyGoal === goal
              return (
                <TouchableOpacity
                  key={goal}
                  onPress={() => handlePickGoal(goal)}
                  disabled={savingGoal !== null}
                  style={[
                    styles.goalChip,
                    {
                      backgroundColor: selected
                        ? palette.textPrimary
                        : palette.surfaceAlt,
                      borderColor: selected
                        ? palette.textPrimary
                        : palette.border,
                    },
                  ]}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.goalChipText,
                      { color: selected ? palette.bg : palette.textPrimary },
                    ]}
                  >
                    {goal}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </View>

          <Text style={[styles.sectionTitle, { color: palette.textPrimary }]}>
            Last 12 weeks
          </Text>
          <View style={styles.weeksRow}>
            {(streak?.recentWeeks ?? []).map((week) => (
              <View key={week.weekStartMs} style={styles.weekCell}>
                <IconSymbol
                  name="flame.fill"
                  size={18}
                  color={week.goalMet ? FLAME_LIT : palette.border}
                />
                <Text
                  style={[styles.weekLabel, { color: palette.textTertiary }]}
                  numberOfLines={1}
                >
                  {formatWeekLabel(week.weekStartMs)}
                </Text>
              </View>
            ))}
          </View>
        </Animated.View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  panel: {
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    paddingTop: spacing.md,
    paddingHorizontal: spacing.xl,
    borderTopWidth: 1,
  },
  handle: {
    alignSelf: 'center',
    width: 44,
    height: 4,
    borderRadius: radius.pill,
    marginBottom: spacing.lg,
  },
  hero: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  heroCount: {
    ...typography.display,
    marginTop: spacing.xs,
  },
  heroLabel: {
    ...typography.bodyStrong,
  },
  heroCaption: {
    ...typography.small,
    marginTop: spacing.xs,
  },
  progressTrack: {
    height: 10,
    borderRadius: radius.pill,
    overflow: 'hidden',
    marginBottom: spacing.lg,
  },
  progressFill: {
    height: '100%',
    borderRadius: radius.pill,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  statBox: {
    flex: 1,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
    gap: 2,
  },
  statValue: {
    ...typography.h2,
  },
  statLabel: {
    ...typography.small,
  },
  sectionTitle: {
    ...typography.h3,
    marginBottom: spacing.xs,
  },
  sectionHint: {
    ...typography.small,
    marginBottom: spacing.md,
  },
  goalRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  goalChip: {
    flex: 1,
    height: 40,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalChipText: {
    ...typography.bodyStrong,
  },
  weeksRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  weekCell: {
    alignItems: 'center',
    gap: 2,
    width: `${100 / 12}%`,
  },
  weekLabel: {
    fontSize: 8,
  },
})
