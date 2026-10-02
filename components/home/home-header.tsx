import React from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { BodfitWordmark } from '@/components/ui/bodfit-logo'
import { spacing, typography } from '@/constants/design'
import { useTheme } from '@/constants/theme-context'

export type HomeTab = 'today' | 'week'

/**
 * Home masthead: the mono BODFIT lockup on its own row at the top right, then
 * "Today | This Week" text tabs over a hairline (Figma frame 1:2).
 */
export function HomeHeader({
  tab,
  onChange,
}: {
  tab: HomeTab
  onChange: (tab: HomeTab) => void
}) {
  const { palette } = useTheme()
  return (
    <View style={[styles.wrap, { borderBottomColor: palette.divider }]}>
      <View style={styles.brandRow}>
        <BodfitWordmark variant="header" />
      </View>
      <View style={styles.tabs} accessibilityRole="tablist">
        {(
          [
            { id: 'today', label: 'Today' },
            { id: 'week', label: 'This Week' },
          ] as const
        ).map((item) => {
          const active = item.id === tab
          return (
            <Pressable
              key={item.id}
              onPress={() => onChange(item.id)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={item.label}
              hitSlop={8}
              style={styles.tab}
            >
              <Text
                style={[
                  styles.tabLabel,
                  { color: active ? palette.textPrimary : palette.textSecondary },
                ]}
              >
                {item.label}
              </Text>
              <View
                style={[
                  styles.tabUnderline,
                  { backgroundColor: active ? palette.textPrimary : 'transparent' },
                ]}
              />
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxxl + spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  brandRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  tabs: {
    flexDirection: 'row',
    gap: spacing.xl,
    marginTop: spacing.lg,
  },
  tab: {
    gap: spacing.xs,
  },
  tabLabel: {
    ...typography.smallStrong,
  },
  tabUnderline: {
    height: 2,
    borderRadius: 1,
  },
})
