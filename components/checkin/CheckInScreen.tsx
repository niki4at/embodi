import { api } from '@/convex/_generated/api'
import { useMutation, useQuery } from 'convex/react'
import * as Haptics from 'expo-haptics'
import { router, type Href } from 'expo-router'
import React, { useMemo, useState } from 'react'
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
  FadeInDown,
  SlideInRight,
  SlideOutLeft,
} from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'

import { IconSymbol } from '@/components/ui/icon-symbol'
import { PillButton } from '@/components/ui/pill-button'
import { motion, radius, spacing, typography } from '@/constants/design'
import { useTheme } from '@/constants/theme-context'

import CheckInChoice, { type ChoiceOption } from './CheckInChoice'
import CheckInSlider from './CheckInSlider'
import { PainBodyMap, type BodyPart, type PainRatings } from './PainBodyMap'

type SleepQuality = 'rough' | 'okay' | 'decent' | 'great'
type WorkoutType = 'strength' | 'mobility' | 'cardio' | 'recovery' | 'mixed'
type IntensityPreference = 'easy' | 'moderate' | 'challenging'
type TimeAvailable = '15' | '30' | '45' | '60'

interface CheckInFormData {
  energyLevel: number
  sleepQuality: SleepQuality | null
  painRatings: PainRatings
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
  { value: 'challenging', label: 'Push me', emoji: '🚀', description: 'Go hard' },
]

const TIME_OPTIONS: ChoiceOption<TimeAvailable>[] = [
  { value: '15', label: '15 min', emoji: '⚡' },
  { value: '30', label: '30 min', emoji: '⏱️' },
  { value: '45', label: '45 min', emoji: '💪' },
  { value: '60', label: '60 min', emoji: '🏆' },
]

const TOTAL_STEPS = 4

export default function CheckInScreen() {
  const { palette } = useTheme()
  const [currentStep, setCurrentStep] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [notesFocused, setNotesFocused] = useState(false)
  const [formData, setFormData] = useState<CheckInFormData>({
    energyLevel: 5,
    sleepQuality: null,
    painRatings: {},
    stressLevel: 2,
    workoutType: null,
    intensityPreference: null,
    timeAvailable: null,
    notes: '',
  })

  const onboardingData = useQuery(api.onboarding.getOnboarding)
  const createCheckin = useMutation(api.checkin.createCheckin)

  const updateFormData = <K extends keyof CheckInFormData>(
    key: K,
    value: CheckInFormData[K],
  ) => {
    setFormData(prev => ({ ...prev, [key]: value }))
  }

  const { painLevel, painAreas } = useMemo(() => {
    const entries = Object.entries(formData.painRatings) as [BodyPart, number][]
    const max = entries.reduce((acc, [, lvl]) => Math.max(acc, lvl), 0)
    return {
      painLevel: max,
      painAreas: entries.filter(([, lvl]) => lvl > 0).map(([part]) => part),
    }
  }, [formData.painRatings])

  const canProceed = (): boolean => {
    switch (currentStep) {
      case 0:
        return formData.sleepQuality !== null
      case 1:
        return true
      case 2:
        return (
          formData.workoutType !== null && formData.intensityPreference !== null
        )
      case 3:
        return formData.timeAvailable !== null
      default:
        return true
    }
  }

  const handleNext = () => {
    if (currentStep < TOTAL_STEPS - 1) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
      setCurrentStep(prev => prev + 1)
    }
  }

  const handleBack = () => {
    if (currentStep > 0) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      setCurrentStep(prev => prev - 1)
    } else {
      router.back()
    }
  }

  const handleSubmit = async () => {
    if (isSubmitting) return

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
          painLevel,
          painAreas: painAreas.length > 0 ? painAreas : undefined,
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
  const proceedEnabled = canProceed()
  const isLast = currentStep === TOTAL_STEPS - 1
  const buttonDisabled = !proceedEnabled || (isLast && isSubmitting)

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <Animated.View
            key="step-0"
            entering={SlideInRight.duration(motion.duration.base)}
            exiting={SlideOutLeft.duration(motion.duration.quick)}
          >
            <Text style={[styles.stepTitle, { color: palette.textPrimary }]}>
              How are you feeling today, {firstName}?
            </Text>
            <Text
              style={[styles.stepSubtitle, { color: palette.textSecondary }]}
            >
              This shapes the session you get next.
            </Text>

            <CheckInSlider
              title="Energy"
              subtitle="How energised do you feel right now?"
              value={formData.energyLevel}
              min={1}
              max={10}
              minLabel="Running on empty"
              maxLabel="Ready to crush it"
              onChange={v => updateFormData('energyLevel', v)}
              delay={80}
            />

            <CheckInChoice
              title="Sleep quality"
              subtitle="How did you sleep last night?"
              options={SLEEP_OPTIONS}
              value={formData.sleepQuality}
              onChange={v => updateFormData('sleepQuality', v)}
              delay={160}
            />
          </Animated.View>
        )

      case 1:
        return (
          <Animated.View
            key="step-1"
            entering={SlideInRight.duration(motion.duration.base)}
            exiting={SlideOutLeft.duration(motion.duration.quick)}
          >
            <Text style={[styles.stepTitle, { color: palette.textPrimary }]}>
              Any aches today?
            </Text>
            <Text
              style={[styles.stepSubtitle, { color: palette.textSecondary }]}
            >
              Tap any body part that hurts and rate the intensity. I&apos;ll steer
              the session around what&apos;s flaring up.
            </Text>

            <PainBodyMap
              value={formData.painRatings}
              onChange={ratings => updateFormData('painRatings', ratings)}
            />

            <View style={{ height: spacing.xl }} />

            <CheckInSlider
              title="Stress"
              subtitle="How's your mental load?"
              value={formData.stressLevel}
              min={1}
              max={5}
              minLabel="Clear-headed"
              maxLabel="Overwhelmed"
              onChange={v => updateFormData('stressLevel', v)}
              delay={160}
            />
          </Animated.View>
        )

      case 2:
        return (
          <Animated.View
            key="step-2"
            entering={SlideInRight.duration(motion.duration.base)}
            exiting={SlideOutLeft.duration(motion.duration.quick)}
          >
            <Text style={[styles.stepTitle, { color: palette.textPrimary }]}>
              What kind of session today?
            </Text>
            <Text
              style={[styles.stepSubtitle, { color: palette.textSecondary }]}
            >
              Pick the focus and how hard you want to work.
            </Text>

            <CheckInChoice
              title="Workout type"
              subtitle="What sounds good right now?"
              options={WORKOUT_OPTIONS}
              value={formData.workoutType}
              onChange={v => updateFormData('workoutType', v)}
              columns={2}
              delay={80}
            />

            <CheckInChoice
              title="Intensity"
              subtitle="How hard do you want to push?"
              options={INTENSITY_OPTIONS}
              value={formData.intensityPreference}
              onChange={v => updateFormData('intensityPreference', v)}
              columns={3}
              delay={160}
            />
          </Animated.View>
        )

      case 3:
        return (
          <Animated.View
            key="step-3"
            entering={SlideInRight.duration(motion.duration.base)}
            exiting={SlideOutLeft.duration(motion.duration.quick)}
          >
            <Text style={[styles.stepTitle, { color: palette.textPrimary }]}>
              How much time do you have?
            </Text>
            <Text
              style={[styles.stepSubtitle, { color: palette.textSecondary }]}
            >
              I&apos;ll design a session that fits.
            </Text>

            <CheckInChoice
              title="Time available"
              subtitle="Choose your session length"
              options={TIME_OPTIONS}
              value={formData.timeAvailable}
              onChange={v => updateFormData('timeAvailable', v)}
              columns={2}
              delay={80}
            />

            <Animated.View
              entering={FadeInDown.delay(160).duration(motion.duration.base)}
              style={styles.notesContainer}
            >
              <Text
                style={[styles.notesLabel, { color: palette.textPrimary }]}
              >
                Anything else I should know?
              </Text>
              <TextInput
                style={[
                  styles.notesInput,
                  {
                    backgroundColor: palette.surface,
                    borderColor: notesFocused
                      ? palette.primary
                      : palette.borderStrong,
                    color: palette.textPrimary,
                  },
                ]}
                placeholder="Goals, limitations or requests (optional)"
                placeholderTextColor={palette.textTertiary}
                value={formData.notes}
                onChangeText={text => updateFormData('notes', text)}
                onFocus={() => setNotesFocused(true)}
                onBlur={() => setNotesFocused(false)}
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

  const progress = (currentStep + 1) / TOTAL_STEPS

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: palette.bg }]}
      edges={['top']}
    >
      <View style={[styles.container, { backgroundColor: palette.bg }]}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={handleBack}
            style={[
              styles.iconButton,
              {
                backgroundColor: palette.surface,
                borderColor: palette.border,
              },
            ]}
            hitSlop={12}
          >
            <IconSymbol
              name="chevron.left"
              size={22}
              color={palette.textPrimary}
            />
          </TouchableOpacity>

          <View
            style={[styles.progressTrack, { backgroundColor: palette.surfaceAlt }]}
          >
            <View
              style={[
                styles.progressFill,
                {
                  backgroundColor: palette.primary,
                  width: `${progress * 100}%`,
                },
              ]}
            />
          </View>

          <Text style={[styles.stepCount, { color: palette.textSecondary }]}>
            {currentStep + 1}/{TOTAL_STEPS}
          </Text>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {renderStep()}
        </ScrollView>

        <View
          style={[
            styles.footer,
            {
              backgroundColor: palette.bg,
              borderTopColor: palette.divider,
            },
          ]}
        >
          {isLast && isSubmitting ? (
            <View
              style={[
                styles.submittingPill,
                { backgroundColor: palette.primary },
              ]}
            >
              <ActivityIndicator size="small" color={palette.white} />
              <Text style={[styles.submittingLabel, { color: palette.white }]}>
                Building your session…
              </Text>
            </View>
          ) : (
            <PillButton
              label={isLast ? 'Start session' : 'Continue'}
              onPress={isLast ? handleSubmit : handleNext}
              disabled={buttonDisabled}
            />
          )}
        </View>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  stepCount: {
    ...typography.smallStrong,
    minWidth: 30,
    textAlign: 'right',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxxl,
  },
  stepTitle: {
    ...typography.h1,
    marginBottom: spacing.sm,
  },
  stepSubtitle: {
    ...typography.body,
    marginBottom: spacing.xxl,
  },
  notesContainer: {
    marginTop: spacing.sm,
  },
  notesLabel: {
    ...typography.h3,
    marginBottom: spacing.md,
  },
  notesInput: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...typography.body,
    minHeight: 110,
    textAlignVertical: 'top',
  },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  submittingPill: {
    height: 58,
    borderRadius: radius.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  submittingLabel: {
    ...typography.button,
  },
})
