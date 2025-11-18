import React, { useCallback, useEffect, useState } from 'react'
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
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { LinearGradient } from 'expo-linear-gradient'
import * as Haptics from 'expo-haptics'
import { OnboardingData } from './onboarding-screen'

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity)

interface StepThreeProps {
  data: OnboardingData
  updateData: (updates: Partial<OnboardingData>) => void
  onNext: () => void
  onSkip: () => void
  onBack: () => void
}

const commonInjuries = [
  'Lower back pain',
  'Knee issues',
  'Shoulder pain',
  'Hip discomfort',
  'Ankle/foot',
  'Neck tension',
  'Wrist/elbow',
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

export default function StepThree({ data, updateData, onNext, onSkip, onBack }: StepThreeProps) {
  const [medicationsFocused, setMedicationsFocused] = useState(false)
  const buttonScale = useSharedValue(1)

  // Shadow opacity values - start at 0, fade in after position animations complete
  const injuriesShadowOpacity = useSharedValue(0)
  const conditionsShadowOpacity = useSharedValue(0)
  const inputShadowOpacity = useSharedValue(0)
  const buttonShadowOpacity = useSharedValue(0)

  useEffect(() => {
    // Injuries: delay 200ms + 600ms duration = 800ms
    injuriesShadowOpacity.value = withDelay(800, withTiming(1, { duration: 300 }))
    
    // Conditions: delay 300ms + 600ms duration = 900ms
    conditionsShadowOpacity.value = withDelay(900, withTiming(1, { duration: 300 }))
    
    // Input: delay 400ms + 600ms duration = 1000ms
    inputShadowOpacity.value = withDelay(1000, withTiming(1, { duration: 300 }))
    
    // Button: appears without delay, fade in immediately
    buttonShadowOpacity.value = withTiming(1, { duration: 300 })
  }, [injuriesShadowOpacity, conditionsShadowOpacity, inputShadowOpacity, buttonShadowOpacity])

  const buttonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
    shadowColor: '#4f46e5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: buttonShadowOpacity.value * 0.3,
    shadowRadius: 12,
    elevation: buttonShadowOpacity.value * 8,
  }))

  const injuryShadowStyle = useAnimatedStyle(() => ({
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: injuriesShadowOpacity.value * 0.05,
    shadowRadius: 8,
    elevation: injuriesShadowOpacity.value * 2,
  }))

  const conditionShadowStyle = useAnimatedStyle(() => ({
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: conditionsShadowOpacity.value * 0.05,
    shadowRadius: 8,
    elevation: conditionsShadowOpacity.value * 2,
  }))

  const inputShadowStyle = useAnimatedStyle(() => ({
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: inputShadowOpacity.value * 0.05,
    shadowRadius: 8,
    elevation: inputShadowOpacity.value * 2,
  }))

  const handleButtonPressIn = () => {
    buttonScale.value = withSpring(0.96)
  }

  const handleButtonPressOut = () => {
    buttonScale.value = withSpring(1)
  }

  const handleInjuryToggle = (injury: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    const current = data.injuries
    if (current.includes(injury)) {
      updateData({ injuries: current.filter((i) => i !== injury) })
    } else {
      updateData({ injuries: [...current, injury] })
    }
  }

  const handleConditionToggle = (condition: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    const current = data.conditions
    if (current.includes(condition)) {
      updateData({ conditions: current.filter((c) => c !== condition) })
    } else {
      updateData({ conditions: [...current, condition] })
    }
  }

  const fadeOutShadows = useCallback(() => {
    cancelAnimation(injuriesShadowOpacity)
    cancelAnimation(conditionsShadowOpacity)
    cancelAnimation(inputShadowOpacity)
    cancelAnimation(buttonShadowOpacity)
    injuriesShadowOpacity.value = 0
    conditionsShadowOpacity.value = 0
    inputShadowOpacity.value = 0
    buttonShadowOpacity.value = 0
  }, [buttonShadowOpacity, conditionsShadowOpacity, injuriesShadowOpacity, inputShadowOpacity])

  const handleNextPress = () => {
    fadeOutShadows()
    onNext()
  }

  const handleSkipPress = () => {
    fadeOutShadows()
    onSkip()
  }

  const handleBackPress = () => {
    fadeOutShadows()
    onBack()
  }

  return (
    <View style={styles.container}>
      <Animated.View entering={FadeInDown.delay(100).duration(600).springify()}>
        <Text style={styles.title}>Your health context</Text>
        <Text style={styles.subtitle}>
          This helps us create a safe, personalized plan. All information is optional and private.
        </Text>
      </Animated.View>

      {/* Injuries */}
      <Animated.View
        entering={FadeInDown.delay(200).duration(600).springify()}
        style={styles.sectionWrapper}
      >
        <Text style={styles.label}>Any areas of discomfort or past injuries?</Text>
        <Text style={styles.hint}>Select all that apply</Text>
        <View style={styles.chipGrid}>
          {commonInjuries.map((injury) => (
            <AnimatedTouchableOpacity
              key={injury}
              style={[
                styles.chip,
                data.injuries.includes(injury) && styles.chipSelected,
                injuryShadowStyle,
              ]}
              onPress={() => handleInjuryToggle(injury)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.chipText,
                  data.injuries.includes(injury) && styles.chipTextSelected,
                ]}
              >
                {injury}
              </Text>
            </AnimatedTouchableOpacity>
          ))}
        </View>
      </Animated.View>

      {/* Conditions */}
      <Animated.View
        entering={FadeInDown.delay(300).duration(600).springify()}
        style={styles.sectionWrapper}
      >
        <Text style={styles.label}>Any health conditions we should know about?</Text>
        <Text style={styles.hint}>Select all that apply</Text>
        <View style={styles.chipGrid}>
          {commonConditions.map((condition) => (
            <AnimatedTouchableOpacity
              key={condition}
              style={[
                styles.chip,
                data.conditions.includes(condition) && styles.chipSelected,
                conditionShadowStyle,
              ]}
              onPress={() => handleConditionToggle(condition)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.chipText,
                  data.conditions.includes(condition) && styles.chipTextSelected,
                ]}
              >
                {condition}
              </Text>
            </AnimatedTouchableOpacity>
          ))}
        </View>
      </Animated.View>

      {/* Medications */}
      <Animated.View
        entering={FadeInDown.delay(400).duration(600).springify()}
        style={styles.inputWrapper}
      >
        <Text style={styles.label}>Current medications (optional)</Text>
        <Animated.View
          style={[
            styles.inputContainer,
            medicationsFocused && styles.inputContainerFocused,
            inputShadowStyle,
          ]}
        >
          <TextInput
            style={styles.input}
            placeholder="List any medications you're taking"
            placeholderTextColor="#9ca3af"
            value={data.medications}
            onChangeText={(text) => updateData({ medications: text })}
            onFocus={() => {
              setMedicationsFocused(true)
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
            }}
            onBlur={() => setMedicationsFocused(false)}
            multiline
          />
        </Animated.View>
      </Animated.View>

      {/* Spacer */}
      <View style={styles.spacer} />

      {/* Buttons */}
      <View style={styles.buttonsContainer}>
        <TouchableOpacity onPress={handleBackPress} style={styles.backButton}>
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>

        <Animated.View style={[styles.nextButtonWrapper, buttonAnimatedStyle]}>
          <Pressable
            onPress={handleNextPress}
            onPressIn={handleButtonPressIn}
            onPressOut={handleButtonPressOut}
          >
            <LinearGradient
              colors={['#6366f1', '#4f46e5']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.nextButton}
            >
              <Text style={styles.nextButtonText}>Next</Text>
            </LinearGradient>
          </Pressable>
        </Animated.View>
      </View>

      <TouchableOpacity onPress={handleSkipPress} style={styles.skipButton}>
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
  sectionWrapper: {
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
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chip: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    paddingHorizontal: 16,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
  },
  chipSelected: {
    borderColor: '#f97316',
    backgroundColor: '#fff7ed',
  },
  chipText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  chipTextSelected: {
    color: '#f97316',
    fontWeight: '600',
  },
  inputWrapper: {
    marginBottom: 24,
  },
  inputContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 80,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
  },
  inputContainerFocused: {
    borderColor: '#6366f1',
    shadowColor: '#6366f1',
    shadowRadius: 12,
    elevation: 4,
  },
  input: {
    fontSize: 16,
    color: '#1f2937',
    fontWeight: '400',
    textAlignVertical: 'top',
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
    shadowRadius: 12,
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



