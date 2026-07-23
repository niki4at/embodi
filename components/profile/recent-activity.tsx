import * as Haptics from 'expo-haptics'
import { router, type Href } from 'expo-router'
import React, { useCallback } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'

import { IconSymbol } from '@/components/ui/icon-symbol'
import { radius, spacing, typography } from '@/constants/design'
import { useTheme } from '@/constants/theme-context'
import type { Id } from '@/convex/_generated/dataModel'

export interface RecentWorkout {
  _id: Id<'workout_sessions'>
  goal: string
  modality: string
  durationMin: number
  setsLogged: number
  completedAt: number
}

function formatWhen(ms: number): string {
  const date = new Date(ms)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const dayStart = new Date(date)
  dayStart.setHours(0, 0, 0, 0)
  const diffDays = Math.round((today.getTime() - dayStart.getTime()) / 86400000)
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

/** The last few completed workouts, each opening its recap. */
export function RecentActivity({ workouts }: { workouts: RecentWorkout[] }) {
  const { palette } = useTheme()

  const handleOpen = useCallback((sessionId: Id<'workout_sessions'>) => {
    Haptics.selectionAsync()
    router.push({
      pathname: '/session/recap',
      params: { sessionId: String(sessionId) },
    } as unknown as Href)
  }, [])

  return (
    <View style={styles.list}>
      {workouts.map((workout) => (
        <TouchableOpacity
          key={workout._id}
          onPress={() => handleOpen(workout._id)}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={`${workout.goal}, ${formatWhen(workout.completedAt)}`}
          style={[
            styles.row,
            { backgroundColor: palette.surface, borderColor: palette.border },
          ]}
        >
          <View style={[styles.icon, { backgroundColor: palette.successMuted }]}>
            <IconSymbol name="checkmark" size={16} color={palette.success} />
          </View>
          <View style={styles.text}>
            <Text
              style={[styles.title, { color: palette.textPrimary }]}
              numberOfLines={1}
            >
              {workout.goal}
            </Text>
            <Text
              style={[styles.meta, { color: palette.textSecondary }]}
              numberOfLines={1}
            >
              {formatWhen(workout.completedAt)} · {workout.modality} ·{' '}
              {workout.durationMin} min
            </Text>
          </View>
          <IconSymbol
            name="chevron.right"
            size={16}
            color={palette.textTertiary}
          />
        </TouchableOpacity>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    flex: 1,
  },
  title: {
    ...typography.bodyStrong,
  },
  meta: {
    ...typography.small,
    marginTop: 1,
  },
})
