import React, { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'

import { motion, spacing } from '@/constants/design'
import {
  FieldLabel,
  Input,
  OptionRow,
  PrimaryButton,
  StepHeader,
} from './primitives'
import { OnboardingData } from './onboarding-screen'

interface StepOneProps {
  data: OnboardingData
  updateData: (updates: Partial<OnboardingData>) => void
  onNext: () => void
  onSkip: () => void
}

export default function StepOne({
  data,
  updateData,
  onNext,
}: StepOneProps) {
  const [nameFocused, setNameFocused] = useState(false)
  const [ageFocused, setAgeFocused] = useState(false)

  const canProceed =
    data.name.trim().length > 0 && data.age.trim().length > 0

  return (
    <View style={styles.container}>
      <Animated.View entering={FadeInDown.duration(motion.duration.base)}>
        <StepHeader
          title="Tell us about yourself"
          subtitle="Quick basics so we can shape your plan."
        />
      </Animated.View>

      <Animated.View
        entering={FadeInDown.delay(60).duration(motion.duration.base)}
        style={styles.field}
      >
        <FieldLabel label="Name" />
        <Input
          focused={nameFocused}
          onFocusChange={setNameFocused}
          placeholder="Your name"
          value={data.name}
          onChangeText={text => updateData({ name: text })}
          autoCapitalize="words"
          autoComplete="name"
        />
      </Animated.View>

      <Animated.View
        entering={FadeInDown.delay(120).duration(motion.duration.base)}
        style={styles.field}
      >
        <FieldLabel label="Age" />
        <Input
          focused={ageFocused}
          onFocusChange={setAgeFocused}
          placeholder="Years"
          value={data.age}
          onChangeText={text => updateData({ age: text.replace(/[^0-9]/g, '') })}
          keyboardType="number-pad"
          maxLength={3}
        />
      </Animated.View>

      <Animated.View
        entering={FadeInDown.delay(180).duration(motion.duration.base)}
        style={styles.field}
      >
        <FieldLabel label="Gender" />
        <View style={styles.options}>
          <OptionRow
            label="Male"
            selected={data.gender === 'male'}
            onPress={() => updateData({ gender: 'male' })}
          />
          <OptionRow
            label="Female"
            selected={data.gender === 'female'}
            onPress={() => updateData({ gender: 'female' })}
          />
          <OptionRow
            label="Prefer not to say"
            selected={data.gender === 'prefer-not-to-say'}
            onPress={() => updateData({ gender: 'prefer-not-to-say' })}
          />
        </View>
      </Animated.View>

      <View style={styles.spacer} />

      <Animated.View entering={FadeInDown.delay(240).duration(motion.duration.base)}>
        <PrimaryButton
          label="Continue"
          onPress={onNext}
          disabled={!canProceed}
        />
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
  options: {
    gap: spacing.md,
  },
  spacer: {
    flex: 1,
    minHeight: spacing.xl,
  },
})
