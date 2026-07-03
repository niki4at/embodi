import * as Haptics from 'expo-haptics'
import React from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'

import { motion, radius, spacing, typography } from '@/constants/design'
import { useTheme } from '@/constants/theme-context'

export interface MultiChoiceOption {
  value: string
  label: string
  emoji?: string
}

interface CheckInMultiChoiceProps {
  title: string
  subtitle?: string
  options: MultiChoiceOption[]
  selected: string[]
  onChange: (selected: string[]) => void
  delay?: number
}

export default function CheckInMultiChoice({
  title,
  subtitle,
  options,
  selected,
  onChange,
  delay = 0,
}: CheckInMultiChoiceProps) {
  const { palette } = useTheme()

  const toggle = (value: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onChange(
      selected.includes(value)
        ? selected.filter(v => v !== value)
        : [...selected, value]
    )
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
        {options.map(option => {
          const isSelected = selected.includes(option.value)
          return (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.chip,
                {
                  backgroundColor: isSelected
                    ? palette.primaryMuted
                    : palette.surface,
                  borderColor: isSelected ? palette.primary : palette.border,
                },
              ]}
              onPress={() => toggle(option.value)}
              activeOpacity={0.85}
            >
              <Text
                style={[
                  styles.chipLabel,
                  {
                    color: isSelected ? palette.primary : palette.textSecondary,
                  },
                ]}
              >
                {option.emoji ? `${option.emoji} ` : ''}
                {option.label}
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
