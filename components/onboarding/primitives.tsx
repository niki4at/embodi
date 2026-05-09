import React from 'react'
import {
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TouchableOpacity,
  View,
} from 'react-native'

import { IconSymbol } from '@/components/ui/icon-symbol'
import { PillButton } from '@/components/ui/pill-button'
import { radius, spacing, typography } from '@/constants/design'
import { useTheme } from '@/constants/theme-context'

export function StepHeader({
  title,
  subtitle,
}: {
  title: string
  subtitle?: string
}) {
  const { palette } = useTheme()
  return (
    <View style={styles.headerWrap}>
      <Text style={[styles.title, { color: palette.textPrimary }]}>{title}</Text>
      {subtitle ? (
        <Text style={[styles.subtitle, { color: palette.textSecondary }]}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  )
}

export function FieldLabel({
  label,
  hint,
}: {
  label: string
  hint?: string
}) {
  const { palette } = useTheme()
  return (
    <View style={styles.labelWrap}>
      <Text style={[styles.label, { color: palette.textSecondary }]}>{label}</Text>
      {hint ? (
        <Text style={[styles.hint, { color: palette.textTertiary }]}>{hint}</Text>
      ) : null}
    </View>
  )
}

interface InputProps extends TextInputProps {
  focused: boolean
  onFocusChange: (v: boolean) => void
  multiline?: boolean
}

export function Input({
  focused,
  onFocusChange,
  style,
  multiline,
  ...rest
}: InputProps) {
  const { palette } = useTheme()
  return (
    <View
      style={[
        styles.inputContainer,
        {
          backgroundColor: palette.surface,
          borderColor: focused ? palette.primary : palette.borderStrong,
        },
        multiline && styles.inputContainerMultiline,
      ]}
    >
      <TextInput
        {...rest}
        style={[
          styles.input,
          { color: palette.textPrimary },
          multiline && styles.inputMultiline,
          style,
        ]}
        placeholderTextColor={palette.textTertiary}
        onFocus={e => {
          onFocusChange(true)
          rest.onFocus?.(e)
        }}
        onBlur={e => {
          onFocusChange(false)
          rest.onBlur?.(e)
        }}
        multiline={multiline}
      />
    </View>
  )
}

export function OptionRow({
  label,
  description,
  selected,
  onPress,
}: {
  label: string
  description?: string
  selected: boolean
  onPress: () => void
}) {
  const { palette } = useTheme()
  return (
    <TouchableOpacity
      style={[
        styles.optionRow,
        {
          backgroundColor: selected ? palette.primaryMuted : palette.surface,
          borderColor: selected ? palette.primary : palette.border,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View
        style={[
          styles.radioOuter,
          { borderColor: selected ? palette.primary : palette.borderStrong },
        ]}
      >
        {selected ? (
          <View style={[styles.radioInner, { backgroundColor: palette.primary }]} />
        ) : null}
      </View>
      <View style={styles.optionTextWrap}>
        <Text
          style={[
            styles.optionLabel,
            { color: selected ? palette.primary : palette.textPrimary },
          ]}
        >
          {label}
        </Text>
        {description ? (
          <Text style={[styles.optionDescription, { color: palette.textTertiary }]}>
            {description}
          </Text>
        ) : null}
      </View>
    </TouchableOpacity>
  )
}

export function Chip({
  label,
  selected,
  onPress,
}: {
  label: string
  selected: boolean
  onPress: () => void
}) {
  const { palette } = useTheme()
  return (
    <TouchableOpacity
      style={[
        styles.chip,
        {
          backgroundColor: selected ? palette.primaryMuted : palette.surface,
          borderColor: selected ? palette.primary : palette.borderStrong,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <Text
        style={[
          styles.chipText,
          { color: selected ? palette.primary : palette.textSecondary },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  )
}

export function ToggleRow({
  label,
  description,
  selected,
  onPress,
}: {
  label: string
  description?: string
  selected: boolean
  onPress: () => void
}) {
  const { palette } = useTheme()
  return (
    <TouchableOpacity
      style={[
        styles.toggleRow,
        {
          backgroundColor: selected ? palette.primaryMuted : palette.surface,
          borderColor: selected ? palette.primary : palette.border,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={styles.toggleTextWrap}>
        <Text style={[styles.toggleLabel, { color: palette.textPrimary }]}>
          {label}
        </Text>
        {description ? (
          <Text
            style={[styles.toggleDescription, { color: palette.textTertiary }]}
          >
            {description}
          </Text>
        ) : null}
      </View>
      <View
        style={[
          styles.checkbox,
          {
            backgroundColor: selected ? palette.primary : 'transparent',
            borderColor: selected ? palette.primary : palette.borderStrong,
          },
        ]}
      >
        {selected ? (
          <IconSymbol name="checkmark" size={14} color={palette.white} />
        ) : null}
      </View>
    </TouchableOpacity>
  )
}

interface PrimaryButtonProps {
  label: string
  onPress: () => void
  disabled?: boolean
}

export function PrimaryButton({ label, onPress, disabled }: PrimaryButtonProps) {
  return <PillButton label={label} onPress={onPress} disabled={disabled} />
}

export function SecondaryButton({
  label,
  onPress,
}: {
  label: string
  onPress: () => void
}) {
  return <PillButton label={label} onPress={onPress} variant="secondary" />
}

export function InfoBanner({ children }: { children: React.ReactNode }) {
  const { palette } = useTheme()
  return (
    <View
      style={[
        styles.infoCard,
        {
          backgroundColor: palette.primaryMuted,
          borderColor: palette.primaryBorder,
        },
      ]}
    >
      <IconSymbol name="info.circle" size={16} color={palette.primary} />
      <Text style={[styles.infoText, { color: palette.textPrimary }]}>
        {children}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  headerWrap: {
    marginBottom: spacing.xxl,
  },
  title: {
    ...typography.h1,
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.body,
  },
  labelWrap: {
    marginBottom: spacing.sm,
    gap: 2,
  },
  label: {
    ...typography.smallStrong,
  },
  hint: {
    ...typography.small,
  },
  inputContainer: {
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    height: 56,
    justifyContent: 'center',
  },
  inputContainerMultiline: {
    height: undefined,
    minHeight: 88,
    paddingVertical: spacing.md,
  },
  input: {
    ...typography.body,
  },
  inputMultiline: {
    textAlignVertical: 'top',
    minHeight: 56,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    gap: spacing.md,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  optionTextWrap: {
    flex: 1,
  },
  optionLabel: {
    ...typography.bodyStrong,
  },
  optionDescription: {
    ...typography.small,
    marginTop: 2,
  },
  chip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  chipText: {
    ...typography.smallStrong,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.md,
  },
  toggleTextWrap: {
    flex: 1,
  },
  toggleLabel: {
    ...typography.bodyStrong,
  },
  toggleDescription: {
    ...typography.small,
    marginTop: 2,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  infoText: {
    flex: 1,
    ...typography.small,
  },
})
