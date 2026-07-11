import type { ReactNode } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { IconSymbol } from '@/components/ui/icon-symbol'
import { radius, spacing, typography } from '@/constants/design'
import { useTheme } from '@/constants/theme-context'

interface SectionShellProps {
  icon: React.ComponentProps<typeof IconSymbol>['name']
  title: string
  description: string
  children: ReactNode
}

export function SectionShell({
  icon,
  title,
  description,
  children,
}: SectionShellProps) {
  const { palette } = useTheme()

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: palette.surface, borderColor: palette.border },
      ]}
    >
      <View style={styles.heading}>
        <View style={[styles.icon, { backgroundColor: palette.primaryMuted }]}>
          <IconSymbol name={icon} size={19} color={palette.primary} />
        </View>
        <View style={styles.headingText}>
          <Text style={[styles.title, { color: palette.textPrimary }]}>{title}</Text>
          <Text style={[styles.description, { color: palette.textSecondary }]}>
            {description}
          </Text>
        </View>
      </View>
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  heading: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  icon: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headingText: {
    flex: 1,
  },
  title: {
    ...typography.h3,
  },
  description: {
    ...typography.small,
    marginTop: spacing.xs,
  },
})
