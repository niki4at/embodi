import type { BottomTabBarProps } from '@react-navigation/bottom-tabs'
import * as Haptics from 'expo-haptics'
import React, { useEffect, useRef, useState } from 'react'
import {
  type LayoutChangeEvent,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native'
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { motion, radius, spacing } from '@/constants/design'
import { fonts } from '@/constants/fonts'
import { useTheme } from '@/constants/theme-context'

const CARD_MAX_WIDTH = 460

const ITEM_HEIGHT = 52
const CARD_VERTICAL_PADDING = spacing.sm
const CARD_HORIZONTAL_PADDING = spacing.sm
const ITEM_GAP = spacing.xs
const WRAP_TOP_PADDING = spacing.sm
const CARD_HEIGHT = ITEM_HEIGHT + CARD_VERTICAL_PADDING * 2

/**
 * Bottom padding a scrollable tab screen should reserve so its content clears
 * the floating tab island (which is absolutely positioned over the content).
 */
export function useFloatingTabBarInset(): number {
  const insets = useSafeAreaInsets()
  return (
    WRAP_TOP_PADDING +
    CARD_HEIGHT +
    Math.max(insets.bottom, spacing.md) +
    spacing.md
  )
}

/**
 * Revolut-style floating tab bar: a rounded island that hovers over the screen
 * so the content stays visible all around it. A single tinted pill slides
 * horizontally to sit behind the active tab, whose label appears under its icon.
 */
export function FloatingTabBar({
  state,
  descriptors,
  navigation,
}: BottomTabBarProps) {
  const { palette, shadows, resolved } = useTheme()
  const insets = useSafeAreaInsets()

  const count = state.routes.length
  const [cardWidth, setCardWidth] = useState(0)
  const innerWidth = Math.max(0, cardWidth - CARD_HORIZONTAL_PADDING * 2)
  const itemWidth =
    count > 0 && innerWidth > 0
      ? (innerWidth - ITEM_GAP * (count - 1)) / count
      : 0

  const indicatorX = useSharedValue(0)
  const initialized = useRef(false)

  useEffect(() => {
    if (itemWidth <= 0) return
    const target =
      CARD_HORIZONTAL_PADDING + state.index * (itemWidth + ITEM_GAP)
    if (initialized.current) {
      indicatorX.value = withSpring(target, motion.spring)
    } else {
      indicatorX.value = target
      initialized.current = true
    }
  }, [state.index, itemWidth, indicatorX])

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorX.value }],
  }))

  const onCardLayout = (event: LayoutChangeEvent) => {
    setCardWidth(event.nativeEvent.layout.width)
  }

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.wrap,
        { paddingBottom: Math.max(insets.bottom, spacing.md) },
      ]}
    >
      <View
        onLayout={onCardLayout}
        style={[
          styles.card,
          resolved === 'dark' ? shadows.md : shadows.lg,
          {
            backgroundColor: palette.bgElevated,
            borderColor: palette.border,
          },
        ]}
      >
        {itemWidth > 0 ? (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.indicator,
              indicatorStyle,
              { width: itemWidth, backgroundColor: palette.primaryMuted },
            ]}
          />
        ) : null}

        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key]
          const label =
            typeof options.title === 'string' ? options.title : route.name
          const isFocused = state.index === index

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            })
            if (Platform.OS === 'ios') {
              Haptics.selectionAsync().catch(() => {})
            }
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params)
            }
          }

          const onLongPress = () => {
            navigation.emit({ type: 'tabLongPress', target: route.key })
          }

          return (
            <TabButton
              key={route.key}
              label={label}
              focused={isFocused}
              activeColor={palette.primary}
              inactiveColor={palette.textTertiary}
              icon={options.tabBarIcon}
              onPress={onPress}
              onLongPress={onLongPress}
            />
          )
        })}
      </View>
    </View>
  )
}

interface TabButtonProps {
  label: string
  focused: boolean
  activeColor: string
  inactiveColor: string
  icon?: (props: {
    focused: boolean
    color: string
    size: number
  }) => React.ReactNode
  onPress: () => void
  onLongPress: () => void
}

function TabButton({
  label,
  focused,
  activeColor,
  inactiveColor,
  icon,
  onPress,
  onLongPress,
}: TabButtonProps) {
  const iconColor = focused ? activeColor : inactiveColor

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={label}
      onPress={onPress}
      onLongPress={onLongPress}
      style={styles.item}
    >
      <View style={styles.iconWrap}>
        {icon?.({ focused, color: iconColor, size: 24 })}
      </View>
      {focused ? (
        <Animated.Text
          entering={FadeIn.duration(motion.duration.quick)}
          exiting={FadeOut.duration(motion.duration.quick)}
          numberOfLines={1}
          style={[styles.label, { color: activeColor }]}
        >
          {label}
        </Animated.Text>
      ) : null}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.lg,
    paddingTop: WRAP_TOP_PADDING,
    alignItems: 'center',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    maxWidth: CARD_MAX_WIDTH,
    minHeight: CARD_HEIGHT,
    gap: ITEM_GAP,
    paddingHorizontal: CARD_HORIZONTAL_PADDING,
    paddingVertical: CARD_VERTICAL_PADDING,
    borderRadius: radius.xxl,
    borderWidth: StyleSheet.hairlineWidth,
  },
  indicator: {
    position: 'absolute',
    left: 0,
    top: CARD_VERTICAL_PADDING,
    height: ITEM_HEIGHT,
    borderRadius: radius.xl,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontFamily: fonts.uiBold,
    fontSize: 11,
    lineHeight: 13,
    letterSpacing: 0.1,
  },
})
