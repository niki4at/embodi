import { useAction, useMutation } from 'convex/react'
import * as Haptics from 'expo-haptics'
import React, { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import Animated, { SlideInDown, SlideOutDown } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { IconSymbol } from '@/components/ui/icon-symbol'
import { PillButton } from '@/components/ui/pill-button'
import { radius, spacing, typography } from '@/constants/design'
import { useTheme } from '@/constants/theme-context'
import { api } from '@/convex/_generated/api'
import { Id } from '@/convex/_generated/dataModel'

import { ExercisePlan } from './types'

type Mode = 'main' | 'replace' | 'reposition' | 'remove'

type ExerciseMenuSheetProps = {
  visible: boolean
  sessionId: Id<'workout_sessions'>
  exercise: ExercisePlan | null
  plan: ExercisePlan[]
  hasLoggedSets: boolean
  onClose: () => void
}

const truncate = (value: string, max: number) =>
  value.length > max ? `${value.slice(0, max - 1)}…` : value

export default function ExerciseMenuSheet({
  visible,
  sessionId,
  exercise,
  plan,
  hasLoggedSets,
  onClose,
}: ExerciseMenuSheetProps) {
  const { palette, shadows } = useTheme()
  const insets = useSafeAreaInsets()

  const generateAlternatives = useAction(
    api.trainer.generateExerciseAlternatives,
  )
  const replaceExercise = useMutation(api.trainer.replaceExerciseInSession)
  const removeExercise = useMutation(api.trainer.removeExerciseFromSession)
  const reorderExercise = useMutation(api.trainer.reorderSessionExercise)

  const [mode, setMode] = useState<Mode>('main')
  const [prompt, setPrompt] = useState('')
  const [alternatives, setAlternatives] = useState<ExercisePlan[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [applyingId, setApplyingId] = useState<string | null>(null)
  const [reorderingTo, setReorderingTo] = useState<number | null>(null)
  const [isRemoving, setIsRemoving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!visible) {
      setMode('main')
      setPrompt('')
      setAlternatives([])
      setIsGenerating(false)
      setApplyingId(null)
      setReorderingTo(null)
      setIsRemoving(false)
      setErrorMessage(null)
    }
  }, [visible])

  if (!visible || !exercise) return null

  const currentIndex = plan.findIndex(ex => ex.id === exercise.id)
  const otherExercises = plan.filter(ex => ex.id !== exercise.id)

  const handleGenerate = async () => {
    if (!exercise || isGenerating) return
    setIsGenerating(true)
    setErrorMessage(null)
    try {
      const result = await generateAlternatives({
        sessionId,
        exerciseId: exercise.id,
        userPrompt: prompt.trim() ? prompt.trim() : undefined,
        count: prompt.trim() ? 2 : 3,
      })
      setAlternatives(result)
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    } catch (error) {
      console.error('alternatives error', error)
      setErrorMessage(
        'Could not load alternatives. Check your connection and try again.',
      )
    } finally {
      setIsGenerating(false)
    }
  }

  const handleApply = async (alt: ExercisePlan) => {
    if (!exercise || applyingId) return
    setApplyingId(alt.id)
    setErrorMessage(null)
    try {
      await replaceExercise({
        sessionId,
        exerciseId: exercise.id,
        newExercise: alt,
      })
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      onClose()
    } catch (error) {
      console.error('replace error', error)
      setErrorMessage('Could not replace the exercise. Please try again.')
      setApplyingId(null)
    }
  }

  const handleRemove = async () => {
    if (!exercise || isRemoving) return
    setIsRemoving(true)
    setErrorMessage(null)
    try {
      await removeExercise({ sessionId, exerciseId: exercise.id })
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
      onClose()
    } catch (error) {
      console.error('remove error', error)
      setErrorMessage('Could not remove the exercise. Please try again.')
      setIsRemoving(false)
    }
  }

  const handleReorder = async (newIndex: number) => {
    if (!exercise || reorderingTo !== null) return
    if (newIndex === currentIndex) {
      onClose()
      return
    }
    setReorderingTo(newIndex)
    setErrorMessage(null)
    try {
      await reorderExercise({
        sessionId,
        exerciseId: exercise.id,
        newIndex,
      })
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
      onClose()
    } catch (error) {
      console.error('reorder error', error)
      setErrorMessage('Could not move the exercise. Please try again.')
      setReorderingTo(null)
    }
  }

  const header = (
    <View style={styles.panelHeader}>
      {mode === 'main' ? (
        <View style={styles.headerSpacer} />
      ) : (
        <TouchableOpacity
          onPress={() => setMode('main')}
          style={[
            styles.headerIcon,
            { backgroundColor: palette.surface, borderColor: palette.border },
          ]}
          hitSlop={12}
        >
          <IconSymbol
            name="chevron.left"
            size={18}
            color={palette.textPrimary}
          />
        </TouchableOpacity>
      )}
      <View style={styles.headerTitleWrap}>
        <Text style={[styles.headerTitle, { color: palette.textPrimary }]}>
          {mode === 'main'
            ? 'Exercise options'
            : mode === 'replace'
              ? 'Replace exercise'
              : mode === 'reposition'
                ? 'Reposition'
                : 'Remove exercise'}
        </Text>
        <Text
          style={[styles.headerSubtitle, { color: palette.textSecondary }]}
          numberOfLines={1}
        >
          {truncate(exercise.name, 38)}
        </Text>
      </View>
      <TouchableOpacity
        onPress={onClose}
        style={[
          styles.headerIcon,
          { backgroundColor: palette.surface, borderColor: palette.border },
        ]}
        hitSlop={12}
      >
        <IconSymbol name="xmark" size={18} color={palette.textPrimary} />
      </TouchableOpacity>
    </View>
  )

  const renderMain = () => (
    <View>
      <OptionRow
        icon="arrow.clockwise"
        title="Replace exercise"
        subtitle="Ask the AI trainer or pick an alternative"
        onPress={() => setMode('replace')}
      />
      <OptionRow
        icon="list.bullet"
        title="Reposition"
        subtitle={`Currently ${currentIndex + 1} of ${plan.length}`}
        onPress={() => setMode('reposition')}
        disabled={plan.length <= 1}
      />
      <OptionRow
        icon="trash"
        title="Remove"
        subtitle={
          hasLoggedSets
            ? 'Removes the exercise and any sets you logged'
            : 'Take this exercise out of today’s session'
        }
        destructive
        onPress={() => setMode('remove')}
      />
    </View>
  )

  const renderReplace = () => (
    <View>
      <Text style={[styles.sectionLabel, { color: palette.textSecondary }]}>
        Tell your AI trainer what you want
      </Text>
      <TextInput
        style={[
          styles.promptInput,
          {
            color: palette.textPrimary,
            backgroundColor: palette.surfaceAlt,
            borderColor: palette.border,
          },
        ]}
        placeholder="e.g. easier, no kit, lighter on knees…"
        placeholderTextColor={palette.textTertiary}
        multiline
        value={prompt}
        onChangeText={setPrompt}
        editable={!isGenerating && !applyingId}
      />
      <PillButton
        label={
          isGenerating
            ? 'Asking your trainer'
            : alternatives.length > 0
              ? 'Get new alternatives'
              : 'Find alternatives'
        }
        onPress={handleGenerate}
        loading={isGenerating}
        disabled={isGenerating || applyingId !== null}
        variant="secondary"
      />

      {errorMessage ? (
        <Text style={[styles.errorText, { color: palette.danger }]}>
          {errorMessage}
        </Text>
      ) : null}

      {alternatives.length > 0 ? (
        <>
          <Text
            style={[
              styles.sectionLabel,
              styles.sectionLabelSpaced,
              { color: palette.textSecondary },
            ]}
          >
            Pick one to swap in
          </Text>
          {alternatives.map(alt => {
            const isApplying = applyingId === alt.id
            const reps = alt.targetReps.join('–')
            const meta = `${alt.targetSets}×${reps} · ${alt.tempo} · ${alt.restSec}s rest`
            return (
              <View
                key={alt.id}
                style={[
                  styles.altCard,
                  {
                    backgroundColor: palette.surface,
                    borderColor: palette.border,
                  },
                ]}
              >
                <Text
                  style={[styles.altTitle, { color: palette.textPrimary }]}
                >
                  {alt.name}
                </Text>
                <Text
                  style={[styles.altMeta, { color: palette.textTertiary }]}
                >
                  {alt.modality} · {alt.bodyPart}
                </Text>
                <Text
                  style={[styles.altMetric, { color: palette.textSecondary }]}
                >
                  {meta}
                </Text>
                {alt.instructions ? (
                  <Text
                    style={[styles.altBody, { color: palette.textSecondary }]}
                    numberOfLines={3}
                  >
                    {alt.instructions}
                  </Text>
                ) : null}
                <PillButton
                  label={isApplying ? 'Swapping in' : 'Use this'}
                  onPress={() => handleApply(alt)}
                  loading={isApplying}
                  disabled={applyingId !== null}
                  fullWidth
                />
              </View>
            )
          })}
        </>
      ) : !isGenerating ? (
        <View
          style={[
            styles.emptyHint,
            { backgroundColor: palette.surfaceAlt, borderColor: palette.border },
          ]}
        >
          <IconSymbol
            name="sparkles"
            size={18}
            color={palette.textSecondary}
          />
          <Text style={[styles.emptyHintText, { color: palette.textSecondary }]}>
            Hit “Find alternatives” to see swap-ins picked for your profile.
          </Text>
        </View>
      ) : null}
    </View>
  )

  const renderReposition = () => (
    <View>
      <Text style={[styles.sectionLabel, { color: palette.textSecondary }]}>
        Currently position {currentIndex + 1} of {plan.length}
      </Text>

      <View style={styles.quickRow}>
        <TouchableOpacity
          style={[
            styles.quickButton,
            {
              backgroundColor: palette.surfaceAlt,
              borderColor: palette.border,
            },
            (currentIndex === 0 || reorderingTo !== null) && styles.disabledOpacity,
          ]}
          onPress={() => handleReorder(0)}
          disabled={currentIndex === 0 || reorderingTo !== null}
        >
          <IconSymbol
            name="chevron.up"
            size={16}
            color={palette.textPrimary}
          />
          <Text
            style={[styles.quickButtonLabel, { color: palette.textPrimary }]}
          >
            Move to top
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.quickButton,
            {
              backgroundColor: palette.surfaceAlt,
              borderColor: palette.border,
            },
            (currentIndex === plan.length - 1 || reorderingTo !== null) &&
              styles.disabledOpacity,
          ]}
          onPress={() => handleReorder(plan.length - 1)}
          disabled={currentIndex === plan.length - 1 || reorderingTo !== null}
        >
          <IconSymbol
            name="chevron.down"
            size={16}
            color={palette.textPrimary}
          />
          <Text
            style={[styles.quickButtonLabel, { color: palette.textPrimary }]}
          >
            Move to bottom
          </Text>
        </TouchableOpacity>
      </View>

      <Text
        style={[
          styles.sectionLabel,
          styles.sectionLabelSpaced,
          { color: palette.textSecondary },
        ]}
      >
        Or place around a specific exercise
      </Text>

      {otherExercises.map(other => {
        const otherIndex = plan.findIndex(ex => ex.id === other.id)
        // Target indexes after removing the current exercise:
        // - "before" puts current at `otherIndex` (since current is removed first, this lands it just before other).
        // - "after"  puts current at `otherIndex + 1` minus 1 if current was before other → otherIndex.
        // To keep this intuitive, compute the resulting positions using a simulated move.
        const beforeIndex = otherIndex < currentIndex ? otherIndex : otherIndex - 1
        const afterIndex = otherIndex < currentIndex ? otherIndex + 1 : otherIndex
        const isBusy = reorderingTo !== null

        return (
          <View
            key={other.id}
            style={[
              styles.repositionRow,
              {
                backgroundColor: palette.surface,
                borderColor: palette.border,
              },
            ]}
          >
            <View style={styles.repositionInfo}>
              <Text
                style={[styles.repositionName, { color: palette.textPrimary }]}
                numberOfLines={1}
              >
                {otherIndex + 1}. {other.name}
              </Text>
              <Text
                style={[
                  styles.repositionMeta,
                  { color: palette.textTertiary },
                ]}
                numberOfLines={1}
              >
                {other.modality} · {other.bodyPart}
              </Text>
            </View>
            <View style={styles.repositionActions}>
              <TouchableOpacity
                style={[
                  styles.posChip,
                  {
                    backgroundColor: palette.surfaceAlt,
                    borderColor: palette.border,
                  },
                  (beforeIndex === currentIndex || isBusy) &&
                    styles.disabledOpacity,
                ]}
                onPress={() => handleReorder(beforeIndex)}
                disabled={beforeIndex === currentIndex || isBusy}
              >
                <IconSymbol
                  name="arrow.up.right"
                  size={12}
                  color={palette.textPrimary}
                  style={styles.beforeIcon}
                />
                <Text
                  style={[styles.posChipLabel, { color: palette.textPrimary }]}
                >
                  Before
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.posChip,
                  {
                    backgroundColor: palette.surfaceAlt,
                    borderColor: palette.border,
                  },
                  (afterIndex === currentIndex || isBusy) &&
                    styles.disabledOpacity,
                ]}
                onPress={() => handleReorder(afterIndex)}
                disabled={afterIndex === currentIndex || isBusy}
              >
                <Text
                  style={[styles.posChipLabel, { color: palette.textPrimary }]}
                >
                  After
                </Text>
                <IconSymbol
                  name="arrow.up.right"
                  size={12}
                  color={palette.textPrimary}
                  style={styles.afterIcon}
                />
              </TouchableOpacity>
            </View>
          </View>
        )
      })}

      {errorMessage ? (
        <Text style={[styles.errorText, { color: palette.danger }]}>
          {errorMessage}
        </Text>
      ) : null}
    </View>
  )

  const renderRemove = () => (
    <View>
      <View
        style={[
          styles.warningBlock,
          {
            backgroundColor: palette.dangerMuted,
            borderColor: palette.primaryBorder,
          },
        ]}
      >
        <IconSymbol
          name="exclamationmark.triangle.fill"
          size={22}
          color={palette.danger}
        />
        <Text
          style={[styles.warningTitle, { color: palette.textPrimary }]}
        >
          Remove {truncate(exercise.name, 26)}?
        </Text>
        <Text
          style={[styles.warningBody, { color: palette.textSecondary }]}
        >
          {hasLoggedSets
            ? 'This deletes the exercise and any sets you logged against it. You can’t undo this.'
            : 'This pulls the exercise out of today’s session. You can ask the trainer for a replacement later.'}
        </Text>
      </View>

      {errorMessage ? (
        <Text style={[styles.errorText, { color: palette.danger }]}>
          {errorMessage}
        </Text>
      ) : null}

      <View style={styles.removeButtons}>
        <PillButton
          label="Cancel"
          variant="secondary"
          onPress={() => setMode('main')}
          disabled={isRemoving}
        />
        <PillButton
          label={isRemoving ? 'Removing' : 'Remove'}
          onPress={handleRemove}
          loading={isRemoving}
          disabled={isRemoving}
        />
      </View>
    </View>
  )

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <Pressable style={styles.backdrop} onPress={onClose} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.kavWrap}
        pointerEvents="box-none"
      >
        <Animated.View
          entering={SlideInDown.springify().damping(20)}
          exiting={SlideOutDown}
          style={[
            styles.panel,
            shadows.lg,
            {
              paddingBottom: Math.max(insets.bottom, spacing.lg),
              backgroundColor: palette.bgElevated,
              borderColor: palette.border,
            },
          ]}
        >
          <View
            style={[
              styles.panelHandle,
              { backgroundColor: palette.borderStrong },
            ]}
          />
          {header}
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {mode === 'main' && renderMain()}
            {mode === 'replace' && renderReplace()}
            {mode === 'reposition' && renderReposition()}
            {mode === 'remove' && renderRemove()}
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  )
}

type OptionRowProps = {
  icon: Parameters<typeof IconSymbol>[0]['name']
  title: string
  subtitle: string
  destructive?: boolean
  disabled?: boolean
  onPress: () => void
}

function OptionRow({
  icon,
  title,
  subtitle,
  destructive,
  disabled,
  onPress,
}: OptionRowProps) {
  const { palette } = useTheme()
  const tint = destructive ? palette.danger : palette.textPrimary
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.optionRow,
        {
          backgroundColor: palette.surface,
          borderColor: palette.border,
        },
        disabled && styles.disabledOpacity,
      ]}
    >
      <View
        style={[
          styles.optionIcon,
          {
            backgroundColor: destructive
              ? palette.dangerMuted
              : palette.surfaceAlt,
          },
        ]}
      >
        <IconSymbol name={icon} size={20} color={tint} />
      </View>
      <View style={styles.optionText}>
        <Text style={[styles.optionTitle, { color: tint }]}>{title}</Text>
        <Text
          style={[styles.optionSubtitle, { color: palette.textSecondary }]}
        >
          {subtitle}
        </Text>
      </View>
      <IconSymbol
        name="chevron.right"
        size={18}
        color={palette.textTertiary}
      />
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex: 1,
  },
  kavWrap: {
    width: '100%',
  },
  panel: {
    maxHeight: '88%',
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    paddingTop: spacing.md,
    paddingHorizontal: spacing.xl,
    borderTopWidth: 1,
  },
  panelHandle: {
    alignSelf: 'center',
    width: 44,
    height: 4,
    borderRadius: radius.pill,
    marginBottom: spacing.lg,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSpacer: {
    width: 36,
    height: 36,
  },
  headerTitleWrap: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    ...typography.h3,
  },
  headerSubtitle: {
    ...typography.small,
    marginTop: 2,
    maxWidth: 220,
  },
  scrollContent: {
    paddingBottom: spacing.lg,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    marginBottom: spacing.sm,
  },
  optionIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionText: {
    flex: 1,
  },
  optionTitle: {
    ...typography.bodyStrong,
  },
  optionSubtitle: {
    ...typography.small,
    marginTop: 2,
  },
  disabledOpacity: {
    opacity: 0.45,
  },
  sectionLabel: {
    ...typography.smallStrong,
    marginBottom: spacing.sm,
  },
  sectionLabelSpaced: {
    marginTop: spacing.xl,
  },
  promptInput: {
    minHeight: 70,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
    ...typography.body,
    marginBottom: spacing.md,
    textAlignVertical: 'top',
  },
  emptyHint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    marginTop: spacing.lg,
  },
  emptyHintText: {
    ...typography.small,
    flex: 1,
  },
  altCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  altTitle: {
    ...typography.bodyStrong,
  },
  altMeta: {
    ...typography.caption,
  },
  altMetric: {
    ...typography.small,
  },
  altBody: {
    ...typography.small,
    marginBottom: spacing.sm,
  },
  errorText: {
    ...typography.small,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  quickRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  quickButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  quickButtonLabel: {
    ...typography.smallStrong,
  },
  repositionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: spacing.sm,
  },
  repositionInfo: {
    flex: 1,
  },
  repositionName: {
    ...typography.bodyStrong,
  },
  repositionMeta: {
    ...typography.caption,
    marginTop: 2,
  },
  repositionActions: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  posChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  posChipLabel: {
    ...typography.caption,
    letterSpacing: 0,
  },
  beforeIcon: {
    transform: [{ rotate: '-90deg' }],
  },
  afterIcon: {
    transform: [{ rotate: '90deg' }],
  },
  warningBlock: {
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.sm,
  },
  warningTitle: {
    ...typography.h3,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  warningBody: {
    ...typography.body,
    textAlign: 'center',
  },
  removeButtons: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
})
