import * as Haptics from 'expo-haptics'
import { router, type Href } from 'expo-router'
import React, { useCallback } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'

import { IconSymbol } from '@/components/ui/icon-symbol'
import { radius, spacing, typography } from '@/constants/design'
import { useTheme } from '@/constants/theme-context'

/** Entry card into the Journey timeline (milestones, PRs, summaries). */
export function JourneyPreview() {
  const { palette } = useTheme()

  const handleOpen = useCallback(() => {
    Haptics.selectionAsync()
    router.push('/journey' as Href)
  }, [])

  return (
    <TouchableOpacity
      onPress={handleOpen}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel="Open your journey"
      style={[
        styles.card,
        { backgroundColor: palette.surface, borderColor: palette.border },
      ]}
    >
      <View style={[styles.icon, { backgroundColor: palette.primaryMuted }]}>
        <IconSymbol name="sparkles" size={18} color={palette.primary} />
      </View>
      <View style={styles.text}>
        <Text style={[styles.title, { color: palette.textPrimary }]}>
          Your journey
        </Text>
        <Text style={[styles.subtitle, { color: palette.textSecondary }]}>
          Milestones, records, and how far you&apos;ve come
        </Text>
      </View>
      <IconSymbol name="chevron.right" size={16} color={palette.textTertiary} />
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  icon: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    flex: 1,
  },
  title: {
    ...typography.bodyStrong,
  },
  subtitle: {
    ...typography.small,
    marginTop: 1,
  },
})
