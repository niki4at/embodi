import React from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'

import { IconSymbol } from '@/components/ui/icon-symbol'
import { radius, spacing, typography } from '@/constants/design'
import { useTheme } from '@/constants/theme-context'

import {
  EQUIPMENT_INTENT_LABELS,
  TRAINING_ENVIRONMENT_LABELS,
  type TrainingContextSelection,
} from './types'

type ContextSummaryProps = {
  value: TrainingContextSelection
  onChange?: () => void
  label?: string
  compact?: boolean
}

export function ContextSummary({
  value,
  onChange,
  label = 'Training context',
  compact = false,
}: ContextSummaryProps) {
  const { palette } = useTheme()
  const unavailableCount = value.unavailableEquipment.length

  return (
    <View
      style={[
        styles.container,
        compact && styles.containerCompact,
        {
          backgroundColor: palette.surface,
          borderColor: palette.border,
        },
      ]}
      accessibilityLabel={`${label}. ${TRAINING_ENVIRONMENT_LABELS[value.trainingEnvironment]}. ${EQUIPMENT_INTENT_LABELS[value.equipmentIntent]}.`}
    >
      <View
        style={[styles.icon, { backgroundColor: palette.primaryMuted }]}
        accessible={false}
      >
        <IconSymbol name="location.fill" size={17} color={palette.primary} />
      </View>
      <View style={styles.copy}>
        <Text style={[styles.label, { color: palette.textTertiary }]}>
          {label}
        </Text>
        <Text
          style={[styles.value, { color: palette.textPrimary }]}
          numberOfLines={compact ? 1 : 2}
        >
          {TRAINING_ENVIRONMENT_LABELS[value.trainingEnvironment]} ·{' '}
          {EQUIPMENT_INTENT_LABELS[value.equipmentIntent]}
        </Text>
        {!compact && value.suggestionReason ? (
          <Text style={[styles.reason, { color: palette.textSecondary }]}>
            {value.suggestionReason}
          </Text>
        ) : null}
        {!compact && unavailableCount > 0 ? (
          <Text style={[styles.unavailable, { color: palette.textTertiary }]}>
            {unavailableCount}{' '}
            {unavailableCount === 1 ? 'item' : 'items'} unavailable today
          </Text>
        ) : null}
      </View>
      {onChange ? (
        <TouchableOpacity
          onPress={onChange}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Change training context"
        >
          <Text style={[styles.change, { color: palette.primary }]}>Change</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
  },
  containerCompact: {
    paddingVertical: spacing.sm,
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  label: {
    ...typography.caption,
  },
  value: {
    ...typography.bodyStrong,
  },
  reason: {
    ...typography.small,
    marginTop: 2,
  },
  unavailable: {
    ...typography.small,
    marginTop: 2,
  },
  change: {
    ...typography.smallStrong,
  },
})
