import { api } from '@/convex/_generated/api'
import { useMutation, useQuery } from 'convex/react'
import * as Haptics from 'expo-haptics'
import { LinearGradient } from 'expo-linear-gradient'
import { router } from 'expo-router'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import Animated, {
  FadeInDown,
  FadeInRight,
  FadeOutLeft,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated'

const AnimatedTouchableOpacity =
  Animated.createAnimatedComponent(TouchableOpacity)

type ProfileQuestion = {
  id: string
  category: string
  questionText: string
  answerType: 'slider' | 'single' | 'multi' | 'text'
  options?: string[]
  sliderMin?: number
  sliderMax?: number
  sliderLabels?: string[]
}

export default function ProfileQuestionScreen() {
  const profileQuestions = useQuery(api.profileQuestions.getProfileQuestions)
  const existingAnswers = useQuery(api.profileQuestions.getProfileAnswers)
  const submitAnswer = useMutation(api.profileQuestions.submitQuestionAnswer)
  const submitAllAnswers = useMutation(api.profileQuestions.submitAllAnswers)
  const completeProfile = useMutation(api.profileQuestions.completeProfile)

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [localAnswers, setLocalAnswers] = useState<
    Record<string, string | number | string[]>
  >({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [hasInitialized, setHasInitialized] = useState(false)

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

  const questions = profileQuestions?.questions || []
  const currentQuestion = questions[currentQuestionIndex]

  // Create a map of existing answers by question ID
  const existingAnswerMap = useMemo(() => {
    const map: Record<string, string | number | string[]> = {}
    if (existingAnswers) {
      for (const answer of existingAnswers) {
        map[answer.questionId] = answer.answer
      }
    }
    return map
  }, [existingAnswers])

  // Find next unanswered question
  const findNextUnansweredIndex = useCallback(() => {
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i]
      if (
        existingAnswerMap[q.id] === undefined &&
        localAnswers[q.id] === undefined
      ) {
        return i
      }
    }
    return -1 // All answered
  }, [questions, localAnswers, existingAnswerMap])

  // Initialize to first unanswered question - only on first load
  useEffect(() => {
    if (hasInitialized || questions.length === 0 || existingAnswers === undefined) return
    
    const nextIndex = findNextUnansweredIndex()
    if (nextIndex !== -1 && nextIndex !== currentQuestionIndex) {
      setCurrentQuestionIndex(nextIndex)
    }
    setHasInitialized(true)
  }, [findNextUnansweredIndex, questions.length, hasInitialized, currentQuestionIndex, existingAnswers])

  const handleSliderChange = (value: number) => {
    if (currentQuestion) {
      setLocalAnswers((prev) => ({
        ...prev,
        [currentQuestion.id]: Math.round(value),
      }))
    }
  }

  const handleSingleSelect = (option: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    if (currentQuestion) {
      setLocalAnswers((prev) => ({
        ...prev,
        [currentQuestion.id]: option,
      }))
    }
  }

  const handleMultiSelect = (option: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    if (currentQuestion) {
      const currentSelection =
        (localAnswers[currentQuestion.id] as string[]) || []
      const newSelection = currentSelection.includes(option)
        ? currentSelection.filter((o) => o !== option)
        : [...currentSelection, option]
      setLocalAnswers((prev) => ({
        ...prev,
        [currentQuestion.id]: newSelection,
      }))
    }
  }

  const handleTextChange = (text: string) => {
    if (currentQuestion) {
      setLocalAnswers((prev) => ({
        ...prev,
        [currentQuestion.id]: text,
      }))
    }
  }

  const getCurrentAnswer = () => {
    if (!currentQuestion) return undefined
    return (
      localAnswers[currentQuestion.id] ?? existingAnswerMap[currentQuestion.id]
    )
  }

  const canProceed = () => {
    const answer = getCurrentAnswer()
    if (answer === undefined) return false
    if (Array.isArray(answer)) return answer.length > 0
    if (typeof answer === 'string') return answer.trim().length > 0
    return true
  }

  const handleNext = async () => {
    if (!currentQuestion || isSubmitting) return

    setIsSubmitting(true)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

    try {
      const answer = getCurrentAnswer()
      if (answer !== undefined) {
        await submitAnswer({
          questionId: currentQuestion.id,
          answer,
        })
      }

      const isAtEnd = currentQuestionIndex >= questions.length - 1
      const isReady = profileQuestions?.status === 'ready'

      // Only complete if we're at the end AND questions are fully generated
      if (isAtEnd && isReady) {
        // Batch save ALL local answers before completing (for reliability)
        const allAnswers = Object.entries(localAnswers)
          .filter(([, value]) => value !== undefined)
          .map(([questionId, answer]) => ({
            questionId,
            answer: answer as string | number | string[],
          }))
        
        if (allAnswers.length > 0) {
          await submitAllAnswers({ answers: allAnswers })
        }
        
        // Complete the profile
        await completeProfile({})
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        router.back()
      } else if (!isAtEnd) {
        // Move to next question
        setCurrentQuestionIndex((prev) => prev + 1)
      }
      // If isAtEnd but still generating, do nothing - UI will update when more questions arrive
    } catch (error) {
      console.error('Failed to submit answer:', error)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex((prev) => prev - 1)
    } else {
      router.back()
    }
  }

  const handleSkip = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    
    const isAtEnd = currentQuestionIndex >= questions.length - 1
    const isReady = profileQuestions?.status === 'ready'
    
    // Only complete if at end AND questions are fully generated
    if (isAtEnd && isReady) {
      try {
        // Batch save ALL local answers before completing
        const allAnswers = Object.entries(localAnswers)
          .filter(([, value]) => value !== undefined)
          .map(([questionId, answer]) => ({
            questionId,
            answer: answer as string | number | string[],
          }))
        
        if (allAnswers.length > 0) {
          await submitAllAnswers({ answers: allAnswers })
        }
        
        await completeProfile({})
        router.back()
      } catch (error) {
        console.error('Failed to complete profile:', error)
      }
    } else if (!isAtEnd) {
      setCurrentQuestionIndex((prev) => prev + 1)
    }
    // If isAtEnd but still generating, do nothing - wait for more questions
  }

  // Show failed state with back button
  if (profileQuestions?.status === 'failed') {
    return (
      <SafeAreaView style={styles.container}>
        <LinearGradient
          colors={['#0f0f23', '#1a1a2e']}
          style={styles.gradient}
        >
          <View style={styles.loadingContainer}>
            <Text style={styles.failedEmoji}>⚠️</Text>
            <Text style={styles.failedTitle}>Something went wrong</Text>
            <Text style={styles.failedSubtitle}>
              We couldn't generate your questions. Go back to retry.
            </Text>
            <TouchableOpacity 
              style={styles.failedBackButton} 
              onPress={() => router.back()}
            >
              <Text style={styles.failedBackButtonText}>← Go back</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </SafeAreaView>
    )
  }

  // Show loading when no data yet or generating with no questions available
  const isGenerating = profileQuestions?.status === 'generating'
  const hasQuestions = questions.length > 0
  
  if (!profileQuestions || (isGenerating && !hasQuestions)) {
    return (
      <SafeAreaView style={styles.container}>
        <LinearGradient
          colors={['#0f0f23', '#1a1a2e']}
          style={styles.gradient}
        >
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingEmoji}>✨</Text>
            <Text style={styles.loadingTitle}>Personalizing your questions...</Text>
            <Text style={styles.loadingSubtitle}>
              Creating questions tailored to your goals
            </Text>
          </View>
        </LinearGradient>
      </SafeAreaView>
    )
  }

  if (!currentQuestion) {
    return null
  }

  // Use questions.length for progress while generating (totalCount may be 0)
  // Once ready, totalCount is accurate
  const totalQuestions = profileQuestions.status === 'ready' 
    ? profileQuestions.totalCount 
    : questions.length
  
  const progress =
    totalQuestions > 0
      ? ((currentQuestionIndex + 1) / totalQuestions) * 100
      : 0

  // During generation, only consider "last" if we're at the end AND status is ready
  const isAtEndOfAvailable = currentQuestionIndex >= questions.length - 1
  const isLastQuestion = profileQuestions.status === 'ready' && isAtEndOfAvailable
  
  // If at end of available questions but still generating, show waiting state
  const isWaitingForMore = isGenerating && isAtEndOfAvailable

  // Check for safety flags (red indicators)
  const isSafetyQuestion =
    currentQuestion.category.toLowerCase().includes('safety') ||
    currentQuestion.questionText.toLowerCase().includes('symptom')

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={['#0f0f23', '#1a1a2e']} style={styles.gradient}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={handleBack} style={styles.backButton}>
              <Text style={styles.backButtonText}>← Back</Text>
            </TouchableOpacity>
            <Text style={styles.categoryLabel}>{currentQuestion.category}</Text>
          </View>

          {/* Progress */}
          <View style={styles.progressContainer}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressText}>
                Question {currentQuestionIndex + 1} of {totalQuestions}
                {isGenerating && '+'}
              </Text>
              {isGenerating && (
                <Text style={styles.generatingBadge}>Creating more...</Text>
              )}
            </View>
            <View style={styles.progressBarBackground}>
              <Animated.View
                style={[styles.progressBarFill, { width: `${progress}%` }]}
              />
            </View>
          </View>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Question */}
            <Animated.View
              key={currentQuestion.id}
              entering={FadeInRight.duration(400).springify()}
              exiting={FadeOutLeft.duration(300)}
              style={styles.questionContainer}
            >
              <Text style={styles.questionText}>
                {currentQuestion.questionText}
              </Text>

              {/* Slider type - Custom number picker */}
              {currentQuestion.answerType === 'slider' && (
                <View style={styles.sliderContainer}>
                  <View style={styles.sliderValueContainer}>
                    <Text style={styles.sliderValue}>
                      {(getCurrentAnswer() as number) ??
                        (currentQuestion.sliderMin ?? 0)}
                    </Text>
                  </View>
                  <View style={styles.sliderTrack}>
                    {Array.from(
                      {
                        length:
                          (currentQuestion.sliderMax ?? 10) -
                          (currentQuestion.sliderMin ?? 0) +
                          1,
                      },
                      (_, i) => (currentQuestion.sliderMin ?? 0) + i
                    ).map((value) => {
                      const currentValue =
                        (getCurrentAnswer() as number) ??
                        (currentQuestion.sliderMin ?? 0)
                      const isSelected = value === currentValue
                      const isFilled = value <= currentValue
                      return (
                        <TouchableOpacity
                          key={value}
                          style={[
                            styles.sliderDot,
                            isFilled && styles.sliderDotFilled,
                            isSelected && styles.sliderDotSelected,
                          ]}
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                            handleSliderChange(value)
                          }}
                          activeOpacity={0.7}
                        >
                          <Text
                            style={[
                              styles.sliderDotText,
                              (isFilled || isSelected) && styles.sliderDotTextSelected,
                            ]}
                          >
                            {value}
                          </Text>
                        </TouchableOpacity>
                      )
                    })}
                  </View>
                  <View style={styles.sliderLabels}>
                    {currentQuestion.sliderLabels?.map((label, index) => (
                      <Text key={index} style={styles.sliderLabel}>
                        {label}
                      </Text>
                    ))}
                  </View>
                </View>
              )}

              {/* Single select type */}
              {currentQuestion.answerType === 'single' && (
                <View style={styles.optionsContainer}>
                  {currentQuestion.options?.map((option, index) => {
                    const isSelected = getCurrentAnswer() === option
                    return (
                      <Animated.View
                        key={option}
                        entering={FadeInDown.delay(index * 50)
                          .duration(400)
                          .springify()}
                      >
                        <TouchableOpacity
                          style={[
                            styles.optionCard,
                            isSelected && styles.optionCardSelected,
                          ]}
                          onPress={() => handleSingleSelect(option)}
                          activeOpacity={0.7}
                        >
                          <View
                            style={[
                              styles.radioOuter,
                              isSelected && styles.radioOuterSelected,
                            ]}
                          >
                            {isSelected && <View style={styles.radioInner} />}
                          </View>
                          <Text
                            style={[
                              styles.optionText,
                              isSelected && styles.optionTextSelected,
                            ]}
                          >
                            {option}
                          </Text>
                        </TouchableOpacity>
                      </Animated.View>
                    )
                  })}
                </View>
              )}

              {/* Multi select type */}
              {currentQuestion.answerType === 'multi' && (
                <View style={styles.multiContainer}>
                  <Text style={styles.multiHint}>Select all that apply</Text>
                  <View style={styles.chipGrid}>
                    {currentQuestion.options?.map((option, index) => {
                      const selectedOptions =
                        (getCurrentAnswer() as string[]) || []
                      const isSelected = selectedOptions.includes(option)
                      const isSafetyFlag =
                        isSafetyQuestion &&
                        !option.toLowerCase().includes('none')
                      return (
                        <Animated.View
                          key={option}
                          entering={FadeInDown.delay(index * 30)
                            .duration(400)
                            .springify()}
                        >
                          <TouchableOpacity
                            style={[
                              styles.chip,
                              isSelected && styles.chipSelected,
                              isSelected &&
                                isSafetyFlag &&
                                styles.chipSafetySelected,
                            ]}
                            onPress={() => handleMultiSelect(option)}
                            activeOpacity={0.7}
                          >
                            <Text
                              style={[
                                styles.chipText,
                                isSelected && styles.chipTextSelected,
                              ]}
                            >
                              {option}
                            </Text>
                            {isSelected && isSafetyFlag && (
                              <View style={styles.safetyIndicator} />
                            )}
                          </TouchableOpacity>
                        </Animated.View>
                      )
                    })}
                  </View>
                  {isSafetyQuestion && (
                    <View style={styles.safetyNote}>
                      <Text style={styles.safetyNoteText}>
                        Some symptoms may require medical assessment. Your plan
                        will start with mobility-only sessions.
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {/* Text input type */}
              {currentQuestion.answerType === 'text' && (
                <View style={styles.textInputContainer}>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Type your answer..."
                    placeholderTextColor="#6b7280"
                    value={(getCurrentAnswer() as string) || ''}
                    onChangeText={handleTextChange}
                    multiline
                    textAlignVertical="top"
                  />
                </View>
              )}
            </Animated.View>
          </ScrollView>

          {/* Bottom buttons */}
          <View style={styles.bottomContainer}>
            <Animated.View style={[styles.nextButtonWrapper, buttonAnimatedStyle]}>
              <Pressable
                onPress={handleNext}
                onPressIn={handleButtonPressIn}
                onPressOut={handleButtonPressOut}
                disabled={!canProceed() || isSubmitting}
              >
                <LinearGradient
                  colors={
                    canProceed() && !isSubmitting && !isWaitingForMore
                      ? ['#6366f1', '#4f46e5']
                      : ['#374151', '#1f2937']
                  }
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.nextButton}
                >
                  <Text style={styles.nextButtonText}>
                    {isSubmitting
                      ? 'Saving...'
                      : isWaitingForMore
                        ? 'Creating more questions...'
                        : isLastQuestion
                          ? 'Complete Profile'
                          : 'Next'}
                  </Text>
                </LinearGradient>
              </Pressable>
            </Animated.View>

            <TouchableOpacity 
              onPress={handleSkip} 
              style={styles.skipButton}
              disabled={isWaitingForMore}
            >
              <Text style={[styles.skipButtonText, isWaitingForMore && styles.skipButtonTextDisabled]}>
                {isLastQuestion ? 'Skip & finish later' : 'Skip this question'}
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </LinearGradient>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f23',
  },
  gradient: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  loadingEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  loadingTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#e0e7ff',
    marginBottom: 8,
    textAlign: 'center',
  },
  loadingSubtitle: {
    fontSize: 15,
    color: '#a5b4fc',
    textAlign: 'center',
  },
  failedEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  failedTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fecaca',
    marginBottom: 8,
    textAlign: 'center',
  },
  failedSubtitle: {
    fontSize: 15,
    color: '#fca5a5',
    textAlign: 'center',
    marginBottom: 24,
  },
  failedBackButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  failedBackButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  backButton: {
    paddingVertical: 8,
    paddingRight: 16,
  },
  backButtonText: {
    fontSize: 16,
    color: '#818cf8',
    fontWeight: '500',
  },
  categoryLabel: {
    fontSize: 14,
    color: '#9ca3af',
    fontWeight: '500',
  },
  progressContainer: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  progressText: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '500',
  },
  generatingBadge: {
    fontSize: 12,
    color: '#a5b4fc',
    fontWeight: '500',
  },
  progressBarBackground: {
    height: 4,
    backgroundColor: '#374151',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#6366f1',
    borderRadius: 2,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
  },
  questionContainer: {
    flex: 1,
  },
  questionText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 32,
    lineHeight: 32,
  },
  // Slider styles
  sliderContainer: {
    marginBottom: 24,
  },
  sliderValueContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  sliderValue: {
    fontSize: 64,
    fontWeight: '700',
    color: '#6366f1',
  },
  sliderTrack: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sliderDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#374151',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#4b5563',
  },
  sliderDotFilled: {
    backgroundColor: '#4338ca',
    borderColor: '#6366f1',
  },
  sliderDotSelected: {
    backgroundColor: '#6366f1',
    borderColor: '#818cf8',
    transform: [{ scale: 1.2 }],
  },
  sliderDotText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9ca3af',
  },
  sliderDotTextSelected: {
    color: '#ffffff',
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  sliderLabel: {
    fontSize: 12,
    color: '#9ca3af',
    maxWidth: '30%',
    textAlign: 'center',
  },
  // Single select styles
  optionsContainer: {
    gap: 12,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1f2937',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#374151',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  optionCardSelected: {
    borderColor: '#6366f1',
    backgroundColor: '#312e81',
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#4b5563',
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
    color: '#d1d5db',
    fontWeight: '500',
    flex: 1,
  },
  optionTextSelected: {
    color: '#e0e7ff',
    fontWeight: '600',
  },
  // Multi select styles
  multiContainer: {
    marginBottom: 24,
  },
  multiHint: {
    fontSize: 14,
    color: '#9ca3af',
    marginBottom: 16,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1f2937',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#374151',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  chipSelected: {
    borderColor: '#6366f1',
    backgroundColor: '#312e81',
  },
  chipSafetySelected: {
    borderColor: '#ef4444',
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
  },
  chipText: {
    fontSize: 14,
    color: '#d1d5db',
    fontWeight: '500',
  },
  chipTextSelected: {
    color: '#e0e7ff',
    fontWeight: '600',
  },
  safetyIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ef4444',
    marginLeft: 8,
  },
  safetyNote: {
    backgroundColor: 'rgba(249, 115, 22, 0.15)',
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
    borderWidth: 1,
    borderColor: 'rgba(249, 115, 22, 0.3)',
  },
  safetyNoteText: {
    fontSize: 14,
    color: '#fb923c',
    lineHeight: 20,
  },
  // Text input styles
  textInputContainer: {
    marginBottom: 24,
  },
  textInput: {
    backgroundColor: '#1f2937',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#374151',
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#ffffff',
    minHeight: 120,
  },
  // Bottom buttons
  bottomContainer: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    paddingTop: 12,
  },
  nextButtonWrapper: {
    marginBottom: 12,
  },
  nextButton: {
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  nextButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  skipButtonText: {
    fontSize: 15,
    color: '#818cf8',
    fontWeight: '500',
  },
  skipButtonTextDisabled: {
    color: '#4b5563',
  },
})

