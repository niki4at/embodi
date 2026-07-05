import { useMutation } from 'convex/react'
import * as Haptics from 'expo-haptics'
import { router } from 'expo-router'
import React, { useState } from 'react'
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import Animated, {
  Easing,
  SlideInDown,
  SlideOutDown,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { IconSymbol } from '@/components/ui/icon-symbol'
import { radius, spacing, typography } from '@/constants/design'
import { useTheme } from '@/constants/theme-context'
import { api } from '@/convex/_generated/api'
import { Id } from '@/convex/_generated/dataModel'

type TryMode = 'session' | 'routine'

/**
 * Bottom sheet shown from a workout detail: clone the shared workout and
 * either jump straight into logging it or stash it in your routines.
 */
export function TryWorkoutSheet({
  visible,
  postId,
  workoutTitle,
  onClose,
}: {
  visible: boolean
  postId: Id<'posts'>
  workoutTitle: string
  onClose: () => void
}) {
  const { palette, shadows } = useTheme()
  const insets = useSafeAreaInsets()
  const tryWorkout = useMutation(api.social.tryWorkout)

  const [busyMode, setBusyMode] = useState<TryMode | null>(null)
  const [saved, setSaved] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handlePick = async (mode: TryMode) => {
    if (busyMode) return
    setBusyMode(mode)
    setErrorMessage(null)
    try {
      const result = await tryWorkout({ postId, mode })
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      if (mode === 'session' && result.sessionId) {
        onClose()
        router.push({
          pathname: '/session',
          params: { sessionId: String(result.sessionId) },
        })
      } else {
        setSaved(true)
      }
    } catch (error) {
      console.error('try workout error', error)
      setErrorMessage('Could not copy this workout. Please try again.')
    } finally {
      setBusyMode(null)
    }
  }

  const handleClose = () => {
    setSaved(false)
    setErrorMessage(null)
    onClose()
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={handleClose} />
        <Animated.View
          entering={SlideInDown.duration(280).easing(
            Easing.bezier(0.22, 1, 0.36, 1),
          )}
          exiting={SlideOutDown.duration(220).easing(
            Easing.bezier(0.4, 0, 1, 1),
          )}
          style={[
            styles.panel,
            shadows.lg,
            {
              paddingBottom: Math.max(insets.bottom, spacing.lg) + spacing.md,
              backgroundColor: palette.bgElevated,
              borderColor: palette.border,
            },
          ]}
        >
          <View
            style={[styles.handle, { backgroundColor: palette.borderStrong }]}
          />
          <Text style={[styles.title, { color: palette.textPrimary }]}>
            Try this workout
          </Text>
          <Text
            style={[styles.subtitle, { color: palette.textSecondary }]}
            numberOfLines={1}
          >
            {workoutTitle}
          </Text>

          {saved ? (
            <View style={styles.savedWrap}>
              <IconSymbol
                name="checkmark.circle.fill"
                size={40}
                color={palette.success}
              />
              <Text style={[styles.savedText, { color: palette.textPrimary }]}>
                Saved to your routines
              </Text>
              <TouchableOpacity
                style={[styles.savedButton, { backgroundColor: palette.primary }]}
                onPress={() => {
                  handleClose()
                  router.push('/routines')
                }}
                activeOpacity={0.85}
              >
                <Text style={[styles.savedButtonText, { color: palette.white }]}>
                  View routines
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <TouchableOpacity
                style={[
                  styles.option,
                  {
                    backgroundColor: palette.surfaceAlt,
                    borderColor: palette.border,
                  },
                ]}
                onPress={() => handlePick('session')}
                disabled={busyMode !== null}
                activeOpacity={0.8}
              >
                <View
                  style={[
                    styles.optionIcon,
                    { backgroundColor: palette.primaryMuted },
                  ]}
                >
                  {busyMode === 'session' ? (
                    <ActivityIndicator size="small" color={palette.primary} />
                  ) : (
                    <IconSymbol
                      name="play.fill"
                      size={20}
                      color={palette.primary}
                    />
                  )}
                </View>
                <View style={styles.optionText}>
                  <Text
                    style={[styles.optionTitle, { color: palette.textPrimary }]}
                  >
                    Start now
                  </Text>
                  <Text
                    style={[
                      styles.optionSubtitle,
                      { color: palette.textSecondary },
                    ]}
                  >
                    Copy the exercises and start logging right away
                  </Text>
                </View>
                <IconSymbol
                  name="chevron.right"
                  size={16}
                  color={palette.textTertiary}
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.option,
                  {
                    backgroundColor: palette.surfaceAlt,
                    borderColor: palette.border,
                  },
                ]}
                onPress={() => handlePick('routine')}
                disabled={busyMode !== null}
                activeOpacity={0.8}
              >
                <View
                  style={[
                    styles.optionIcon,
                    { backgroundColor: palette.successMuted },
                  ]}
                >
                  {busyMode === 'routine' ? (
                    <ActivityIndicator size="small" color={palette.success} />
                  ) : (
                    <IconSymbol
                      name="bookmark.fill"
                      size={18}
                      color={palette.success}
                    />
                  )}
                </View>
                <View style={styles.optionText}>
                  <Text
                    style={[styles.optionTitle, { color: palette.textPrimary }]}
                  >
                    Save to routines
                  </Text>
                  <Text
                    style={[
                      styles.optionSubtitle,
                      { color: palette.textSecondary },
                    ]}
                  >
                    Keep it in your library to run any time
                  </Text>
                </View>
                <IconSymbol
                  name="chevron.right"
                  size={16}
                  color={palette.textTertiary}
                />
              </TouchableOpacity>

              {errorMessage ? (
                <Text style={[styles.errorText, { color: palette.danger }]}>
                  {errorMessage}
                </Text>
              ) : null}
            </>
          )}
        </Animated.View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  panel: {
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    paddingTop: spacing.md,
    paddingHorizontal: spacing.xl,
    borderTopWidth: 1,
  },
  handle: {
    alignSelf: 'center',
    width: 44,
    height: 4,
    borderRadius: radius.pill,
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.h2,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.small,
    textAlign: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.xl,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  optionIcon: {
    width: 44,
    height: 44,
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
    marginTop: 1,
  },
  errorText: {
    ...typography.small,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  savedWrap: {
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.lg,
  },
  savedText: {
    ...typography.bodyStrong,
  },
  savedButton: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  savedButtonText: {
    ...typography.button,
  },
})
