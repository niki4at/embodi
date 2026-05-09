import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  Linking,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native'
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'

import { BodyFigure } from '@/components/ui/body-figure'
import { CarouselDot } from '@/components/ui/carousel-dot'
import { EmbodiWordmark } from '@/components/ui/embodi-wordmark'
import { PillButton } from '@/components/ui/pill-button'
import { motion, spacing, typography } from '@/constants/design'
import { useTheme } from '@/constants/theme-context'

interface WelcomeScreenProps {
  onGetStarted: () => void
  onSignIn: () => void
}

const TERMS_URL = 'https://embodi.app/terms'
const PRIVACY_URL = 'https://embodi.app/privacy'
const AUTO_ADVANCE_MS = 5000

type Slide = {
  id: string
  headline: string
  highlight: string
  tagline: string
}

const SLIDES: Slide[] = [
  {
    id: 'understand',
    headline: 'Understand your body.',
    highlight: 'Build a better you.',
    tagline:
      'Personalised plans that adapt to your body, your goals, and your life.',
  },
  {
    id: 'map-pain',
    headline: 'Map what hurts.',
    highlight: 'Move with confidence.',
    tagline:
      'Tap any sore spot and we steer your session around it. No guesswork, no flare-ups.',
  },
  {
    id: 'adapt',
    headline: 'Plans that learn.',
    highlight: 'Progress that lasts.',
    tagline:
      'Every check-in tunes tomorrow. The harder you train, the smarter your coach gets.',
  },
]

export default function WelcomeScreen({
  onGetStarted,
  onSignIn,
}: WelcomeScreenProps) {
  const { palette } = useTheme()
  const { width, height: screenHeight } = useWindowDimensions()
  const scrollRef = useRef<ScrollView>(null)
  const [step, setStep] = useState(0)
  const [autoAdvance, setAutoAdvance] = useState(true)
  const stepRef = useRef(step)

  useEffect(() => {
    stepRef.current = step
  }, [step])

  const goTo = useCallback(
    (index: number, animated = true) => {
      const target = ((index % SLIDES.length) + SLIDES.length) % SLIDES.length
      scrollRef.current?.scrollTo({ x: width * target, animated })
      setStep(target)
    },
    [width],
  )

  useEffect(() => {
    if (!autoAdvance) return
    const id = setInterval(() => {
      const next = (stepRef.current + 1) % SLIDES.length
      goTo(next, true)
    }, AUTO_ADVANCE_MS)
    return () => clearInterval(id)
  }, [autoAdvance, goTo])

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const next = Math.round(event.nativeEvent.contentOffset.x / width)
      if (next !== step) setStep(next)
    },
    [step, width],
  )

  const handleManualScroll = useCallback(() => {
    setAutoAdvance(false)
  }, [])

  const handleDotPress = useCallback(
    (index: number) => {
      setAutoAdvance(false)
      goTo(index, true)
    },
    [goTo],
  )

  // The body PNG is cropped tight to the figure at retina-friendly resolution
  // (401 x 1109, aspect ~0.362). We size by height first so the figure fills
  // the vertical space without distortion, then derive width from the aspect.
  const figureHeight = Math.min(380, screenHeight * 0.42)
  const figureWidth = figureHeight * (401 / 1109)

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: palette.bg }]}
      edges={['top', 'bottom']}
    >
      <View style={styles.content}>
        <Animated.View
          entering={FadeInUp.duration(motion.duration.base)}
          style={styles.headerRow}
        >
          <EmbodiWordmark size="md" />
        </Animated.View>

        <Animated.View
          entering={FadeInDown.delay(80).duration(motion.duration.slow)}
          style={styles.illustrationWrap}
        >
          <BodyFigure width={figureWidth} height={figureHeight} />
        </Animated.View>

        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleScroll}
          onScrollBeginDrag={handleManualScroll}
          scrollEventThrottle={16}
          style={styles.copyScroll}
          contentContainerStyle={styles.copyScrollContent}
        >
          {SLIDES.map(slide => (
            <View key={slide.id} style={[styles.copyBlock, { width }]}>
              <Text
                style={[styles.headline, { color: palette.textPrimary }]}
                numberOfLines={2}
              >
                {slide.headline}
              </Text>
              <Text
                style={[styles.headline, { color: palette.primary }]}
                numberOfLines={2}
              >
                {slide.highlight}
              </Text>
              <Text style={[styles.tagline, { color: palette.textSecondary }]}>
                {slide.tagline}
              </Text>
            </View>
          ))}
        </ScrollView>

        <View style={styles.dots}>
          {SLIDES.map((slide, i) => (
            <CarouselDot
              key={slide.id}
              index={i}
              active={i === step}
              activeColor={palette.primary}
              inactiveColor={palette.surfaceHigh}
              onPress={() => handleDotPress(i)}
            />
          ))}
        </View>

        <Animated.View
          entering={FadeInDown.delay(180).duration(motion.duration.base)}
          style={styles.actions}
        >
          <PillButton label="Get started" onPress={onGetStarted} />
          <PillButton
            label="I already have an account"
            variant="secondary"
            onPress={onSignIn}
          />
        </Animated.View>

        <Animated.View
          entering={FadeInDown.delay(240).duration(motion.duration.base)}
          style={styles.termsRow}
        >
          <Text style={[styles.terms, { color: palette.textSecondary }]}>
            By continuing, you agree to our{' '}
            <Text
              style={[styles.termsLink, { color: palette.textPrimary }]}
              onPress={() => Linking.openURL(TERMS_URL).catch(() => {})}
            >
              Terms
            </Text>{' '}
            and{' '}
            <Text
              style={[styles.termsLink, { color: palette.textPrimary }]}
              onPress={() => Linking.openURL(PRIVACY_URL).catch(() => {})}
            >
              Privacy Policy
            </Text>
          </Text>
        </Animated.View>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
  },
  headerRow: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  illustrationWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
  },
  copyScroll: {
    flexGrow: 0,
  },
  copyScrollContent: {
    alignItems: 'flex-start',
  },
  copyBlock: {
    paddingHorizontal: spacing.xl,
    gap: 2,
    minHeight: 130,
  },
  headline: {
    ...typography.h1,
    fontSize: 26,
    lineHeight: 32,
  },
  tagline: {
    ...typography.body,
    marginTop: spacing.md,
    fontSize: 14,
    lineHeight: 21,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  actions: {
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  termsRow: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
  },
  terms: {
    ...typography.small,
    fontSize: 11,
    textAlign: 'center',
  },
  termsLink: {
    fontFamily: typography.smallStrong.fontFamily,
    textDecorationLine: 'underline',
  },
})
