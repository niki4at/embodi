import { useMutation, usePaginatedQuery, useQuery } from 'convex/react'
import * as Haptics from 'expo-haptics'
import { router } from 'expo-router'
import React, { useCallback, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'

import { useFloatingTabBarInset } from '@/components/navigation/floating-tab-bar'
import { Avatar } from '@/components/social/avatar'
import { PostCard } from '@/components/social/post-card'
import type { FeedPost } from '@/components/social/types'
import { StreakFlame } from '@/components/streak/streak-flame'
import { IconSymbol } from '@/components/ui/icon-symbol'
import { motion, radius, spacing, typography } from '@/constants/design'
import { useTheme } from '@/constants/theme-context'
import { api } from '@/convex/_generated/api'

function LeaderboardStrip({ now }: { now: number }) {
  const { palette } = useTheme()
  const leaderboard = useQuery(api.social.getWeeklyLeaderboard, { now })

  if (!leaderboard || leaderboard.entries.length < 2) return null

  return (
    <View style={styles.stripSection}>
      <View style={styles.stripHeader}>
        <Text style={[styles.stripLabel, { color: palette.textTertiary }]}>
          THIS WEEK{'\u2019'}S LEADERBOARD
        </Text>
        <Text style={[typography.small, { color: palette.textTertiary }]}>
          Resets Monday
        </Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.discoverRow}
      >
        {leaderboard.entries.map((entry) => (
          <Pressable
            key={entry.userId}
            onPress={() => {
              if (entry.isMe) return
              router.push({
                pathname: '/u/[username]',
                params: { username: entry.username },
              })
            }}
            style={[
              styles.leaderCard,
              {
                backgroundColor: entry.isMe
                  ? palette.primaryMuted
                  : palette.surface,
                borderColor: entry.isMe ? palette.primaryBorder : palette.border,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel={
              entry.isMe ? 'You' : `View ${entry.displayName}`
            }
          >
            <View style={styles.leaderAvatarWrap}>
              <Avatar
                url={entry.avatarUrl}
                name={entry.displayName}
                size={44}
              />
              <View
                style={[
                  styles.leaderRankBadge,
                  {
                    backgroundColor:
                      entry.rank === 1 ? '#FFB300' : palette.textPrimary,
                  },
                ]}
              >
                <Text style={styles.leaderRankText}>{entry.rank}</Text>
              </View>
            </View>
            <Text
              style={[typography.smallStrong, { color: palette.textPrimary }]}
              numberOfLines={1}
            >
              {entry.isMe ? 'You' : entry.displayName}
            </Text>
            <Text
              style={[typography.small, { color: palette.textSecondary }]}
              numberOfLines={1}
            >
              {entry.workoutsThisWeek} workout
              {entry.workoutsThisWeek === 1 ? '' : 's'}
            </Text>
            {entry.streakWeeks > 0 ? (
              <StreakFlame weeks={entry.streakWeeks} size="sm" />
            ) : null}
          </Pressable>
        ))}
      </ScrollView>
    </View>
  )
}

function TrendingStrip() {
  const { palette } = useTheme()
  const trending = useQuery(api.trending.getTrending)

  if (!trending || trending.entries.length === 0) return null

  return (
    <View style={styles.stripSection}>
      <View style={styles.stripHeader}>
        <Text style={[styles.stripLabel, { color: palette.textTertiary }]}>
          TRENDING THIS WEEK
        </Text>
        <IconSymbol name="flame.fill" size={13} color={palette.primary} />
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.discoverRow}
      >
        {trending.entries.map((entry) => (
          <Pressable
            key={String(entry.postId)}
            onPress={() =>
              router.push({
                pathname: '/post/[id]',
                params: { id: String(entry.postId) },
              })
            }
            style={[
              styles.trendingCard,
              { backgroundColor: palette.surface, borderColor: palette.border },
            ]}
            accessibilityRole="button"
            accessibilityLabel={`Open trending workout ${entry.title}`}
          >
            <View style={styles.trendingTopRow}>
              <View
                style={[
                  styles.trendingRank,
                  {
                    backgroundColor:
                      entry.rank === 1 ? '#FFB300' : palette.surfaceAlt,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.trendingRankText,
                    {
                      color: entry.rank === 1 ? '#FFFFFF' : palette.textSecondary,
                    },
                  ]}
                >
                  #{entry.rank}
                </Text>
              </View>
              <Text
                style={[typography.small, { color: palette.textTertiary }]}
                numberOfLines={1}
              >
                {entry.modality}
              </Text>
            </View>
            <Text
              style={[typography.smallStrong, { color: palette.textPrimary }]}
              numberOfLines={2}
            >
              {entry.title}
            </Text>
            <View style={styles.trendingFooter}>
              <Avatar
                url={entry.authorAvatarUrl}
                name={entry.authorDisplayName}
                size={18}
              />
              <Text
                style={[typography.small, { color: palette.textSecondary }]}
                numberOfLines={1}
              >
                {entry.triedCount} tried
              </Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  )
}

function DiscoverStrip() {
  const { palette } = useTheme()
  const discover = useQuery(api.discover.getDiscover)
  const backUser = useMutation(api.profiles.backUser)

  if (
    !discover ||
    (discover.suggestedProfiles.length === 0 &&
      discover.trendingCommunities.length === 0)
  ) {
    return null
  }

  return (
    <View style={styles.discoverSection}>
      {discover.suggestedProfiles.length > 0 ? (
        <>
          <Text style={[styles.discoverLabel, { color: palette.textTertiary }]}>
            PEOPLE TO BACK
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.discoverRow}
          >
            {discover.suggestedProfiles.map((person) => (
              <View
                key={person.userId}
                style={[
                  styles.personCard,
                  {
                    backgroundColor: palette.surface,
                    borderColor: palette.border,
                  },
                ]}
              >
                <Pressable
                  onPress={() =>
                    router.push({
                      pathname: '/u/[username]',
                      params: { username: person.username },
                    })
                  }
                  style={styles.personTap}
                  accessibilityRole="button"
                  accessibilityLabel={`View ${person.displayName}`}
                >
                  <Avatar
                    url={person.avatarUrl}
                    name={person.displayName}
                    size={48}
                  />
                  <Text
                    style={[
                      typography.smallStrong,
                      { color: palette.textPrimary },
                    ]}
                    numberOfLines={1}
                  >
                    {person.displayName}
                  </Text>
                  <Text
                    style={[typography.small, { color: palette.textTertiary }]}
                    numberOfLines={1}
                  >
                    @{person.username}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    void Haptics.selectionAsync()
                    backUser({ userId: person.userId }).catch(() => {})
                  }}
                  style={[
                    styles.backButton,
                    { backgroundColor: palette.primary },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={`Back ${person.displayName}`}
                >
                  <Text style={[typography.smallStrong, { color: '#FFFFFF' }]}>
                    Back
                  </Text>
                </Pressable>
              </View>
            ))}
          </ScrollView>
        </>
      ) : null}

      {discover.trendingCommunities.length > 0 ? (
        <>
          <Text style={[styles.discoverLabel, { color: palette.textTertiary }]}>
            COMMUNITIES ON THE MOVE
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.discoverRow}
          >
            {discover.trendingCommunities.map((community) => (
              <Pressable
                key={String(community.communityId)}
                onPress={() =>
                  router.push({
                    pathname: '/community/[id]',
                    params: { id: String(community.communityId) },
                  })
                }
                style={[
                  styles.communityCard,
                  {
                    backgroundColor: palette.surface,
                    borderColor: palette.border,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel={`Open community ${community.name}`}
              >
                <View
                  style={[
                    styles.communityIcon,
                    { backgroundColor: palette.primaryMuted },
                  ]}
                >
                  <IconSymbol
                    name="flag.fill"
                    size={16}
                    color={palette.primary}
                  />
                </View>
                <Text
                  style={[
                    typography.smallStrong,
                    { color: palette.textPrimary },
                  ]}
                  numberOfLines={1}
                >
                  {community.name}
                </Text>
                <Text
                  style={[typography.small, { color: palette.textTertiary }]}
                  numberOfLines={1}
                >
                  {community.memberCount} member
                  {community.memberCount === 1 ? '' : 's'}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </>
      ) : null}
    </View>
  )
}

export default function SocialScreen() {
  const { palette } = useTheme()
  const tabBarInset = useFloatingTabBarInset()

  // Stable per-mount so the leaderboard query stays cacheable.
  const [now] = useState(() => Date.now())

  const myProfile = useQuery(api.profiles.getMyProfile)
  const unreadCount = useQuery(api.notifications.getUnreadCount) ?? 0
  const {
    results: posts,
    status,
    loadMore,
  } = usePaginatedQuery(api.social.getFeed, {}, { initialNumItems: 10 })

  const renderPost = useCallback(
    ({ item, index }: { item: FeedPost; index: number }) => (
      <Animated.View
        entering={FadeInDown.duration(motion.duration.base).delay(
          Math.min(index, 5) * 40
        )}
        style={styles.postWrap}
      >
        <PostCard post={item} myUserId={myProfile?.userId ?? null} />
      </Animated.View>
    ),
    [myProfile?.userId]
  )

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: palette.bg }]}
      edges={['top']}
    >
      <Animated.View
        entering={FadeInUp.duration(motion.duration.base)}
        style={styles.header}
      >
        <View>
          <Text style={[styles.title, { color: palette.textPrimary }]}>
            Social
          </Text>
          <Text style={[styles.subtitle, { color: palette.textSecondary }]}>
            Train together, stay accountable
          </Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable
            onPress={() => router.push('/social/search')}
            style={[styles.headerButton, { backgroundColor: palette.surface }]}
            accessibilityRole="button"
            accessibilityLabel="Search people"
          >
            <IconSymbol
              name="magnifyingglass"
              size={19}
              color={palette.textPrimary}
            />
          </Pressable>
          <Pressable
            onPress={() => router.push('/social/notifications')}
            style={[styles.headerButton, { backgroundColor: palette.surface }]}
            accessibilityRole="button"
            accessibilityLabel="Notifications"
          >
            <IconSymbol name="bell.fill" size={19} color={palette.textPrimary} />
            {unreadCount > 0 ? (
              <View style={[styles.badge, { backgroundColor: palette.primary }]}>
                <Text style={styles.badgeText}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </Text>
              </View>
            ) : null}
          </Pressable>
        </View>
      </Animated.View>

      {status === 'LoadingFirstPage' ? (
        <View style={styles.centered}>
          <ActivityIndicator size="small" color={palette.primary} />
        </View>
      ) : (
        <FlatList
          data={posts as FeedPost[]}
          keyExtractor={(item) => String(item._id)}
          renderItem={renderPost}
          ListHeaderComponent={
            <>
              <LeaderboardStrip now={now} />
              <TrendingStrip />
              <DiscoverStrip />
            </>
          }
          ListEmptyComponent={
            <View
              style={[
                styles.emptyCard,
                {
                  backgroundColor: palette.surface,
                  borderColor: palette.border,
                },
              ]}
            >
              <View
                style={[
                  styles.emptyIcon,
                  { backgroundColor: palette.primaryMuted },
                ]}
              >
                <IconSymbol
                  name="person.2.fill"
                  size={28}
                  color={palette.primary}
                />
              </View>
              <Text style={[typography.h3, { color: palette.textPrimary }]}>
                Your feed starts here
              </Text>
              <Text
                style={[
                  typography.small,
                  styles.emptyBody,
                  { color: palette.textSecondary },
                ]}
              >
                Back your friends to see their workouts, and share your next
                session so they can cheer you on.
              </Text>
              <Pressable
                onPress={() => router.push('/social/search')}
                style={[styles.emptyCta, { backgroundColor: palette.primary }]}
                accessibilityRole="button"
                accessibilityLabel="Find people"
              >
                <Text style={[typography.bodyStrong, { color: '#FFFFFF' }]}>
                  Find people
                </Text>
              </Pressable>
            </View>
          }
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: tabBarInset + spacing.xl },
          ]}
          showsVerticalScrollIndicator={false}
          onEndReachedThreshold={0.6}
          onEndReached={() => {
            if (status === 'CanLoadMore') loadMore(10)
          }}
          ListFooterComponent={
            status === 'LoadingMore' ? (
              <ActivityIndicator
                size="small"
                color={palette.primary}
                style={styles.footerSpinner}
              />
            ) : null
          }
        />
      )}
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
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
  },
  title: {
    ...typography.h1,
  },
  subtitle: {
    ...typography.small,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    ...typography.caption,
    fontSize: 10,
    lineHeight: 12,
    color: '#FFFFFF',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingHorizontal: spacing.xl,
  },
  postWrap: {
    marginBottom: spacing.lg,
  },
  discoverSection: {
    marginBottom: spacing.lg,
  },
  stripSection: {
    marginBottom: spacing.sm,
  },
  stripLabel: {
    ...typography.caption,
  },
  stripHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  leaderCard: {
    width: 108,
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: spacing.md,
    alignItems: 'center',
    gap: 3,
  },
  leaderAvatarWrap: {
    marginBottom: spacing.xs,
  },
  leaderRankBadge: {
    position: 'absolute',
    bottom: -4,
    right: -6,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  leaderRankText: {
    ...typography.caption,
    fontSize: 10,
    lineHeight: 12,
    color: '#FFFFFF',
  },
  trendingCard: {
    width: 172,
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.xs,
  },
  trendingTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  trendingRank: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  trendingRankText: {
    ...typography.caption,
    fontSize: 10,
    lineHeight: 13,
  },
  trendingFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: 2,
  },
  discoverLabel: {
    ...typography.caption,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  discoverRow: {
    gap: spacing.md,
    paddingBottom: spacing.sm,
  },
  personCard: {
    width: 132,
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: spacing.md,
    alignItems: 'center',
    gap: spacing.xs,
  },
  personTap: {
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'stretch',
  },
  backButton: {
    alignSelf: 'stretch',
    alignItems: 'center',
    borderRadius: radius.pill,
    paddingVertical: 7,
    marginTop: spacing.xs,
  },
  communityCard: {
    width: 168,
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.xs,
  },
  communityIcon: {
    width: 30,
    height: 30,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  emptyCard: {
    alignItems: 'center',
    padding: spacing.xxl,
    borderRadius: radius.xl,
    borderWidth: 1,
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  emptyBody: {
    textAlign: 'center',
  },
  emptyCta: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.xxl,
    paddingVertical: 12,
    marginTop: spacing.sm,
  },
  footerSpinner: {
    marginVertical: spacing.lg,
  },
})
