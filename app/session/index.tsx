import { useAction, useMutation, useQuery } from 'convex/react'
import * as Haptics from 'expo-haptics'
import { router, useLocalSearchParams } from 'expo-router'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'

import CitationsPanel from '@/components/trainer/CitationsPanel'
import CoachBubble from '@/components/trainer/CoachBubble'
import type { SetPayload } from '@/components/trainer/ExerciseSetRow'
import { CoachComment, ExercisePlan } from '@/components/trainer/types'
import WorkoutCard from '@/components/trainer/WorkoutCard'
import { IconSymbol } from '@/components/ui/icon-symbol'
import { PillButton } from '@/components/ui/pill-button'
import {
  motion,
  radius,
  spacing,
  typography,
} from '@/constants/design'
import { useTheme } from '@/constants/theme-context'
import { api } from '@/convex/_generated/api'
import { Id } from '@/convex/_generated/dataModel'

type SessionParams = {
  sessionId?: string
}

type TimerHandle = ReturnType<typeof setTimeout>
type PercentString = `${number}%`

export default function SessionScreen() {
  const { palette, resolved, shadows } = useTheme()
  const params = useLocalSearchParams<SessionParams>()
  const sessionId =
    typeof params.sessionId === 'string'
      ? (params.sessionId as Id<'workout_sessions'>)
      : undefined

  const sessionData = useQuery(
    api.trainer.getSessionWithSets,
    sessionId ? { sessionId } : 'skip',
  )
  const onboarding = useQuery(api.onboarding.getOnboarding)
  const logSet = useMutation(api.trainer.logSet)
  const completeSession = useMutation(api.trainer.completeSession)
  const postFeedback = useMutation(api.trainer.postSessionFeedback)
  const prefetchComments = useAction(api.trainer.prefetchCoachComments)

  const [showCitations, setShowCitations] = useState(false)
  const [activeComment, setActiveComment] = useState<CoachComment | null>(null)
  const [isCompleting, setIsCompleting] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [feedbackFocused, setFeedbackFocused] = useState(false)
  const [isSendingFeedback, setIsSendingFeedback] = useState(false)
  const hideTimerRef = useRef<TimerHandle | null>(null)
  const scheduledTimers = useRef<TimerHandle[]>([])
  const coachQueueRef = useRef<CoachComment[]>([])
  const commentsLoaded = useRef(false)

  const session = sessionData?.session
  const sets = sessionData?.sets ?? []

  const planExercises = useMemo<ExercisePlan[]>(() => {
    if (!session) return []
    return session.plan.map(exercise => ({
      ...exercise,
      targetReps: Array.isArray(exercise.targetReps)
        ? exercise.targetReps
        : [exercise.targetReps ?? 0],
    }))
  }, [session])

  const totalTargetSets = useMemo(() => {
    if (!planExercises.length) return 0
    return planExercises.reduce((acc, ex) => acc + ex.targetSets, 0)
  }, [planExercises])

  const progress = totalTargetSets
    ? Math.min(sets.length / totalTargetSets, 1)
    : 0
  const progressWidth: PercentString = `${Math.round(progress * 100)}%`

  const displayComment = useCallback((comment: CoachComment) => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current)
    }
    setActiveComment(comment)
    hideTimerRef.current = setTimeout(
      () => {
        setActiveComment(null)
      },
      Math.max((comment.delaySec ?? 5) * 1000, 3500),
    )
  }, [])

  const triggerComment = useCallback(
    (trigger: CoachComment['trigger'], exerciseId?: string) => {
      const idx = coachQueueRef.current.findIndex(comment => {
        if (comment.trigger !== trigger) return false
        if (
          exerciseId &&
          comment.exerciseId &&
          comment.exerciseId !== exerciseId
        )
          return false
        return true
      })
      if (idx === -1) return
      const [comment] = coachQueueRef.current.splice(idx, 1)
      displayComment(comment)
    },
    [displayComment],
  )

  useEffect(() => {
    const timersRef = scheduledTimers.current
    return () => {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current)
      }
      timersRef.forEach(timer => clearTimeout(timer))
    }
  }, [])

  useEffect(() => {
    if (!session || !onboarding || commentsLoaded.current) return
    commentsLoaded.current = true

    const profilePayload = {
      name: onboarding.name,
      age: onboarding.age,
      gender: onboarding.gender,
      goal: onboarding.goal,
      activityLevel: onboarding.activityLevel,
      timeAvailable: onboarding.timeAvailable,
      injuries: onboarding.injuries,
      conditions: onboarding.conditions,
      medications: onboarding.medications,
      smoking: onboarding.smoking,
      alcohol: onboarding.alcohol,
    }

    prefetchComments({
      profile: profilePayload,
      plan: planExercises,
      durationMin: session.durationMin,
      goal: session.goal,
    })
      .then(comments => {
        const timed = comments.filter(comment => comment.delaySec)
        const immediate = comments.filter(comment => !comment.delaySec)
        coachQueueRef.current = immediate
        const startComment = immediate.find(
          comment => comment.trigger === 'session_start',
        )
        if (startComment) {
          displayComment(startComment)
          coachQueueRef.current = coachQueueRef.current.filter(
            comment => comment.id !== startComment.id,
          )
        }
        timed.forEach(comment => {
          const timer = setTimeout(
            () => {
              displayComment(comment)
            },
            (comment.delaySec ?? 0) * 1000,
          )
          scheduledTimers.current.push(timer)
        })
      })
      .catch(error => {
        console.error('coach comments error', error)
      })
  }, [session, onboarding, prefetchComments, displayComment, planExercises])

  const handleLogSet = useCallback(
    async (exerciseId: string, setIndex: number, payload: SetPayload) => {
      if (!sessionId) return
      await logSet({
        sessionId,
        exerciseId,
        setIndex,
        ...payload,
      })
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      triggerComment('after_set', exerciseId)
    },
    [logSet, sessionId, triggerComment],
  )

  const handleBeforeSet = useCallback(
    (exerciseId: string) => {
      triggerComment('before_set', exerciseId)
    },
    [triggerComment],
  )

  const handleCompleteSession = useCallback(async () => {
    if (!sessionId || isCompleting) return
    setIsCompleting(true)
    try {
      await completeSession({ sessionId })
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      triggerComment('session_end')
    } catch (error) {
      console.error('complete session error', error)
    } finally {
      setIsCompleting(false)
    }
  }, [sessionId, completeSession, triggerComment, isCompleting])

  const handleSendFeedback = useCallback(async () => {
    if (!sessionId || !feedback.trim() || isSendingFeedback) return
    setIsSendingFeedback(true)
    try {
      await postFeedback({ sessionId, text: feedback.trim() })
      setFeedback('')
      triggerComment('session_end')
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    } catch (error) {
      console.error('feedback error', error)
    } finally {
      setIsSendingFeedback(false)
    }
  }, [sessionId, feedback, postFeedback, isSendingFeedback, triggerComment])

  if (!sessionId) {
    return (
      <SafeAreaView
        style={[styles.centered, { backgroundColor: palette.bg }]}
      >
        <Text style={[styles.errorText, { color: palette.danger }]}>
          Missing session ID.
        </Text>
      </SafeAreaView>
    )
  }

  if (sessionData === undefined) {
    return (
      <SafeAreaView
        style={[styles.centered, { backgroundColor: palette.bg }]}
      >
        <ActivityIndicator size="large" color={palette.primary} />
      </SafeAreaView>
    )
  }

  if (!session) {
    return (
      <SafeAreaView
        style={[styles.centered, { backgroundColor: palette.bg }]}
      >
        <Text style={[styles.errorText, { color: palette.danger }]}>
          Session not available.
        </Text>
      </SafeAreaView>
    )
  }

  if (session.status === 'failed') {
    return (
      <SafeAreaView
        style={[styles.safeArea, { backgroundColor: palette.bg }]}
        edges={['top']}
      >
        <View style={[styles.centered, { backgroundColor: palette.bg }]}>
          <View
            style={[
              styles.failedIcon,
              { backgroundColor: palette.dangerMuted },
            ]}
          >
            <IconSymbol
              name="exclamationmark.triangle.fill"
              size={36}
              color={palette.danger}
            />
          </View>
          <Text style={[styles.failedTitle, { color: palette.textPrimary }]}>
            Session generation failed
          </Text>
          <Text
            style={[styles.failedSubtitle, { color: palette.textSecondary }]}
          >
            Something went wrong. Please head back and try again.
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

  const isGenerating = session.status === 'generating'
  const hasExercises = planExercises.length > 0
  const sessionShadow = resolved === 'dark' ? shadows.primaryDark : shadows.primary

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: palette.bg }]}
      edges={['top']}
    >
      <View style={[styles.container, { backgroundColor: palette.bg }]}>
        <View style={styles.topBar}>
          <TouchableOpacity
            onPress={() => router.back()}
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
          <Text style={[styles.topBarTitle, { color: palette.textPrimary }]} numberOfLines={1}>
            Session
          </Text>
          {session.healthFacts.length > 0 ? (
            <TouchableOpacity
              onPress={() => setShowCitations(true)}
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
                name="book.closed"
                size={20}
                color={palette.textPrimary}
              />
            </TouchableOpacity>
          ) : (
            <View style={styles.iconButton} />
          )}
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View
            entering={FadeInDown.duration(motion.duration.base)}
            style={[
              styles.heroCard,
              {
                backgroundColor: palette.surface,
                borderColor: palette.border,
              },
            ]}
          >
            <View
              style={[
                styles.heroBadge,
                { backgroundColor: palette.primaryMuted },
              ]}
            >
              <Text style={[styles.heroBadgeText, { color: palette.primary }]}>
                {isGenerating ? 'BUILDING' : 'TODAY'}
              </Text>
            </View>
            <Text style={[styles.heroTitle, { color: palette.textPrimary }]}>
              {session.goal}
            </Text>
            <Text style={[styles.heroMeta, { color: palette.textSecondary }]}>
              {isGenerating
                ? 'Building your personalised session…'
                : `${session.modality} · ${session.durationMin} min`}
            </Text>

            {!isGenerating && (
              <View
                style={[
                  styles.heroStats,
                  { backgroundColor: palette.surfaceAlt },
                ]}
              >
                <View style={styles.heroStat}>
                  <Text
                    style={[styles.heroStatValue, { color: palette.textPrimary }]}
                  >
                    {sets.length}
                  </Text>
                  <Text
                    style={[styles.heroStatLabel, { color: palette.textTertiary }]}
                  >
                    Sets logged
                  </Text>
                </View>
                <View
                  style={[
                    styles.heroStatDivider,
                    { backgroundColor: palette.border },
                  ]}
                />
                <View style={styles.heroStat}>
                  <Text
                    style={[styles.heroStatValue, { color: palette.textPrimary }]}
                  >
                    {totalTargetSets}
                  </Text>
                  <Text
                    style={[styles.heroStatLabel, { color: palette.textTertiary }]}
                  >
                    Total sets
                  </Text>
                </View>
                <View
                  style={[
                    styles.heroStatDivider,
                    { backgroundColor: palette.border },
                  ]}
                />
                <View style={styles.heroStat}>
                  <Text
                    style={[styles.heroStatValue, { color: palette.textPrimary }]}
                  >
                    {Math.round(progress * 100)}%
                  </Text>
                  <Text
                    style={[styles.heroStatLabel, { color: palette.textTertiary }]}
                  >
                    Done
                  </Text>
                </View>
              </View>
            )}

            {!isGenerating && (
              <View
                style={[
                  styles.progressBar,
                  { backgroundColor: palette.surfaceAlt },
                ]}
              >
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: progressWidth,
                      backgroundColor: palette.primary,
                    },
                  ]}
                />
              </View>
            )}

            {isGenerating && (
              <View style={styles.generatingIndicator}>
                <ActivityIndicator size="small" color={palette.primary} />
                <Text
                  style={[styles.generatingText, { color: palette.primary }]}
                >
                  {hasExercises
                    ? `${planExercises.length} exercise${planExercises.length > 1 ? 's' : ''} ready, loading more…`
                    : 'Creating your exercises…'}
                </Text>
              </View>
            )}
          </Animated.View>

          {planExercises.map(exercise => (
            <WorkoutCard
              key={exercise.id}
              exercise={exercise}
              sets={sets}
              onSaveSet={(setIndex, payload) =>
                handleLogSet(exercise.id, setIndex, payload)
              }
              onPrefetchComment={handleBeforeSet}
            />
          ))}

          {isGenerating && !hasExercises && (
            <>
              <SkeletonCard />
              <SkeletonCard />
            </>
          )}

          <View
            style={[
              styles.feedbackCard,
              {
                backgroundColor: palette.surface,
                borderColor: palette.border,
              },
            ]}
          >
            <Text style={[styles.feedbackTitle, { color: palette.textPrimary }]}>
              Report back to your coach
            </Text>
            <Text
              style={[styles.feedbackSubtitle, { color: palette.textSecondary }]}
            >
              Share pain, energy levels, or medication changes so I can adapt
              the next block.
            </Text>
            <TextInput
              style={[
                styles.feedbackInput,
                {
                  borderColor: feedbackFocused ? palette.primary : palette.border,
                  backgroundColor: feedbackFocused
                    ? palette.surfaceAlt
                    : palette.bgElevated,
                  color: palette.textPrimary,
                },
              ]}
              placeholder="Today's wins, flags, or notes"
              placeholderTextColor={palette.textTertiary}
              value={feedback}
              onChangeText={setFeedback}
              onFocus={() => setFeedbackFocused(true)}
              onBlur={() => setFeedbackFocused(false)}
              multiline
            />
            <PillButton
              label={isSendingFeedback ? 'Sending' : 'Send feedback'}
              onPress={handleSendFeedback}
              disabled={isSendingFeedback || !feedback.trim()}
              loading={isSendingFeedback}
              variant="secondary"
            />
          </View>

          <View style={[styles.completeWrap, sessionShadow]}>
            <PillButton
              label={isCompleting ? 'Saving' : 'Complete session'}
              onPress={handleCompleteSession}
              disabled={isCompleting}
              loading={isCompleting}
            />
          </View>
          <View style={{ height: spacing.huge }} />
        </ScrollView>

        <CitationsPanel
          visible={showCitations}
          facts={session.healthFacts}
          onClose={() => setShowCitations(false)}
        />
        <CoachBubble comment={activeComment} />
      </View>
    </SafeAreaView>
  )
}

function SkeletonCard() {
  const { palette } = useTheme()
  return (
    <View
      style={[
        styles.skeletonCard,
        { backgroundColor: palette.surface, borderColor: palette.border },
      ]}
    >
      <View
        style={[
          styles.skeletonTitle,
          { backgroundColor: palette.surfaceAlt },
        ]}
      />
      <View
        style={[styles.skeletonBody, { backgroundColor: palette.surfaceAlt }]}
      />
      <View
        style={[
          styles.skeletonBody,
          { width: '70%', backgroundColor: palette.surfaceAlt },
        ]}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarTitle: {
    ...typography.bodyStrong,
  },
  scroll: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.huge,
  },
  heroCard: {
    borderRadius: radius.xl,
    padding: spacing.xl,
    marginBottom: spacing.lg,
    borderWidth: 1,
  },
  heroBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radius.pill,
    marginBottom: spacing.md,
  },
  heroBadgeText: {
    ...typography.caption,
  },
  heroTitle: {
    ...typography.h1,
  },
  heroMeta: {
    ...typography.body,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  heroStats: {
    flexDirection: 'row',
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  heroStat: {
    flex: 1,
    alignItems: 'center',
  },
  heroStatValue: {
    ...typography.h2,
  },
  heroStatLabel: {
    ...typography.caption,
    marginTop: 2,
  },
  heroStatDivider: {
    width: StyleSheet.hairlineWidth,
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  generatingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  generatingText: {
    ...typography.smallStrong,
  },
  feedbackCard: {
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: spacing.xl,
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  feedbackTitle: {
    ...typography.h3,
    marginBottom: spacing.xs,
  },
  feedbackSubtitle: {
    ...typography.small,
    marginBottom: spacing.md,
  },
  feedbackInput: {
    minHeight: 90,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
    ...typography.body,
    marginBottom: spacing.md,
    textAlignVertical: 'top',
  },
  completeWrap: {
    marginTop: spacing.sm,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
  },
  errorText: {
    ...typography.body,
  },
  failedIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  failedTitle: {
    ...typography.h2,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  failedSubtitle: {
    ...typography.body,
    textAlign: 'center',
    marginBottom: spacing.xxl,
  },
  skeletonCard: {
    borderRadius: radius.xl,
    padding: spacing.xl,
    marginBottom: spacing.lg,
    borderWidth: 1,
  },
  skeletonTitle: {
    width: '60%',
    height: 22,
    borderRadius: radius.sm,
    marginBottom: spacing.md,
  },
  skeletonBody: {
    width: '100%',
    height: 14,
    borderRadius: radius.xs,
    marginBottom: spacing.sm,
  },
})
