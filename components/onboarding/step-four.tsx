import React from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'

import { motion, spacing } from '@/constants/design'
import {
  FieldLabel,
  InfoBanner,
  OptionRow,
  PrimaryButton,
  SecondaryButton,
  StepHeader,
  ToggleRow,
} from './primitives'
import { OnboardingData } from './onboarding-screen'

interface StepFourProps {
  data: OnboardingData
  updateData: (updates: Partial<OnboardingData>) => void
  onNext: () => void
  onSkip: () => void
  onBack: () => void
}

const smokingOptions = [
  { id: 'never', label: 'Never' },
  { id: 'former', label: 'Former smoker' },
  { id: 'current', label: 'Current smoker' },
] as const

const alcoholOptions = [
  { id: 'never', label: 'Never' },
  { id: 'occasionally', label: 'Occasionally' },
  { id: 'regularly', label: 'Regularly' },
] as const

export default function StepFour({
  data,
  updateData,
  onNext,
  onBack,
}: StepFourProps) {
  const showPeriodTracker = data.gender === 'female'

  return (
    <View style={styles.container}>
      <Animated.View entering={FadeInDown.duration(motion.duration.base)}>
        <StepHeader
          title="Almost there"
          subtitle="A few more details to fine-tune recovery and energy."
        />
      </Animated.View>

      <Animated.View
        entering={FadeInDown.delay(60).duration(motion.duration.base)}
        style={styles.field}
      >
        <FieldLabel label="Smoking" />
        <View style={styles.optionsCol}>
          {smokingOptions.map(option => (
            <OptionRow
              key={option.id}
              label={option.label}
              selected={data.smoking === option.id}
              onPress={() => updateData({ smoking: option.id })}
            />
          ))}
        </View>
      </Animated.View>

      <Animated.View
        entering={FadeInDown.delay(120).duration(motion.duration.base)}
        style={styles.field}
      >
        <FieldLabel label="Alcohol" />
        <View style={styles.optionsCol}>
          {alcoholOptions.map(option => (
            <OptionRow
              key={option.id}
              label={option.label}
              selected={data.alcohol === option.id}
              onPress={() => updateData({ alcohol: option.id })}
            />
          ))}
        </View>
      </Animated.View>

      {showPeriodTracker && (
        <Animated.View
          entering={FadeInDown.delay(180).duration(motion.duration.base)}
          style={styles.field}
        >
          <ToggleRow
            label="Track menstrual cycle"
            description="Optimize training around your cycle"
            selected={data.trackPeriod}
            onPress={() => updateData({ trackPeriod: !data.trackPeriod })}
          />
        </Animated.View>
      )}

      <Animated.View entering={FadeInDown.delay(240).duration(motion.duration.base)}>
        <InfoBanner>
          All health data is encrypted and never shared without your consent.
        </InfoBanner>
      </Animated.View>

      <View style={styles.spacer} />

      <Animated.View
        entering={FadeInDown.delay(300).duration(motion.duration.base)}
        style={styles.actions}
      >
        <View style={styles.backWrap}>
          <SecondaryButton label="Back" onPress={onBack} />
        </View>
        <View style={styles.nextWrap}>
          <PrimaryButton label="Complete" onPress={onNext} />
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
