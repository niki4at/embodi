import * as Haptics from 'expo-haptics'
import { LinearGradient } from 'expo-linear-gradient'
import React, { useCallback, useEffect } from 'react'
import {
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
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
import { OnboardingData } from './onboarding-screen'

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity)

interface StepFourProps {
  data: OnboardingData
  updateData: (updates: Partial<OnboardingData>) => void
  onNext: () => void
  onSkip: () => void
  onBack: () => void
}

export default function StepFour({
  data,
  updateData,
  onNext,
  onSkip,
  onBack,
}: StepFourProps) {
  const buttonScale = useSharedValue(1)

  // Shadow opacity values - start at 0, fade in after position animations complete
  const smokingShadowOpacity = useSharedValue(0)
  const alcoholShadowOpacity = useSharedValue(0)
  const periodShadowOpacity = useSharedValue(0)
  const buttonShadowOpacity = useSharedValue(0)

  useEffect(() => {
    // Smoking: delay 200ms + 600ms duration = 800ms
    smokingShadowOpacity.value = withDelay(800, withTiming(1, { duration: 300 }))
    
    // Alcohol: delay 300ms + 600ms duration = 900ms
    alcoholShadowOpacity.value = withDelay(900, withTiming(1, { duration: 300 }))
    
    // Period: delay 400ms + 600ms duration = 1000ms
    periodShadowOpacity.value = withDelay(1000, withTiming(1, { duration: 300 }))
    
    // Button: appears without delay, fade in immediately
    buttonShadowOpacity.value = withTiming(1, { duration: 300 })
  }, [smokingShadowOpacity, alcoholShadowOpacity, periodShadowOpacity, buttonShadowOpacity])

  const buttonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: buttonShadowOpacity.value * 0.3,
    shadowRadius: 12,
    elevation: buttonShadowOpacity.value * 8,
  }))

  const smokingShadowStyle = useAnimatedStyle(() => ({
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: smokingShadowOpacity.value * 0.05,
    shadowRadius: 8,
    elevation: smokingShadowOpacity.value * 2,
  }))

  const alcoholShadowStyle = useAnimatedStyle(() => ({
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: alcoholShadowOpacity.value * 0.05,
    shadowRadius: 8,
    elevation: alcoholShadowOpacity.value * 2,
  }))

  const periodShadowStyle = useAnimatedStyle(() => ({
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: periodShadowOpacity.value * 0.05,
    shadowRadius: 8,
    elevation: periodShadowOpacity.value * 2,
  }))

  const handleButtonPressIn = () => {
    buttonScale.value = withSpring(0.96)
  }

  const handleButtonPressOut = () => {
    buttonScale.value = withSpring(1)
  }

  const handleSmokingSelect = (value: 'never' | 'former' | 'current') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    updateData({ smoking: value })
  }

  const handleAlcoholSelect = (
    value: 'never' | 'occasionally' | 'regularly'
  ) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    updateData({ alcohol: value })
  }

  const handlePeriodToggle = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    updateData({ trackPeriod: !data.trackPeriod })
  }

  const showPeriodTracker = data.gender === 'female'

  const fadeOutShadows = useCallback(() => {
    cancelAnimation(smokingShadowOpacity)
    cancelAnimation(alcoholShadowOpacity)
    cancelAnimation(periodShadowOpacity)
    cancelAnimation(buttonShadowOpacity)
    smokingShadowOpacity.value = 0
    alcoholShadowOpacity.value = 0
    periodShadowOpacity.value = 0
    buttonShadowOpacity.value = 0
  }, [alcoholShadowOpacity, buttonShadowOpacity, periodShadowOpacity, smokingShadowOpacity])

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
        <Text style={styles.title}>Almost there</Text>
        <Text style={styles.subtitle}>
          A few more details help us fine-tune your recovery and energy
          recommendations.
        </Text>
      </Animated.View>

      {/* Smoking */}
      <Animated.View
        entering={FadeInDown.delay(200).duration(600).springify()}
        style={styles.sectionWrapper}
      >
        <Text style={styles.label}>Smoking status</Text>
        <View style={styles.optionsList}>
          {[
            { id: 'never', label: 'Never' },
            { id: 'former', label: 'Former smoker' },
            { id: 'current', label: 'Current smoker' },
          ].map((option) => (
            <AnimatedTouchableOpacity
              key={option.id}
              style={[
                styles.option,
                data.smoking === option.id && styles.optionSelected,
                smokingShadowStyle,
              ]}
              onPress={() => handleSmokingSelect(option.id as any)}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.radioOuter,
                  data.smoking === option.id && styles.radioOuterSelected,
                ]}
              >
                {data.smoking === option.id && (
                  <View style={styles.radioInner} />
                )}
              </View>
              <Text
                style={[
                  styles.optionText,
                  data.smoking === option.id && styles.optionTextSelected,
                ]}
              >
                {option.label}
              </Text>
            </AnimatedTouchableOpacity>
          ))}
        </View>
      </Animated.View>

      {/* Alcohol */}
      <Animated.View
        entering={FadeInDown.delay(300).duration(600).springify()}
        style={styles.sectionWrapper}
      >
        <Text style={styles.label}>Alcohol consumption</Text>
        <View style={styles.optionsList}>
          {[
            { id: 'never', label: 'Never' },
            { id: 'occasionally', label: 'Occasionally' },
            { id: 'regularly', label: 'Regularly' },
          ].map((option) => (
            <AnimatedTouchableOpacity
              key={option.id}
              style={[
                styles.option,
                data.alcohol === option.id && styles.optionSelected,
                alcoholShadowStyle,
              ]}
              onPress={() => handleAlcoholSelect(option.id as any)}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.radioOuter,
                  data.alcohol === option.id && styles.radioOuterSelected,
                ]}
              >
                {data.alcohol === option.id && (
                  <View style={styles.radioInner} />
                )}
              </View>
              <Text
                style={[
                  styles.optionText,
                  data.alcohol === option.id && styles.optionTextSelected,
                ]}
              >
                {option.label}
              </Text>
            </AnimatedTouchableOpacity>
          ))}
        </View>
      </Animated.View>

      {/* Period Tracker */}
      {showPeriodTracker && (
        <Animated.View
          entering={FadeInDown.delay(400).duration(600).springify()}
          style={styles.sectionWrapper}
        >
          <AnimatedTouchableOpacity
            style={[
              styles.periodOption,
              data.trackPeriod && styles.periodOptionSelected,
              periodShadowStyle,
            ]}
            onPress={handlePeriodToggle}
            activeOpacity={0.7}
          >
            <View style={styles.periodContent}>
              <Text
                style={[
                  styles.periodLabel,
                  data.trackPeriod && styles.periodLabelSelected,
                ]}
              >
                Track menstrual cycle
              </Text>
              <Text
                style={[
                  styles.periodDescription,
                  data.trackPeriod && styles.periodDescriptionSelected,
                ]}
              >
                Helps optimize training around your cycle
              </Text>
            </View>
            <View
              style={[
                styles.checkbox,
                data.trackPeriod && styles.checkboxSelected,
              ]}
            >
              {data.trackPeriod && <Text style={styles.checkmark}>✓</Text>}
            </View>
          </AnimatedTouchableOpacity>
        </Animated.View>
      )}

      {/* Spacer */}
      <View style={styles.spacer} />

      {/* Info Card */}
      <Animated.View
        entering={FadeInDown.delay(500).duration(600).springify()}
        style={styles.infoCard}
      >
        <Text style={styles.infoText}>
          All health data is encrypted and never shared without your consent.
        </Text>
      </Animated.View>

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
              colors={['#10b981', '#059669']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.nextButton}
            >
              <Text style={styles.nextButtonText}>Complete</Text>
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
    marginBottom: 12,
  },
  optionsList: {
    gap: 10,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    paddingHorizontal: 16,
    paddingVertical: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
  },
  optionSelected: {
    borderColor: '#6366f1',
    backgroundColor: '#eef2ff',
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  radioOuterSelected: {
    borderColor: '#6366f1',
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#6366f1',
  },
  optionText: {
    fontSize: 16,
    color: '#6b7280',
    fontWeight: '500',
  },
  optionTextSelected: {
    color: '#4f46e5',
    fontWeight: '600',
  },
  periodOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    paddingHorizontal: 16,
    paddingVertical: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
  },
  periodOptionSelected: {
    borderColor: '#ec4899',
    backgroundColor: '#fdf2f8',
  },
  periodContent: {
    flex: 1,
    marginRight: 12,
  },
  periodLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 2,
  },
  periodLabelSelected: {
    color: '#ec4899',
  },
  periodDescription: {
    fontSize: 13,
    color: '#9ca3af',
  },
  periodDescriptionSelected: {
    color: '#f9a8d4',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: '#ec4899',
    borderColor: '#ec4899',
  },
  checkmark: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  spacer: {
    flex: 1,
    minHeight: 20,
  },
  infoCard: {
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#dbeafe',
  },
  infoText: {
    fontSize: 13,
    color: '#3b82f6',
    lineHeight: 18,
    textAlign: 'center',
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
    shadowColor: '#059669',
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
