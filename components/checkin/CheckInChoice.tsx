import * as Haptics from 'expo-haptics'
import React from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'

import { motion, radius, spacing, typography } from '@/constants/design'
import { useTheme } from '@/constants/theme-context'

export interface ChoiceOption<T extends string> {
  value: T
  label: string
  emoji?: string
  description?: string
}

interface CheckInChoiceProps<T extends string> {
  title: string
  subtitle?: string
  options: ChoiceOption<T>[]
  value: T | null
  onChange: (value: T) => void
  columns?: 1 | 2 | 3
  delay?: number
}

export default function CheckInChoice<T extends string>({
  title,
  subtitle,
  options,
  value,
  onChange,
  columns = 2,
  delay = 0,
}: CheckInChoiceProps<T>) {
  const { palette } = useTheme()

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
          const isSelected = value === option.value
          return (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.option,
                columns === 1 && styles.optionFull,
                columns === 2 && styles.optionHalf,
                columns === 3 && styles.optionThird,
                {
                  backgroundColor: isSelected
                    ? palette.primaryMuted
                    : palette.surface,
                  borderColor: isSelected ? palette.primary : palette.border,
                },
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                onChange(option.value)
              }}
              activeOpacity={0.85}
            >
              {option.emoji ? (
                <Text style={styles.emoji}>{option.emoji}</Text>
              ) : null}
              <Text
                style={[
                  styles.optionLabel,
                  { color: isSelected ? palette.primary : palette.textPrimary },
                ]}
              >
                {option.label}
              </Text>
              {option.description ? (
                <Text
                  style={[
                    styles.optionDescription,
                    {
                      color: isSelected ? palette.primary : palette.textTertiary,
                    },
                  ]}
                >
                  {option.description}
                </Text>
              ) : null}
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
    gap: spacing.md,
  },
  option: {
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    flexGrow: 1,
  },
  optionFull: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'flex-start',
    gap: spacing.md,
    alignItems: 'center',
  },
  optionHalf: {
    minWidth: '47%',
  },
  optionThird: {
    minWidth: '30%',
  },
  emoji: {
    fontSize: 22,
    marginBottom: spacing.sm,
  },
  optionLabel: {
    ...typography.bodyStrong,
    textAlign: 'center',
  },
  optionDescription: {
    ...typography.small,
    textAlign: 'center',
    marginTop: 2,
  },
})
