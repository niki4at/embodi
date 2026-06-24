import { useMutation } from 'convex/react'
import * as Haptics from 'expo-haptics'
import React, { useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import Animated, {
  Easing,
  SlideInDown,
  SlideOutDown,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import {
  ExerciseLibrary,
  type ExerciseEntry,
} from '@/components/library/exercise-library'
import { IconSymbol } from '@/components/ui/icon-symbol'
import { radius, spacing, typography } from '@/constants/design'
import { useTheme } from '@/constants/theme-context'
import { api } from '@/convex/_generated/api'
import { Id } from '@/convex/_generated/dataModel'

type AddExerciseSheetProps = {
  visible: boolean
  sessionId: Id<'workout_sessions'>
  onClose: () => void
  onAdded?: (count: number) => void
}

export default function AddExerciseSheet({
  visible,
  sessionId,
  onClose,
  onAdded,
}: AddExerciseSheetProps) {
  const { palette, shadows } = useTheme()
  const insets = useSafeAreaInsets()
  const addExercises = useMutation(api.trainer.addExercisesToSession)

  const [selected, setSelected] = useState<ExerciseEntry[]>([])
  const [isAdding, setIsAdding] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const selectedIds = useMemo(() => selected.map((ex) => ex.id), [selected])
  const hasSelection = selected.length > 0

  const reset = () => {
    setSelected([])
    setIsAdding(false)
    setErrorMessage(null)
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const handleToggle = (exercise: ExerciseEntry) => {
    setErrorMessage(null)
    setSelected((prev) => {
      const exists = prev.some((e) => e.id === exercise.id)
      if (exists) return prev.filter((e) => e.id !== exercise.id)
      return [...prev, exercise]
    })
  }

  const handleAdd = async () => {
    if (!hasSelection || isAdding) return
    setIsAdding(true)
    setErrorMessage(null)
    try {
      const count = await addExercises({
        sessionId,
        exercises: selected.map((ex) => ({
          id: ex.id,
          name: ex.name,
          bodyPart: ex.bodyPart,
          modality: ex.modality,
          equipment: ex.equipment,
        })),
      })
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      onAdded?.(count)
      reset()
      onClose()
    } catch (error) {
      console.error('add exercises error', error)
      setErrorMessage('Could not add those exercises. Please try again.')
      setIsAdding(false)
    }
  }

  if (!visible) return null

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <Pressable style={styles.backdrop} onPress={handleClose} />
      <Animated.View
        entering={SlideInDown.duration(280).easing(
          Easing.bezier(0.22, 1, 0.36, 1),
        )}
        exiting={SlideOutDown.duration(220).easing(Easing.bezier(0.4, 0, 1, 1))}
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
          style={[styles.panelHandle, { backgroundColor: palette.borderStrong }]}
        />
        <View style={styles.header}>
          <View style={styles.headerSpacer} />
          <View style={styles.headerTitleWrap}>
            <Text style={[styles.headerTitle, { color: palette.textPrimary }]}>
              Add exercises
            </Text>
            <Text
              style={[styles.headerSubtitle, { color: palette.textSecondary }]}
              numberOfLines={1}
            >
              Pick moves to drop into today&apos;s session
            </Text>
          </View>
          <Pressable
            onPress={handleClose}
            style={[
              styles.headerIcon,
              { backgroundColor: palette.surface, borderColor: palette.border },
            ]}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <IconSymbol name="xmark" size={18} color={palette.textPrimary} />
          </Pressable>
        </View>

        <View style={styles.libraryWrap}>
          <ExerciseLibrary
            onSelectExercise={handleToggle}
            selectedIds={selectedIds}
            listBottomPadding={hasSelection ? 140 : spacing.xxl}
          />
        </View>

        {errorMessage ? (
          <Text style={[styles.errorText, { color: palette.danger }]}>
            {errorMessage}
          </Text>
        ) : null}

        {hasSelection ? (
          <View
            style={[
              styles.tray,
              {
                backgroundColor: palette.bgElevated,
                borderTopColor: palette.divider,
                paddingBottom: Math.max(insets.bottom, spacing.lg),
              },
            ]}
          >
            <View style={styles.trayText}>
              <Text style={[styles.trayCount, { color: palette.textPrimary }]}>
                {selected.length} selected
              </Text>
              <Text
                style={[styles.trayHint, { color: palette.textSecondary }]}
                numberOfLines={1}
              >
                {selected.map((e) => e.name).join(' · ')}
              </Text>
            </View>
            <Pressable
              onPress={handleAdd}
              disabled={isAdding}
              style={({ pressed }) => [
                styles.addCta,
                { backgroundColor: palette.primary, opacity: pressed ? 0.9 : 1 },
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Add ${selected.length} exercise${
                selected.length > 1 ? 's' : ''
              }`}
            >
              {isAdding ? (
                <ActivityIndicator size="small" color={palette.white} />
              ) : (
                <>
                  <IconSymbol name="plus" size={16} color={palette.white} />
                  <Text style={[styles.addCtaText, { color: palette.white }]}>
                    Add {selected.length}
                  </Text>
                </>
              )}
            </Pressable>
          </View>
        ) : null}
      </Animated.View>
    </View>
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
  panel: {
    height: '88%',
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
  header: {
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
  },
  libraryWrap: {
    flex: 1,
    marginHorizontal: -spacing.xl,
  },
  errorText: {
    ...typography.small,
    marginTop: spacing.sm,
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
  addCta: {
    height: 50,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minWidth: 110,
  },
  addCtaText: {
    ...typography.button,
  },
})
