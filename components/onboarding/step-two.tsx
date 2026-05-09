import React, { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'

import { motion, spacing } from '@/constants/design'
import {
  Chip,
  FieldLabel,
  Input,
  OptionRow,
  PrimaryButton,
  SecondaryButton,
  StepHeader,
} from './primitives'
import { OnboardingData } from './onboarding-screen'

interface StepTwoProps {
  data: OnboardingData
  updateData: (updates: Partial<OnboardingData>) => void
  onNext: () => void
  onSkip: () => void
  onBack: () => void
}

const activityLevels = [
  { id: 'sedentary', label: 'Sedentary', description: 'Little to no exercise' },
  { id: 'light', label: 'Light', description: '1–2 days per week' },
  { id: 'moderate', label: 'Moderate', description: '3–4 days per week' },
  { id: 'active', label: 'Active', description: '5–6 days per week' },
  { id: 'very-active', label: 'Very active', description: 'Daily exercise' },
] as const

const timeOptions = [
  { id: '15min', label: '15 min' },
  { id: '30min', label: '30 min' },
  { id: '45min', label: '45 min' },
  { id: '60min', label: '60 min' },
  { id: '90min+', label: '90+ min' },
]

export default function StepTwo({
  data,
  updateData,
  onNext,
  onBack,
}: StepTwoProps) {
  const [goalFocused, setGoalFocused] = useState(false)

  const canProceed =
    data.goal.trim().length > 0 && data.activityLevel !== null

  const toggleTime = (id: string) => {
    const current = data.timeAvailable
    if (current.includes(id)) {
      updateData({ timeAvailable: current.filter(t => t !== id) })
    } else {
      updateData({ timeAvailable: [...current, id] })
    }
  }

  return (
    <View style={styles.container}>
      <Animated.View entering={FadeInDown.duration(motion.duration.base)}>
        <StepHeader
          title="Your fitness journey"
          subtitle="Help us shape a plan around your goals and schedule."
        />
      </Animated.View>

      <Animated.View
        entering={FadeInDown.delay(60).duration(motion.duration.base)}
        style={styles.field}
      >
        <FieldLabel label="Main goal" />
        <Input
          focused={goalFocused}
          onFocusChange={setGoalFocused}
          placeholder="Run a 5k, move pain-free, build strength"
          value={data.goal}
          onChangeText={text => updateData({ goal: text })}
          multiline
        />
      </Animated.View>

      <Animated.View
        entering={FadeInDown.delay(120).duration(motion.duration.base)}
        style={styles.field}
      >
        <FieldLabel label="Current activity level" />
        <View style={styles.optionsCol}>
          {activityLevels.map(level => (
            <OptionRow
              key={level.id}
              label={level.label}
              description={level.description}
              selected={data.activityLevel === level.id}
              onPress={() => updateData({ activityLevel: level.id })}
            />
          ))}
        </View>
      </Animated.View>

      <Animated.View
        entering={FadeInDown.delay(180).duration(motion.duration.base)}
        style={styles.field}
      >
        <FieldLabel
          label="Time per session"
          hint="Pick all that work for you"
        />
        <View style={styles.chipsRow}>
          {timeOptions.map(time => (
            <Chip
              key={time.id}
              label={time.label}
              selected={data.timeAvailable.includes(time.id)}
              onPress={() => toggleTime(time.id)}
            />
          ))}
        </View>
      </Animated.View>

      <View style={styles.spacer} />

      <Animated.View
        entering={FadeInDown.delay(240).duration(motion.duration.base)}
        style={styles.actions}
      >
        <View style={styles.backWrap}>
          <SecondaryButton label="Back" onPress={onBack} />
        </View>
        <View style={styles.nextWrap}>
          <PrimaryButton
            label="Continue"
            onPress={onNext}
            disabled={!canProceed}
          />
        </View>
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  field: {
    marginBottom: spacing.xl,
  },
  optionsCol: {
    gap: spacing.sm,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  spacer: {
    flex: 1,
    minHeight: spacing.xl,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  backWrap: {
    width: 110,
  },
  nextWrap: {
    flex: 1,
  },
})
