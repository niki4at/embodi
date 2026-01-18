import { api } from '@/convex/_generated/api'
import { useQuery, useMutation } from 'convex/react'
import * as Haptics from 'expo-haptics'
import { LinearGradient } from 'expo-linear-gradient'
import { router, type Href } from 'expo-router'
import React, { useState, useRef, useCallback } from 'react'
import {
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  FadeOut,
  SlideInRight,
  SlideOutLeft,
} from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'

const { width: SCREEN_WIDTH } = Dimensions.get('window')

type CheckinStep =
  | 'energy'
  | 'sleep'
  | 'stress'
  | 'mood'
  | 'pain'
  | 'intensity'
  | 'time'
  | 'type'
  | 'focus'
  | 'notes'
  | 'summary'

type CheckinData = {
  energyLevel: number
  sleepQuality: number
  stressLevel: number
  painLevel?: number
  painAreas?: string[]
  workoutIntensity: 'push-hard' | 'moderate' | 'easy' | 'just-move'
  timeAvailable: '15-min' | '30-min' | '45-min' | '60-min'
  focusAreas?: string[]
  workoutType?: 'strength' | 'cardio' | 'mobility' | 'recovery' | 'mixed'
  notes?: string
  mood?: 'great' | 'good' | 'okay' | 'tired' | 'stressed'
}

const ENERGY_LABELS = [
  'Exhausted',
  'Dragging',
  'Low',
  'Below average',
  'Okay',
  'Decent',
  'Good',
  'Energized',
  'Strong',
  'Fired up',
]

const SLEEP_LABELS = [
  'Terrible',
  'Poor',
  'Rough',
  'Below average',
  'Okay',
  'Fair',
  'Good',
  'Great',
  'Excellent',
  'Perfect',
]

const STRESS_LABELS = ['Calm', 'Relaxed', 'Balanced', 'Tense', 'Overwhelmed']

const MOOD_OPTIONS: { value: NonNullable<CheckinData['mood']>; label: string; emoji: string }[] = [
  { value: 'great', label: 'Feeling great', emoji: '😄' },
  { value: 'good', label: 'Pretty good', emoji: '🙂' },
  { value: 'okay', label: 'Okay', emoji: '😐' },
  { value: 'tired', label: 'Tired', emoji: '😴' },
  { value: 'stressed', label: 'Stressed', emoji: '😓' },
]

const INTENSITY_OPTIONS: { value: CheckinData['workoutIntensity']; label: string; description: string; emoji: string }[] = [
  { value: 'push-hard', label: 'Push me hard', description: 'Challenge me today', emoji: '🔥' },
  { value: 'moderate', label: 'Moderate effort', description: 'Balanced session', emoji: '💪' },
  { value: 'easy', label: 'Take it easy', description: 'Gentle but effective', emoji: '🌿' },
  { value: 'just-move', label: 'Just move', description: 'Light movement only', emoji: '🧘' },
]

const TIME_OPTIONS: { value: CheckinData['timeAvailable']; label: string }[] = [
  { value: '15-min', label: '15 min' },
  { value: '30-min', label: '30 min' },
  { value: '45-min', label: '45 min' },
  { value: '60-min', label: '60 min' },
]

const WORKOUT_TYPE_OPTIONS: { value: NonNullable<CheckinData['workoutType']>; label: string; emoji: string }[] = [
  { value: 'strength', label: 'Strength', emoji: '🏋️' },
  { value: 'cardio', label: 'Cardio', emoji: '🏃' },
  { value: 'mobility', label: 'Mobility', emoji: '🤸' },
  { value: 'recovery', label: 'Recovery', emoji: '🧘' },
  { value: 'mixed', label: 'Mix it up', emoji: '🎯' },
]

const FOCUS_AREAS = [
  'Upper body',
  'Lower body',
  'Core',
  'Back',
  'Shoulders',
  'Hips',
  'Full body',
  'Cardio endurance',
]

export default function CheckInScreen() {
  const onboardingData = useQuery(api.onboarding.getOnboarding)
  const submitCheckin = useMutation(api.checkin.submitCheckinAndStartSession)

  const [currentStep, setCurrentStep] = useState<CheckinStep>('energy')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const scrollRef = useRef<ScrollView>(null)

  // Check-in state
  const [data, setData] = useState<CheckinData>({
    energyLevel: 5,
    sleepQuality: 5,
    stressLevel: 3,
    workoutIntensity: 'moderate',
    timeAvailable: '30-min',
  })

  const hasInjuries = (onboardingData?.injuries?.length ?? 0) > 0 ||
    (onboardingData?.conditions?.length ?? 0) > 0

  const userName = onboardingData?.name?.split(' ')[0] || 'there'

  // Navigation helpers
  const getSteps = useCallback((): CheckinStep[] => {
    const baseSteps: CheckinStep[] = ['energy', 'sleep', 'stress', 'mood']
    if (hasInjuries) {
      baseSteps.push('pain')
    }
    baseSteps.push('intensity', 'time', 'type', 'focus', 'notes', 'summary')
    return baseSteps
  }, [hasInjuries])

  const steps = getSteps()
  const currentIndex = steps.indexOf(currentStep)
  const progress = (currentIndex + 1) / steps.length

  const goNext = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    const nextIndex = currentIndex + 1
    if (nextIndex < steps.length) {
      setCurrentStep(steps[nextIndex])
    }
  }, [currentIndex, steps])

  const goBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    if (currentIndex > 0) {
      setCurrentStep(steps[currentIndex - 1])
    } else {
      router.back()
    }
  }, [currentIndex, steps])

  const handleSubmit = useCallback(async () => {
    if (isSubmitting) return
    setIsSubmitting(true)
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
      const sessionId = await submitCheckin({ checkinData: data })
      const sessionHref = {
        pathname: '/session',
        params: { sessionId: String(sessionId) },
      } as unknown as Href
      router.replace(sessionHref)
    } catch (error) {
      console.error('Failed to submit check-in:', error)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    } finally {
      setIsSubmitting(false)
    }
  }, [data, isSubmitting, submitCheckin])

  // Slider component
  const renderSlider = (
    value: number,
    min: number,
    max: number,
    labels: string[],
    onChange: (v: number) => void
  ) => {
    const steps = max - min + 1
    return (
      <View style={styles.sliderContainer}>
        <View style={styles.sliderTrack}>
          {Array.from({ length: steps }).map((_, i) => {
            const stepValue = min + i
            const isActive = stepValue <= value
            const isSelected = stepValue === value
            return (
              <TouchableOpacity
                key={i}
                style={[
                  styles.sliderStep,
                  isActive && styles.sliderStepActive,
                  isSelected && styles.sliderStepSelected,
                ]}
                onPress={() => {
                  Haptics.selectionAsync()
                  onChange(stepValue)
                }}
              />
            )
          })}
        </View>
        <View style={styles.sliderLabels}>
          <Text style={styles.sliderLabelText}>{labels[0]}</Text>
          <Text style={styles.sliderValueText}>{labels[value - min]}</Text>
          <Text style={styles.sliderLabelText}>{labels[labels.length - 1]}</Text>
        </View>
        <Text style={styles.sliderNumber}>{value}</Text>
      </View>
    )
  }

  // Option button component for mood
  const renderMoodOption = (
    option: { value: NonNullable<CheckinData['mood']>; label: string; emoji: string },
    selected: CheckinData['mood'],
    onSelect: (v: NonNullable<CheckinData['mood']>) => void
  ) => (
    <TouchableOpacity
      key={option.value}
      style={[
        styles.optionButton,
        selected === option.value && styles.optionButtonSelected,
      ]}
      onPress={() => {
        Haptics.selectionAsync()
        onSelect(option.value)
      }}
    >
      <Text style={styles.optionEmoji}>{option.emoji}</Text>
      <View style={styles.optionTextContainer}>
        <Text
          style={[
            styles.optionLabel,
            selected === option.value && styles.optionLabelSelected,
          ]}
        >
          {option.label}
        </Text>
      </View>
    </TouchableOpacity>
  )

  // Option button component for intensity
  const renderIntensityOption = (
    option: { value: CheckinData['workoutIntensity']; label: string; description: string; emoji: string },
    selected: CheckinData['workoutIntensity'],
    onSelect: (v: CheckinData['workoutIntensity']) => void
  ) => (
    <TouchableOpacity
      key={option.value}
      style={[
        styles.optionButton,
        selected === option.value && styles.optionButtonSelected,
      ]}
      onPress={() => {
        Haptics.selectionAsync()
        onSelect(option.value)
      }}
    >
      <Text style={styles.optionEmoji}>{option.emoji}</Text>
      <View style={styles.optionTextContainer}>
        <Text
          style={[
            styles.optionLabel,
            selected === option.value && styles.optionLabelSelected,
          ]}
        >
          {option.label}
        </Text>
        <Text style={styles.optionDescription}>{option.description}</Text>
      </View>
    </TouchableOpacity>
  )

  // Multi-select component
  const renderMultiSelect = (
    options: string[],
    selected: string[],
    onChange: (v: string[]) => void
  ) => (
    <View style={styles.multiSelectGrid}>
      {options.map((option) => {
        const isSelected = selected.includes(option)
        return (
          <TouchableOpacity
            key={option}
            style={[
              styles.multiSelectOption,
              isSelected && styles.multiSelectOptionSelected,
            ]}
            onPress={() => {
              Haptics.selectionAsync()
              if (isSelected) {
                onChange(selected.filter((s) => s !== option))
              } else {
                onChange([...selected, option])
              }
            }}
          >
            <Text
              style={[
                styles.multiSelectText,
                isSelected && styles.multiSelectTextSelected,
              ]}
            >
              {option}
            </Text>
          </TouchableOpacity>
        )
      })}
    </View>
  )

  // Step content renderer
  const renderStepContent = () => {
    switch (currentStep) {
      case 'energy':
        return (
          <Animated.View
            entering={SlideInRight.duration(300)}
            exiting={SlideOutLeft.duration(200)}
            style={styles.stepContent}
          >
            <Text style={styles.stepQuestion}>How's your energy right now?</Text>
            <Text style={styles.stepSubtext}>
              Be honest, {userName}. This helps me adjust your workout.
            </Text>
            {renderSlider(
              data.energyLevel,
              1,
              10,
              ENERGY_LABELS,
              (v) => setData({ ...data, energyLevel: v })
            )}
          </Animated.View>
        )

      case 'sleep':
        return (
          <Animated.View
            entering={SlideInRight.duration(300)}
            exiting={SlideOutLeft.duration(200)}
            style={styles.stepContent}
          >
            <Text style={styles.stepQuestion}>How did you sleep last night?</Text>
            <Text style={styles.stepSubtext}>
              Sleep affects recovery and performance.
            </Text>
            {renderSlider(
              data.sleepQuality,
              1,
              10,
              SLEEP_LABELS,
              (v) => setData({ ...data, sleepQuality: v })
            )}
          </Animated.View>
        )

      case 'stress':
        return (
          <Animated.View
            entering={SlideInRight.duration(300)}
            exiting={SlideOutLeft.duration(200)}
            style={styles.stepContent}
          >
            <Text style={styles.stepQuestion}>What's your stress level today?</Text>
            <Text style={styles.stepSubtext}>
              This helps me pick the right intensity.
            </Text>
            {renderSlider(
              data.stressLevel,
              1,
              5,
              STRESS_LABELS,
              (v) => setData({ ...data, stressLevel: v })
            )}
          </Animated.View>
        )

      case 'mood':
        return (
          <Animated.View
            entering={SlideInRight.duration(300)}
            exiting={SlideOutLeft.duration(200)}
            style={styles.stepContent}
          >
            <Text style={styles.stepQuestion}>How are you feeling overall?</Text>
            <View style={styles.optionsContainer}>
              {MOOD_OPTIONS.map((option) =>
                renderMoodOption(option, data.mood, (v) =>
                  setData({ ...data, mood: v })
                )
              )}
            </View>
          </Animated.View>
        )

      case 'pain':
        return (
          <Animated.View
            entering={SlideInRight.duration(300)}
            exiting={SlideOutLeft.duration(200)}
            style={styles.stepContent}
          >
            <Text style={styles.stepQuestion}>
              How are your {onboardingData?.injuries?.join(', ') || 'problem areas'} feeling today?
            </Text>
            <Text style={styles.stepSubtext}>
              0 = no pain, 10 = severe pain
            </Text>
            {renderSlider(
              data.painLevel ?? 0,
              0,
              10,
              ['None', '1', '2', 'Mild', '4', 'Moderate', '6', '7', 'Severe', '9', 'Worst'],
              (v) => setData({ ...data, painLevel: v })
            )}
            {(data.painLevel ?? 0) > 3 && (
              <Animated.View entering={FadeIn} style={styles.painWarning}>
                <Text style={styles.painWarningText}>
                  I'll make sure to avoid aggravating movements and include recovery work.
                </Text>
              </Animated.View>
            )}
          </Animated.View>
        )

      case 'intensity':
        return (
          <Animated.View
            entering={SlideInRight.duration(300)}
            exiting={SlideOutLeft.duration(200)}
            style={styles.stepContent}
          >
            <Text style={styles.stepQuestion}>What kind of session do you want?</Text>
            <View style={styles.optionsContainer}>
              {INTENSITY_OPTIONS.map((option) =>
                renderIntensityOption(option, data.workoutIntensity, (v) =>
                  setData({ ...data, workoutIntensity: v })
                )
              )}
            </View>
          </Animated.View>
        )

      case 'time':
        return (
          <Animated.View
            entering={SlideInRight.duration(300)}
            exiting={SlideOutLeft.duration(200)}
            style={styles.stepContent}
          >
            <Text style={styles.stepQuestion}>How much time do you have?</Text>
            <View style={styles.timeGrid}>
              {TIME_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.timeButton,
                    data.timeAvailable === option.value && styles.timeButtonSelected,
                  ]}
                  onPress={() => {
                    Haptics.selectionAsync()
                    setData({ ...data, timeAvailable: option.value })
                  }}
                >
                  <Text
                    style={[
                      styles.timeButtonText,
                      data.timeAvailable === option.value &&
                        styles.timeButtonTextSelected,
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </Animated.View>
        )

      case 'type':
        return (
          <Animated.View
            entering={SlideInRight.duration(300)}
            exiting={SlideOutLeft.duration(200)}
            style={styles.stepContent}
          >
            <Text style={styles.stepQuestion}>What type of workout?</Text>
            <Text style={styles.stepSubtext}>Optional - skip if you want me to decide</Text>
            <View style={styles.typeGrid}>
              {WORKOUT_TYPE_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.typeButton,
                    data.workoutType === option.value && styles.typeButtonSelected,
                  ]}
                  onPress={() => {
                    Haptics.selectionAsync()
                    setData({ ...data, workoutType: option.value })
                  }}
                >
                  <Text style={styles.typeEmoji}>{option.emoji}</Text>
                  <Text
                    style={[
                      styles.typeLabel,
                      data.workoutType === option.value && styles.typeLabelSelected,
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </Animated.View>
        )

      case 'focus':
        return (
          <Animated.View
            entering={SlideInRight.duration(300)}
            exiting={SlideOutLeft.duration(200)}
            style={styles.stepContent}
          >
            <Text style={styles.stepQuestion}>Any specific areas to focus on?</Text>
            <Text style={styles.stepSubtext}>Optional - tap any that apply</Text>
            {renderMultiSelect(
              FOCUS_AREAS,
              data.focusAreas || [],
              (v) => setData({ ...data, focusAreas: v })
            )}
          </Animated.View>
        )

      case 'notes':
        return (
          <Animated.View
            entering={SlideInRight.duration(300)}
            exiting={SlideOutLeft.duration(200)}
            style={styles.stepContent}
          >
            <Text style={styles.stepQuestion}>Anything else I should know?</Text>
            <Text style={styles.stepSubtext}>
              New aches, medication changes, or today's goals
            </Text>
            <TextInput
              style={styles.notesInput}
              placeholder="Optional notes..."
              placeholderTextColor="#9ca3af"
              value={data.notes || ''}
              onChangeText={(text) => setData({ ...data, notes: text })}
              multiline
              textAlignVertical="top"
            />
          </Animated.View>
        )

      case 'summary':
        return (
          <Animated.View
            entering={FadeInDown.duration(400)}
            style={styles.stepContent}
          >
            <Text style={styles.stepQuestion}>Ready to go, {userName}!</Text>
            <View style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Energy</Text>
                <Text style={styles.summaryValue}>
                  {ENERGY_LABELS[data.energyLevel - 1]} ({data.energyLevel}/10)
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Sleep</Text>
                <Text style={styles.summaryValue}>
                  {SLEEP_LABELS[data.sleepQuality - 1]} ({data.sleepQuality}/10)
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Stress</Text>
                <Text style={styles.summaryValue}>
                  {STRESS_LABELS[data.stressLevel - 1]}
                </Text>
              </View>
              {data.mood && (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Mood</Text>
                  <Text style={styles.summaryValue}>
                    {MOOD_OPTIONS.find((m) => m.value === data.mood)?.label}
                  </Text>
                </View>
              )}
              {data.painLevel !== undefined && data.painLevel > 0 && (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Pain</Text>
                  <Text style={styles.summaryValue}>{data.painLevel}/10</Text>
                </View>
              )}
              <View style={styles.summaryDivider} />
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Session</Text>
                <Text style={styles.summaryValue}>
                  {INTENSITY_OPTIONS.find((i) => i.value === data.workoutIntensity)?.label} •{' '}
                  {TIME_OPTIONS.find((t) => t.value === data.timeAvailable)?.label}
                </Text>
              </View>
              {data.workoutType && (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Type</Text>
                  <Text style={styles.summaryValue}>
                    {WORKOUT_TYPE_OPTIONS.find((t) => t.value === data.workoutType)?.label}
                  </Text>
                </View>
              )}
              {data.focusAreas && data.focusAreas.length > 0 && (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Focus</Text>
                  <Text style={styles.summaryValue}>
                    {data.focusAreas.join(', ')}
                  </Text>
                </View>
              )}
            </View>
          </Animated.View>
        )
    }
  }

  return (
    <LinearGradient colors={['#fef3f2', '#ffffff']} style={styles.gradient}>
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={goBack} style={styles.backButton}>
            <Text style={styles.backText}>←</Text>
          </TouchableOpacity>
          <View style={styles.progressContainer}>
            <View style={styles.progressTrack}>
              <Animated.View
                style={[styles.progressFill, { width: `${progress * 100}%` }]}
              />
            </View>
          </View>
          <Text style={styles.stepCounter}>
            {currentIndex + 1}/{steps.length}
          </Text>
        </View>

        {/* Content */}
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View entering={FadeInUp.delay(100)} style={styles.greeting}>
            {currentStep === 'energy' && (
              <>
                <Text style={styles.greetingEmoji}>👋</Text>
                <Text style={styles.greetingText}>
                  Let's check in, {userName}
                </Text>
                <Text style={styles.greetingSubtext}>
                  A few quick questions to build your perfect session
                </Text>
              </>
            )}
          </Animated.View>

          {renderStepContent()}
        </ScrollView>

        {/* Footer */}
        <Animated.View
          entering={FadeIn.delay(300)}
          style={styles.footer}
        >
          {currentStep === 'summary' ? (
            <TouchableOpacity
              style={[styles.primaryButton, isSubmitting && styles.primaryButtonDisabled]}
              onPress={handleSubmit}
              disabled={isSubmitting}
            >
              <LinearGradient
                colors={['#f97316', '#ea580c']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.primaryButtonGradient}
              >
                <Text style={styles.primaryButtonText}>
                  {isSubmitting ? 'Building your session...' : 'Start my workout →'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.nextButton} onPress={goNext}>
              <Text style={styles.nextButtonText}>Continue</Text>
            </TouchableOpacity>
          )}

          {currentStep !== 'summary' && currentStep !== 'energy' && (
            <TouchableOpacity style={styles.skipButton} onPress={goNext}>
              <Text style={styles.skipButtonText}>Skip</Text>
            </TouchableOpacity>
          )}
        </Animated.View>
      </SafeAreaView>
    </LinearGradient>
  )
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  backText: {
    fontSize: 20,
    color: '#374151',
  },
  progressContainer: {
    flex: 1,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#e5e7eb',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#f97316',
    borderRadius: 3,
  },
  stepCounter: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
    minWidth: 40,
    textAlign: 'right',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 120,
  },
  greeting: {
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 32,
  },
  greetingEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  greetingText: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1f2937',
    textAlign: 'center',
    marginBottom: 8,
  },
  greetingSubtext: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
  },
  stepContent: {
    flex: 1,
  },
  stepQuestion: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 8,
    lineHeight: 32,
  },
  stepSubtext: {
    fontSize: 15,
    color: '#6b7280',
    marginBottom: 32,
  },
  sliderContainer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  sliderTrack: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 16,
  },
  sliderStep: {
    width: (SCREEN_WIDTH - 100) / 10,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#e5e7eb',
  },
  sliderStepActive: {
    backgroundColor: '#fed7aa',
  },
  sliderStepSelected: {
    backgroundColor: '#f97316',
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 4,
    marginBottom: 12,
  },
  sliderLabelText: {
    fontSize: 12,
    color: '#9ca3af',
  },
  sliderValueText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f97316',
  },
  sliderNumber: {
    fontSize: 48,
    fontWeight: '700',
    color: '#1f2937',
  },
  optionsContainer: {
    gap: 12,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    gap: 14,
  },
  optionButtonSelected: {
    borderColor: '#f97316',
    backgroundColor: '#fff7ed',
  },
  optionEmoji: {
    fontSize: 28,
  },
  optionTextContainer: {
    flex: 1,
  },
  optionLabel: {
    fontSize: 17,
    fontWeight: '600',
    color: '#374151',
  },
  optionLabelSelected: {
    color: '#ea580c',
  },
  optionDescription: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 2,
  },
  timeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
  },
  timeButton: {
    paddingHorizontal: 28,
    paddingVertical: 20,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#e5e7eb',
  },
  timeButtonSelected: {
    borderColor: '#f97316',
    backgroundColor: '#fff7ed',
  },
  timeButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
  },
  timeButtonTextSelected: {
    color: '#ea580c',
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 8,
  },
  typeButton: {
    width: '47%',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#e5e7eb',
  },
  typeButtonSelected: {
    borderColor: '#f97316',
    backgroundColor: '#fff7ed',
  },
  typeEmoji: {
    fontSize: 32,
    marginBottom: 8,
  },
  typeLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
  },
  typeLabelSelected: {
    color: '#ea580c',
  },
  multiSelectGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  multiSelectOption: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#e5e7eb',
  },
  multiSelectOptionSelected: {
    borderColor: '#f97316',
    backgroundColor: '#fff7ed',
  },
  multiSelectText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#374151',
  },
  multiSelectTextSelected: {
    color: '#ea580c',
  },
  notesInput: {
    minHeight: 120,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    padding: 16,
    fontSize: 16,
    color: '#1f2937',
  },
  painWarning: {
    marginTop: 20,
    padding: 16,
    backgroundColor: '#fef3c7',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fcd34d',
  },
  painWarningText: {
    fontSize: 14,
    color: '#92400e',
    lineHeight: 20,
  },
  summaryCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginTop: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  summaryLabel: {
    fontSize: 15,
    color: '#6b7280',
  },
  summaryValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1f2937',
    textAlign: 'right',
    flex: 1,
    marginLeft: 16,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: 12,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    paddingBottom: 36,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    gap: 12,
  },
  nextButton: {
    backgroundColor: '#1f2937',
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
  },
  nextButtonText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '700',
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  skipButtonText: {
    color: '#9ca3af',
    fontSize: 15,
    fontWeight: '500',
  },
  primaryButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  primaryButtonDisabled: {
    opacity: 0.7,
  },
  primaryButtonGradient: {
    paddingVertical: 18,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
  },
})
