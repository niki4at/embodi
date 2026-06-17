import { useMutation } from 'convex/react'
import * as Haptics from 'expo-haptics'
import { router, type Href } from 'expo-router'
import React, { useCallback, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'

import { IconSymbol } from '@/components/ui/icon-symbol'
import {
  CATEGORY_META,
  CATEGORY_ORDER,
  type ChallengeCategory,
  type MetricDirection,
} from '@/constants/challenge-meta'
import { motion, radius, spacing, typography } from '@/constants/design'
import { useTheme } from '@/constants/theme-context'
import { api } from '@/convex/_generated/api'

const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000

const DIRECTIONS: { id: MetricDirection; label: string }[] = [
  { id: 'increase', label: 'Increase' },
  { id: 'decrease', label: 'Decrease' },
  { id: 'maintain', label: 'Maintain' },
]

const DEADLINES: { id: string; label: string; weeks: number | null }[] = [
  { id: '4', label: '4 weeks', weeks: 4 },
  { id: '8', label: '8 weeks', weeks: 8 },
  { id: '12', label: '12 weeks', weeks: 12 },
  { id: 'none', label: 'No deadline', weeks: null },
]

export default function NewChallengeScreen() {
  const { palette, resolved, shadows } = useTheme()
  const createChallenge = useMutation(api.challenges.createChallenge)

  const [category, setCategory] = useState<ChallengeCategory>('endurance')
  const [title, setTitle] = useState(CATEGORY_META.endurance.defaultTitle)
  const [description, setDescription] = useState('')
  const [unit, setUnit] = useState(CATEGORY_META.endurance.defaultMetric.unit)
  const [direction, setDirection] = useState<MetricDirection>(
    CATEGORY_META.endurance.defaultMetric.direction,
  )
  const [startValue, setStartValue] = useState('')
  const [targetValue, setTargetValue] = useState('')
  const [deadline, setDeadline] = useState<string>('8')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [titleTouched, setTitleTouched] = useState(false)

  const handlePickCategory = useCallback(
    (id: ChallengeCategory) => {
      Haptics.selectionAsync()
      const meta = CATEGORY_META[id]
      setCategory(id)
      setUnit(meta.defaultMetric.unit)
      setDirection(meta.defaultMetric.direction)
      // Only auto-fill the title while the user hasn't customised it.
      if (!titleTouched) setTitle(meta.defaultTitle)
    },
    [titleTouched],
  )

  const handleBack = useCallback(() => {
    Haptics.selectionAsync()
    if (router.canGoBack()) router.back()
    else router.replace('/challenges' as Href)
  }, [])

  const canSubmit = useMemo(
    () => title.trim().length > 0 && unit.trim().length > 0 && !isSubmitting,
    [title, unit, isSubmitting],
  )

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return
    setIsSubmitting(true)
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
      const meta = CATEGORY_META[category]
      const deadlineCfg = DEADLINES.find((d) => d.id === deadline)
      const targetDate =
        deadlineCfg && deadlineCfg.weeks != null
          ? Date.now() + deadlineCfg.weeks * MS_PER_WEEK
          : undefined

      const parsedStart = parseFloat(startValue)
      const parsedTarget = parseFloat(targetValue)

      const id = await createChallenge({
        title: title.trim(),
        category,
        description: description.trim(),
        metric: {
          kind: meta.defaultMetric.kind,
          unit: unit.trim(),
          direction,
          startValue: Number.isFinite(parsedStart) ? parsedStart : undefined,
          targetValue: Number.isFinite(parsedTarget) ? parsedTarget : undefined,
        },
        targetDate,
      })

      router.replace({
        pathname: '/challenge/[id]',
        params: { id: String(id) },
      } as unknown as Href)
    } catch (error) {
      console.error('Failed to create challenge', error)
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      setIsSubmitting(false)
    }
  }, [
    canSubmit,
    category,
    deadline,
    startValue,
    targetValue,
    createChallenge,
    title,
    description,
    unit,
    direction,
  ])

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: palette.bg }]}
      edges={['top']}
    >
      <View style={styles.header}>
        <Pressable
          onPress={handleBack}
          hitSlop={12}
          style={[
            styles.iconButton,
            { backgroundColor: palette.surface, borderColor: palette.border },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <IconSymbol
            name="arrow.left"
            size={18}
            color={resolved === 'dark' ? palette.white : palette.textPrimary}
          />
        </Pressable>
        <Text style={[styles.headerTitle, { color: palette.textPrimary }]}>
          New challenge
        </Text>
        <View style={styles.iconButton} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Section label="What are you chasing?">
            <View style={styles.categoryGrid}>
              {CATEGORY_ORDER.map((id) => {
                const meta = CATEGORY_META[id]
                const accent = palette[meta.accent]
                const isActive = id === category
                return (
                  <TouchableOpacity
                    key={id}
                    onPress={() => handlePickCategory(id)}
                    activeOpacity={0.85}
                    style={[
                      styles.categoryCard,
                      {
                        backgroundColor: palette.surface,
                        borderColor: isActive ? accent : palette.border,
                        borderWidth: isActive ? 2 : 1,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.categoryIcon,
                        { backgroundColor: accent + '22' },
                      ]}
                    >
                      <IconSymbol name={meta.icon} size={20} color={accent} />
                    </View>
                    <Text
                      style={[
                        styles.categoryLabel,
                        { color: palette.textPrimary },
                      ]}
                    >
                      {meta.label}
                    </Text>
                    <Text
                      style={[
                        styles.categoryBlurb,
                        { color: palette.textSecondary },
                      ]}
                      numberOfLines={2}
                    >
                      {meta.blurb}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </View>
          </Section>

          <Section label="Name it">
            <Input
              value={title}
              onChangeText={(t) => {
                setTitle(t)
                setTitleTouched(true)
              }}
              placeholder="e.g. Run the London Marathon"
            />
          </Section>

          <Section label="What does success look like? (optional)">
            <Input
              value={description}
              onChangeText={setDescription}
              placeholder="Add any detail that helps your coach"
              multiline
            />
          </Section>

          <Section label="Track this metric">
            <View style={styles.metricRow}>
              <View style={styles.metricUnit}>
                <Text style={[styles.fieldHint, { color: palette.textTertiary }]}>
                  Unit
                </Text>
                <Input
                  value={unit}
                  onChangeText={setUnit}
                  placeholder="km, kg, sessions…"
                />
              </View>
            </View>
            <View style={styles.segment}>
              {DIRECTIONS.map((d) => {
                const isActive = d.id === direction
                return (
                  <TouchableOpacity
                    key={d.id}
                    onPress={() => {
                      Haptics.selectionAsync()
                      setDirection(d.id)
                    }}
                    style={[
                      styles.segmentItem,
                      {
                        backgroundColor: isActive
                          ? palette.primary
                          : palette.surface,
                        borderColor: isActive
                          ? palette.primary
                          : palette.border,
                      },
                    ]}
                    activeOpacity={0.85}
                  >
                    <Text
                      style={[
                        styles.segmentText,
                        {
                          color: isActive ? palette.white : palette.textSecondary,
                        },
                      ]}
                    >
                      {d.label}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </View>
            <View style={styles.valueRow}>
              <View style={styles.valueField}>
                <Text style={[styles.fieldHint, { color: palette.textTertiary }]}>
                  Now (optional)
                </Text>
                <Input
                  value={startValue}
                  onChangeText={setStartValue}
                  placeholder="0"
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.valueField}>
                <Text style={[styles.fieldHint, { color: palette.textTertiary }]}>
                  Target (optional)
                </Text>
                <Input
                  value={targetValue}
                  onChangeText={setTargetValue}
                  placeholder="42"
                  keyboardType="numeric"
                />
              </View>
            </View>
          </Section>

          <Section label="By when?">
            <View style={styles.deadlineRow}>
              {DEADLINES.map((d) => {
                const isActive = d.id === deadline
                return (
                  <TouchableOpacity
                    key={d.id}
                    onPress={() => {
                      Haptics.selectionAsync()
                      setDeadline(d.id)
                    }}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: isActive
                          ? palette.primary
                          : palette.surface,
                        borderColor: isActive
                          ? palette.primary
                          : palette.borderStrong,
                      },
                    ]}
                    activeOpacity={0.85}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        {
                          color: isActive ? palette.white : palette.textSecondary,
                        },
                      ]}
                    >
                      {d.label}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </View>
          </Section>

          <View style={styles.bottomSpacing} />
        </ScrollView>

        <Animated.View
          entering={FadeInDown.duration(motion.duration.base)}
          style={[
            styles.footer,
            {
              backgroundColor: palette.bgElevated,
              borderTopColor: palette.divider,
            },
          ]}
        >
          <Pressable
            onPress={handleSubmit}
            disabled={!canSubmit}
            style={({ pressed }) => [
              styles.submitCta,
              {
                backgroundColor: canSubmit ? palette.primary : palette.surfaceHigh,
                opacity: pressed ? 0.92 : 1,
              },
              canSubmit
                ? resolved === 'dark'
                  ? shadows.primaryDark
                  : shadows.primary
                : undefined,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Create challenge"
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text
                style={[
                  styles.submitText,
                  { color: canSubmit ? '#FFFFFF' : palette.textTertiary },
                ]}
              >
                Create challenge
              </Text>
            )}
          </Pressable>
        </Animated.View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

function Section({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  const { palette } = useTheme()
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionLabel, { color: palette.textTertiary }]}>
        {label}
      </Text>
      {children}
    </View>
  )
}

function Input({
  value,
  onChangeText,
  placeholder,
  multiline,
  keyboardType,
}: {
  value: string
  onChangeText: (t: string) => void
  placeholder: string
  multiline?: boolean
  keyboardType?: 'numeric' | 'default'
}) {
  const { palette } = useTheme()
  const [focused, setFocused] = useState(false)
  return (
    <TextInput
      style={[
        styles.input,
        multiline && styles.inputMultiline,
        {
          backgroundColor: palette.surface,
          borderColor: focused ? palette.primary : palette.borderStrong,
          color: palette.textPrimary,
        },
      ]}
      value={value}
      onChangeText={onChangeText}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      placeholder={placeholder}
      placeholderTextColor={palette.textTertiary}
      multiline={multiline}
      keyboardType={keyboardType ?? 'default'}
    />
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  headerTitle: {
    ...typography.h3,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  scrollContent: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.huge,
  },
  section: {
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
  sectionLabel: {
    ...typography.caption,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  categoryCard: {
    width: '48%',
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.xs,
  },
  categoryIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  categoryLabel: {
    ...typography.bodyStrong,
  },
  categoryBlurb: {
    ...typography.small,
  },
  input: {
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    ...typography.body,
  },
  inputMultiline: {
    minHeight: 84,
    textAlignVertical: 'top',
  },
  metricRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  metricUnit: {
    flex: 1,
    gap: spacing.xs,
  },
  fieldHint: {
    ...typography.small,
  },
  segment: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  segmentItem: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  segmentText: {
    ...typography.smallStrong,
  },
  valueRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  valueField: {
    flex: 1,
    gap: spacing.xs,
  },
  deadlineRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  chipText: {
    ...typography.smallStrong,
  },
  bottomSpacing: {
    height: spacing.xl,
  },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  submitCta: {
    height: 54,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitText: {
    ...typography.button,
  },
})
