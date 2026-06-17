import { useMutation } from 'convex/react'
import * as Haptics from 'expo-haptics'
import { router, type Href } from 'expo-router'
import React, { useCallback, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import Animated, { FadeInUp } from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'

import {
  ExerciseLibrary,
  type ExerciseEntry,
} from '@/components/library/exercise-library'
import { IconSymbol } from '@/components/ui/icon-symbol'
import { motion, radius, spacing, typography } from '@/constants/design'
import { useTheme } from '@/constants/theme-context'
import { api } from '@/convex/_generated/api'

export default function BuildWorkoutScreen() {
  const { palette, resolved, shadows } = useTheme()
  const createCustomSession = useMutation(api.trainer.createCustomSession)
  const [selected, setSelected] = useState<ExerciseEntry[]>([])
  const [isStarting, setIsStarting] = useState(false)

  const handleBack = useCallback(() => {
    Haptics.selectionAsync()
    if (router.canGoBack()) {
      router.back()
    } else {
      router.replace('/')
    }
  }, [])

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

  const handleStart = useCallback(async () => {
    if (selected.length === 0 || isStarting) return
    setIsStarting(true)
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
      const sessionId = await createCustomSession({
        exercises: selected.map((ex) => ({
          id: ex.id,
          name: ex.name,
          bodyPart: ex.bodyPart,
          modality: ex.modality,
          equipment: ex.equipment,
        })),
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
  }, [selected, isStarting, createCustomSession])

  const selectedIds = selected.map((e) => e.id)
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
          accessibilityLabel="Go back"
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
          Build your own
        </Text>
        <Text style={[styles.subtitle, { color: palette.textSecondary }]}>
          Pick the movements you want, then start logging.
        </Text>
      </Animated.View>

      <ExerciseLibrary
        onSelectExercise={handleToggle}
        selectedIds={selectedIds}
        listBottomPadding={hasSelection ? 140 : spacing.huge}
      />

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
              {selected.length} exercise{selected.length > 1 ? 's' : ''} selected
            </Text>
            <Text
              style={[styles.trayHint, { color: palette.textSecondary }]}
              numberOfLines={1}
            >
              {selected.map((e) => e.name).join(' · ')}
            </Text>
          </View>
          <Pressable
            onPress={handleStart}
            disabled={isStarting}
            style={({ pressed }) => [
              styles.startCta,
              { backgroundColor: palette.primary, opacity: pressed ? 0.9 : 1 },
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
        </View>
      ) : null}
    </SafeAreaView>
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
