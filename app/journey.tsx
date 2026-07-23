import { useQuery } from 'convex/react'
import * as Haptics from 'expo-haptics'
import { router } from 'expo-router'
import React, { useCallback, useMemo, useState } from 'react'
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { ActivityHeatmap } from '@/components/profile/activity-heatmap'
import { SectionHeader } from '@/components/profile/section'
import { IconSymbol } from '@/components/ui/icon-symbol'
import { radius, spacing, typography } from '@/constants/design'
import { useTheme } from '@/constants/theme-context'
import { api } from '@/convex/_generated/api'
import type { UnitSystem } from '@/utils/activity-heatmap'

type Category =
  | 'consistency'
  | 'performance'
  | 'exploration'
  | 'challenges'
  | 'community'
  | 'recovery'

const FILTERS: { value: Category | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'consistency', label: 'Consistency' },
  { value: 'performance', label: 'Performance' },
  { value: 'exploration', label: 'Exploration' },
  { value: 'challenges', label: 'Challenges' },
  { value: 'community', label: 'Community' },
  { value: 'recovery', label: 'Recovery' },
]

const CATEGORY_ICON: Record<
  Category,
  React.ComponentProps<typeof IconSymbol>['name']
> = {
  consistency: 'flame.fill',
  performance: 'bolt.fill',
  exploration: 'sparkles',
  challenges: 'trophy.fill',
  community: 'person.2.fill',
  recovery: 'heart.fill',
}

function formatEarnedDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

type RecordKind = 'weight' | 'reps' | 'duration' | 'distance'

const RECORD_ICON: Record<
  RecordKind,
  React.ComponentProps<typeof IconSymbol>['name']
> = {
  weight: 'scalemass.fill',
  reps: 'repeat',
  duration: 'stopwatch',
  distance: 'figure.run',
}

const METERS_PER_MILE = 1609.344
const LB_PER_KG = 2.20462

function formatRecordValue(
  kind: RecordKind,
  value: number,
  units: UnitSystem
): string {
  switch (kind) {
    case 'weight':
      return units === 'imperial'
        ? `${Math.round(value * LB_PER_KG)} lb`
        : `${Math.round(value * 10) / 10} kg`
    case 'reps':
      return `${value} ${value === 1 ? 'rep' : 'reps'}`
    case 'duration': {
      if (value >= 3600) {
        const hours = Math.floor(value / 3600)
        const minutes = Math.round((value % 3600) / 60)
        return minutes > 0 ? `${hours} h ${minutes} min` : `${hours} h`
      }
      return value >= 60 ? `${Math.round(value / 60)} min` : `${value} sec`
    }
    case 'distance': {
      if (units === 'imperial') {
        const miles = value / METERS_PER_MILE
        return miles >= 0.1
          ? `${miles.toFixed(1)} mi`
          : `${Math.round(value * 3.28084)} ft`
      }
      return value >= 1000
        ? `${(value / 1000).toFixed(1)} km`
        : `${Math.round(value)} m`
    }
    default: {
      const exhaustive: never = kind
      throw new Error(`Unhandled record kind: ${String(exhaustive)}`)
    }
  }
}

/**
 * Journey: the long-term progress timeline — monthly heatmap plus every
 * earned milestone, filterable by category. Recovery milestones stay private
 * to the owner and are labeled as such.
 */
export default function JourneyScreen() {
  const { palette, resolved } = useTheme()
  const iconTint = resolved === 'dark' ? palette.white : palette.textPrimary
  const achievements = useQuery(api.achievements.listMine)
  const personalRecords = useQuery(api.exerciseStats.getPersonalRecords)
  const settings = useQuery(api.userSettings.get)
  const units: UnitSystem = settings?.units ?? 'metric'
  const [filter, setFilter] = useState<Category | 'all'>('all')

  const handleBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back()
    } else {
      router.replace('/')
    }
  }, [])

  const visible = useMemo(() => {
    if (!achievements) return []
    if (filter === 'all') return achievements
    return achievements.filter((achievement) => achievement.category === filter)
  }, [achievements, filter])

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: palette.bg }]}
      edges={['top', 'bottom']}
    >
      <View style={styles.header}>
        <TouchableOpacity
          onPress={handleBack}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={[
            styles.iconButton,
            { backgroundColor: palette.surface, borderColor: palette.border },
          ]}
        >
          <IconSymbol name="chevron.left" size={20} color={iconTint} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: palette.textPrimary }]}>
          Your journey
        </Text>
        <View style={styles.iconButtonPlaceholder} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <SectionHeader title="Activity" />
        <ActivityHeatmap />

        <SectionHeader title="Personal records" />
        {personalRecords === undefined ? null : personalRecords.length === 0 ? (
          <View
            style={[
              styles.placeholder,
              { backgroundColor: palette.surface, borderColor: palette.border },
            ]}
          >
            <IconSymbol
              name="scalemass.fill"
              size={20}
              color={palette.textTertiary}
            />
            <Text
              style={[styles.placeholderText, { color: palette.textSecondary }]}
            >
              Log weights, times, or distances during a session and your best
              numbers per movement will live here.
            </Text>
          </View>
        ) : (
          <View style={styles.timeline}>
            {personalRecords.map((record) => (
              <View
                key={`${record.name}-${record.kind}`}
                style={[
                  styles.recordRow,
                  {
                    backgroundColor: palette.surface,
                    borderColor: palette.border,
                  },
                ]}
              >
                <View
                  style={[
                    styles.milestoneIcon,
                    { backgroundColor: palette.primaryMuted },
                  ]}
                >
                  <IconSymbol
                    name={RECORD_ICON[record.kind]}
                    size={16}
                    color={palette.primary}
                  />
                </View>
                <View style={styles.milestoneText}>
                  <Text
                    style={[
                      styles.milestoneTitle,
                      { color: palette.textPrimary },
                    ]}
                    numberOfLines={1}
                  >
                    {record.name}
                  </Text>
                  <Text
                    style={[
                      styles.milestoneDate,
                      { color: palette.textTertiary },
                    ]}
                  >
                    {formatEarnedDate(record.achievedAt)}
                  </Text>
                </View>
                <Text style={[styles.recordValue, { color: palette.primary }]}>
                  {formatRecordValue(record.kind, record.value, units)}
                </Text>
              </View>
            ))}
          </View>
        )}

        <SectionHeader title="Milestones" />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {FILTERS.map((option) => {
            const active = filter === option.value
            return (
              <TouchableOpacity
                key={option.value}
                onPress={() => {
                  Haptics.selectionAsync()
                  setFilter(option.value)
                }}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`Filter milestones: ${option.label}`}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: active
                      ? palette.primaryMuted
                      : palette.surface,
                    borderColor: active ? palette.primaryBorder : palette.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.filterLabel,
                    { color: active ? palette.primary : palette.textSecondary },
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            )
          })}
        </ScrollView>

        {achievements !== undefined && visible.length === 0 ? (
          <View
            style={[
              styles.placeholder,
              { backgroundColor: palette.surface, borderColor: palette.border },
            ]}
          >
            <IconSymbol name="sparkles" size={20} color={palette.textTertiary} />
            <Text
              style={[styles.placeholderText, { color: palette.textSecondary }]}
            >
              {filter === 'all'
                ? 'Milestones earn themselves as you train: consistency runs, first records, new movement types. Keep going and they’ll appear here.'
                : 'Nothing in this category yet. Keep moving.'}
            </Text>
          </View>
        ) : (
          <View style={styles.timeline}>
            {visible.map((achievement) => (
              <View
                key={achievement._id}
                style={[
                  styles.milestone,
                  {
                    backgroundColor: palette.surface,
                    borderColor: palette.border,
                  },
                ]}
              >
                <View
                  style={[
                    styles.milestoneIcon,
                    { backgroundColor: palette.primaryMuted },
                  ]}
                >
                  <IconSymbol
                    name={CATEGORY_ICON[achievement.category]}
                    size={16}
                    color={palette.primary}
                  />
                </View>
                <View style={styles.milestoneText}>
                  <Text
                    style={[styles.milestoneTitle, { color: palette.textPrimary }]}
                  >
                    {achievement.title}
                  </Text>
                  <Text
                    style={[
                      styles.milestoneSubtitle,
                      { color: palette.textSecondary },
                    ]}
                  >
                    {achievement.description}
                  </Text>
                  <View style={styles.milestoneMeta}>
                    <Text
                      style={[
                        styles.milestoneDate,
                        { color: palette.textTertiary },
                      ]}
                    >
                      {formatEarnedDate(achievement.earnedAt)}
                    </Text>
                    {achievement.isPrivate ? (
                      <View
                        style={[
                          styles.privateBadge,
                          { backgroundColor: palette.surfaceAlt },
                        ]}
                      >
                        <IconSymbol
                          name="lock.fill"
                          size={9}
                          color={palette.textTertiary}
                        />
                        <Text
                          style={[
                            styles.privateLabel,
                            { color: palette.textTertiary },
                          ]}
                        >
                          Only you
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        <SectionHeader title="Dig deeper" />
        <View style={styles.links}>
          <TouchableOpacity
            onPress={() => {
              Haptics.selectionAsync()
              router.push('/history')
            }}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Past workouts"
            style={[
              styles.linkRow,
              { backgroundColor: palette.surface, borderColor: palette.border },
            ]}
          >
            <IconSymbol name="clock.fill" size={18} color={palette.textPrimary} />
            <Text style={[styles.linkLabel, { color: palette.textPrimary }]}>
              Past workouts
            </Text>
            <IconSymbol
              name="chevron.right"
              size={16}
              color={palette.textTertiary}
            />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              Haptics.selectionAsync()
              router.push('/routines')
            }}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Your routines"
            style={[
              styles.linkRow,
              { backgroundColor: palette.surface, borderColor: palette.border },
            ]}
          >
            <IconSymbol
              name="list.bullet"
              size={18}
              color={palette.textPrimary}
            />
            <Text style={[styles.linkLabel, { color: palette.textPrimary }]}>
              Your routines
            </Text>
            <IconSymbol
              name="chevron.right"
              size={16}
              color={palette.textTertiary}
            />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
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
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  iconButtonPlaceholder: {
    width: 40,
    height: 40,
  },
  title: {
    ...typography.h2,
  },
  scrollContent: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxxl,
  },
  filterRow: {
    gap: spacing.sm,
    paddingBottom: spacing.lg,
  },
  filterChip: {
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  filterLabel: {
    ...typography.smallStrong,
    fontSize: 12,
  },
  timeline: {
    gap: spacing.md,
  },
  milestone: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  milestoneIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  milestoneText: {
    flex: 1,
  },
  milestoneTitle: {
    ...typography.bodyStrong,
  },
  milestoneSubtitle: {
    ...typography.small,
    marginTop: 1,
  },
  milestoneMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  milestoneDate: {
    ...typography.caption,
  },
  recordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  recordValue: {
    ...typography.bodyStrong,
  },
  privateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  privateLabel: {
    ...typography.caption,
    fontSize: 10,
  },
  placeholder: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  placeholderText: {
    flex: 1,
    ...typography.small,
  },
  links: {
    gap: spacing.md,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  linkLabel: {
    flex: 1,
    ...typography.bodyStrong,
  },
})
