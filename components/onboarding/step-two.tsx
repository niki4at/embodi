import React, { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Pressable,
} from 'react-native'
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated'
import { LinearGradient } from 'expo-linear-gradient'
import * as Haptics from 'expo-haptics'
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
  { id: 'light', label: 'Light', description: '1-2 days per week' },
  { id: 'moderate', label: 'Moderate', description: '3-4 days per week' },
  { id: 'active', label: 'Active', description: '5-6 days per week' },
  { id: 'very-active', label: 'Very Active', description: 'Daily exercise' },
] as const

const timeOptions = [
  { id: '15min', label: '15 min' },
  { id: '30min', label: '30 min' },
  { id: '45min', label: '45 min' },
  { id: '60min', label: '60 min' },
  { id: '90min+', label: '90+ min' },
]

export default function StepTwo({ data, updateData, onNext, onSkip, onBack }: StepTwoProps) {
  const [goalFocused, setGoalFocused] = useState(false)
  const buttonScale = useSharedValue(1)

  const buttonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }))

  const handleButtonPressIn = () => {
    buttonScale.value = withSpring(0.96)
  }

  const handleButtonPressOut = () => {
    buttonScale.value = withSpring(1)
  }

  const handleActivitySelect = (level: typeof activityLevels[number]['id']) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    updateData({ activityLevel: level })
  }

  const handleTimeSelect = (time: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    const current = data.timeAvailable
    if (current.includes(time)) {
      updateData({ timeAvailable: current.filter((t) => t !== time) })
    } else {
      updateData({ timeAvailable: [...current, time] })
    }
  }

  const canProceed = data.goal.trim().length > 0 && data.activityLevel !== null

  return (
    <View style={styles.container}>
      <Animated.View entering={FadeInDown.delay(100).duration(600).springify()}>
        <Text style={styles.title}>Your fitness journey</Text>
        <Text style={styles.subtitle}>
          Help us understand your goals so we can create a training plan that meets your body where it is
        </Text>
      </Animated.View>

      {/* Goal Input */}
      <Animated.View
        entering={FadeInDown.delay(200).duration(600).springify()}
        style={styles.inputWrapper}
      >
        <Text style={styles.label}>What is your main goal?</Text>
        <View style={[styles.inputContainer, goalFocused && styles.inputContainerFocused]}>
          <TextInput
            style={styles.input}
            placeholder="e.g., Run a 5k, Move pain-free, Build strength"
            placeholderTextColor="#9ca3af"
            value={data.goal}
            onChangeText={(text) => updateData({ goal: text })}
            onFocus={() => {
              setGoalFocused(true)
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
            }}
            onBlur={() => setGoalFocused(false)}
            multiline
          />
        </View>
      </Animated.View>

      {/* Activity Level */}
      <Animated.View
        entering={FadeInDown.delay(300).duration(600).springify()}
        style={styles.sectionWrapper}
      >
        <Text style={styles.label}>Current activity level</Text>
        <View style={styles.activityOptions}>
          {activityLevels.map((level, index) => (
            <TouchableOpacity
              key={level.id}
              style={[
                styles.activityOption,
                data.activityLevel === level.id && styles.activityOptionSelected,
              ]}
              onPress={() => handleActivitySelect(level.id)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.activityLabel,
                  data.activityLevel === level.id && styles.activityLabelSelected,
                ]}
              >
                {level.label}
              </Text>
              <Text
                style={[
                  styles.activityDescription,
                  data.activityLevel === level.id && styles.activityDescriptionSelected,
                ]}
              >
                {level.description}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </Animated.View>

      {/* Time Available */}
      <Animated.View
        entering={FadeInDown.delay(400).duration(600).springify()}
        style={styles.sectionWrapper}
      >
        <Text style={styles.label}>Time available per session</Text>
        <Text style={styles.hint}>Select all that work for you</Text>
        <View style={styles.timeOptions}>
          {timeOptions.map((time) => (
            <TouchableOpacity
              key={time.id}
              style={[
                styles.timeChip,
                data.timeAvailable.includes(time.id) && styles.timeChipSelected,
              ]}
              onPress={() => handleTimeSelect(time.id)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.timeChipText,
                  data.timeAvailable.includes(time.id) && styles.timeChipTextSelected,
                ]}
              >
                {time.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </Animated.View>

      {/* Spacer */}
      <View style={styles.spacer} />

      {/* Buttons */}
      <View style={styles.buttonsContainer}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>

        <Animated.View style={[styles.nextButtonWrapper, buttonAnimatedStyle]}>
          <Pressable
            onPress={onNext}
            onPressIn={handleButtonPressIn}
            onPressOut={handleButtonPressOut}
            disabled={!canProceed}
          >
            <LinearGradient
              colors={canProceed ? ['#6366f1', '#4f46e5'] : ['#d1d5db', '#9ca3af']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.nextButton}
            >
              <Text style={styles.nextButtonText}>Next</Text>
            </LinearGradient>
          </Pressable>
        </Animated.View>
      </View>

      <TouchableOpacity onPress={onSkip} style={styles.skipButton}>
        <Text style={styles.skipButtonText}>Skip this step</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#f97316',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#6b7280',
    marginBottom: 24,
    lineHeight: 22,
  },
  inputWrapper: {
    marginBottom: 24,
  },
  label: {
    fontSize: 15,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  hint: {
    fontSize: 13,
    color: '#9ca3af',
    marginBottom: 12,
  },
  inputContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 54,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  inputContainerFocused: {
    borderColor: '#6366f1',
    shadowColor: '#6366f1',
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  input: {
    fontSize: 16,
    color: '#1f2937',
    fontWeight: '400',
  },
  sectionWrapper: {
    marginBottom: 24,
  },
  activityOptions: {
    gap: 10,
  },
  activityOption: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    paddingHorizontal: 16,
    paddingVertical: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  activityOptionSelected: {
    borderColor: '#6366f1',
    backgroundColor: '#eef2ff',
  },
  activityLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 2,
  },
  activityLabelSelected: {
    color: '#4f46e5',
  },
  activityDescription: {
    fontSize: 13,
    color: '#9ca3af',
  },
  activityDescriptionSelected: {
    color: '#818cf8',
  },
  timeOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  timeChip: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    paddingHorizontal: 20,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  timeChipSelected: {
    borderColor: '#6366f1',
    backgroundColor: '#eef2ff',
  },
  timeChipText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#6b7280',
  },
  timeChipTextSelected: {
    color: '#4f46e5',
    fontWeight: '600',
  },
  spacer: {
    flex: 1,
    minHeight: 20,
  },
  buttonsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  backButton: {
    flex: 1,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6b7280',
  },
  nextButtonWrapper: {
    flex: 1,
  },
  nextButton: {
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#4f46e5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  nextButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  skipButtonText: {
    fontSize: 15,
    color: '#6366f1',
    fontWeight: '500',
  },
})

