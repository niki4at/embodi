import React from 'react'
import {
  ActivityIndicator,
  Alert,
  type AlertButton,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native'

import { IconSymbol } from '@/components/ui/icon-symbol'
import { radius, spacing, typography } from '@/constants/design'
import { useTheme } from '@/constants/theme-context'

export interface ConfirmActionOptions {
  title: string
  message: string
  confirmText: string
  confirmStyle?: AlertButton['style']
  onConfirm: () => void
}

/** Cross-platform confirm dialog (window.confirm on web, Alert elsewhere). */
export function confirmAction({
  title,
  message,
  confirmText,
  confirmStyle,
  onConfirm,
}: ConfirmActionOptions) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    if (window.confirm(`${title}\n\n${message}`)) {
      onConfirm()
    }
    return
  }

  Alert.alert(
    title,
    message,
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: confirmText,
        style: confirmStyle,
        onPress: onConfirm,
      },
    ],
    { cancelable: true },
  )
}

export async function runHaptic(effect: () => Promise<void>) {
  try {
    await effect()
  } catch {
    // Haptics are optional feedback and should never block actions.
  }
}

/** Uppercase group label for the settings index. */
export function SettingsSectionLabel({ title }: { title: string }) {
  const { palette } = useTheme()
  return (
    <Text style={[styles.sectionLabel, { color: palette.textTertiary }]}>
      {title}
    </Text>
  )
}

export function SettingsDivider() {
  return <View style={styles.divider} />
}

export interface SettingsRowProps {
  icon: React.ComponentProps<typeof IconSymbol>['name']
  iconTint: string
  iconBg: string
  title: string
  subtitle?: string
  destructive?: boolean
  disabled?: boolean
  loading?: boolean
  /** Custom trailing element (defaults to a chevron). */
  trailing?: React.ReactNode
  onPress: () => void
}

export function SettingsRow({
  icon,
  iconTint,
  iconBg,
  title,
  subtitle,
  destructive,
  disabled,
  loading,
  trailing,
  onPress,
}: SettingsRowProps) {
  const { palette } = useTheme()
  const titleColor = destructive ? palette.danger : palette.textPrimary

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: !!disabled, busy: !!loading }}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: palette.surface,
          borderColor: palette.border,
          opacity: disabled && !loading ? 0.5 : pressed ? 0.85 : 1,
        },
      ]}
    >
      <View style={[styles.rowIcon, { backgroundColor: iconBg }]}>
        <IconSymbol name={icon} size={18} color={iconTint} />
      </View>
      <View style={styles.rowText}>
        <Text style={[styles.rowTitle, { color: titleColor }]}>{title}</Text>
        {subtitle ? (
          <Text
            style={[styles.rowSubtitle, { color: palette.textSecondary }]}
            numberOfLines={2}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      {loading ? (
        <ActivityIndicator size="small" color={titleColor} />
      ) : (
        (trailing ?? (
          <IconSymbol
            name="chevron.right"
            size={18}
            color={palette.textTertiary}
          />
        ))
      )}
    </Pressable>
  )
}

export interface SettingsSwitchRowProps {
  icon?: React.ComponentProps<typeof IconSymbol>['name']
  iconTint?: string
  iconBg?: string
  title: string
  subtitle?: string
  value: boolean
  disabled?: boolean
  onValueChange: (value: boolean) => void
}

/** Settings row with a trailing switch instead of a chevron. */
export function SettingsSwitchRow({
  icon,
  iconTint,
  iconBg,
  title,
  subtitle,
  value,
  disabled,
  onValueChange,
}: SettingsSwitchRowProps) {
  const { palette } = useTheme()

  return (
    <View
      accessible
      accessibilityRole="switch"
      accessibilityLabel={title}
      accessibilityState={{ checked: value, disabled: !!disabled }}
      style={[
        styles.row,
        {
          backgroundColor: palette.surface,
          borderColor: palette.border,
          opacity: disabled ? 0.5 : 1,
        },
      ]}
    >
      {icon ? (
        <View
          style={[
            styles.rowIcon,
            { backgroundColor: iconBg ?? palette.surfaceAlt },
          ]}
        >
          <IconSymbol
            name={icon}
            size={18}
            color={iconTint ?? palette.textSecondary}
          />
        </View>
      ) : null}
      <View style={styles.rowText}>
        <Text style={[styles.rowTitle, { color: palette.textPrimary }]}>
          {title}
        </Text>
        {subtitle ? (
          <Text
            style={[styles.rowSubtitle, { color: palette.textSecondary }]}
            numberOfLines={2}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      <Switch
        value={value}
        disabled={disabled}
        onValueChange={onValueChange}
        trackColor={{ true: palette.primary }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  sectionLabel: {
    ...typography.caption,
    marginBottom: spacing.md,
  },
  divider: {
    height: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  rowIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
  },
  rowTitle: {
    ...typography.bodyStrong,
    marginBottom: 2,
  },
  rowSubtitle: {
    ...typography.small,
  },
})
