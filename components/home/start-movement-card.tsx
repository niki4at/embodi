import { IconSymbol } from '@/components/ui/icon-symbol'
import { motion, radius, spacing, typography } from '@/constants/design'
import { useTheme } from '@/constants/theme-context'
import * as Haptics from 'expo-haptics'
import React, { memo, useCallback } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated'

export interface StartMovementCardProps {
  onAskCoach: () => void
  onStartMyOwn: () => void
  isStartingCoachSession?: boolean
}

/**
 * Top-of-home "Start your movement" choice card. Two equal-weight tiles let the
 * user pick between an AI-coached session (Ask coach -> check-in flow) and a
 * self-built session (Start my own -> manual workout flow).
 */
function StartMovementCardComponent({
  onAskCoach,
  onStartMyOwn,
  isStartingCoachSession = false,
}: StartMovementCardProps) {
  const { palette, resolved, shadows } = useTheme()

  const handleAskCoach = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    onAskCoach()
  }, [onAskCoach])

  const handleStartMyOwn = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    onStartMyOwn()
  }, [onStartMyOwn])

  const cardBg = resolved === 'dark' ? palette.surface : '#FFF1F1'
  const cardBorder =
    resolved === 'dark' ? palette.border : 'rgba(255, 107, 107, 0.12)'
  const cardShadow = resolved === 'dark' ? shadows.none : shadows.sm

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: cardBg,
          borderColor: cardBorder,
        },
        cardShadow,
      ]}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: palette.textPrimary }]}>
          Start your movement
        </Text>
        <Text style={[styles.subtitle, { color: palette.textSecondary }]}>
          Choose your preference
        </Text>
      </View>

      <View style={styles.tilesRow}>
        <Tile
          emoji="🏋️"
          label="Start my own"
          helper="Build your own session"
          accentColor={palette.primary}
          tileBg={palette.bgElevated}
          tileBorder={resolved === 'dark' ? palette.border : 'transparent'}
          labelColor={palette.textPrimary}
          helperColor={palette.textSecondary}
          chipBg={palette.surfaceAlt}
          onPress={handleStartMyOwn}
          accessibilityLabel="Start my own workout. Build your own session."
        />
        <Tile
          emoji="⚡"
          label="Ask coach"
          helper={
            isStartingCoachSession
              ? 'Starting your session…'
              : 'Get a personalised session'
          }
          accentColor={palette.primary}
          tileBg={palette.bgElevated}
          tileBorder={resolved === 'dark' ? palette.border : 'transparent'}
          labelColor={palette.textPrimary}
          helperColor={palette.textSecondary}
          chipBg={palette.primaryMuted}
          showAiBadge
          onPress={handleAskCoach}
          disabled={isStartingCoachSession}
          accessibilityLabel="Ask coach for a personalised session built from a quick check-in."
        />
      </View>
    </View>
  )
}

export const StartMovementCard = memo(StartMovementCardComponent)

interface TileProps {
  emoji: string
  label: string
  helper: string
  accentColor: string
  tileBg: string
  tileBorder: string
  labelColor: string
  helperColor: string
  chipBg: string
  showAiBadge?: boolean
  disabled?: boolean
  onPress: () => void
  accessibilityLabel: string
}

function Tile({
  emoji,
  label,
  helper,
  accentColor,
  tileBg,
  tileBorder,
  labelColor,
  helperColor,
  chipBg,
  showAiBadge = false,
  disabled = false,
  onPress,
  accessibilityLabel,
}: TileProps) {
  const scale = useSharedValue(1)
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  return (
    <Pressable
      onPressIn={() => {
        if (disabled) return
        scale.value = withSpring(0.97, motion.spring)
      }}
      onPressOut={() => {
        scale.value = withSpring(1, motion.spring)
      }}
      onPress={onPress}
      disabled={disabled}
      style={styles.tilePressable}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
    >
      <Animated.View
        style={[
          styles.tile,
          {
            backgroundColor: tileBg,
            borderColor: tileBorder,
            borderWidth: tileBorder === 'transparent' ? 0 : 1,
            opacity: disabled ? 0.7 : 1,
          },
          animatedStyle,
        ]}
      >
        {showAiBadge && (
          <View style={[styles.aiBadge, { backgroundColor: accentColor }]}>
            <Text style={styles.aiBadgeText}>AI</Text>
          </View>
        )}
        <View style={[styles.emojiChip, { backgroundColor: chipBg }]}>
          <Text style={styles.emoji}>{emoji}</Text>
        </View>
        <Text style={[styles.tileLabel, { color: accentColor }]} numberOfLines={1}>
          {label}
        </Text>
        <Text
          style={[styles.tileHelper, { color: helperColor }]}
          numberOfLines={2}
        >
          {helper}
        </Text>
        <View style={styles.arrowRow}>
          <IconSymbol name="arrow.right" size={14} color={labelColor} />
        </View>
      </Animated.View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: {
    marginTop: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.xxl,
    borderWidth: 1,
  },
  header: {
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.xs,
  },
  title: {
    ...typography.h3,
    fontSize: 18,
    marginBottom: 2,
  },
  subtitle: {
    ...typography.small,
  },
  tilesRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  tilePressable: {
    flex: 1,
  },
  tile: {
    flex: 1,
    minHeight: 152,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  emojiChip: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  emoji: {
    fontSize: 30,
    lineHeight: 36,
  },
  tileLabel: {
    ...typography.bodyStrong,
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 2,
  },
  tileHelper: {
    ...typography.small,
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
  },
  arrowRow: {
    position: 'absolute',
    bottom: spacing.sm,
    right: spacing.sm,
    opacity: 0.45,
  },
  aiBadge: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  aiBadgeText: {
    ...typography.caption,
    fontSize: 9,
    lineHeight: 12,
    letterSpacing: 0.4,
    color: '#FFFFFF',
  },
})
