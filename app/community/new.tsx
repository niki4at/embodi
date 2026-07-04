import { useMutation, useQuery } from 'convex/react'
import * as Haptics from 'expo-haptics'
import { router } from 'expo-router'
import React, { useMemo, useState } from 'react'
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { Avatar } from '@/components/social/avatar'
import type { ProfileCard } from '@/components/social/types'
import { IconSymbol } from '@/components/ui/icon-symbol'
import { PillButton } from '@/components/ui/pill-button'
import { radius, spacing, typography } from '@/constants/design'
import { useTheme } from '@/constants/theme-context'
import { api } from '@/convex/_generated/api'

type GoalCategory =
  | 'marathon'
  | 'half_marathon'
  | 'ironman'
  | 'consistency'
  | 'custom'

type MetricKind = 'distance_km' | 'sessions' | 'custom'

const GOAL_PRESETS: {
  category: GoalCategory
  label: string
  metricKind: MetricKind
  defaultTarget: number | null
  unit: string
}[] = [
  {
    category: 'marathon',
    label: 'Marathon',
    metricKind: 'distance_km',
    defaultTarget: 300,
    unit: 'km',
  },
  {
    category: 'half_marathon',
    label: 'Half marathon',
    metricKind: 'distance_km',
    defaultTarget: 150,
    unit: 'km',
  },
  {
    category: 'ironman',
    label: 'Ironman',
    metricKind: 'distance_km',
    defaultTarget: 600,
    unit: 'km',
  },
  {
    category: 'consistency',
    label: 'Consistency',
    metricKind: 'sessions',
    defaultTarget: 24,
    unit: 'sessions',
  },
  {
    category: 'custom',
    label: 'Custom',
    metricKind: 'custom',
    defaultTarget: null,
    unit: '',
  },
]

const EVENT_DATE_PRESETS = [
  { label: 'No date', weeks: null },
  { label: '4 weeks', weeks: 4 },
  { label: '8 weeks', weeks: 8 },
  { label: '12 weeks', weeks: 12 },
  { label: '16 weeks', weeks: 16 },
]

export default function NewCommunityScreen() {
  const { palette } = useTheme()

  const myProfile = useQuery(api.profiles.getMyProfile)
  const backing = useQuery(
    api.profiles.listBacking,
    myProfile ? { userId: myProfile.userId } : 'skip'
  )
  const createCommunity = useMutation(api.communities.createCommunity)

  const [name, setName] = useState('')
  const [preset, setPreset] = useState(GOAL_PRESETS[0])
  const [customGoal, setCustomGoal] = useState('')
  const [customUnit, setCustomUnit] = useState('')
  const [target, setTarget] = useState(
    GOAL_PRESETS[0].defaultTarget != null
      ? String(GOAL_PRESETS[0].defaultTarget)
      : ''
  )
  const [eventWeeks, setEventWeeks] = useState<number | null>(12)
  const [visibility, setVisibility] = useState<'invite' | 'open'>('invite')
  const [invitees, setInvitees] = useState<Set<string>>(new Set())
  const [creating, setCreating] = useState(false)

  const eventDateLabel = useMemo(() => {
    if (eventWeeks == null) return null
    const date = new Date(Date.now() + eventWeeks * 7 * 24 * 60 * 60 * 1000)
    return date.toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }, [eventWeeks])

  const selectPreset = (next: (typeof GOAL_PRESETS)[number]) => {
    void Haptics.selectionAsync()
    setPreset(next)
    setTarget(next.defaultTarget != null ? String(next.defaultTarget) : '')
  }

  const toggleInvitee = (userId: string) => {
    void Haptics.selectionAsync()
    setInvitees((prev) => {
      const next = new Set(prev)
      if (next.has(userId)) next.delete(userId)
      else next.add(userId)
      return next
    })
  }

  const handleCreate = async () => {
    if (creating) return
    const trimmedName = name.trim()
    if (trimmedName.length < 3) {
      Alert.alert('Name it first', 'Give your community a name (3+ characters).')
      return
    }
    const isCustom = preset.category === 'custom'
    const goalLabel = isCustom ? customGoal.trim() || trimmedName : preset.label
    const unit = isCustom ? customUnit.trim() || 'points' : preset.unit
    const targetNumber = Number(target)

    setCreating(true)
    try {
      const communityId = await createCommunity({
        name: trimmedName,
        goalCategory: preset.category,
        goalLabel,
        eventDate:
          eventWeeks != null
            ? Date.now() + eventWeeks * 7 * 24 * 60 * 60 * 1000
            : undefined,
        metric: {
          kind: preset.metricKind,
          target:
            Number.isFinite(targetNumber) && targetNumber > 0
              ? targetNumber
              : undefined,
          unit,
        },
        visibility,
        inviteeUserIds: Array.from(invitees),
      })
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      router.replace({
        pathname: '/community/[id]',
        params: { id: String(communityId) },
      })
    } catch (error) {
      Alert.alert(
        'Could not create community',
        error instanceof Error
          ? error.message.replace(/^.*Error: /, '')
          : 'Try again.'
      )
      setCreating(false)
    }
  }

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: palette.bg }]}
      edges={['top', 'bottom']}
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <IconSymbol name="xmark" size={22} color={palette.textPrimary} />
          </Pressable>
          <Text style={[typography.h3, { color: palette.textPrimary }]}>
            Start a community
          </Text>
          <View style={{ width: 22 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={[styles.fieldLabel, { color: palette.textSecondary }]}>
            Name
          </Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Sunday Long Run Crew"
            placeholderTextColor={palette.textTertiary}
            maxLength={60}
            style={[
              styles.input,
              {
                backgroundColor: palette.surface,
                borderColor: palette.border,
                color: palette.textPrimary,
              },
            ]}
          />

          <Text style={[styles.fieldLabel, { color: palette.textSecondary }]}>
            Shared goal
          </Text>
          <View style={styles.chipsWrap}>
            {GOAL_PRESETS.map((option) => {
              const selected = option.category === preset.category
              return (
                <Pressable
                  key={option.category}
                  onPress={() => selectPreset(option)}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: selected
                        ? palette.primaryMuted
                        : palette.surface,
                      borderColor: selected ? palette.primary : palette.border,
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={option.label}
                >
                  <Text
                    style={[
                      typography.smallStrong,
                      {
                        color: selected ? palette.primary : palette.textPrimary,
                      },
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              )
            })}
          </View>

          {preset.category === 'custom' ? (
            <>
              <TextInput
                value={customGoal}
                onChangeText={setCustomGoal}
                placeholder="What are you working toward?"
                placeholderTextColor={palette.textTertiary}
                maxLength={60}
                style={[
                  styles.input,
                  styles.customInput,
                  {
                    backgroundColor: palette.surface,
                    borderColor: palette.border,
                    color: palette.textPrimary,
                  },
                ]}
              />
              <TextInput
                value={customUnit}
                onChangeText={setCustomUnit}
                placeholder="Unit (e.g. laps, sessions, km)"
                placeholderTextColor={palette.textTertiary}
                maxLength={20}
                style={[
                  styles.input,
                  styles.customInput,
                  {
                    backgroundColor: palette.surface,
                    borderColor: palette.border,
                    color: palette.textPrimary,
                  },
                ]}
              />
            </>
          ) : null}

          <Text style={[styles.fieldLabel, { color: palette.textSecondary }]}>
            Personal target{preset.unit ? ` (${preset.unit})` : ''}
          </Text>
          <TextInput
            value={target}
            onChangeText={setTarget}
            placeholder="Everyone tracks toward this by default"
            placeholderTextColor={palette.textTertiary}
            keyboardType="numeric"
            style={[
              styles.input,
              {
                backgroundColor: palette.surface,
                borderColor: palette.border,
                color: palette.textPrimary,
              },
            ]}
          />

          <Text style={[styles.fieldLabel, { color: palette.textSecondary }]}>
            Event date
          </Text>
          <View style={styles.chipsWrap}>
            {EVENT_DATE_PRESETS.map((option) => {
              const selected = option.weeks === eventWeeks
              return (
                <Pressable
                  key={option.label}
                  onPress={() => {
                    void Haptics.selectionAsync()
                    setEventWeeks(option.weeks)
                  }}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: selected
                        ? palette.primaryMuted
                        : palette.surface,
                      borderColor: selected ? palette.primary : palette.border,
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={option.label}
                >
                  <Text
                    style={[
                      typography.smallStrong,
                      {
                        color: selected ? palette.primary : palette.textPrimary,
                      },
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              )
            })}
          </View>
          {eventDateLabel ? (
            <Text style={[styles.fieldHint, { color: palette.textTertiary }]}>
              Event day: {eventDateLabel}
            </Text>
          ) : null}

          <Text style={[styles.fieldLabel, { color: palette.textSecondary }]}>
            Who can join
          </Text>
          <View style={styles.visibilityRow}>
            {(
              [
                {
                  key: 'invite' as const,
                  icon: 'lock.fill' as const,
                  label: 'Invite only',
                },
                {
                  key: 'open' as const,
                  icon: 'globe' as const,
                  label: 'Open to all',
                },
              ]
            ).map((option) => {
              const selected = visibility === option.key
              return (
                <Pressable
                  key={option.key}
                  onPress={() => {
                    void Haptics.selectionAsync()
                    setVisibility(option.key)
                  }}
                  style={[
                    styles.visibilityOption,
                    {
                      backgroundColor: selected
                        ? palette.primaryMuted
                        : palette.surface,
                      borderColor: selected ? palette.primary : palette.border,
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={option.label}
                >
                  <IconSymbol
                    name={option.icon}
                    size={17}
                    color={selected ? palette.primary : palette.textSecondary}
                  />
                  <Text
                    style={[
                      typography.bodyStrong,
                      {
                        color: selected ? palette.primary : palette.textPrimary,
                      },
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              )
            })}
          </View>

          <Text style={[styles.fieldLabel, { color: palette.textSecondary }]}>
            Invite people you back
          </Text>
          {backing === undefined ? null : backing.length === 0 ? (
            <Text style={[typography.small, { color: palette.textTertiary }]}>
              Back some people first, then invite them here. You can also share
              an invite link after creating.
            </Text>
          ) : (
            <View style={styles.inviteList}>
              {(backing as ProfileCard[]).map((person) => {
                const selected = invitees.has(person.userId)
                return (
                  <Pressable
                    key={person.userId}
                    onPress={() => toggleInvitee(person.userId)}
                    style={styles.inviteRow}
                    accessibilityRole="button"
                    accessibilityLabel={`Invite ${person.displayName}`}
                  >
                    <Avatar
                      url={person.avatarUrl}
                      name={person.displayName}
                      size={38}
                    />
                    <View style={styles.inviteText}>
                      <Text
                        style={[
                          typography.bodyStrong,
                          { color: palette.textPrimary },
                        ]}
                        numberOfLines={1}
                      >
                        {person.displayName}
                      </Text>
                      <Text
                        style={[
                          typography.small,
                          { color: palette.textTertiary },
                        ]}
                        numberOfLines={1}
                      >
                        @{person.username}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.checkbox,
                        {
                          backgroundColor: selected
                            ? palette.primary
                            : 'transparent',
                          borderColor: selected
                            ? palette.primary
                            : palette.borderStrong,
                        },
                      ]}
                    >
                      {selected ? (
                        <IconSymbol name="checkmark" size={13} color="#FFFFFF" />
                      ) : null}
                    </View>
                  </Pressable>
                )
              })}
            </View>
          )}

          <View style={styles.createButton}>
            <PillButton
              label={creating ? 'Creating\u2026' : 'Create community'}
              onPress={handleCreate}
              disabled={creating}
              loading={creating}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
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
    paddingVertical: spacing.lg,
  },
  scrollContent: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.huge,
  },
  fieldLabel: {
    ...typography.smallStrong,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  fieldHint: {
    ...typography.small,
    marginTop: spacing.sm,
  },
  input: {
    ...typography.body,
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
  },
  customInput: {
    marginTop: spacing.sm,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  visibilityRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  visibilityOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingVertical: spacing.lg,
  },
  inviteList: {
    gap: spacing.xs,
  },
  inviteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  inviteText: {
    flex: 1,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createButton: {
    marginTop: spacing.xxl,
  },
})
