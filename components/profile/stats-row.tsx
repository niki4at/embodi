import React from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'

import { IconSymbol } from '@/components/ui/icon-symbol'
import { FLAME_LIT } from '@/components/streak/streak-flame'
import { radius, spacing, typography } from '@/constants/design'
import { useTheme } from '@/constants/theme-context'

export interface ProfileStats {
  totalWorkouts: number
  minutesThisMonth: number
  streakWeeks: number
  goalMetThisWeek: boolean
}

interface StatsRowProps {
  stats: ProfileStats
  onStreakPress: () => void
}

/** Training-first headline metrics: workouts, minutes this month, streak. */
export function StatsRow({ stats, onStreakPress }: StatsRowProps) {
  const { palette } = useTheme()

  return (
    <View style={styles.row}>
      <View
        style={[
          styles.card,
          { backgroundColor: palette.surface, borderColor: palette.border },
        ]}
      >
        <Text style={[styles.value, { color: palette.textPrimary }]}>
          {stats.totalWorkouts}
        </Text>
        <Text style={[styles.label, { color: palette.textSecondary }]}>
          Workouts
        </Text>
      </View>
      <View
        style={[
          styles.card,
          { backgroundColor: palette.surface, borderColor: palette.border },
        ]}
      >
        <Text style={[styles.value, { color: palette.textPrimary }]}>
          {stats.minutesThisMonth}
        </Text>
        <Text style={[styles.label, { color: palette.textSecondary }]}>
          Min this month
        </Text>
      </View>
      <TouchableOpacity
        onPress={onStreakPress}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={`${stats.streakWeeks}-week streak. Open streak details.`}
        style={[
          styles.card,
          { backgroundColor: palette.surface, borderColor: palette.border },
        ]}
      >
        <View style={styles.streakValueRow}>
          <IconSymbol
            name="flame.fill"
            size={16}
            color={stats.goalMetThisWeek ? FLAME_LIT : palette.textTertiary}
          />
          <Text style={[styles.value, { color: palette.textPrimary }]}>
            {stats.streakWeeks}
          </Text>
        </View>
        <Text style={[styles.label, { color: palette.textSecondary }]}>
          Week streak
        </Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xl,
  },
  card: {
    flex: 1,
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    gap: 2,
  },
  streakValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  value: {
    fontFamily: typography.h2.fontFamily,
    fontSize: 22,
    lineHeight: 28,
  },
  label: {
    ...typography.small,
    fontSize: 12,
    textAlign: 'center',
  },
})
