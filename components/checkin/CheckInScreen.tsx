import { api } from '@/convex/_generated/api'
import { useMutation, useQuery } from 'convex/react'
import * as Haptics from 'expo-haptics'
import { router, useLocalSearchParams, type Href } from 'expo-router'
import React, { useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'

import {
  ContextEditorSheet,
  CONTEXT_TAGS,
  EQUIPMENT_INTENT_LABELS,
  EQUIPMENT_INTENTS,
  isEquipmentIntent,
  isTrainingEnvironment,
  useForegroundPlaceMatch,
  type ContextSuggestionSource,
  type TrainingContextSelection,
  type TrainingContextTag,
  type TrainingEnvironment,
} from '@/components/training-context'
import { PillButton } from '@/components/ui/pill-button'
import {
  Chip,
  Eyebrow,
  FlowHeader,
  InferredSparkle,
  OptionTile,
  Segmented,
  TextLink,
} from '@/components/ui/primitives'
import {
  ENERGY_OPTIONS,
  FOCUS_OPTIONS,
  INTENSITY_OPTIONS,
  QUICK_PAIN_AREAS,
  SLEEP_OPTIONS,
  STRESS_OPTIONS,
  TIME_OPTIONS,
  WORKOUT_TYPE_OPTIONS,
  type EnergyBucket,
  type IntensityPreference,
  type SleepQuality,
  type StressBucket,
  type TimeAvailable,
  type WorkoutType,
} from '@/constants/checkin-labels'
import { motion, radius, spacing, typography } from '@/constants/design'
import { useTheme } from '@/constants/theme-context'
import { useTrainingPreferences } from '@/hooks/use-training-preferences'

import { PainBodyMap, type BodyPart, type PainRatings } from './PainBodyMap'

type RecommendationSeed = {
  title: string
  modality: string
  durationMin: number
  moveCount: number
  description: string
  reasoning: string
  tags: string[]
  source: 'aligned' | 'exploration'
}

const VALID_WORKOUT_TYPES: WorkoutType[] = [
  'strength',
  'mobility',
  'cardio',
  'recovery',
  'mixed',
]

function workoutOptionIndexFromModality(modality: string): number | null {
  const m = modality.toLowerCase()
  const find = (label: string) =>
    WORKOUT_TYPE_OPTIONS.findIndex((o) => o.label.toLowerCase() === label)
  if (m.includes('run')) return find('run')
  if (m.includes('strength') || m.includes('lift') || m.includes('power'))
    return find('strength')
  if (m.includes('mobility') || m.includes('yoga') || m.includes('flex'))
    return find('mobility')
  if (m.includes('cardio') || m.includes('endurance')) return find('cardio')
  if (m.includes('recovery') || m.includes('breath') || m.includes('rest'))
    return find('recovery')
  if (m.includes('mixed') || m.includes('hybrid') || m.includes('full'))
    return find('hybrid')
  if (VALID_WORKOUT_TYPES.includes(m as WorkoutType)) {
    const idx = WORKOUT_TYPE_OPTIONS.findIndex((o) => o.value === m)
    return idx >= 0 ? idx : null
  }
  return null
}

function nearestTimeBucket(durationMin: number): TimeAvailable {
  let best: TimeAvailable = '30'
  let bestDelta = Infinity
  for (const bucket of TIME_OPTIONS) {
    const delta = Math.abs(parseInt(bucket, 10) - durationMin)
    if (delta < bestDelta) {
      bestDelta = delta
      best = bucket
    }
  }
  return best
}

function parseRecommendationSeed(raw: unknown): RecommendationSeed | null {
  if (typeof raw !== 'string' || raw.length === 0) return null
  try {
    const parsed = JSON.parse(raw) as Partial<RecommendationSeed>
    if (
      typeof parsed.title === 'string' &&
      typeof parsed.modality === 'string' &&
      typeof parsed.durationMin === 'number' &&
      typeof parsed.moveCount === 'number' &&
      typeof parsed.description === 'string' &&
      typeof parsed.reasoning === 'string' &&
      Array.isArray(parsed.tags) &&
      (parsed.source === 'aligned' || parsed.source === 'exploration')
    ) {
      return parsed as RecommendationSeed
    }
  } catch {
    return null
  }
  return null
}

function parseStringArray(raw: string | undefined): string[] {
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === 'string')
      : []
  } catch {
    return []
  }
}

function preferredSuggestionSource(
  environmentSource: ContextSuggestionSource,
  equipmentSource: ContextSuggestionSource,
): ContextSuggestionSource {
  const priority: ContextSuggestionSource[] = [
    'manual',
    'place',
    'workout_need',
    'weekly_rhythm',
    'history',
    'fallback',
  ]
  return (
    priority.find(
      (source) => source === environmentSource || source === equipmentSource,
    ) ?? 'fallback'
  )
}

function suggestedIntensity(
  sleep: SleepQuality | null,
  energy: EnergyBucket | null,
): IntensityPreference {
  if (energy === 'drained' || energy === 'low' || sleep === 'rough') return 'easy'
  if (
    energy === 'charged' ||
    (energy === 'good' && (sleep === 'great' || sleep === 'decent'))
  ) {
    return 'challenging'
  }
  return 'moderate'
}

const WEEKDAYS = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const

const TOTAL_STEPS = 4
const STEP_EYEBROW = ['', 'Body', 'Time', 'Set up'] as const
const STEP_TITLE = [
  'How are you today?',
  'Anything sore or hurting?',
  'How long have you got?',
  'What are we doing?',
] as const

/**
 * The Figma "Where" control has three segments: HOME / WORK / TRAVELLING.
 * The backend enum is home / gym / outdoors / travel, so WORK maps to `gym`
 * (the place with equipment you don't own) and TRAVELLING to `travel`;
 * `outdoors` stays reachable through "Edit for today".
 */
const WHERE_SEGMENTS: { value: TrainingEnvironment; label: string }[] = [
  { value: 'home', label: 'HOME' },
  { value: 'gym', label: 'WORK' },
  { value: 'travel', label: 'TRAVELLING' },
]

function whereSegmentFor(environment: TrainingEnvironment): TrainingEnvironment {
  return environment === 'outdoors' ? 'travel' : environment
}

/** Location is only asked for gym-flavoured work; runs, mobility, and recovery skip it. */
function asksForLocation(option: (typeof WORKOUT_TYPE_OPTIONS)[number] | null): boolean {
  if (!option) return false
  if (option.focusTag === 'running') return false
  return option.value === 'strength' || option.value === 'mixed' || option.value === 'cardio'
}

interface CheckInFormData {
  sleepQuality: SleepQuality | null
  energy: EnergyBucket | null
  stress: StressBucket | null
  quickPainAreas: string[]
  painRatings: PainRatings
  timeAvailable: TimeAvailable | null
  workoutOption: number | null
  focusAreas: string[]
  intensityPreference: IntensityPreference | null
}

export default function CheckInScreen() {
  const { palette } = useTheme()
  const params = useLocalSearchParams<{
    rec?: string
    step?: string
    bodyMap?: string
    trainingEnvironment?: string
    equipmentIntent?: string
    contextTags?: string
    unavailableEquipment?: string
  }>()
  const recommendation = useMemo(
    () => parseRecommendationSeed(params.rec),
    [params.rec],
  )
  const initialStep = useMemo(() => {
    const parsed = parseInt(params.step ?? '0', 10)
    return Number.isFinite(parsed) && parsed >= 0 && parsed < TOTAL_STEPS
      ? parsed
      : 0
  }, [params.step])

  const [currentStep, setCurrentStep] = useState(initialStep)
  const [bodyMapMode, setBodyMapMode] = useState(params.bodyMap === '1')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [contextEditorOpen, setContextEditorOpen] = useState(false)
  const [homeSetupPrompted, setHomeSetupPrompted] = useState(false)
  const [trainingContext, setTrainingContext] =
    useState<TrainingContextSelection | null>(null)
  const [formData, setFormData] = useState<CheckInFormData>(() => ({
    sleepQuality: null,
    energy: null,
    stress: null,
    quickPainAreas: [],
    painRatings: {},
    timeAvailable: recommendation
      ? nearestTimeBucket(recommendation.durationMin)
      : null,
    workoutOption: recommendation
      ? workoutOptionIndexFromModality(recommendation.modality)
      : null,
    focusAreas: [],
    intensityPreference: null,
  }))

  useEffect(() => {
    if (!recommendation) return
    setFormData((prev) => ({
      ...prev,
      workoutOption:
        prev.workoutOption ?? workoutOptionIndexFromModality(recommendation.modality),
      timeAvailable:
        prev.timeAvailable ?? nearestTimeBucket(recommendation.durationMin),
    }))
  }, [recommendation])

  const workoutOption =
    formData.workoutOption !== null
      ? WORKOUT_TYPE_OPTIONS[formData.workoutOption] ?? null
      : null
  const workoutType: WorkoutType | null = workoutOption?.value ?? null

  const onboardingData = useQuery(api.onboarding.getOnboarding)
  const trainingPreferences = useTrainingPreferences()
  const equipmentInventory = useQuery(api.equipment.listActive)
  const createCheckin = useMutation(api.checkin.createCheckin)
  const recordContextEvent = useMutation(api.trainingContext.recordEvent)
  const { match: foregroundPlaceMatch } = useForegroundPlaceMatch(
    trainingPreferences?.locationEnabled === true,
  )
  const suggestionNow = useMemo(() => new Date(), [])
  const requestedEnvironment = isTrainingEnvironment(params.trainingEnvironment)
    ? params.trainingEnvironment
    : undefined
  const requestedEquipmentIntent = isEquipmentIntent(params.equipmentIntent)
    ? params.equipmentIntent
    : undefined
  const requestedContextTags = useMemo(
    () =>
      parseStringArray(params.contextTags).filter(
        (tag): tag is TrainingContextTag =>
          CONTEXT_TAGS.some((candidate) => candidate === tag),
      ),
    [params.contextTags],
  )
  const requestedUnavailableEquipment = useMemo(
    () => parseStringArray(params.unavailableEquipment),
    [params.unavailableEquipment],
  )
  const contextSuggestion = useQuery(
    api.trainingContext.suggest,
    workoutType
      ? {
          manualContext:
            requestedEnvironment || requestedEquipmentIntent
              ? {
                  trainingEnvironment: requestedEnvironment,
                  equipmentIntent: requestedEquipmentIntent,
                }
              : undefined,
          foregroundPlaceMatch: foregroundPlaceMatch ?? undefined,
          workoutType,
          goal: recommendation?.title ?? onboardingData?.goal,
          weekday: WEEKDAYS[suggestionNow.getDay()],
          timeOfDay: suggestionNow.getHours() < 12 ? 'morning' : 'evening',
        }
      : 'skip',
  )

  const equipmentSnapshot = useMemo(
    () =>
      (equipmentInventory ?? []).map(({ equipment }) => ({
        catalogKey: equipment.catalogKey,
        label: equipment.label,
        details: equipment.details,
        capabilities: equipment.capabilities,
      })),
    [equipmentInventory],
  )

  useEffect(() => {
    if (
      !workoutType ||
      trainingContext?.suggestionSource === 'manual' ||
      equipmentInventory === undefined ||
      contextSuggestion == null
    ) {
      return
    }
    const nextEnvironment = contextSuggestion.environment.value
    const nextEquipmentIntent =
      contextSuggestion.equipmentIntent.value === 'available' &&
      nextEnvironment === 'home' &&
      equipmentSnapshot.length === 0
        ? 'bodyweight'
        : contextSuggestion.equipmentIntent.value
    const reasons = [
      contextSuggestion.environment.reason,
      contextSuggestion.equipmentIntent.reason,
    ].filter((reason, index, values) => values.indexOf(reason) === index)
    setTrainingContext({
      trainingEnvironment: nextEnvironment,
      equipmentIntent: nextEquipmentIntent,
      contextTags: requestedContextTags,
      suggestionSource: preferredSuggestionSource(
        contextSuggestion.environment.source,
        contextSuggestion.equipmentIntent.source,
      ),
      suggestionReason: reasons.join(' '),
      equipmentSnapshot,
      unavailableEquipment: requestedUnavailableEquipment,
    })
  }, [
    equipmentInventory,
    equipmentSnapshot,
    workoutType,
    contextSuggestion,
    requestedContextTags,
    requestedUnavailableEquipment,
    trainingContext?.suggestionSource,
  ])

  useEffect(() => {
    if (
      currentStep !== 3 ||
      homeSetupPrompted ||
      !asksForLocation(workoutOption) ||
      trainingContext?.trainingEnvironment !== 'home' ||
      equipmentInventory === undefined ||
      equipmentInventory.length > 0
    ) {
      return
    }
    setHomeSetupPrompted(true)
    Alert.alert(
      'Set up your home equipment?',
      'Save it once and Bodfit will consider it for future Home sessions. You can use bodyweight today and do this later.',
      [
        { text: 'Bodyweight today', style: 'cancel' },
        {
          text: 'Add equipment',
          onPress: () => router.push('/training-setup' as Href),
        },
      ],
    )
  }, [
    currentStep,
    equipmentInventory,
    homeSetupPrompted,
    trainingContext?.trainingEnvironment,
    workoutOption,
  ])

  const update = <K extends keyof CheckInFormData>(
    key: K,
    value: CheckInFormData[K],
  ) => setFormData((prev) => ({ ...prev, [key]: value }))

  const { painLevel, painAreas, painRatingsList } = useMemo(() => {
    const entries = Object.entries(formData.painRatings) as [BodyPart, number][]
    const rated = entries.filter(([, lvl]) => lvl > 0)
    const max = rated.reduce((acc, [, lvl]) => Math.max(acc, lvl), 0)
    const areas = [
      ...formData.quickPainAreas,
      ...rated.map(([part]) => part as string),
    ]
    const level =
      max > 0 ? max : formData.quickPainAreas.length > 0 ? 4 : 0
    const list = [
      ...formData.quickPainAreas.map((area) => ({ area, level: 4 })),
      ...rated.map(([part, lvl]) => ({ area: part as string, level: lvl })),
    ]
    return {
      painLevel: level,
      painAreas: Array.from(new Set(areas)),
      painRatingsList: list,
    }
  }, [formData.painRatings, formData.quickPainAreas])

  const intensitySuggestion = suggestedIntensity(
    formData.sleepQuality,
    formData.energy,
  )
  const needsLocation = asksForLocation(workoutOption)

  const canProceed = (): boolean => {
    switch (currentStep) {
      case 0:
        return formData.sleepQuality !== null && formData.energy !== null
      case 1:
        return true
      case 2:
        return formData.timeAvailable !== null
      case 3:
        return (
          workoutType !== null &&
          formData.intensityPreference !== null &&
          (!needsLocation || trainingContext !== null)
        )
      default:
        return true
    }
  }

  const goTo = (step: number) => setCurrentStep(step)

  const handleNext = () => {
    if (currentStep < TOTAL_STEPS - 1) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {})
      goTo(currentStep + 1)
    }
  }

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
    if (currentStep === 1 && bodyMapMode) {
      setBodyMapMode(false)
      return
    }
    if (currentStep > 0) {
      goTo(currentStep - 1)
    } else if (router.canGoBack()) {
      router.back()
    } else {
      router.replace('/')
    }
  }

  const handleSkipToWorkout = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {})
    setFormData((prev) => ({
      ...prev,
      sleepQuality: 'great',
      energy: 'charged',
      stress: 'calm',
      quickPainAreas: [],
      painRatings: {},
      timeAvailable: prev.timeAvailable ?? '30',
    }))
    goTo(3)
  }

  const handleSubmit = async () => {
    if (isSubmitting) return
    const energyOption = ENERGY_OPTIONS.find((o) => o.value === formData.energy)
    const stressOption =
      STRESS_OPTIONS.find((o) => o.value === formData.stress) ?? STRESS_OPTIONS[0]
    if (
      !formData.sleepQuality ||
      !energyOption ||
      !workoutType ||
      !formData.intensityPreference ||
      !formData.timeAvailable ||
      (needsLocation && !trainingContext)
    ) {
      return
    }

    const focusAreas = [
      ...formData.focusAreas,
      ...(workoutOption?.focusTag ? [workoutOption.focusTag] : []),
    ]

    setIsSubmitting(true)
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
      const result = await createCheckin({
        data: {
          energyLevel: energyOption.level,
          sleepQuality: formData.sleepQuality,
          painLevel,
          painAreas: painAreas.length > 0 ? painAreas : undefined,
          painRatings: painRatingsList.length > 0 ? painRatingsList : undefined,
          stressLevel: stressOption.level,
          workoutType,
          focusAreas: focusAreas.length > 0 ? focusAreas : undefined,
          intensityPreference: formData.intensityPreference,
          timeAvailable: formData.timeAvailable,
          trainingEnvironment: trainingContext?.trainingEnvironment,
          equipmentIntent: trainingContext?.equipmentIntent,
          contextTags: trainingContext?.contextTags,
          suggestionSource: trainingContext?.suggestionSource,
          suggestionReason: trainingContext?.suggestionReason,
          unavailableEquipment: trainingContext?.unavailableEquipment,
        },
        startSession: true,
        recommendationSeed: recommendation ?? undefined,
      })

      if (result.sessionId) {
        if (trainingContext) {
          await recordContextEvent({
            trainingEnvironment: trainingContext.trainingEnvironment,
            equipmentIntent: trainingContext.equipmentIntent,
            contextTags: trainingContext.contextTags,
            workoutType,
            goal: recommendation?.title ?? onboardingData?.goal,
            localWeekday: WEEKDAYS[suggestionNow.getDay()],
            timeOfDay: suggestionNow.getHours() < 12 ? 'morning' : 'evening',
            suggestionSource: trainingContext.suggestionSource,
            suggestionReason: trainingContext.suggestionReason,
            equipmentKeys: trainingContext.equipmentSnapshot.map(
              (item) => item.catalogKey,
            ),
          }).catch((error: unknown) => {
            console.info('Could not record training context pattern', error)
          })
        }
        router.replace({
          pathname: '/session/ready',
          params: { sessionId: String(result.sessionId) },
        } as unknown as Href)
      }
    } catch (error) {
      console.error('Failed to create check-in:', error)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {})
    } finally {
      setIsSubmitting(false)
    }
  }

  const isLast = currentStep === TOTAL_STEPS - 1
  const proceedEnabled = canProceed()

  const setEnvironment = (environment: TrainingEnvironment) => {
    setTrainingContext((current) =>
      current
        ? {
            ...current,
            trainingEnvironment: environment,
            equipmentIntent:
              environment === 'home' && equipmentSnapshot.length === 0
                ? 'bodyweight'
                : environment === 'home'
                  ? 'available'
                  : current.equipmentIntent === 'treadmill'
                    ? 'treadmill'
                    : 'available',
            suggestionSource: 'manual',
            suggestionReason: 'Chosen for this session.',
          }
        : current,
    )
  }

  /* -------------------------------------------------------------- steps */

  const renderStepOne = () => (
    <View>
      {!recommendation ? (
        <Pressable
          onPress={handleSkipToWorkout}
          accessibilityRole="button"
          accessibilityLabel="Feeling great? Skip to workout. Good energy, solid sleep, no pain. You can still change the workout."
          style={({ pressed }) => [
            styles.skipCard,
            { backgroundColor: palette.coachMuted },
            pressed && styles.pressed,
          ]}
        >
          <Eyebrow color={palette.coach}>Feeling great?</Eyebrow>
          <Text style={[styles.skipTitle, { color: palette.textPrimary }]}>
            Skip to workout
          </Text>
          <Text style={[styles.skipBody, { color: palette.textSecondary }]}>
            Good energy, solid sleep, no pain. You can still change the workout.
          </Text>
        </Pressable>
      ) : (
        <View style={[styles.skipCard, { backgroundColor: palette.primaryMuted }]}>
          <Eyebrow color={palette.primary}>Building from your pick</Eyebrow>
          <Text style={[styles.skipTitle, { color: palette.textPrimary }]}>
            {recommendation.title}
          </Text>
          <Text style={[styles.skipBody, { color: palette.textSecondary }]}>
            {recommendation.modality} {'\u00b7'} {recommendation.durationMin} min{' '}
            {'\u00b7'} {recommendation.moveCount} moves
          </Text>
        </View>
      )}

      <Text style={[styles.title, { color: palette.textPrimary }]} accessibilityRole="header">
        {STEP_TITLE[0]}
      </Text>

      <Eyebrow style={styles.groupLabel}>Sleep</Eyebrow>
      <View style={styles.rowFour}>
        {SLEEP_OPTIONS.map((option) => (
          <OptionTile
            key={option.value}
            title={option.label}
            subtitle={option.hint}
            centered
            selected={formData.sleepQuality === option.value}
            onPress={() => update('sleepQuality', option.value)}
            style={styles.quarterTile}
            accessibilityLabel={`Sleep ${option.label}, ${option.hint}`}
          />
        ))}
      </View>

      <Eyebrow style={styles.groupLabel}>Energy</Eyebrow>
      <View style={styles.stack}>
        {ENERGY_OPTIONS.map((option) => (
          <OptionTile
            key={option.value}
            title={option.label}
            subtitle={option.hint}
            dot={palette[option.dot]}
            selected={formData.energy === option.value}
            onPress={() => update('energy', option.value)}
          />
        ))}
      </View>

      <Eyebrow style={styles.groupLabel}>Stress</Eyebrow>
      <View style={styles.rowThree}>
        {STRESS_OPTIONS.map((option) => (
          <OptionTile
            key={option.value}
            title={option.label}
            centered
            selected={formData.stress === option.value}
            onPress={() => update('stress', option.value)}
            style={styles.thirdTile}
            accessibilityLabel={`Stress: ${option.label}`}
          />
        ))}
      </View>
    </View>
  )

  const renderStepTwo = () => (
    <View>
      <Eyebrow>{STEP_EYEBROW[1]}</Eyebrow>
      <Text style={[styles.title, styles.titleTight, { color: palette.textPrimary }]} accessibilityRole="header">
        {STEP_TITLE[1]}
      </Text>
      {bodyMapMode ? (
        <>
          <Text style={[styles.hint, { color: palette.textSecondary }]}>
            Tap the exact spot. Tap it again to close.
          </Text>
          <PainBodyMap
            value={formData.painRatings}
            onChange={(ratings) => update('painRatings', ratings)}
          />
        </>
      ) : (
        <>
          <View style={styles.chipWrap}>
            {QUICK_PAIN_AREAS.map((area) => (
              <Chip
                key={area.id}
                label={area.label}
                selected={formData.quickPainAreas.includes(area.id)}
                onPress={() =>
                  update(
                    'quickPainAreas',
                    formData.quickPainAreas.includes(area.id)
                      ? formData.quickPainAreas.filter((a) => a !== area.id)
                      : [...formData.quickPainAreas, area.id],
                  )
                }
              />
            ))}
          </View>
          <View style={styles.stackTight}>
            <Chip
              label="Adjust on body map"
              dashed
              onPress={() => setBodyMapMode(true)}
              style={styles.selfStart}
              accessibilityLabel="Adjust on body map. Tap exact spots and rate them."
            />
            <Chip
              label="Nothing today"
              onPress={() => {
                update('quickPainAreas', [])
                update('painRatings', {})
                handleNext()
              }}
              style={styles.selfStart}
              accessibilityLabel="Nothing hurts today. Continue."
            />
          </View>
        </>
      )}
    </View>
  )

  const renderStepThree = () => (
    <View>
      <Eyebrow>{STEP_EYEBROW[2]}</Eyebrow>
      <Text style={[styles.title, styles.titleTight, { color: palette.textPrimary }]} accessibilityRole="header">
        {STEP_TITLE[2]}
      </Text>
      <View style={styles.timeGrid}>
        {TIME_OPTIONS.map((minutes) => (
          <OptionTile
            key={minutes}
            title={minutes}
            subtitle="min"
            centered
            tone="ink"
            selected={formData.timeAvailable === minutes}
            onPress={() => update('timeAvailable', minutes)}
            style={styles.timeTile}
            accessibilityLabel={`${minutes} minutes`}
          />
        ))}
      </View>
    </View>
  )

  const renderStepFour = () => {
    const suggestedSegment = contextSuggestion
      ? whereSegmentFor(contextSuggestion.environment.value)
      : null
    const environmentOptions = WHERE_SEGMENTS.map((segment) => ({
      value: segment.value,
      label: segment.label,
      leading:
        suggestedSegment === segment.value &&
        contextSuggestion?.environment.source !== 'manual' ? (
          <InferredSparkle size={9} />
        ) : undefined,
    }))
    const equipmentLabel =
      trainingContext?.equipmentIntent === 'bodyweight'
        ? 'Bodyweight only'
        : trainingContext?.equipmentIntent === 'treadmill'
          ? 'Treadmill'
          : trainingContext && trainingContext.equipmentSnapshot.length > 0
            ? trainingContext.equipmentSnapshot
                .slice(0, 4)
                .map((item) => item.label)
                .join(' \u00b7 ')
            : 'Whatever is on hand'

    return (
      <View>
        <Eyebrow>{STEP_EYEBROW[3]}</Eyebrow>
        <Text style={[styles.title, styles.titleTight, { color: palette.textPrimary }]} accessibilityRole="header">
          {STEP_TITLE[3]}
        </Text>

        <Eyebrow style={styles.groupLabelTight}>Type</Eyebrow>
        <View style={styles.typeGrid}>
          {WORKOUT_TYPE_OPTIONS.map((option, index) => (
            <OptionTile
              key={option.label}
              title={option.label}
              centered
              tone="ink"
              selected={formData.workoutOption === index}
              onPress={() => {
                update('workoutOption', index)
                if (trainingContext?.suggestionSource !== 'manual') {
                  setTrainingContext(null)
                }
              }}
              style={styles.typeTile}
            />
          ))}
        </View>

        <Eyebrow style={styles.groupLabel}>Focus</Eyebrow>
        <View style={styles.chipWrap}>
          {FOCUS_OPTIONS.map((focus) => (
            <Chip
              key={focus.value}
              label={focus.label}
              selected={formData.focusAreas.includes(focus.value)}
              onPress={() =>
                update(
                  'focusAreas',
                  formData.focusAreas.includes(focus.value)
                    ? formData.focusAreas.filter((f) => f !== focus.value)
                    : [...formData.focusAreas, focus.value],
                )
              }
            />
          ))}
        </View>

        <Eyebrow style={styles.groupLabel}>Intensity</Eyebrow>
        <View style={styles.rowThree}>
          {INTENSITY_OPTIONS.map((option) => (
            <OptionTile
              key={option.value}
              title={option.label}
              subtitle={option.hint}
              centered
              tone="ink"
              selected={formData.intensityPreference === option.value}
              onPress={() => update('intensityPreference', option.value)}
              style={styles.thirdTile}
              trailing={
                option.value === intensitySuggestion ? (
                  <View style={styles.tileSparkle}>
                    <InferredSparkle size={10} />
                  </View>
                ) : undefined
              }
              accessibilityLabel={`${option.label}, ${option.hint}${
                option.value === intensitySuggestion
                  ? '. Suggested for your sleep and energy.'
                  : ''
              }`}
            />
          ))}
        </View>
        <View style={styles.sparkleHint}>
          <InferredSparkle size={9} />
          <Text style={[styles.sparkleHintText, { color: palette.textSecondary }]}>
            Suggested for your sleep and energy
          </Text>
        </View>

        {needsLocation ? (
          <>
            <Eyebrow style={styles.groupLabel}>Where</Eyebrow>
            <View style={[styles.whereCard, { borderColor: palette.border }]}>
              {trainingContext ? (
                <>
                  <Segmented
                    options={environmentOptions}
                    value={whereSegmentFor(trainingContext.trainingEnvironment)}
                    onChange={setEnvironment}
                  />
                  {contextSuggestion &&
                  contextSuggestion.environment.source !== 'manual' ? (
                    <View style={styles.sparkleHintInline}>
                      <InferredSparkle size={9} />
                      <Text
                        style={[styles.sparkleHintText, { color: palette.textSecondary }]}
                        numberOfLines={2}
                      >
                        {contextSuggestion.environment.reason}
                      </Text>
                    </View>
                  ) : null}
                  <View style={[styles.whereDivider, { backgroundColor: palette.divider }]} />
                  <View style={styles.whereRow}>
                    <Eyebrow color={palette.primary}>
                      {trainingContext.trainingEnvironment === 'home'
                        ? 'Using what you have'
                        : 'Select the following'}
                    </Eyebrow>
                    <TextLink
                      label="Edit for today"
                      color={palette.danger}
                      onPress={() => setContextEditorOpen(true)}
                    />
                  </View>
                  {trainingContext.trainingEnvironment === 'home' ? (
                    <Text
                      style={[styles.equipmentLine, { color: palette.textPrimary }]}
                      numberOfLines={2}
                    >
                      {equipmentLabel}
                    </Text>
                  ) : (
                    <View style={styles.chipWrapTight}>
                      {EQUIPMENT_INTENTS.map((intent) => (
                        <Chip
                          key={intent}
                          label={EQUIPMENT_INTENT_LABELS[intent]}
                          selected={trainingContext.equipmentIntent === intent}
                          onPress={() =>
                            setTrainingContext((current) =>
                              current
                                ? {
                                    ...current,
                                    equipmentIntent: intent,
                                    suggestionSource: 'manual',
                                    suggestionReason: 'Chosen for this session.',
                                  }
                                : current,
                            )
                          }
                        />
                      ))}
                    </View>
                  )}
                  {trainingContext.trainingEnvironment === 'home' &&
                  trainingContext.equipmentSnapshot.length === 0 ? (
                    <TextLink
                      label={"Add your home equipment →"}
                      onPress={() => router.push('/training-setup' as Href)}
                    />
                  ) : null}
                </>
              ) : (
                <View style={styles.contextLoading} accessibilityLiveRegion="polite">
                  <ActivityIndicator size="small" color={palette.primary} />
                  <Text style={[styles.sparkleHintText, { color: palette.textSecondary }]}>
                    Matching your place and equipment
                  </Text>
                </View>
              )}
            </View>
          </>
        ) : null}

      </View>
    )
  }

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return renderStepOne()
      case 1:
        return renderStepTwo()
      case 2:
        return renderStepThree()
      case 3:
        return renderStepFour()
      default:
        return null
    }
  }

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: palette.bg }]}
      edges={['top']}
    >
      <FlowHeader
        backLabel={currentStep === 0 ? 'Home' : 'Back'}
        onBack={handleBack}
        step={currentStep + 1}
        total={TOTAL_STEPS}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View
          key={`step-${currentStep}-${bodyMapMode ? 'map' : 'list'}`}
          entering={FadeInDown.duration(motion.duration.base)}
          exiting={FadeOut.duration(motion.duration.quick)}
        >
          {renderStep()}
        </Animated.View>
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: palette.bg }]}>
        {isLast ? (
          <PillButton
            variant="gradient"
            label={isSubmitting ? 'Building your session' : 'Build my session'}
            onPress={handleSubmit}
            disabled={!proceedEnabled || isSubmitting}
            loading={isSubmitting}
          />
        ) : (
          <PillButton
            label="Continue"
            onPress={handleNext}
            disabled={!proceedEnabled}
          />
        )}
      </View>

      {trainingContext ? (
        <ContextEditorSheet
          visible={contextEditorOpen}
          value={trainingContext}
          onClose={() => setContextEditorOpen(false)}
          onSave={(value) => {
            setTrainingContext({ ...value, suggestionSource: 'manual' })
            setContextEditorOpen(false)
          }}
          showTrainingSetupLink={
            trainingContext.trainingEnvironment === 'home' &&
            trainingContext.equipmentSnapshot.length === 0
          }
          onOpenTrainingSetup={() => {
            setContextEditorOpen(false)
            router.push('/training-setup' as Href)
          }}
        />
      ) : null}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  pressed: {
    opacity: 0.8,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xs,
    paddingBottom: 120,
  },
  skipCard: {
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: 4,
    marginBottom: spacing.xl,
  },
  skipTitle: {
    ...typography.bodyStrong,
    fontSize: 16,
  },
  skipBody: {
    ...typography.small,
  },
  title: {
    ...typography.h1,
    fontSize: 24,
    lineHeight: 30,
  },
  titleTight: {
    marginTop: 6,
  },
  hint: {
    ...typography.small,
    fontSize: 14,
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  groupLabel: {
    marginTop: spacing.xxl,
    marginBottom: spacing.md,
  },
  groupLabelTight: {
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  rowFour: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  quarterTile: {
    flex: 1,
    minHeight: 60,
    paddingHorizontal: 4,
  },
  rowThree: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  thirdTile: {
    flex: 1,
    minHeight: 56,
  },
  stack: {
    gap: spacing.sm,
  },
  stackTight: {
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  selfStart: {
    alignSelf: 'flex-start',
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  chipWrapTight: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  timeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  timeTile: {
    flexBasis: '30%',
    flexGrow: 1,
    minHeight: 76,
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  typeTile: {
    flexBasis: '30%',
    flexGrow: 1,
    minHeight: 54,
  },
  tileSparkle: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  sparkleHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.sm,
  },
  sparkleHintInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sparkleHintText: {
    ...typography.small,
    fontSize: 12,
    flexShrink: 1,
  },
  whereCard: {
    borderWidth: 1,
    borderRadius: radius.xxl,
    padding: spacing.lg,
    gap: spacing.md,
  },
  whereDivider: {
    height: StyleSheet.hairlineWidth,
  },
  whereRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  equipmentLine: {
    ...typography.bodyStrong,
  },
  contextLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 56,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
  },
})
