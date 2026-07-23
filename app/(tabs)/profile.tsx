import { useQuery } from 'convex/react'
import * as Haptics from 'expo-haptics'
import { router, type Href } from 'expo-router'
import React, { useCallback, useState } from 'react'
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { useFloatingTabBarInset } from '@/components/navigation/floating-tab-bar'
import { ActivityHeatmap } from '@/components/profile/activity-heatmap'
import { CurrentFocusCard } from '@/components/profile/current-focus-card'
import { JourneyPreview } from '@/components/profile/journey-preview'
import { PostsPreview } from '@/components/profile/posts-preview'
import { ProfileHeader } from '@/components/profile/profile-header'
import { RecentActivity } from '@/components/profile/recent-activity'
import { RoutinesPreview } from '@/components/profile/routines-preview'
import { EmptyHint, SectionHeader } from '@/components/profile/section'
import { StatsRow } from '@/components/profile/stats-row'
import { StreakSheet } from '@/components/streak/streak-sheet'
import { spacing } from '@/constants/design'
import { useTheme } from '@/constants/theme-context'
import { api } from '@/convex/_generated/api'

/**
 * Profile tab: the progress and identity hub. One aggregate query feeds the
 * overview; the heatmap runs its own month-scoped query.
 */
export default function ProfileScreen() {
  const { palette } = useTheme()
  const tabBarInset = useFloatingTabBarInset()
  // Stable per-mount so the aggregate query stays cacheable.
  const [now] = useState(() => Date.now())
  const overview = useQuery(api.profileSummary.getProfileOverview, { now })
  const [streakSheetOpen, setStreakSheetOpen] = useState(false)

  const handleOpenHistory = useCallback(() => {
    Haptics.selectionAsync()
    router.push('/history' as Href)
  }, [])

  const handleOpenRoutines = useCallback(() => {
    Haptics.selectionAsync()
    router.push('/routines' as Href)
  }, [])

  const handleViewPublicProfile = useCallback(() => {
    if (!overview?.profile) return
    Haptics.selectionAsync()
    router.push({
      pathname: '/u/[username]',
      params: { username: overview.profile.username },
    } as unknown as Href)
  }, [overview?.profile])

  const handleStreakPress = useCallback(() => {
    Haptics.selectionAsync()
    setStreakSheetOpen(true)
  }, [])

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: palette.bg }]}
      edges={['top']}
    >
      {overview === undefined ? (
        <View style={styles.loading}>
          <ActivityIndicator size="small" color={palette.primary} />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: tabBarInset },
          ]}
        >
          <ProfileHeader
            profile={overview.profile}
            fallbackName={overview.name}
          />

          <StatsRow
            stats={overview.stats}
            onStreakPress={handleStreakPress}
          />

          <SectionHeader title="Current focus" />
          <CurrentFocusCard
            focus={overview.currentFocus}
            weeklyGoal={overview.stats.weeklyGoal}
            workoutsThisWeek={overview.stats.workoutsThisWeek}
          />

          <SectionHeader title="Activity" />
          <ActivityHeatmap />

          <SectionHeader title="Journey" />
          <JourneyPreview />

          <SectionHeader
            title="Recent workouts"
            actionLabel="View all"
            onAction={handleOpenHistory}
          />
          {overview.recentWorkouts.length > 0 ? (
            <RecentActivity workouts={overview.recentWorkouts} />
          ) : (
            <EmptyHint text="Completed workouts show up here." />
          )}

          <SectionHeader
            title="Routines"
            actionLabel="See all"
            onAction={handleOpenRoutines}
          />
          {overview.routines.length > 0 ? (
            <RoutinesPreview routines={overview.routines} />
          ) : (
            <EmptyHint text="Save a workout as a routine to repeat it any time." />
          )}

          <SectionHeader
            title="Posts"
            actionLabel={overview.profile ? 'View as others' : undefined}
            onAction={overview.profile ? handleViewPublicProfile : undefined}
          />
          {overview.posts.length > 0 ? (
            <PostsPreview posts={overview.posts} />
          ) : (
            <EmptyHint text="Share a workout to start your feed." />
          )}
        </ScrollView>
      )}

      <StreakSheet
        visible={streakSheetOpen}
        onClose={() => setStreakSheetOpen(false)}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
  },
})
