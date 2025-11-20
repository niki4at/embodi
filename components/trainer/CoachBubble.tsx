import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Animated, { FadeInUp, FadeOutDown } from 'react-native-reanimated'

import { CoachComment } from './types'

type CoachBubbleProps = {
  comment: CoachComment | null
}

export default function CoachBubble({ comment }: CoachBubbleProps) {
  if (!comment) return null

  return (
    <Animated.View
      entering={FadeInUp.duration(300)}
      exiting={FadeOutDown.duration(200)}
      style={styles.container}
    >
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>AI</Text>
      </View>
      <Text style={styles.text}>{comment.text}</Text>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 24,
    left: 20,
    right: 20,
    backgroundColor: '#111827',
    borderRadius: 20,
    padding: 16,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 16,
    elevation: 10,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f97316',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#fff',
    fontWeight: '700',
  },
  text: {
    flex: 1,
    color: '#f8fafc',
    fontSize: 15,
    lineHeight: 20,
  },
})


