import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Animated, {
  FadeInDown,
  FadeInRight,
  FadeOutLeft,
} from 'react-native-reanimated'
import { useMutation, useQuery } from 'convex/react'
import * as Haptics from 'expo-haptics'
import { router } from 'expo-router'

import { api } from '@/convex/_generated/api'
import { IconSymbol } from '@/components/ui/icon-symbol'
import { PillButton } from '@/components/ui/pill-button'
import { motion, radius, spacing, typography } from '@/constants/design'
import { useTheme } from '@/constants/theme-context'

export default function ProfileQuestionScreen() {
  const { palette } = useTheme()
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

  const questions = useMemo(
    () => profileQuestions?.questions || [],
    [profileQuestions?.questions],
  )
  const currentQuestion = questions[currentQuestionIndex]

  const existingAnswerMap = useMemo(() => {
    const map: Record<string, string | number | string[]> = {}
    if (existingAnswers) {
      for (const answer of existingAnswers) {
        map[answer.questionId] = answer.answer
      }
    }
    return map
  }, [existingAnswers])

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
    return -1
  }, [questions, localAnswers, existingAnswerMap])

  useEffect(() => {
    if (
      hasInitialized ||
      questions.length === 0 ||
      existingAnswers === undefined
    )
      return

    const nextIndex = findNextUnansweredIndex()
    if (nextIndex !== -1 && nextIndex !== currentQuestionIndex) {
      setCurrentQuestionIndex(nextIndex)
    }
    setHasInitialized(true)
  }, [
    findNextUnansweredIndex,
    questions.length,
    hasInitialized,
    currentQuestionIndex,
    existingAnswers,
  ])

  const setAnswer = (value: string | number | string[]) => {
    if (currentQuestion) {
      setLocalAnswers(prev => ({ ...prev, [currentQuestion.id]: value }))
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
        await submitAnswer({ questionId: currentQuestion.id, answer })
      }

      const isAtEnd = currentQuestionIndex >= questions.length - 1
      const isReady = profileQuestions?.status === 'ready'

      if (isAtEnd && isReady) {
        const allAnswers = Object.entries(localAnswers)
          .filter(([, value]) => value !== undefined)
          .map(([questionId, value]) => ({ questionId, answer: value }))

        if (allAnswers.length > 0) {
          await submitAllAnswers({ answers: allAnswers })
        }

        await completeProfile({})
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        router.back()
      } else if (!isAtEnd) {
        setCurrentQuestionIndex(prev => prev + 1)
      }
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
      setCurrentQuestionIndex(prev => prev - 1)
    } else {
      router.back()
    }
  }

  const handleSkip = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)

    const isAtEnd = currentQuestionIndex >= questions.length - 1
    const isReady = profileQuestions?.status === 'ready'

    if (isAtEnd && isReady) {
      try {
        const allAnswers = Object.entries(localAnswers)
          .filter(([, value]) => value !== undefined)
          .map(([questionId, value]) => ({ questionId, answer: value }))

        if (allAnswers.length > 0) {
          await submitAllAnswers({ answers: allAnswers })
        }

        await completeProfile({})
        router.back()
      } catch (error) {
        console.error('Failed to complete profile:', error)
      }
    } else if (!isAtEnd) {
      setCurrentQuestionIndex(prev => prev + 1)
    }
  }

  if (profileQuestions?.status === 'failed') {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: palette.bg }]}>
        <View style={styles.statusContainer}>
          <View
            style={[
              styles.statusIcon,
              { backgroundColor: palette.dangerMuted },
            ]}
          >
            <IconSymbol name="info.circle" size={28} color={palette.danger} />
          </View>
          <Text style={[styles.statusTitle, { color: palette.textPrimary }]}>
            Something went wrong
          </Text>
          <Text style={[styles.statusSubtitle, { color: palette.textSecondary }]}>
            We couldn&apos;t generate your questions. Go back and retry.
          </Text>
          <PillButton
            label="Go back"
            onPress={() => router.back()}
            fullWidth={false}
          />
        </View>
      </SafeAreaView>
    )
  }

  const isGenerating = profileQuestions?.status === 'generating'
  const hasQuestions = questions.length > 0

  if (!profileQuestions || (isGenerating && !hasQuestions)) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: palette.bg }]}>
        <View style={styles.statusContainer}>
          <View
            style={[
              styles.statusIcon,
              { backgroundColor: palette.primaryMuted },
            ]}
          >
            <IconSymbol name="sparkles" size={28} color={palette.primary} />
          </View>
          <Text style={[styles.statusTitle, { color: palette.textPrimary }]}>
            Personalizing your questions
          </Text>
          <Text style={[styles.statusSubtitle, { color: palette.textSecondary }]}>
            Creating questions tailored to your goals.
          </Text>
        </View>
      </SafeAreaView>
    )
  }

  if (!currentQuestion) return null

  const totalQuestions =
    profileQuestions.status === 'ready'
      ? profileQuestions.totalCount
      : questions.length

  const progress =
    totalQuestions > 0
      ? ((currentQuestionIndex + 1) / totalQuestions) * 100
      : 0

  const isAtEndOfAvailable = currentQuestionIndex >= questions.length - 1
  const isLastQuestion =
    profileQuestions.status === 'ready' && isAtEndOfAvailable
  const isWaitingForMore = isGenerating && isAtEndOfAvailable

  const isSafetyQuestion =
    currentQuestion.category.toLowerCase().includes('safety') ||
    currentQuestion.questionText.toLowerCase().includes('symptom')

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: palette.bg }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={[styles.headerBar, { borderBottomColor: palette.divider }]}>
          <TouchableOpacity
            style={[
              styles.iconButton,
              {
                backgroundColor: palette.surface,
                borderColor: palette.border,
              },
            ]}
            onPress={handleBack}
            hitSlop={12}
          >
            <IconSymbol
              name="chevron.left"
              size={20}
              color={palette.textPrimary}
            />
          </TouchableOpacity>
          <View style={styles.progressContainer}>
            <View
              style={[
                styles.progressTrack,
                { backgroundColor: palette.surfaceAlt },
              ]}
            >
              <View
                style={[
                  styles.progressFill,
                  { backgroundColor: palette.primary, width: `${progress}%` },
                ]}
              />
            </View>
            <Text
              style={[styles.progressText, { color: palette.textTertiary }]}
            >
              {currentQuestionIndex + 1} of {totalQuestions}
              {isGenerating ? '+' : ''}
            </Text>
          </View>
          <TouchableOpacity onPress={handleSkip} hitSlop={12}>
            <Text style={[styles.skipText, { color: palette.textSecondary }]}>
              Skip
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View
            key={currentQuestion.id}
            entering={FadeInRight.duration(motion.duration.base)}
            exiting={FadeOutLeft.duration(motion.duration.quick)}
          >
            <Text style={[styles.categoryLabel, { color: palette.primary }]}>
              {currentQuestion.category}
            </Text>
            <Text style={[styles.questionText, { color: palette.textPrimary }]}>
              {currentQuestion.questionText}
            </Text>

            {currentQuestion.answerType === 'slider' && (
              <View style={styles.sliderBlock}>
                <Text style={[styles.sliderValue, { color: palette.primary }]}>
                  {(getCurrentAnswer() as number) ??
                    currentQuestion.sliderMin ??
                    0}
                </Text>
                <View style={styles.sliderTrack}>
                  {Array.from(
                    {
                      length:
                        (currentQuestion.sliderMax ?? 10) -
                        (currentQuestion.sliderMin ?? 0) +
                        1,
                    },
                    (_, i) => (currentQuestion.sliderMin ?? 0) + i,
                  ).map(value => {
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
                          {
                            backgroundColor: isSelected
                              ? palette.primary
                              : isFilled
                                ? palette.primaryMuted
                                : palette.surface,
                            borderColor: isFilled
                              ? palette.primary
                              : palette.border,
                          },
                        ]}
                        onPress={() => {
                          Haptics.impactAsync(
                            Haptics.ImpactFeedbackStyle.Light,
                          )
                          setAnswer(value)
                        }}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.sliderDotText,
                            {
                              color:
                                isFilled || isSelected
                                  ? isSelected
                                    ? palette.white
                                    : palette.primary
                                  : palette.textTertiary,
                            },
                          ]}
                        >
                          {value}
                        </Text>
                      </TouchableOpacity>
                    )
                  })}
                </View>
                {currentQuestion.sliderLabels &&
                  currentQuestion.sliderLabels.length > 0 && (
                    <View style={styles.sliderLabels}>
                      {currentQuestion.sliderLabels.map((label, idx) => (
                        <Text
                          key={idx}
                          style={[
                            styles.sliderLabelText,
                            { color: palette.textTertiary },
                          ]}
                        >
                          {label}
                        </Text>
                      ))}
                    </View>
                  )}
              </View>
            )}

            {currentQuestion.answerType === 'single' && (
              <View style={styles.optionsCol}>
                {currentQuestion.options?.map((option, idx) => {
                  const isSelected = getCurrentAnswer() === option
                  return (
                    <Animated.View
                      key={option}
                      entering={FadeInDown.delay(idx * 40).duration(
                        motion.duration.base,
                      )}
                    >
                      <TouchableOpacity
                        style={[
                          styles.optionRow,
                          {
                            backgroundColor: isSelected
                              ? palette.primaryMuted
                              : palette.surface,
                            borderColor: isSelected
                              ? palette.primary
                              : palette.border,
                          },
                        ]}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                          setAnswer(option)
                        }}
                        activeOpacity={0.85}
                      >
                        <View
                          style={[
                            styles.radioOuter,
                            {
                              borderColor: isSelected
                                ? palette.primary
                                : palette.borderStrong,
                            },
                          ]}
                        >
                          {isSelected ? (
                            <View
                              style={[
                                styles.radioInner,
                                { backgroundColor: palette.primary },
                              ]}
                            />
                          ) : null}
                        </View>
                        <Text
                          style={[
                            styles.optionText,
                            {
                              color: isSelected
                                ? palette.textPrimary
                                : palette.textSecondary,
                              fontWeight: isSelected ? '600' : '400',
                            },
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

            {currentQuestion.answerType === 'multi' && (
              <View>
                <Text style={[styles.hint, { color: palette.textTertiary }]}>
                  Select all that apply
                </Text>
                <View style={styles.chipGrid}>
                  {currentQuestion.options?.map((option, idx) => {
                    const selectedOptions =
                      (getCurrentAnswer() as string[]) || []
                    const isSelected = selectedOptions.includes(option)
                    const isSafetyFlag =
                      isSafetyQuestion &&
                      !option.toLowerCase().includes('none')
                    const chipBg = isSelected
                      ? isSafetyFlag
                        ? palette.dangerMuted
                        : palette.primaryMuted
                      : palette.surface
                    const chipBorder = isSelected
                      ? isSafetyFlag
                        ? palette.danger
                        : palette.primary
                      : palette.border
                    const chipColor = isSelected
                      ? isSafetyFlag
                        ? palette.danger
                        : palette.primary
                      : palette.textSecondary
                    return (
                      <Animated.View
                        key={option}
                        entering={FadeInDown.delay(idx * 30).duration(
                          motion.duration.base,
                        )}
                      >
                        <TouchableOpacity
                          style={[
                            styles.chip,
                            {
                              backgroundColor: chipBg,
                              borderColor: chipBorder,
                            },
                          ]}
                          onPress={() => {
                            Haptics.impactAsync(
                              Haptics.ImpactFeedbackStyle.Light,
                            )
                            const newSelection = isSelected
                              ? selectedOptions.filter(o => o !== option)
                              : [...selectedOptions, option]
                            setAnswer(newSelection)
                          }}
                          activeOpacity={0.85}
                        >
                          <Text
                            style={[
                              styles.chipText,
                              { color: chipColor },
                            ]}
                          >
                            {option}
                          </Text>
                        </TouchableOpacity>
                      </Animated.View>
                    )
                  })}
                </View>
                {isSafetyQuestion && (
                  <View
                    style={[
                      styles.safetyNote,
                      {
                        backgroundColor: palette.warningMuted,
                        borderColor: 'rgba(245, 158, 11, 0.3)',
                      },
                    ]}
                  >
                    <IconSymbol
                      name="info.circle"
                      size={16}
                      color={palette.warning}
                    />
                    <Text
                      style={[
                        styles.safetyNoteText,
                        { color: palette.warning },
                      ]}
                    >
                      Some symptoms may need medical assessment. Your plan will
                      start with mobility-only sessions.
                    </Text>
                  </View>
                )}
              </View>
            )}

            {currentQuestion.answerType === 'text' && (
              <View style={styles.textInputContainer}>
                <TextInput
                  style={[
                    styles.textInput,
                    {
                      backgroundColor: palette.surface,
                      borderColor: palette.borderStrong,
                      color: palette.textPrimary,
                    },
                  ]}
                  placeholder="Type your answer"
                  placeholderTextColor={palette.textTertiary}
                  value={(getCurrentAnswer() as string) || ''}
                  onChangeText={value => setAnswer(value)}
                  multiline
                  textAlignVertical="top"
                />
              </View>
            )}
          </Animated.View>
        </ScrollView>

        <View
          style={[styles.bottomContainer, { borderTopColor: palette.divider }]}
        >
          <PillButton
            label={
              isSubmitting
                ? 'Saving'
                : isWaitingForMore
                  ? 'Creating more questions'
                  : isLastQuestion
                    ? 'Complete profile'
                    : 'Next'
            }
            onPress={handleNext}
            disabled={!canProceed() || isSubmitting || isWaitingForMore}
            loading={isSubmitting}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  statusContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
    gap: spacing.lg,
  },
  statusIcon: {
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusTitle: {
    ...typography.h2,
    textAlign: 'center',
  },
  statusSubtitle: {
    ...typography.body,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: 12,
    paddingBottom: spacing.lg,
    gap: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressContainer: {
    flex: 1,
    gap: 6,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
  },
  progressText: {
    ...typography.caption,
  },
  skipText: {
    ...typography.smallStrong,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xxxl,
  },
  categoryLabel: {
    ...typography.caption,
    marginBottom: spacing.sm,
  },
  questionText: {
    ...typography.h1,
    marginBottom: spacing.xxl,
  },
  hint: {
    ...typography.small,
    marginBottom: spacing.md,
  },
  sliderBlock: {
    marginBottom: spacing.lg,
  },
  sliderValue: {
    ...typography.display,
    fontSize: 56,
    lineHeight: 64,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  sliderTrack: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sliderDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sliderDotText: {
    ...typography.caption,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sliderLabelText: {
    ...typography.small,
    maxWidth: '32%',
    textAlign: 'center',
  },
  optionsCol: {
    gap: spacing.sm,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  optionText: {
    ...typography.body,
    flex: 1,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  chipText: {
    ...typography.smallStrong,
  },
  safetyNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginTop: spacing.lg,
    borderWidth: 1,
  },
  safetyNoteText: {
    flex: 1,
    ...typography.small,
  },
  textInputContainer: {
    marginBottom: spacing.lg,
  },
  textInput: {
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    ...typography.body,
    minHeight: 120,
  },
  bottomContainer: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
    paddingTop: spacing.md,
    borderTopWidth: 1,
  },
})
