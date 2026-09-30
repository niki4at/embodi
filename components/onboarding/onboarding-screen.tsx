import React, { useState } from 'react'
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import Animated, { FadeInRight, FadeOutLeft } from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'

import StepOne from './step-one'
import StepTwo from './step-two'
import StepThree from './step-three'
import StepFour from './step-four'
import { BodfitWordmark } from '@/components/ui/bodfit-logo'
import { motion, spacing, typography } from '@/constants/design'
import { useTheme } from '@/constants/theme-context'

export interface OnboardingData {
  name: string
  username: string
  age: string
  gender: 'male' | 'female' | 'prefer-not-to-say' | null
  goal: string
  activityLevel:
    | 'sedentary'
    | 'light'
    | 'moderate'
    | 'active'
    | 'very-active'
    | null
  timeAvailable: string[]
  injuries: string[]
  conditions: string[]
  medications: string
  smoking: 'never' | 'former' | 'current' | null
  alcohol: 'never' | 'occasionally' | 'regularly' | null
  trackPeriod: boolean
}

interface OnboardingScreenProps {
  onComplete: (data: OnboardingData) => void
}

const TOTAL_STEPS = 4

export default function OnboardingScreen({ onComplete }: OnboardingScreenProps) {
  const { palette } = useTheme()
  const [currentStep, setCurrentStep] = useState(1)
  const [data, setData] = useState<OnboardingData>({
    name: '',
    username: '',
    age: '',
    gender: null,
    goal: '',
    activityLevel: null,
    timeAvailable: [],
    injuries: [],
    conditions: [],
    medications: '',
    smoking: null,
    alcohol: null,
    trackPeriod: false,
  })

  const updateData = (updates: Partial<OnboardingData>) => {
    setData(prev => ({ ...prev, ...updates }))
  }

  const handleNext = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    if (currentStep < TOTAL_STEPS) {
      setCurrentStep(prev => prev + 1)
    } else {
      onComplete(data)
    }
  }

  const handleSkip = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    if (currentStep < TOTAL_STEPS) {
      setCurrentStep(prev => prev + 1)
    } else {
      onComplete(data)
    }
  }

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1)
    }
  }

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <StepOne
            data={data}
            updateData={updateData}
            onNext={handleNext}
            onSkip={handleSkip}
          />
        )
      case 2:
        return (
          <StepTwo
            data={data}
            updateData={updateData}
            onNext={handleNext}
            onSkip={handleSkip}
            onBack={handleBack}
          />
        )
      case 3:
        return (
          <StepThree
            data={data}
            updateData={updateData}
            onNext={handleNext}
            onSkip={handleSkip}
            onBack={handleBack}
          />
        )
      case 4:
        return (
          <StepFour
            data={data}
            updateData={updateData}
            onNext={handleNext}
            onSkip={handleSkip}
            onBack={handleBack}
          />
        )
      default:
        return null
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: palette.bg }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={styles.headerBar}>
          <View style={styles.headerTop}>
            {currentStep > 1 ? (
              <TouchableOpacity
                onPress={handleBack}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel="Back"
              >
                <Text style={[styles.backText, { color: palette.textSecondary }]}>
                  {'\u2190'} Back
                </Text>
              </TouchableOpacity>
            ) : (
              <BodfitWordmark variant="header" />
            )}
            <View style={styles.headerRight}>
              <Text
                style={[styles.progressText, { color: palette.textSecondary }]}
                accessibilityLabel={`Step ${currentStep} of ${TOTAL_STEPS}`}
              >
                {currentStep} / {TOTAL_STEPS}
              </Text>
              <TouchableOpacity
                onPress={handleSkip}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel="Skip this step"
              >
                <Text style={[styles.skipText, { color: palette.textSecondary }]}>
                  Skip
                </Text>
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.segments} accessible={false}>
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <View
                key={i}
                style={[
                  styles.segment,
                  {
                    backgroundColor:
                      i < currentStep ? palette.primary : palette.surfaceHigh,
                  },
                ]}
              />
            ))}
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View
            key={currentStep}
            entering={FadeInRight.duration(motion.duration.base)}
            exiting={FadeOutLeft.duration(motion.duration.quick)}
            style={styles.stepContent}
          >
            {renderStep()}
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  headerBar: {
    paddingHorizontal: spacing.xl,
    paddingTop: 56,
    paddingBottom: spacing.md,
    gap: spacing.md,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 28,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  backText: {
    ...typography.smallStrong,
  },
  segments: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  segment: {
    flex: 1,
    height: 3,
    borderRadius: 2,
  },
  progressText: {
    ...typography.mono,
  },
  skipText: {
    ...typography.smallStrong,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.huge,
    maxWidth: 540,
    width: '100%',
    alignSelf: 'center',
  },
  stepContent: {
    flex: 1,
  },
})
