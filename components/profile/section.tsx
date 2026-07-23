import React from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'

import { spacing, typography } from '@/constants/design'
import { useTheme } from '@/constants/theme-context'

interface SectionHeaderProps {
  title: string
  actionLabel?: string
  onAction?: () => void
}

/** Uppercase section label with an optional trailing action link. */
export function SectionHeader({
  title,
  actionLabel,
  onAction,
}: SectionHeaderProps) {
  const { palette } = useTheme()
  return (
    <View style={styles.header}>
      <Text style={[styles.label, { color: palette.textTertiary }]}>
        {title}
      </Text>
      {actionLabel && onAction ? (
        <TouchableOpacity
          onPress={onAction}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
        >
          <Text style={[styles.action, { color: palette.primary }]}>
            {actionLabel}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  )
}

/** Quiet placeholder for sections without data yet. */
export function EmptyHint({ text }: { text: string }) {
  const { palette } = useTheme()
  return (
    <View
      style={[
        styles.empty,
        { backgroundColor: palette.surface, borderColor: palette.border },
      ]}
    >
      <Text style={[styles.emptyText, { color: palette.textSecondary }]}>
        {text}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xxl,
    marginBottom: spacing.md,
  },
  label: {
    ...typography.caption,
  },
  action: {
    ...typography.smallStrong,
  },
  empty: {
    borderRadius: 16,
    borderWidth: 1,
    padding: spacing.lg,
  },
  emptyText: {
    ...typography.small,
  },
})
