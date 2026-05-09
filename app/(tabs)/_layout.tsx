import { Tabs } from 'expo-router'
import React from 'react'
import { Platform, StyleSheet } from 'react-native'

import { HapticTab } from '@/components/haptic-tab'
import { IconSymbol } from '@/components/ui/icon-symbol'
import { useTheme } from '@/constants/theme-context'

export default function TabLayout() {
  const { palette } = useTheme()

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
          height: Platform.select({ ios: 84, default: 64 }),
          paddingTop: 6,
          paddingBottom: Platform.select({ ios: 28, default: 8 }),
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
        name="explore"
        options={{
          title: 'Library',
          tabBarIcon: ({ color, focused }) => (
            <IconSymbol
              size={26}
              name="dumbbell.fill"
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
