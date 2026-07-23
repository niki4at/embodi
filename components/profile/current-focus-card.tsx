import * as Haptics from 'expo-haptics'
import { router, type Href } from 'expo-router'
import React, { useCallback } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'

import { IconSymbol } from '@/components/ui/icon-symbol'
import { radius, spacing, typography } from '@/constants/design'
import { useTheme } from '@/constants/theme-context'
import type { Id } from '@/convex/_generated/dataModel'

export interface CurrentFocus {
  _id: Id<'challenges'>
  title: string
  category: string
  targetDate: number | null
  weekCount: number
}

interface CurrentFocusCardProps {
  focus: CurrentFocus | null
  weeklyGoal: number
  workoutsThisWeek: number
}

function formatTargetDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
  })
}

/**
 * Adaptive "current focus": the active challenge when one exists, otherwise
 * progress toward this week's workout goal.
 */
export function CurrentFocusCard({
  focus,
  weeklyGoal,
  workoutsThisWeek,
}: CurrentFocusCardProps) {
  const { palette } = useTheme()

  const handlePress = useCallback(() => {
    Haptics.selectionAsync()
    if (focus) {
      router.push({
        pathname: '/challenge/[id]',
        params: { id: String(focus._id) },
      } as unknown as Href)
    } else {
      router.push('/(tabs)/challenges' as Href)
    }
  }, [focus])

  const title = focus ? focus.title : 'This week'
  const subtitle = focus
    ? [
        focus.weekCount > 0 ? `${focus.weekCount}-week program` : null,
        focus.targetDate ? `target ${formatTargetDate(focus.targetDate)}` : null,
      ]
        .filter(Boolean)
        .join(' · ') || 'Active challenge'
    : `${workoutsThisWeek} of ${weeklyGoal} workouts done`

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={`Current focus: ${title}. ${subtitle}`}
      style={[
        styles.card,
        { backgroundColor: palette.surface, borderColor: palette.border },
      ]}
    >
      <View style={[styles.icon, { backgroundColor: palette.primaryMuted }]}>
        <IconSymbol
          name={focus ? 'target' : 'flag.fill'}
          size={18}
          color={palette.primary}
        />
      </View>
      <View style={styles.text}>
        <Text
          style={[styles.title, { color: palette.textPrimary }]}
          numberOfLines={1}
        >
          {title}
        </Text>
        <Text
          style={[styles.subtitle, { color: palette.textSecondary }]}
          numberOfLines={1}
        >
          {subtitle}
        </Text>
      </View>
      <IconSymbol name="chevron.right" size={16} color={palette.textTertiary} />
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  icon: {
    width: 38,
    height: 38,
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
  subtitle: {
    ...typography.small,
    marginTop: 1,
  },
})
