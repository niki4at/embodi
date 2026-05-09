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

import { motion, radius, shadow, spacing, typography } from '@/constants/design'
import { useTheme } from '@/constants/theme-context'

type PillVariant = 'primary' | 'secondary' | 'ghost'

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
 * Coral pill CTA matching the Figma onboarding "Get started" / "I already have
 * an account" buttons. Variants share the same height and pill radius so
 * stacked CTAs line up cleanly.
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

  const isPrimary = variant === 'primary'
  const isGhost = variant === 'ghost'

  const containerStyle: ViewStyle = isPrimary
    ? {
        backgroundColor: disabled ? palette.surfaceHigh : palette.primary,
        ...(disabled
          ? shadow.none
          : resolved === 'dark'
            ? shadow.primaryDark
            : shadow.primary),
      }
    : isGhost
      ? {
          backgroundColor: 'transparent',
        }
      : {
          backgroundColor: palette.surface,
          borderWidth: 1,
          borderColor: palette.borderStrong,
        }

  const labelColor = isPrimary
    ? palette.white
    : isGhost
      ? palette.textSecondary
      : palette.textPrimary

  return (
    <Animated.View
      style={[
        animatedStyle,
        fullWidth ? styles.fullWidth : null,
        style,
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityState={{ disabled: !!disabled }}
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
        {loading ? (
          <ActivityIndicator color={labelColor} />
        ) : (
          <Text style={[styles.label, { color: labelColor }]}>{label}</Text>
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
    height: 58,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  label: {
    ...typography.button,
  },
  disabled: {
    opacity: 0.6,
  },
})
