import * as Haptics from 'expo-haptics'
import React from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'

import { IconSymbol } from '@/components/ui/icon-symbol'
import { radius, spacing, typography } from '@/constants/design'
import { useTheme, type ThemeMode } from '@/constants/theme-context'

const OPTIONS: { value: ThemeMode; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
]

/** Appearance selector: System / Light / Dark, stored on device. */
export function ThemeRow() {
  const { palette, mode, setMode } = useTheme()

  return (
    <View
      style={[
        styles.row,
        { backgroundColor: palette.surface, borderColor: palette.border },
      ]}
    >
      <View style={[styles.icon, { backgroundColor: palette.surfaceAlt }]}>
        <IconSymbol name="moon.fill" size={18} color={palette.textPrimary} />
      </View>
      <View style={styles.text}>
        <Text style={[styles.title, { color: palette.textPrimary }]}>
          Appearance
        </Text>
        <View style={styles.segments}>
          {OPTIONS.map((option) => {
            const active = mode === option.value
            return (
              <TouchableOpacity
                key={option.value}
                onPress={() => {
                  Haptics.selectionAsync()
                  setMode(option.value)
                }}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`${option.label} appearance`}
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
