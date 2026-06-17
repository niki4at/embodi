import { useMutation, useQuery } from 'convex/react'
import * as Haptics from 'expo-haptics'
import { router, type Href } from 'expo-router'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import Animated, { FadeInUp } from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'

import { DraggableExerciseList } from '@/components/trainer/DraggableExerciseList'
import {
  ExerciseLibrary,
  type ExerciseEntry,
} from '@/components/library/exercise-library'
import { IconSymbol } from '@/components/ui/icon-symbol'
import { motion, radius, spacing, typography } from '@/constants/design'
import { useTheme } from '@/constants/theme-context'
import { api } from '@/convex/_generated/api'

type Targets = { sets: number; reps: number; restSec: number }

const ROW_HEIGHT = 150
const ROW_GAP = spacing.md

function defaultTargets(modality: string): Targets {
  if (modality === 'strength') return { sets: 3, reps: 10, restSec: 75 }
  return { sets: 3, reps: 12, restSec: 45 }
}

export default function BuildWorkoutScreen() {
  const { palette, resolved, shadows } = useTheme()
  const createCustomSession = useMutation(api.trainer.createCustomSession)

  const [step, setStep] = useState<'pick' | 'arrange'>('pick')
  const [selected, setSelected] = useState<ExerciseEntry[]>([])
  const [targets, setTargets] = useState<Record<string, Targets>>({})
  // Ids the user has hand-tuned — we never overwrite these with history.
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [isStarting, setIsStarting] = useState(false)

  const lastTargets = useQuery(
    api.exerciseStats.getLastTargetsForExercises,
    selected.length > 0
      ? { items: selected.map((ex) => ({ catalogId: ex.id, name: ex.name })) }
      : 'skip'
  )

  // Seed targets for any newly added exercise with sensible defaults so the
  // arrange step always has a value to edit.
  useEffect(() => {
    setTargets((prev) => {
      const next = { ...prev }
      let changed = false
      for (const ex of selected) {
        if (!next[ex.id]) {
          next[ex.id] = defaultTargets(ex.modality)
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [selected])

  // Personalize: when the user's last numbers come back, prefill any rows the
  // user hasn't edited by hand.
  useEffect(() => {
    if (!lastTargets) return
    setTargets((prev) => {
      const next = { ...prev }
      let changed = false
      selected.forEach((ex, i) => {
        const last = lastTargets[i]
        if (last && !touched[ex.id]) {
          const candidate: Targets = {
            sets: last.sets,
            reps: last.reps,
            restSec: last.restSec,
          }
          const current = next[ex.id]
          if (
            !current ||
            current.sets !== candidate.sets ||
            current.reps !== candidate.reps ||
            current.restSec !== candidate.restSec
          ) {
            next[ex.id] = candidate
            changed = true
          }
        }
      })
      return changed ? next : prev
    })
  }, [lastTargets, selected, touched])

  const handleBack = useCallback(() => {
    Haptics.selectionAsync()
    if (step === 'arrange') {
      setStep('pick')
      return
    }
    if (router.canGoBack()) router.back()
    else router.replace('/')
  }, [step])

  const handleToggle = useCallback((exercise: ExerciseEntry) => {
    setSelected((prev) => {
      const exists = prev.some((e) => e.id === exercise.id)
      if (exists) return prev.filter((e) => e.id !== exercise.id)
      return [...prev, exercise]
    })
  }, [])

  const handleAskCoach = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    router.replace('/checkin')
  }, [])

  const handleReorder = useCallback((orderedIds: string[]) => {
    setSelected((prev) => {
      const byId = new Map(prev.map((ex) => [ex.id, ex]))
      const next = orderedIds
        .map((id) => byId.get(id))
        .filter((ex): ex is ExerciseEntry => Boolean(ex))
      return next.length === prev.length ? next : prev
    })
  }, [])

  const handleRemove = useCallback((id: string) => {
    Haptics.selectionAsync()
    setSelected((prev) => prev.filter((e) => e.id !== id))
  }, [])

  const handleEditTarget = useCallback(
    (id: string, key: keyof Targets, delta: number) => {
      Haptics.selectionAsync()
      setTouched((prev) => ({ ...prev, [id]: true }))
      setTargets((prev) => {
        const base = prev[id] ?? { sets: 3, reps: 10, restSec: 60 }
        const limits: Record<keyof Targets, { min: number; max: number }> = {
          sets: { min: 1, max: 10 },
          reps: { min: 1, max: 50 },
          restSec: { min: 0, max: 300 },
        }
        const limit = limits[key]
        const value = Math.max(
          limit.min,
          Math.min(limit.max, base[key] + delta)
        )
        return { ...prev, [id]: { ...base, [key]: value } }
      })
    },
    []
  )

  const handlePreview = useCallback((exercise: ExerciseEntry) => {
    Haptics.selectionAsync()
    const payload = {
      catalogId: exercise.id,
      name: exercise.name,
      bodyPart: exercise.bodyPart,
      modality: exercise.modality,
      equipment: exercise.equipment ? [exercise.equipment] : [],
    }
    router.push({
      pathname: '/exercise/[id]',
      params: {
        id: exercise.id,
        mode: 'session',
        payload: JSON.stringify(payload),
      },
    })
  }, [])

  const handleStart = useCallback(async () => {
    if (selected.length === 0 || isStarting) return
    setIsStarting(true)
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
      const sessionId = await createCustomSession({
        exercises: selected.map((ex) => {
          const t = targets[ex.id] ?? defaultTargets(ex.modality)
          return {
            id: ex.id,
            name: ex.name,
            bodyPart: ex.bodyPart,
            modality: ex.modality,
            equipment: ex.equipment,
            targetSets: t.sets,
            targetReps: Array.from({ length: t.sets }, () => t.reps),
            restSec: t.restSec,
          }
        }),
      })
      router.replace({
        pathname: '/session/ready',
        params: { sessionId: String(sessionId) },
      } as unknown as Href)
    } catch (error) {
      console.error('Failed to start custom session', error)
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      setIsStarting(false)
    }
  }, [selected, targets, isStarting, createCustomSession])

  const selectedIds = useMemo(() => selected.map((e) => e.id), [selected])
  const hasSelection = selected.length > 0

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: palette.bg }]}
      edges={['top']}
    >
      <View style={styles.header}>
        <Pressable
          onPress={handleBack}
          hitSlop={12}
          style={[
            styles.iconButton,
            { backgroundColor: palette.surface, borderColor: palette.border },
          ]}
          accessibilityRole="button"
          accessibilityLabel={step === 'arrange' ? 'Back to picker' : 'Go back'}
        >
          <IconSymbol
            name="arrow.left"
            size={18}
            color={resolved === 'dark' ? palette.white : palette.textPrimary}
          />
        </Pressable>
        <Pressable
          onPress={handleAskCoach}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Ask coach instead"
        >
          <Text style={[styles.coachLink, { color: palette.primary }]}>
            Ask coach
          </Text>
        </Pressable>
      </View>

      <Animated.View
        entering={FadeInUp.duration(motion.duration.base)}
        style={styles.titleBlock}
      >
        <Text style={[styles.title, { color: palette.textPrimary }]}>
          {step === 'pick' ? 'Build your own' : 'Review & arrange'}
        </Text>
        <Text style={[styles.subtitle, { color: palette.textSecondary }]}>
          {step === 'pick'
            ? 'Pick the movements you want, then fine-tune them.'
            : 'Drag to reorder, tune sets, reps, and rest, then start.'}
        </Text>
      </Animated.View>

      {step === 'pick' ? (
        <ExerciseLibrary
          onSelectExercise={handleToggle}
          selectedIds={selectedIds}
          listBottomPadding={hasSelection ? 140 : spacing.huge}
        />
      ) : (
        <ScrollView
          contentContainerStyle={styles.arrangeContent}
          showsVerticalScrollIndicator={false}
        >
          <DraggableExerciseList
            items={selected}
            itemHeight={ROW_HEIGHT}
            itemSpacing={ROW_GAP}
            rowBackgroundColor={palette.surface}
            rowBorderRadius={radius.lg}
            onReorder={handleReorder}
            renderItem={({ item }) => (
              <ArrangeRow
                exercise={item}
                targets={targets[item.id] ?? defaultTargets(item.modality)}
                canRemove={selected.length > 1}
                onPreview={() => handlePreview(item)}
                onRemove={() => handleRemove(item.id)}
                onEdit={(key, delta) => handleEditTarget(item.id, key, delta)}
              />
            )}
          />
        </ScrollView>
      )}

      {hasSelection ? (
        <View
          style={[
            styles.tray,
            {
              backgroundColor: palette.bgElevated,
              borderTopColor: palette.divider,
            },
          ]}
        >
          <View style={styles.trayText}>
            <Text style={[styles.trayCount, { color: palette.textPrimary }]}>
              {selected.length} exercise{selected.length > 1 ? 's' : ''}
            </Text>
            <Text
              style={[styles.trayHint, { color: palette.textSecondary }]}
              numberOfLines={1}
            >
              {selected.map((e) => e.name).join(' · ')}
            </Text>
          </View>
          {step === 'pick' ? (
            <Pressable
              onPress={() => {
                Haptics.selectionAsync()
                setStep('arrange')
              }}
              style={({ pressed }) => [
                styles.startCta,
                {
                  backgroundColor: palette.primary,
                  opacity: pressed ? 0.9 : 1,
                },
                resolved === 'dark' ? shadows.primaryDark : shadows.primary,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Review and arrange"
            >
              <Text style={styles.startCtaText}>Review</Text>
              <IconSymbol name="arrow.right" size={16} color="#FFFFFF" />
            </Pressable>
          ) : (
            <Pressable
              onPress={handleStart}
              disabled={isStarting}
              style={({ pressed }) => [
                styles.startCta,
                {
                  backgroundColor: palette.primary,
                  opacity: pressed ? 0.9 : 1,
                },
                resolved === 'dark' ? shadows.primaryDark : shadows.primary,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Start custom session"
            >
              {isStarting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Text style={styles.startCtaText}>Start</Text>
                  <IconSymbol name="arrow.right" size={16} color="#FFFFFF" />
                </>
              )}
            </Pressable>
          )}
        </View>
      ) : null}
    </SafeAreaView>
  )
}

type ArrangeRowProps = {
  exercise: ExerciseEntry
  targets: Targets
  canRemove: boolean
  onPreview: () => void
  onRemove: () => void
  onEdit: (key: keyof Targets, delta: number) => void
}

function ArrangeRow({
  exercise,
  targets,
  canRemove,
  onPreview,
  onRemove,
  onEdit,
}: ArrangeRowProps) {
  const { palette } = useTheme()
  return (
    <View
      style={[
        styles.row,
        { backgroundColor: palette.surface, borderColor: palette.border },
      ]}
    >
      <View style={styles.rowHeader}>
        <IconSymbol
          name="line.3.horizontal"
          size={18}
          color={palette.textTertiary}
        />
        <Pressable
          style={styles.rowTitleWrap}
          onPress={onPreview}
          accessibilityRole="button"
          accessibilityLabel={`Preview ${exercise.name}`}
        >
          <Text
            style={[styles.rowTitle, { color: palette.textPrimary }]}
            numberOfLines={1}
          >
            {exercise.name}
          </Text>
          <Text
            style={[styles.rowMeta, { color: palette.textSecondary }]}
            numberOfLines={1}
          >
            {exercise.bodyPart} · Tap to preview
          </Text>
        </Pressable>
        <Pressable
          onPress={onRemove}
          disabled={!canRemove}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={`Remove ${exercise.name}`}
          style={styles.removeBtn}
        >
          <IconSymbol
            name="xmark"
            size={14}
            color={canRemove ? palette.textTertiary : palette.divider}
          />
        </Pressable>
      </View>

      <View style={styles.steppers}>
        <Stepper
          label="Sets"
          value={String(targets.sets)}
          onDec={() => onEdit('sets', -1)}
          onInc={() => onEdit('sets', 1)}
        />
        <Stepper
          label="Reps"
          value={String(targets.reps)}
          onDec={() => onEdit('reps', -1)}
          onInc={() => onEdit('reps', 1)}
        />
        <Stepper
          label="Rest"
          value={`${targets.restSec}s`}
          onDec={() => onEdit('restSec', -15)}
          onInc={() => onEdit('restSec', 15)}
        />
      </View>
    </View>
  )
}

type StepperProps = {
  label: string
  value: string
  onDec: () => void
  onInc: () => void
}

function Stepper({ label, value, onDec, onInc }: StepperProps) {
  const { palette } = useTheme()
  return (
    <View style={styles.stepper}>
      <Text style={[styles.stepperLabel, { color: palette.textTertiary }]}>
        {label}
      </Text>
      <View style={styles.stepperControls}>
        <Pressable
          onPress={onDec}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={`Decrease ${label}`}
          style={[styles.stepBtn, { backgroundColor: palette.surfaceAlt }]}
        >
          <IconSymbol name="minus" size={14} color={palette.textPrimary} />
        </Pressable>
        <Text style={[styles.stepValue, { color: palette.textPrimary }]}>
          {value}
        </Text>
        <Pressable
          onPress={onInc}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={`Increase ${label}`}
          style={[styles.stepBtn, { backgroundColor: palette.surfaceAlt }]}
        >
          <IconSymbol name="plus" size={14} color={palette.textPrimary} />
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  coachLink: {
    ...typography.bodyStrong,
  },
  titleBlock: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  title: {
    ...typography.display,
    fontSize: 32,
    lineHeight: 38,
  },
  subtitle: {
    ...typography.body,
    marginTop: spacing.xs,
  },
  arrangeContent: {
    paddingHorizontal: spacing.xl,
    paddingBottom: 160,
  },
  row: {
    flex: 1,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.lg,
    justifyContent: 'space-between',
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  rowTitleWrap: {
    flex: 1,
  },
  rowTitle: {
    ...typography.bodyStrong,
  },
  rowMeta: {
    ...typography.small,
    marginTop: 2,
  },
  removeBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  steppers: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  stepper: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
  },
  stepperLabel: {
    ...typography.caption,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  stepperControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  stepBtn: {
    width: 30,
    height: 30,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepValue: {
    ...typography.bodyStrong,
    minWidth: 38,
    textAlign: 'center',
  },
  tray: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  trayText: {
    flex: 1,
  },
  trayCount: {
    ...typography.bodyStrong,
  },
  trayHint: {
    ...typography.small,
    marginTop: 2,
  },
  startCta: {
    height: 50,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minWidth: 110,
  },
  startCtaText: {
    ...typography.button,
    color: '#FFFFFF',
  },
})
