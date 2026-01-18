import { api } from '@/convex/_generated/api'
import { useMutation, useQuery } from 'convex/react'
import * as Haptics from 'expo-haptics'
import { LinearGradient } from 'expo-linear-gradient'
import { router, type Href } from 'expo-router'
import React, { useState } from 'react'
import {
  ActivityIndicator,
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
  FadeOut,
  SlideInRight,
  SlideOutLeft,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'

import BodyAreaSelector from './BodyAreaSelector'
import CheckInChoice, { type ChoiceOption } from './CheckInChoice'
import CheckInSlider from './CheckInSlider'

const AnimatedTouchableOpacity =
  Animated.createAnimatedComponent(TouchableOpacity)

// Check-in data types
type SleepQuality = 'rough' | 'okay' | 'decent' | 'great'
type WorkoutType = 'strength' | 'mobility' | 'cardio' | 'recovery' | 'mixed'
type IntensityPreference = 'easy' | 'moderate' | 'challenging'
type TimeAvailable = '15' | '30' | '45' | '60'

interface CheckInFormData {
  energyLevel: number
  sleepQuality: SleepQuality | null
  painLevel: number
  painAreas: string[]
  stressLevel: number
  workoutType: WorkoutType | null
  intensityPreference: IntensityPreference | null
  timeAvailable: TimeAvailable | null
  notes: string
}

const SLEEP_OPTIONS: ChoiceOption<SleepQuality>[] = [
  { value: 'rough', label: 'Rough night', emoji: '😴', description: 'Barely slept' },
  { value: 'okay', label: 'Could be better', emoji: '😐', description: 'Woke up tired' },
  { value: 'decent', label: 'Decent', emoji: '🙂', description: 'Rested enough' },
  { value: 'great', label: 'Slept great', emoji: '😊', description: 'Feel refreshed' },
]

const WORKOUT_OPTIONS: ChoiceOption<WorkoutType>[] = [
  { value: 'strength', label: 'Strength', emoji: '💪', description: 'Build power' },
  { value: 'mobility', label: 'Mobility', emoji: '🧘', description: 'Flexibility' },
  { value: 'cardio', label: 'Cardio', emoji: '🏃', description: 'Get moving' },
  { value: 'recovery', label: 'Recovery', emoji: '🌿', description: 'Gentle day' },
  { value: 'mixed', label: 'Mixed', emoji: '⚡', description: 'A bit of everything' },
]

const INTENSITY_OPTIONS: ChoiceOption<IntensityPreference>[] = [
  { value: 'easy', label: 'Easy', emoji: '🌱', description: 'Keep it light' },
  { value: 'moderate', label: 'Moderate', emoji: '🔥', description: 'Steady effort' },
  { value: 'challenging', label: 'Push me', emoji: '🚀', description: 'Challenge accepted' },
]

const TIME_OPTIONS: ChoiceOption<TimeAvailable>[] = [
  { value: '15', label: '15 min', emoji: '⚡' },
  { value: '30', label: '30 min', emoji: '⏱️' },
  { value: '45', label: '45 min', emoji: '💪' },
  { value: '60', label: '60 min', emoji: '🏆' },
]

const TOTAL_STEPS = 4

export default function CheckInScreen() {
  const [currentStep, setCurrentStep] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState<CheckInFormData>({
    energyLevel: 5,
    sleepQuality: null,
    painLevel: 0,
    painAreas: [],
    stressLevel: 2,
    workoutType: null,
    intensityPreference: null,
    timeAvailable: null,
    notes: '',
  })

  const onboardingData = useQuery(api.onboarding.getOnboarding)
  const createCheckin = useMutation(api.checkin.createCheckin)

  const buttonScale = useSharedValue(1)

  const buttonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }))

  const handlePressIn = () => {
    buttonScale.value = withSpring(0.96)
  }

  const handlePressOut = () => {
    buttonScale.value = withSpring(1)
  }

  const updateFormData = <K extends keyof CheckInFormData>(
    key: K,
    value: CheckInFormData[K]
  ) => {
    setFormData((prev) => ({ ...prev, [key]: value }))
  }

  const canProceed = (): boolean => {
    switch (currentStep) {
      case 0: // Energy & Sleep
        return formData.sleepQuality !== null
      case 1: // Pain & Stress (pain areas only required if pain > 3)
        return formData.painLevel <= 3 || formData.painAreas.length > 0
      case 2: // Workout preferences
        return formData.workoutType !== null && formData.intensityPreference !== null
      case 3: // Time
        return formData.timeAvailable !== null
      default:
        return true
    }
  }

  const handleNext = () => {
    if (currentStep < TOTAL_STEPS - 1) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
      setCurrentStep((prev) => prev + 1)
    }
  }

  const handleBack = () => {
    if (currentStep > 0) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      setCurrentStep((prev) => prev - 1)
    } else {
      router.back()
    }
  }

  const handleSubmit = async () => {
    if (isSubmitting) return

    // Validate required fields
    if (
      !formData.sleepQuality ||
      !formData.workoutType ||
      !formData.intensityPreference ||
      !formData.timeAvailable
    ) {
      return
    }

    setIsSubmitting(true)
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

      const result = await createCheckin({
        data: {
          energyLevel: formData.energyLevel,
          sleepQuality: formData.sleepQuality,
          painLevel: formData.painLevel,
          painAreas: formData.painAreas.length > 0 ? formData.painAreas : undefined,
          stressLevel: formData.stressLevel,
          workoutType: formData.workoutType,
          intensityPreference: formData.intensityPreference,
          timeAvailable: formData.timeAvailable,
          notes: formData.notes.trim() || undefined,
        },
        startSession: true,
      })

      if (result.sessionId) {
        const sessionHref = {
          pathname: '/session',
          params: { sessionId: String(result.sessionId) },
        } as unknown as Href
        router.replace(sessionHref)
      }
    } catch (error) {
      console.error('Failed to create check-in:', error)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const firstName = onboardingData?.name?.split(' ')[0] || 'there'

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <Animated.View
            key="step-0"
            entering={SlideInRight.duration(300)}
            exiting={SlideOutLeft.duration(200)}
          >
            <Text style={styles.stepTitle}>How are you feeling today, {firstName}?</Text>
            <Text style={styles.stepSubtitle}>
              This helps me create the perfect session for you right now.
            </Text>

            <CheckInSlider
              title="Energy Level"
              subtitle="How energized do you feel right now?"
              value={formData.energyLevel}
              min={1}
              max={10}
              minLabel="Running on empty"
              maxLabel="Ready to crush it"
              onChange={(v) => updateFormData('energyLevel', v)}
              colorStart="#fbbf24"
              colorEnd="#22c55e"
              delay={100}
            />

            <CheckInChoice
              title="Sleep Quality"
              subtitle="How did you sleep last night?"
              options={SLEEP_OPTIONS}
              value={formData.sleepQuality}
              onChange={(v) => updateFormData('sleepQuality', v)}
              delay={200}
            />
          </Animated.View>
        )

      case 1:
        return (
          <Animated.View
            key="step-1"
            entering={SlideInRight.duration(300)}
            exiting={SlideOutLeft.duration(200)}
          >
            <Text style={styles.stepTitle}>Any aches or stress today?</Text>
            <Text style={styles.stepSubtitle}>
              This helps me avoid movements that might aggravate you.
            </Text>

            <CheckInSlider
              title="Pain / Discomfort"
              subtitle="Rate any pain or discomfort you're feeling"
              value={formData.painLevel}
              min={0}
              max={10}
              minLabel="None"
              maxLabel="Significant"
              onChange={(v) => updateFormData('painLevel', v)}
              colorStart="#22c55e"
              colorEnd="#ef4444"
              delay={100}
            />

            {formData.painLevel > 3 && (
              <Animated.View entering={FadeIn.duration(300)} exiting={FadeOut.duration(200)}>
                <BodyAreaSelector
                  title="Where does it hurt?"
                  subtitle="Tap all areas that feel uncomfortable"
                  selectedAreas={formData.painAreas}
                  onChange={(areas) => updateFormData('painAreas', areas)}
                  delay={0}
                />
              </Animated.View>
            )}

            <CheckInSlider
              title="Stress Level"
              subtitle="How's your mental load today?"
              value={formData.stressLevel}
              min={1}
              max={5}
              minLabel="Clear-headed"
              maxLabel="Overwhelmed"
              onChange={(v) => updateFormData('stressLevel', v)}
              colorStart="#22c55e"
              colorEnd="#f97316"
              delay={formData.painLevel > 3 ? 300 : 200}
            />
          </Animated.View>
        )

      case 2:
        return (
          <Animated.View
            key="step-2"
            entering={SlideInRight.duration(300)}
            exiting={SlideOutLeft.duration(200)}
          >
            <Text style={styles.stepTitle}>What kind of session today?</Text>
            <Text style={styles.stepSubtitle}>
              Tell me what feels right and how hard you want to work.
            </Text>

            <CheckInChoice
              title="Workout Type"
              subtitle="What sounds good right now?"
              options={WORKOUT_OPTIONS}
              value={formData.workoutType}
              onChange={(v) => updateFormData('workoutType', v)}
              columns={2}
              delay={100}
            />

            <CheckInChoice
              title="Intensity"
              subtitle="How hard do you want to push?"
              options={INTENSITY_OPTIONS}
              value={formData.intensityPreference}
              onChange={(v) => updateFormData('intensityPreference', v)}
              columns={3}
              delay={200}
            />
          </Animated.View>
        )

      case 3:
        return (
          <Animated.View
            key="step-3"
            entering={SlideInRight.duration(300)}
            exiting={SlideOutLeft.duration(200)}
          >
            <Text style={styles.stepTitle}>How much time do you have?</Text>
            <Text style={styles.stepSubtitle}>
              I'll design a session that fits your schedule.
            </Text>

            <CheckInChoice
              title="Time Available"
              subtitle="Choose your session length"
              options={TIME_OPTIONS}
              value={formData.timeAvailable}
              onChange={(v) => updateFormData('timeAvailable', v)}
              columns={2}
              delay={100}
            />

            <Animated.View
              entering={FadeInDown.delay(200).duration(400)}
              style={styles.notesContainer}
            >
              <Text style={styles.notesLabel}>Anything else I should know?</Text>
              <TextInput
                style={styles.notesInput}
                placeholder="Optional: specific goals, limitations, or requests..."
                placeholderTextColor="#9ca3af"
                value={formData.notes}
                onChangeText={(text) => updateFormData('notes', text)}
                multiline
                numberOfLines={3}
              />
            </Animated.View>
          </Animated.View>
        )

      default:
        return null
    }
  }

  return (
    <LinearGradient colors={['#fef3f2', '#ffffff', '#ffffff']} style={styles.gradient}>
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>

          {/* Progress indicator */}
          <View style={styles.progressContainer}>
            {Array.from({ length: TOTAL_STEPS }).map((_, index) => (
              <View
                key={index}
                style={[
                  styles.progressDot,
                  index === currentStep && styles.progressDotActive,
                  index < currentStep && styles.progressDotComplete,
                ]}
              />
            ))}
          </View>

          <View style={styles.headerSpacer} />
        </View>

        {/* Content */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {renderStep()}
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          {currentStep < TOTAL_STEPS - 1 ? (
            <AnimatedTouchableOpacity
              style={[
                styles.nextButton,
                !canProceed() && styles.nextButtonDisabled,
                buttonAnimatedStyle,
              ]}
              onPress={handleNext}
              onPressIn={handlePressIn}
              onPressOut={handlePressOut}
              disabled={!canProceed()}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={canProceed() ? ['#6366f1', '#4f46e5'] : ['#d1d5db', '#9ca3af']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.nextButtonGradient}
              >
                <Text style={styles.nextButtonText}>Continue</Text>
              </LinearGradient>
            </AnimatedTouchableOpacity>
          ) : (
            <AnimatedTouchableOpacity
              style={[
                styles.nextButton,
                (!canProceed() || isSubmitting) && styles.nextButtonDisabled,
                buttonAnimatedStyle,
              ]}
              onPress={handleSubmit}
              onPressIn={handlePressIn}
              onPressOut={handlePressOut}
              disabled={!canProceed() || isSubmitting}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={
                  canProceed() && !isSubmitting
                    ? ['#f97316', '#ea580c']
                    : ['#d1d5db', '#9ca3af']
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.nextButtonGradient}
              >
                {isSubmitting ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color="#ffffff" />
                    <Text style={styles.nextButtonText}>Building your session...</Text>
                  </View>
                ) : (
                  <Text style={styles.nextButtonText}>Start Session →</Text>
                )}
              </LinearGradient>
            </AnimatedTouchableOpacity>
          )}
        </View>
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
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  backButton: {
    width: 80,
  },
  backText: {
    fontSize: 16,
    color: '#4f46e5',
    fontWeight: '600',
  },
  progressContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#e5e7eb',
  },
  progressDotActive: {
    backgroundColor: '#4f46e5',
    width: 24,
  },
  progressDotComplete: {
    backgroundColor: '#22c55e',
  },
  headerSpacer: {
    width: 80,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 32,
  },
  stepTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  stepSubtitle: {
    fontSize: 16,
    color: '#6b7280',
    marginBottom: 32,
    lineHeight: 22,
  },
  notesContainer: {
    marginTop: 8,
  },
  notesLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
  },
  notesInput: {
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    borderRadius: 16,
    padding: 16,
    fontSize: 15,
    color: '#1f2937',
    minHeight: 100,
    textAlignVertical: 'top',
  },
  footer: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    paddingTop: 8,
    backgroundColor: 'transparent',
  },
  nextButton: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#4f46e5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  nextButtonDisabled: {
    shadowOpacity: 0,
    elevation: 0,
  },
  nextButtonGradient: {
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#ffffff',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
})
