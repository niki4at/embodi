import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Animated, { FadeInUp, FadeOutDown } from 'react-native-reanimated'

import { motion, radius, spacing, typography } from '@/constants/design'
import { useTheme } from '@/constants/theme-context'

import { CoachComment } from './types'

type CoachBubbleProps = {
  comment: CoachComment | null
}

export default function CoachBubble({ comment }: CoachBubbleProps) {
  const { palette, shadows } = useTheme()
  if (!comment) return null

  return (
    <Animated.View
      entering={FadeInUp.duration(motion.duration.base)}
      exiting={FadeOutDown.duration(motion.duration.quick)}
      style={[
        styles.container,
        shadows.lg,
        {
          backgroundColor: palette.bgElevated,
          borderColor: palette.border,
        },
      ]}
    >
      <View style={[styles.avatar, { backgroundColor: palette.primary }]}>
        <Text style={[styles.avatarText, { color: palette.white }]}>e</Text>
      </View>
      <View style={styles.content}>
        <Text style={[styles.label, { color: palette.primary }]}>Coach</Text>
        <Text style={[styles.text, { color: palette.textPrimary }]}>
          {comment.text}
        </Text>
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: spacing.xl,
    left: spacing.lg,
    right: spacing.lg,
    borderRadius: radius.xl,
    padding: spacing.lg,
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    ...typography.h2,
    fontWeight: '800',
  },
  content: {
    flex: 1,
  },
  label: {
    ...typography.caption,
    marginBottom: 2,
  },
  text: {
    ...typography.body,
  },
})
