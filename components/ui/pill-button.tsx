import { LinearGradient } from 'expo-linear-gradient'
import React from 'react'
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  ViewStyle,
} from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated'

import { gradients, motion, radius, spacing, typography } from '@/constants/design'
import { useTheme } from '@/constants/theme-context'

type PillVariant = 'primary' | 'gradient' | 'secondary' | 'ghost'

interface PillButtonProps {
  label: string
  onPress?: () => void
  disabled?: boolean
  loading?: boolean
  variant?: PillVariant
  fullWidth?: boolean
  style?: ViewStyle
  accessibilityLabel?: string
  testID?: string
}

/**
 * Bodfit pill CTA. `primary` is solid ink (Continue, Log it), `gradient` is
 * the blue-to-lavender hero button (Build my session, Start session),
 * `secondary` is a hairline outline, `ghost` is text only. All share one
 * height and radius so stacked CTAs line up.
 */
export function PillButton({
  label,
  onPress,
  disabled,
  loading,
  variant = 'primary',
  fullWidth = true,
  style,
  accessibilityLabel,
  testID,
}: PillButtonProps) {
  const { palette, resolved } = useTheme()
  const scale = useSharedValue(1)
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  const ink = resolved === 'dark' ? palette.white : palette.textPrimary
  const onInk = resolved === 'dark' ? palette.black : palette.white

  let containerStyle: ViewStyle
  let labelColor: string
  switch (variant) {
    case 'primary':
      containerStyle = { backgroundColor: disabled ? palette.surfaceHigh : ink }
      labelColor = disabled ? palette.textTertiary : onInk
      break
    case 'gradient':
      containerStyle = { backgroundColor: 'transparent' }
      labelColor = palette.white
      break
    case 'secondary':
      containerStyle = {
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: palette.borderStrong,
      }
      labelColor = palette.textPrimary
      break
    case 'ghost':
      containerStyle = { backgroundColor: 'transparent' }
      labelColor = palette.textSecondary
      break
    default: {
      const _exhaustive: never = variant
      return _exhaustive
    }
  }

  const content = loading ? (
    <ActivityIndicator color={labelColor} />
  ) : (
    <Text style={[styles.label, { color: labelColor }]} numberOfLines={1}>
      {label}
    </Text>
  )

  return (
    <Animated.View
      style={[animatedStyle, fullWidth ? styles.fullWidth : null, style]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityState={{ disabled: !!disabled, busy: !!loading }}
        testID={testID}
        onPress={() => {
          if (disabled || loading) return
          onPress?.()
        }}
        onPressIn={() => {
          if (disabled || loading) return
          scale.value = withSpring(0.97, motion.spring)
        }}
        onPressOut={() => {
          scale.value = withSpring(1, motion.spring)
        }}
        style={[styles.base, containerStyle, disabled && styles.disabled]}
      >
        {variant === 'gradient' ? (
          <LinearGradient
            colors={[...gradients.hero]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={[styles.gradient, disabled && styles.gradientDisabled]}
          >
            {content}
          </LinearGradient>
        ) : (
          content
        )}
      </Pressable>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  fullWidth: {
    width: '100%',
  },
  base: {
    height: 52,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    overflow: 'hidden',
  },
  gradient: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
  },
  gradientDisabled: {
    opacity: 0.55,
  },
  label: {
    ...typography.button,
  },
  disabled: {
    opacity: 0.7,
  },
})
