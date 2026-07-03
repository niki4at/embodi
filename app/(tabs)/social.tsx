import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'

import { useFloatingTabBarInset } from '@/components/navigation/floating-tab-bar'
import { IconSymbol } from '@/components/ui/icon-symbol'
import { motion, radius, spacing, typography } from '@/constants/design'
import { useTheme } from '@/constants/theme-context'

export default function SocialScreen() {
  const { palette } = useTheme()
  const tabBarInset = useFloatingTabBarInset()

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: palette.bg }]}
      edges={['top']}
    >
      <Animated.View
        entering={FadeInUp.duration(motion.duration.base)}
        style={styles.header}
      >
        <Text style={[styles.title, { color: palette.textPrimary }]}>
          Social
        </Text>
        <Text style={[styles.subtitle, { color: palette.textSecondary }]}>
          Train together, stay accountable
        </Text>
      </Animated.View>

      <View style={[styles.body, { paddingBottom: tabBarInset }]}>
        <Animated.View
          entering={FadeInDown.duration(motion.duration.base)}
          style={[
            styles.card,
            { backgroundColor: palette.surface, borderColor: palette.border },
          ]}
        >
          <View style={[styles.iconWrap, { backgroundColor: palette.primaryMuted }]}>
            <IconSymbol name="person.2.fill" size={30} color={palette.primary} />
          </View>
          <Text style={[styles.cardTitle, { color: palette.textPrimary }]}>
            Coming soon
          </Text>
          <Text style={[styles.cardBody, { color: palette.textSecondary }]}>
            Follow friends, share your sessions, and cheer each other on. We&apos;re
            building it now.
          </Text>
        </Animated.View>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
  },
  title: {
    ...typography.h1,
  },
  subtitle: {
    ...typography.small,
    marginTop: 2,
  },
  body: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    justifyContent: 'center',
  },
  card: {
    alignItems: 'center',
    padding: spacing.xxl,
    borderRadius: radius.xl,
    borderWidth: 1,
    gap: spacing.sm,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  cardTitle: {
    ...typography.h2,
  },
  cardBody: {
    ...typography.small,
    textAlign: 'center',
  },
})
