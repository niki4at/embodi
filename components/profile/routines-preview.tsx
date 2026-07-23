import * as Haptics from 'expo-haptics'
import { router, type Href } from 'expo-router'
import React, { useCallback } from 'react'
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'

import { IconSymbol } from '@/components/ui/icon-symbol'
import { radius, spacing, typography } from '@/constants/design'
import { useTheme } from '@/constants/theme-context'
import type { Id } from '@/convex/_generated/dataModel'

export interface RoutinePreview {
  _id: Id<'workout_routines'>
  name: string
  modality: string
  durationMin: number
  exerciseCount: number
}

/** Horizontal strip of saved routines; tapping opens the routines screen. */
export function RoutinesPreview({ routines }: { routines: RoutinePreview[] }) {
  const { palette } = useTheme()

  const handleOpen = useCallback(() => {
    Haptics.selectionAsync()
    router.push('/routines' as Href)
  }, [])

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {routines.map((routine) => (
        <TouchableOpacity
          key={routine._id}
          onPress={handleOpen}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={`Routine ${routine.name}`}
          style={[
            styles.chip,
            { backgroundColor: palette.surface, borderColor: palette.border },
          ]}
        >
          <View style={[styles.icon, { backgroundColor: palette.primaryMuted }]}>
            <IconSymbol name="repeat" size={16} color={palette.primary} />
          </View>
          <Text
            style={[styles.title, { color: palette.textPrimary }]}
            numberOfLines={1}
          >
            {routine.name}
          </Text>
          <Text
            style={[styles.meta, { color: palette.textSecondary }]}
            numberOfLines={1}
          >
            {routine.exerciseCount}{' '}
            {routine.exerciseCount === 1 ? 'move' : 'moves'} ·{' '}
            {routine.durationMin} min
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  row: {
    gap: spacing.md,
    paddingRight: spacing.xs,
  },
  chip: {
    width: 150,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
    gap: 2,
  },
  icon: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  title: {
    ...typography.bodyStrong,
    fontSize: 14,
  },
  meta: {
    ...typography.small,
    fontSize: 12,
  },
})
