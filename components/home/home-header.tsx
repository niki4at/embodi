import React from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { BodfitMark, BodfitWordmark } from '@/components/ui/bodfit-logo'
import { spacing, typography } from '@/constants/design'
import { useTheme } from '@/constants/theme-context'

export type HomeTab = 'today' | 'week'

const TAB_TOP_PADDING = 6
const TAB_LABEL_GAP = 6
const TAB_UNDERLINE_HEIGHT = 2
const TAB_HEIGHT =
  TAB_TOP_PADDING +
  typography.smallStrong.lineHeight +
  TAB_LABEL_GAP +
  TAB_UNDERLINE_HEIGHT

/**
 * Home masthead: the Bodfit mark and mono lockup anchor the left edge (in line
 * with the greeting), "Today | This Week" text tabs sit on the right, and a
 * hairline runs underneath with the active underline resting on it.
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
      <View style={styles.brand}>
        <BodfitMark size={20} />
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
                maxFontSizeMultiplier={1.3}
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
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: TAB_HEIGHT,
    paddingBottom: TAB_UNDERLINE_HEIGHT,
  },
  tabs: {
    flexDirection: 'row',
    gap: spacing.xl,
  },
  tab: {
    paddingTop: TAB_TOP_PADDING,
    gap: TAB_LABEL_GAP,
  },
  tabLabel: {
    ...typography.smallStrong,
  },
  tabUnderline: {
    height: TAB_UNDERLINE_HEIGHT,
    borderRadius: 1,
  },
})
