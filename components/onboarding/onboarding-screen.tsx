import React, { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native'
import Animated, {
  FadeInRight,
  FadeOutLeft,
} from 'react-native-reanimated'
import { LinearGradient } from 'expo-linear-gradient'
import * as Haptics from 'expo-haptics'

import StepOne from './step-one'
import StepTwo from './step-two'
import StepThree from './step-three'
import StepFour from './step-four'

export interface OnboardingData {
  // Step 1: Basic Info
  name: string
  age: string
  gender: 'male' | 'female' | 'prefer-not-to-say' | null

  // Step 2: Goals & Activity
  goal: string
  activityLevel: 'sedentary' | 'light' | 'moderate' | 'active' | 'very-active' | null
  timeAvailable: string[]

  // Step 3: Health Context
  injuries: string[]
  conditions: string[]
  medications: string

  // Step 4: Lifestyle
  smoking: 'never' | 'former' | 'current' | null
  alcohol: 'never' | 'occasionally' | 'regularly' | null
  trackPeriod: boolean
}

interface OnboardingScreenProps {
  onComplete: (data: OnboardingData) => void
}

export default function OnboardingScreen({ onComplete }: OnboardingScreenProps) {
  const [currentStep, setCurrentStep] = useState(1)
  const [data, setData] = useState<OnboardingData>({
    name: '',
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

  const totalSteps = 4

  const updateData = (updates: Partial<OnboardingData>) => {
    setData((prev) => ({ ...prev, ...updates }))
  }

  const handleNext = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    if (currentStep < totalSteps) {
      setCurrentStep((prev) => prev + 1)
    } else {
      onComplete(data)
    }
  }

  const handleSkip = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    if (currentStep < totalSteps) {
      setCurrentStep((prev) => prev + 1)
    } else {
      onComplete(data)
    }
  }

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1)
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
    <View style={styles.container}>
      <LinearGradient
        colors={['#f8f9fa', '#ffffff', '#f8f9fa']}
        style={styles.gradient}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.content}>
              {/* Header */}
              <View style={styles.header}>
                <Text style={styles.headerTitle}>Profile Set Up {currentStep}</Text>
              </View>

              {/* Progress Bar */}
              <View style={styles.progressContainer}>
                <Text style={styles.progressText}>
                  {currentStep}/{totalSteps} steps
                </Text>
                <View style={styles.progressBarBackground}>
                  <Animated.View
                    style={[
                      styles.progressBarFill,
                      { width: `${(currentStep / totalSteps) * 100}%` },
                    ]}
                  />
                </View>
              </View>

              {/* Step Content */}
              <Animated.View
                key={currentStep}
                entering={FadeInRight.duration(400).springify()}
                exiting={FadeOutLeft.duration(400)}
                style={styles.stepContent}
              >
                {renderStep()}
              </Animated.View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </LinearGradient>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    marginBottom: 24,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  progressContainer: {
    marginBottom: 32,
  },
  progressText: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 8,
    fontWeight: '500',
  },
  progressBarBackground: {
    height: 6,
    backgroundColor: '#e5e7eb',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#6366f1',
    borderRadius: 3,
  },
  stepContent: {
    flex: 1,
  },
})



