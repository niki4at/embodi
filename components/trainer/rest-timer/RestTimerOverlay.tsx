import { LinearGradient } from 'expo-linear-gradient'
import React, { useEffect } from 'react'
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { Circle } from 'react-native-svg'

import { IconSymbol } from '@/components/ui/icon-symbol'
import { radius, spacing, typography } from '@/constants/design'
import { useTheme } from '@/constants/theme-context'

import { useRestTimer } from './RestTimerProvider'
import { formatClock, useCountdownMs } from './restTimerUtils'

const AnimatedCircle = Animated.createAnimatedComponent(Circle)

const RING_SIZE = 248
const STROKE = 14
const R = (RING_SIZE - STROKE) / 2
const CIRCUMFERENCE = 2 * Math.PI * R

export default function RestTimerOverlay() {
  const { palette, resolved } = useTheme()
  const insets = useSafeAreaInsets()
  const {
    status,
    mode,
    exerciseName,
    totalSec,
    endsAt,
    addTime,
    skip,
    minimize,
  } = useRestTimer()

  const visible = status !== 'idle' && mode === 'full'
  const running = status === 'running'
  const remainingMs = useCountdownMs(endsAt, running)
  const remainingSec = Math.ceil(remainingMs / 1000)
  const finished = status === 'finished'

  const progress = useSharedValue(1)
  useEffect(() => {
    const next = finished
      ? 0
      : totalSec > 0
        ? Math.max(0, Math.min(1, remainingMs / (totalSec * 1000)))
        : 0
    progress.value = withTiming(next, { duration: 280 })
  }, [remainingMs, totalSec, finished, progress])

  const ringProps = useAnimatedProps(() => ({
    strokeDashoffset: CIRCUMFERENCE * (1 - progress.value),
  }))

  if (!visible) return null

  const ringColor = finished ? palette.success : palette.primary
  const gradient =
    resolved === 'dark'
      ? ([palette.bg, palette.bgElevated] as const)
      : ([palette.bgElevated, palette.surfaceAlt] as const)

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={minimize}
      statusBarTranslucent
    >
      <Animated.View
        entering={FadeIn.duration(220)}
        exiting={FadeOut.duration(160)}
        style={styles.fill}
      >
        <LinearGradient colors={gradient} style={styles.fill}>
          <View
            style={[
              styles.container,
              { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.xl },
            ]}
          >
            <View style={styles.topRow}>
              <View>
                <Text style={[styles.eyebrow, { color: palette.textTertiary }]}>
                  {finished ? 'Rest complete' : 'Resting'}
                </Text>
                {exerciseName ? (
                  <Text
                    style={[styles.exercise, { color: palette.textPrimary }]}
                    numberOfLines={1}
                  >
                    {exerciseName}
                  </Text>
                ) : null}
              </View>
              <Pressable
                onPress={minimize}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel="Minimize rest timer"
                style={[
                  styles.iconBtn,
                  { backgroundColor: palette.surface, borderColor: palette.border },
                ]}
              >
                <IconSymbol
                  name="arrow.down.right.and.arrow.up.left"
                  size={18}
                  color={palette.textPrimary}
                />
              </Pressable>
            </View>

            <View style={styles.ringWrap}>
              <Svg width={RING_SIZE} height={RING_SIZE}>
                <Circle
                  cx={RING_SIZE / 2}
                  cy={RING_SIZE / 2}
                  r={R}
                  stroke={palette.surfaceHigh}
                  strokeWidth={STROKE}
                  fill="none"
                />
                <AnimatedCircle
                  cx={RING_SIZE / 2}
                  cy={RING_SIZE / 2}
                  r={R}
                  stroke={ringColor}
                  strokeWidth={STROKE}
                  strokeLinecap="round"
                  fill="none"
                  strokeDasharray={CIRCUMFERENCE}
                  animatedProps={ringProps}
                  transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
                />
              </Svg>
              <View style={styles.ringCenter} pointerEvents="none">
                {finished ? (
                  <IconSymbol
                    name="checkmark.circle.fill"
                    size={72}
                    color={palette.success}
                  />
                ) : (
                  <>
                    <Text style={[styles.clock, { color: palette.textPrimary }]}>
                      {formatClock(remainingSec)}
                    </Text>
                    <Text
                      style={[styles.clockSub, { color: palette.textTertiary }]}
                    >
                      of {formatClock(totalSec)}
                    </Text>
                  </>
                )}
              </View>
            </View>

            {finished ? (
              <Pressable
                onPress={skip}
                accessibilityRole="button"
                accessibilityLabel="Dismiss"
                style={[styles.primaryBtn, { backgroundColor: palette.success }]}
              >
                <Text style={[styles.primaryBtnText, { color: palette.white }]}>
                  Let’s go
                </Text>
              </Pressable>
            ) : (
              <>
                <View style={styles.adjustRow}>
                  <AdjustButton
                    label="-30s"
                    onPress={() => addTime(-30)}
                    palette={palette}
                  />
                  <AdjustButton
                    label="+30s"
                    onPress={() => addTime(30)}
                    palette={palette}
                  />
                </View>

                <Pressable
                  onPress={skip}
                  accessibilityRole="button"
                  accessibilityLabel="Skip rest"
                  style={[
                    styles.primaryBtn,
                    { backgroundColor: palette.primary },
                  ]}
                >
                  <IconSymbol
                    name="forward.fill"
                    size={18}
                    color={palette.white}
                  />
                  <Text style={[styles.primaryBtnText, { color: palette.white }]}>
                    Skip rest
                  </Text>
                </Pressable>
              </>
            )}
          </View>
        </LinearGradient>
      </Animated.View>
    </Modal>
  )
}

function AdjustButton({
  label,
  onPress,
  palette,
}: {
  label: string
  onPress: () => void
  palette: ReturnType<typeof useTheme>['palette']
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[
        styles.adjustBtn,
        { backgroundColor: palette.surface, borderColor: palette.border },
      ]}
    >
      <Text style={[styles.adjustText, { color: palette.textPrimary }]}>
        {label}
      </Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  eyebrow: {
    ...typography.caption,
  },
  exercise: {
    ...typography.h2,
    marginTop: spacing.xs,
    maxWidth: 280,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringWrap: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringCenter: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clock: {
    fontFamily: typography.display.fontFamily,
    fontSize: 64,
    lineHeight: 70,
    letterSpacing: -1,
  },
  clockSub: {
    ...typography.smallStrong,
    marginTop: spacing.xs,
  },
  adjustRow: {
    flexDirection: 'row',
    gap: spacing.md,
    width: '100%',
    justifyContent: 'center',
  },
  adjustBtn: {
    flex: 1,
    maxWidth: 160,
    paddingVertical: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
  },
  adjustText: {
    ...typography.button,
    fontSize: 18,
  },
  primaryBtn: {
    width: '100%',
    flexDirection: 'row',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
  },
  primaryBtnText: {
    ...typography.button,
  },
})
