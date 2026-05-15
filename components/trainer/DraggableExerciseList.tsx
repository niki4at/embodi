import * as Haptics from 'expo-haptics'
import React, { ReactNode, useCallback, useEffect, useRef } from 'react'
import { StyleSheet, View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  runOnJS,
  SharedValue,
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated'

type Item = { id: string }

type RenderItemArgs<T extends Item> = {
  item: T
  index: number
  isActive: SharedValue<boolean>
}

type DraggableExerciseListProps<T extends Item> = {
  items: T[]
  itemHeight: number
  itemSpacing?: number
  /**
   * Background colour applied to each row's lifted card. When this matches
   * the surrounding surface, rows blend into the parent at rest and only
   * pop out when the user is dragging — the shadow does the rest.
   */
  rowBackgroundColor: string
  rowBorderRadius?: number
  onReorder: (orderedIds: string[]) => void
  renderItem: (args: RenderItemArgs<T>) => ReactNode
}

const SPRING = { damping: 22, stiffness: 220, mass: 0.7 }

function buildPositions(ids: string[]): Record<string, number> {
  return ids.reduce<Record<string, number>>((acc, id, idx) => {
    acc[id] = idx
    return acc
  }, {})
}

/**
 * Phase-scoped drag-to-reorder list. Long-press an item, then pan to slot it
 * elsewhere — neighbors slide out of the way, the lifted card follows the
 * finger, and on release the new order is reported via `onReorder`.
 *
 * Quick taps fall through to the row's children, so a `Pressable` inside
 * `renderItem` continues to fire `onPress` for opening previews.
 */
export function DraggableExerciseList<T extends Item>({
  items,
  itemHeight,
  itemSpacing = 0,
  rowBackgroundColor,
  rowBorderRadius = 0,
  onReorder,
  renderItem,
}: DraggableExerciseListProps<T>) {
  const slotHeight = itemHeight + itemSpacing
  const ids = items.map(i => i.id)
  const idsKey = ids.join('|')

  const positions = useSharedValue<Record<string, number>>(buildPositions(ids))
  const idsKeyRef = useRef(idsKey)

  useEffect(() => {
    if (idsKeyRef.current === idsKey) return
    idsKeyRef.current = idsKey
    positions.value = buildPositions(idsKey.split('|').filter(Boolean))
  }, [idsKey, positions])

  const handleReorder = useCallback(
    (orderedIds: string[]) => onReorder(orderedIds),
    [onReorder],
  )

  return (
    <View style={[styles.container, { height: items.length * slotHeight }]}>
      {items.map((item, idx) => (
        <DraggableRow
          key={item.id}
          item={item}
          index={idx}
          itemCount={items.length}
          slotHeight={slotHeight}
          itemHeight={itemHeight}
          rowBackgroundColor={rowBackgroundColor}
          rowBorderRadius={rowBorderRadius}
          positions={positions}
          renderItem={renderItem}
          onReorder={handleReorder}
        />
      ))}
    </View>
  )
}

type DraggableRowProps<T extends Item> = {
  item: T
  index: number
  itemCount: number
  slotHeight: number
  itemHeight: number
  rowBackgroundColor: string
  rowBorderRadius: number
  positions: SharedValue<Record<string, number>>
  renderItem: (args: RenderItemArgs<T>) => ReactNode
  onReorder: (orderedIds: string[]) => void
}

function DraggableRow<T extends Item>({
  item,
  index,
  itemCount,
  slotHeight,
  itemHeight,
  rowBackgroundColor,
  rowBorderRadius,
  positions,
  renderItem,
  onReorder,
}: DraggableRowProps<T>) {
  const isActive = useSharedValue(false)
  const translateY = useSharedValue(index * slotHeight)
  const scale = useSharedValue(1)
  const startSlot = useSharedValue(index)

  // React to logical position changes — when another item drags past us, our
  // slot shifts and we spring into the new place. Active rows ignore this so
  // they keep tracking the finger directly.
  useAnimatedReaction(
    () => ({
      pos: positions.value[item.id] ?? index,
      active: isActive.value,
    }),
    ({ pos, active }) => {
      if (active) return
      translateY.value = withSpring(pos * slotHeight, SPRING)
    },
  )

  const triggerLiftHaptic = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {})
  }, [])

  const triggerSwapHaptic = useCallback(() => {
    Haptics.selectionAsync().catch(() => {})
  }, [])

  const commitOrder = useCallback(() => {
    const entries = Object.entries(positions.value)
    entries.sort((a, b) => a[1] - b[1])
    onReorder(entries.map(([id]) => id))
  }, [positions, onReorder])

  const pan = Gesture.Pan()
    .activateAfterLongPress(220)
    .onStart(() => {
      isActive.value = true
      startSlot.value = positions.value[item.id] ?? index
      scale.value = withSpring(1.04, SPRING)
      runOnJS(triggerLiftHaptic)()
    })
    .onUpdate(event => {
      if (!isActive.value) return

      const lifted = startSlot.value * slotHeight + event.translationY
      translateY.value = lifted

      const desiredSlot = Math.max(
        0,
        Math.min(itemCount - 1, Math.round(lifted / slotHeight)),
      )
      const currentSlot = positions.value[item.id] ?? index
      if (desiredSlot === currentSlot) return

      // Swap the dragged item with whoever owns the desired slot.
      const next = { ...positions.value }
      for (const id of Object.keys(next)) {
        if (next[id] === desiredSlot) {
          next[id] = currentSlot
          break
        }
      }
      next[item.id] = desiredSlot
      positions.value = next
      runOnJS(triggerSwapHaptic)()
    })
    .onEnd(() => {
      if (!isActive.value) return
      isActive.value = false
      scale.value = withSpring(1, SPRING)
      const finalSlot = positions.value[item.id] ?? index
      translateY.value = withSpring(finalSlot * slotHeight, SPRING)
      runOnJS(commitOrder)()
    })
    .onFinalize(() => {
      if (!isActive.value) return
      isActive.value = false
      scale.value = withSpring(1, SPRING)
      const finalSlot = positions.value[item.id] ?? index
      translateY.value = withSpring(finalSlot * slotHeight, SPRING)
    })

  // Soft fade in/out of the lift effect so the shadow only appears while the
  // user is actively dragging. The row itself always carries the surrounding
  // surface colour, so at rest it sits flush with the phase card.
  const liftProgress = useDerivedValue(() =>
    withTiming(isActive.value ? 1 : 0, { duration: 160 }),
  )

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }, { scale: scale.value }],
    zIndex: isActive.value ? 50 : 0,
    shadowOpacity: liftProgress.value * 0.22,
    elevation: liftProgress.value * 14,
  }))

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        style={[
          styles.row,
          {
            height: itemHeight,
            backgroundColor: rowBackgroundColor,
            borderRadius: rowBorderRadius,
          },
          animatedStyle,
        ]}
      >
        {renderItem({ item, index, isActive })}
      </Animated.View>
    </GestureDetector>
  )
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  row: {
    position: 'absolute',
    left: 0,
    right: 0,
    shadowColor: '#0B0F1A',
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 22,
  },
})
