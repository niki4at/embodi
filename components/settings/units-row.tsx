import { useMutation, useQuery } from 'convex/react'
import * as Haptics from 'expo-haptics'
import React from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'

import { IconSymbol } from '@/components/ui/icon-symbol'
import { radius, spacing, typography } from '@/constants/design'
import { useTheme } from '@/constants/theme-context'
import { api } from '@/convex/_generated/api'

const OPTIONS: { value: 'metric' | 'imperial'; label: string }[] = [
  { value: 'metric', label: 'Metric (kg, km)' },
  { value: 'imperial', label: 'Imperial (lb, mi)' },
]

/** Units selector: Metric / Imperial, synced through Convex. */
export function UnitsRow() {
  const { palette } = useTheme()
  const settings = useQuery(api.userSettings.get)
  const update = useMutation(api.userSettings.update)
  const units = settings?.units ?? 'metric'

  return (
    <View
      style={[
        styles.row,
        { backgroundColor: palette.surface, borderColor: palette.border },
      ]}
    >
      <View style={[styles.icon, { backgroundColor: palette.surfaceAlt }]}>
        <IconSymbol name="ruler" size={18} color={palette.textPrimary} />
      </View>
      <View style={styles.text}>
        <Text style={[styles.title, { color: palette.textPrimary }]}>
          Units
        </Text>
        <View style={styles.segments}>
          {OPTIONS.map((option) => {
            const active = units === option.value
            return (
              <TouchableOpacity
                key={option.value}
                onPress={() => {
                  Haptics.selectionAsync()
                  update({ units: option.value }).catch(() => {})
                }}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={option.label}
                style={[
                  styles.segment,
                  {
                    backgroundColor: active
                      ? palette.primaryMuted
                      : palette.surfaceAlt,
                    borderColor: active ? palette.primaryBorder : 'transparent',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.segmentLabel,
                    { color: active ? palette.primary : palette.textSecondary },
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            )
          })}
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
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
    marginBottom: spacing.sm,
  },
  segments: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  segmentLabel: {
    ...typography.smallStrong,
    fontSize: 12,
  },
})
