import React, { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'

import { motion, spacing } from '@/constants/design'
import {
  Chip,
  FieldLabel,
  InfoBanner,
  Input,
  PrimaryButton,
  SecondaryButton,
  StepHeader,
} from './primitives'
import { OnboardingData } from './onboarding-screen'

interface StepThreeProps {
  data: OnboardingData
  updateData: (updates: Partial<OnboardingData>) => void
  onNext: () => void
  onSkip: () => void
  onBack: () => void
}

const commonInjuries = [
  'Lower back',
  'Knee',
  'Shoulder',
  'Hip',
  'Ankle / foot',
  'Neck',
  'Wrist / elbow',
]

const commonConditions = [
  'Asthma',
  'High blood pressure',
  'Diabetes',
  'Arthritis',
  'Heart condition',
  'Chronic pain',
  'Other',
]

export default function StepThree({
  data,
  updateData,
  onNext,
  onBack,
}: StepThreeProps) {
  const [medsFocused, setMedsFocused] = useState(false)

  const toggle = (
    key: 'injuries' | 'conditions',
    value: string,
  ) => {
    const current = data[key]
    if (current.includes(value)) {
      updateData({ [key]: current.filter(v => v !== value) } as Partial<OnboardingData>)
    } else {
      updateData({ [key]: [...current, value] } as Partial<OnboardingData>)
    }
  }

  return (
    <View style={styles.container}>
      <Animated.View entering={FadeInDown.duration(motion.duration.base)}>
        <StepHeader
          title="Your health context"
          subtitle="This shapes a safer plan. Everything is optional and private."
        />
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(40).duration(motion.duration.base)}>
        <InfoBanner>
          We use this to filter out movements that won&apos;t serve you, not to
          diagnose anything.
        </InfoBanner>
      </Animated.View>

      <Animated.View
        entering={FadeInDown.delay(100).duration(motion.duration.base)}
        style={styles.field}
      >
        <FieldLabel
          label="Areas of discomfort"
          hint="Past or current — pick all that apply"
        />
        <View style={styles.chipsRow}>
          {commonInjuries.map(injury => (
            <Chip
              key={injury}
              label={injury}
              selected={data.injuries.includes(injury)}
              onPress={() => toggle('injuries', injury)}
            />
          ))}
        </View>
      </Animated.View>

      <Animated.View
        entering={FadeInDown.delay(160).duration(motion.duration.base)}
        style={styles.field}
      >
        <FieldLabel
          label="Health conditions"
          hint="Pick all that apply"
        />
        <View style={styles.chipsRow}>
          {commonConditions.map(condition => (
            <Chip
              key={condition}
              label={condition}
              selected={data.conditions.includes(condition)}
              onPress={() => toggle('conditions', condition)}
            />
          ))}
        </View>
      </Animated.View>

      <Animated.View
        entering={FadeInDown.delay(220).duration(motion.duration.base)}
        style={styles.field}
      >
        <FieldLabel label="Current medications" hint="Optional" />
        <Input
          focused={medsFocused}
          onFocusChange={setMedsFocused}
          placeholder="Anything we should be aware of"
          value={data.medications}
          onChangeText={text => updateData({ medications: text })}
          multiline
        />
      </Animated.View>

      <View style={styles.spacer} />

      <Animated.View
        entering={FadeInDown.delay(280).duration(motion.duration.base)}
        style={styles.actions}
      >
        <View style={styles.backWrap}>
          <SecondaryButton label="Back" onPress={onBack} />
        </View>
        <View style={styles.nextWrap}>
          <PrimaryButton label="Continue" onPress={onNext} />
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
