import * as Haptics from 'expo-haptics'
import React from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'

import { motion, radius, spacing, typography } from '@/constants/design'
import { useTheme } from '@/constants/theme-context'

const BODY_AREAS = [
  { id: 'neck', label: 'Neck' },
  { id: 'shoulders', label: 'Shoulders' },
  { id: 'upper-back', label: 'Upper back' },
  { id: 'lower-back', label: 'Lower back' },
  { id: 'hips', label: 'Hips' },
  { id: 'knees', label: 'Knees' },
  { id: 'ankles', label: 'Ankles' },
  { id: 'wrists', label: 'Wrists' },
] as const

type BodyAreaId = (typeof BODY_AREAS)[number]['id']

interface BodyAreaSelectorProps {
  title: string
  subtitle?: string
  selectedAreas: string[]
  onChange: (areas: string[]) => void
  delay?: number
}

export default function BodyAreaSelector({
  title,
  subtitle,
  selectedAreas,
  onChange,
  delay = 0,
}: BodyAreaSelectorProps) {
  const { palette } = useTheme()

  const toggleArea = (areaId: BodyAreaId) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    if (selectedAreas.includes(areaId)) {
      onChange(selectedAreas.filter(id => id !== areaId))
    } else {
      onChange([...selectedAreas, areaId])
    }
  }

  return (
    <Animated.View
      entering={FadeInDown.delay(delay).duration(motion.duration.base)}
      style={styles.container}
    >
      <Text style={[styles.title, { color: palette.textPrimary }]}>{title}</Text>
      {subtitle ? (
        <Text style={[styles.subtitle, { color: palette.textSecondary }]}>
          {subtitle}
        </Text>
      ) : null}

      <View style={styles.grid}>
        {BODY_AREAS.map(area => {
          const isSelected = selectedAreas.includes(area.id)
          return (
            <TouchableOpacity
              key={area.id}
              style={[
                styles.chip,
                {
                  backgroundColor: isSelected
                    ? palette.dangerMuted
                    : palette.surface,
                  borderColor: isSelected ? palette.danger : palette.border,
                },
              ]}
              onPress={() => toggleArea(area.id)}
              activeOpacity={0.85}
            >
              <Text
                style={[
                  styles.chipLabel,
                  {
                    color: isSelected ? palette.danger : palette.textSecondary,
                  },
                ]}
              >
                {area.label}
              </Text>
            </TouchableOpacity>
          )
        })}
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.xxl,
  },
  title: {
    ...typography.h3,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.small,
    marginBottom: spacing.md,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  chipLabel: {
    ...typography.smallStrong,
  },
})
