import React from 'react'
import { StyleSheet } from 'react-native'
import Animated, { FadeInUp, FadeOutDown } from 'react-native-reanimated'

import { CoachNote } from '@/components/ui/primitives'
import { motion, spacing } from '@/constants/design'

import { CoachComment } from './types'

type CoachBubbleProps = {
  comment: CoachComment | null
}

/**
 * Live-session coach remark. Sits directly above the Complete button so it
 * never covers the set table; uses the shared lavender coach bubble.
 */
export default function CoachBubble({ comment }: CoachBubbleProps) {
  if (!comment) return null

  return (
    <Animated.View
      entering={FadeInUp.duration(motion.duration.base)}
      exiting={FadeOutDown.duration(motion.duration.quick)}
      style={styles.container}
      accessibilityLiveRegion="polite"
    >
      <CoachNote eyebrow="Coach's advice">{comment.text}</CoachNote>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.xs,
  },
})
