import { useQuery } from 'convex/react'
import React, { useEffect, useRef, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'

import { motion, spacing, typography } from '@/constants/design'
import { useTheme } from '@/constants/theme-context'
import { api } from '@/convex/_generated/api'
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

function suggestHandle(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 16)
}

export default function StepOne({
  data,
  updateData,
  onNext,
}: StepOneProps) {
  const { palette } = useTheme()
  const [nameFocused, setNameFocused] = useState(false)
  const [usernameFocused, setUsernameFocused] = useState(false)
  const [ageFocused, setAgeFocused] = useState(false)
  const usernameTouched = useRef(false)
  const [debouncedUsername, setDebouncedUsername] = useState('')

  // Keep suggesting a handle from the name until the user edits it directly.
  useEffect(() => {
    if (!usernameTouched.current) {
      updateData({ username: suggestHandle(data.name) })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.name])

  useEffect(() => {
    const timeout = setTimeout(
      () => setDebouncedUsername(data.username.trim().toLowerCase()),
      350
    )
    return () => clearTimeout(timeout)
  }, [data.username])

  const availability = useQuery(
    api.profiles.checkUsernameAvailable,
    debouncedUsername.length >= 3 ? { username: debouncedUsername } : 'skip'
  )
  const usernameOk =
    debouncedUsername.length >= 3 && availability?.available === true

  const canProceed =
    data.name.trim().length > 0 && data.age.trim().length > 0 && usernameOk

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
        entering={FadeInDown.delay(90).duration(motion.duration.base)}
        style={styles.field}
      >
        <FieldLabel
          label="Handle"
          hint="How friends find you on Embodi"
        />
        <Input
          focused={usernameFocused}
          onFocusChange={setUsernameFocused}
          placeholder="yourhandle"
          value={data.username}
          onChangeText={(text) => {
            usernameTouched.current = true
            updateData({
              username: text.toLowerCase().replace(/[^a-z0-9_]/g, ''),
            })
          }}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={20}
        />
        {data.username.length >= 3 &&
        debouncedUsername === data.username.trim().toLowerCase() &&
        availability ? (
          <Text
            style={[
              styles.availability,
              {
                color: availability.available
                  ? palette.success
                  : palette.danger,
              },
            ]}
          >
            {availability.available
              ? `@${data.username} is yours`
              : (availability.reason ?? 'That handle is taken')}
          </Text>
        ) : null}
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
  availability: {
    ...typography.small,
    marginTop: spacing.xs,
  },
  spacer: {
    flex: 1,
    minHeight: spacing.xl,
  },
})
