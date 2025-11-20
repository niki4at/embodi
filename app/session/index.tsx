import { useAction, useMutation, useQuery } from 'convex/react'
import * as Haptics from 'expo-haptics'
import { LinearGradient } from 'expo-linear-gradient'
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
import { api } from '@/convex/_generated/api'
import { Id } from '@/convex/_generated/dataModel'

type SessionParams = {
  sessionId?: string
}

type TimerHandle = ReturnType<typeof setTimeout>
type PercentString = `${number}%`

export default function SessionScreen() {
  const params = useLocalSearchParams<SessionParams>()
  const sessionId =
    typeof params.sessionId === 'string'
      ? (params.sessionId as Id<'workout_sessions'>)
      : undefined

  const sessionData = useQuery(
    api.trainer.getSessionWithSets,
    sessionId ? { sessionId } : 'skip'
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
  const [isSendingFeedback, setIsSendingFeedback] = useState(false)
  const hideTimerRef = useRef<TimerHandle | null>(null)
  const scheduledTimers = useRef<TimerHandle[]>([])
  const coachQueueRef = useRef<CoachComment[]>([])
  const commentsLoaded = useRef(false)

  const session = sessionData?.session
  const sets = sessionData?.sets ?? []

  const planExercises = useMemo<ExercisePlan[]>(() => {
    if (!session) return []
    return session.plan.map((exercise) => ({
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
      Math.max((comment.delaySec ?? 5) * 1000, 3500)
    )
  }, [])

  const triggerComment = useCallback(
    (trigger: CoachComment['trigger'], exerciseId?: string) => {
      const idx = coachQueueRef.current.findIndex((comment) => {
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
    [displayComment]
  )

  useEffect(() => {
    const timersRef = scheduledTimers.current
    return () => {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current)
      }
      timersRef.forEach((timer) => clearTimeout(timer))
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
      .then((comments) => {
        const timed = comments.filter((comment) => comment.delaySec)
        const immediate = comments.filter((comment) => !comment.delaySec)
        coachQueueRef.current = immediate
        const startComment = immediate.find(
          (comment) => comment.trigger === 'session_start'
        )
        if (startComment) {
          displayComment(startComment)
          coachQueueRef.current = coachQueueRef.current.filter(
            (comment) => comment.id !== startComment.id
          )
        }
        timed.forEach((comment) => {
          const timer = setTimeout(
            () => {
              displayComment(comment)
            },
            (comment.delaySec ?? 0) * 1000
          )
          scheduledTimers.current.push(timer)
        })
      })
      .catch((error) => {
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
    [logSet, sessionId, triggerComment]
  )

  const handleBeforeSet = useCallback(
    (exerciseId: string) => {
      triggerComment('before_set', exerciseId)
    },
    [triggerComment]
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
      <SafeAreaView style={styles.centered}>
        <Text style={styles.errorText}>Missing session ID.</Text>
      </SafeAreaView>
    )
  }

  if (sessionData === undefined) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color="#6366f1" />
      </SafeAreaView>
    )
  }

  if (!session) {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={styles.errorText}>Session not available.</Text>
      </SafeAreaView>
    )
  }

  return (
    <LinearGradient colors={['#fef3f2', '#ffffff']} style={styles.gradient}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View
            entering={FadeInDown.duration(600)}
            style={styles.header}
          >
            <TouchableOpacity onPress={() => router.back()}>
              <Text style={styles.backText}>← Back</Text>
            </TouchableOpacity>
            <Text style={styles.sessionTitle}>{session.goal}</Text>
            <Text style={styles.sessionMeta}>
              {session.modality} · {session.durationMin} min
            </Text>

            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: progressWidth }]} />
            </View>
            <Text style={styles.progressLabel}>
              {sets.length}/{totalTargetSets} sets logged
            </Text>

            <TouchableOpacity
              onPress={() => setShowCitations(true)}
              style={styles.healthFactButton}
            >
              <Text style={styles.healthFactText}>
                Health facts & citations →
              </Text>
            </TouchableOpacity>
          </Animated.View>

          {planExercises.map((exercise) => (
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

          <View style={styles.feedbackCard}>
            <Text style={styles.feedbackTitle}>
              Report back to your trainer
            </Text>
            <Text style={styles.feedbackSubtitle}>
              Share pain, energy levels, or medication changes so I can adapt
              the next block.
            </Text>
            <TextInput
              style={styles.feedbackInput}
              placeholder="Today's wins, flags, or notes"
              placeholderTextColor="#9ca3af"
              value={feedback}
              onChangeText={setFeedback}
              multiline
            />
            <TouchableOpacity
              style={styles.feedbackButton}
              onPress={handleSendFeedback}
              disabled={isSendingFeedback || !feedback.trim()}
            >
              <Text style={styles.feedbackButtonText}>
                {isSendingFeedback ? 'Sending...' : 'Send feedback'}
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.completeButton}
            onPress={handleCompleteSession}
            disabled={isCompleting}
          >
            <Text style={styles.completeButtonText}>
              {isCompleting ? 'Saving...' : 'Complete session'}
            </Text>
          </TouchableOpacity>
          <View style={{ height: 80 }} />
        </ScrollView>

        <CitationsPanel
          visible={showCitations}
          facts={session.healthFacts}
          onClose={() => setShowCitations(false)}
        />
        <CoachBubble comment={activeComment} />
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
  scroll: {
    paddingHorizontal: 20,
    paddingBottom: 120,
  },
  header: {
    paddingTop: 12,
    paddingBottom: 20,
  },
  backText: {
    color: '#4f46e5',
    fontWeight: '600',
    marginBottom: 12,
  },
  sessionTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
  },
  sessionMeta: {
    fontSize: 15,
    color: '#6b7280',
    marginBottom: 16,
  },
  progressBar: {
    height: 10,
    borderRadius: 999,
    backgroundColor: '#e5e7eb',
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#6366f1',
  },
  progressLabel: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 12,
  },
  healthFactButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#f3f4f6',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  healthFactText: {
    fontSize: 13,
    color: '#111827',
    fontWeight: '600',
  },
  feedbackCard: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 20,
    padding: 20,
    backgroundColor: '#fff',
    marginTop: 12,
    marginBottom: 12,
  },
  feedbackTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 6,
  },
  feedbackSubtitle: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 12,
  },
  feedbackInput: {
    minHeight: 90,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 14,
    fontSize: 15,
    color: '#111827',
    marginBottom: 12,
  },
  feedbackButton: {
    backgroundColor: '#4f46e5',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  feedbackButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
  completeButton: {
    backgroundColor: '#0f172a',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  completeButtonText: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '700',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    color: '#dc2626',
    fontSize: 16,
  },
})
