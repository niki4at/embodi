import React from 'react'
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import Animated, {
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { IconSymbol } from '@/components/ui/icon-symbol'
import { motion, spacing, typography } from '@/constants/design'
import { useTheme } from '@/constants/theme-context'

/**
 * Bodfit bottom sheet: a white card with a drag handle, large title, an
 * optional close glyph or Cancel link, and a dimmed backdrop. Content scrolls
 * when taller than the viewport.
 */
export function BottomSheet({
  visible,
  onClose,
  title,
  subtitle,
  dismissLabel = 'close',
  children,
  footer,
  contentStyle,
}: {
  visible: boolean
  onClose: () => void
  title?: string
  subtitle?: string
  dismissLabel?: 'close' | 'cancel' | 'none'
  children: React.ReactNode
  footer?: React.ReactNode
  contentStyle?: StyleProp<ViewStyle>
}) {
  const { palette } = useTheme()
  const insets = useSafeAreaInsets()

  if (!visible) return null

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <GestureHandlerRootView style={styles.root}>
        <Animated.View
          entering={FadeIn.duration(motion.duration.quick)}
          exiting={FadeOut.duration(motion.duration.quick)}
          style={styles.backdrop}
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Dismiss"
          />
        </Animated.View>

        <Animated.View
          entering={SlideInDown.duration(motion.duration.base)}
          exiting={SlideOutDown.duration(motion.duration.quick)}
          style={[
            styles.sheet,
            {
              backgroundColor: palette.bgElevated,
              paddingBottom: Math.max(insets.bottom, spacing.lg),
            },
          ]}
        >
          <View style={[styles.handle, { backgroundColor: palette.surfaceHigh }]} />

          {title ? (
            <View style={styles.titleRow}>
              <View style={styles.titleCopy}>
                <Text
                  style={[styles.title, { color: palette.textPrimary }]}
                  accessibilityRole="header"
                >
                  {title}
                </Text>
                {subtitle ? (
                  <Text style={[styles.subtitle, { color: palette.textSecondary }]}>
                    {subtitle}
                  </Text>
                ) : null}
              </View>
              {dismissLabel === 'close' ? (
                <Pressable
                  onPress={onClose}
                  hitSlop={12}
                  accessibilityRole="button"
                  accessibilityLabel="Close"
                  style={styles.closeButton}
                >
                  <IconSymbol name="xmark" size={20} color={palette.textSecondary} />
                </Pressable>
              ) : dismissLabel === 'cancel' ? (
                <Pressable
                  onPress={onClose}
                  hitSlop={12}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel"
                >
                  <Text style={[styles.cancel, { color: palette.textSecondary }]}>
                    Cancel
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          <ScrollView
            bounces={false}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[styles.content, contentStyle]}
            style={styles.scroll}
          >
            {children}
          </ScrollView>

          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(20, 20, 24, 0.5)',
  },
  sheet: {
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    paddingTop: spacing.md,
    maxHeight: '92%',
  },
  handle: {
    width: 44,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: spacing.lg,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xxl,
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  titleCopy: {
    flex: 1,
    gap: 4,
  },
  title: {
    ...typography.h2,
    fontSize: 22,
  },
  subtitle: {
    ...typography.small,
  },
  closeButton: {
    paddingTop: 4,
  },
  cancel: {
    ...typography.body,
  },
  scroll: {
    flexGrow: 0,
  },
  content: {
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.md,
  },
  footer: {
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.sm,
    gap: spacing.md,
  },
})
