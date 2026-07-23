import React from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { IconSymbol } from '@/components/ui/icon-symbol'
import { radius, spacing, typography } from '@/constants/design'
import { useTheme } from '@/constants/theme-context'

const INTEGRATIONS = [
  'Apple Health & Health Connect',
  'Strava',
  'Spotify',
  'Wearables',
]

/** Restrained preview of planned integrations. No active Connect actions. */
export function ComingSoonCard() {
  const { palette } = useTheme()

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: palette.surface, borderColor: palette.border },
      ]}
    >
      <View style={styles.header}>
        <IconSymbol name="link" size={16} color={palette.textTertiary} />
        <Text style={[typography.bodyStrong, { color: palette.textPrimary }]}>
          Integrations
        </Text>
        <View style={[styles.badge, { backgroundColor: palette.surfaceAlt }]}>
          <Text style={[typography.caption, { color: palette.textSecondary }]}>
            COMING SOON
          </Text>
        </View>
      </View>
      <Text style={[typography.small, { color: palette.textSecondary }]}>
        {INTEGRATIONS.join(' · ')}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  badge: {
    marginLeft: 'auto',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 3,
  },
})
