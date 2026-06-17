import { Tabs } from 'expo-router'
import React from 'react'
import { Platform, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { HapticTab } from '@/components/haptic-tab'
import { IconSymbol } from '@/components/ui/icon-symbol'
import { useTheme } from '@/constants/theme-context'

export default function TabLayout() {
  const { palette } = useTheme()
  const insets = useSafeAreaInsets()

  const basePaddingBottom = Platform.select({ ios: 28, default: 8 }) ?? 8
  const baseHeight = Platform.select({ ios: 84, default: 64 }) ?? 64
  const paddingBottom = Math.max(basePaddingBottom, insets.bottom + 8)
  const height = baseHeight + Math.max(0, insets.bottom - basePaddingBottom + 8)

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: palette.primary,
        tabBarInactiveTintColor: palette.textTertiary,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: {
          backgroundColor: palette.bgElevated,
          borderTopColor: palette.divider,
          borderTopWidth: StyleSheet.hairlineWidth,
          height,
          paddingTop: 6,
          paddingBottom,
        },
        tabBarLabelStyle: styles.tabLabel,
        tabBarItemStyle: styles.tabItem,
        sceneStyle: { backgroundColor: palette.bg },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <IconSymbol
              size={26}
              name="house.fill"
              color={color}
              weight={focused ? 'semibold' : 'regular'}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="challenges"
        options={{
          title: 'Challenges',
          tabBarIcon: ({ color, focused }) => (
            <IconSymbol
              size={26}
              name="target"
              color={color}
              weight={focused ? 'semibold' : 'regular'}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarIcon: ({ color, focused }) => (
            <IconSymbol
              size={26}
              name="clock.arrow.circlepath"
              color={color}
              weight={focused ? 'semibold' : 'regular'}
            />
          ),
        }}
      />
    </Tabs>
  )
}

const styles = StyleSheet.create({
  tabLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
    marginTop: 2,
  },
  tabItem: {
    paddingVertical: 4,
  },
})
