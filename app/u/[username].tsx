import { useMutation, usePaginatedQuery, useQuery } from 'convex/react'
import * as Haptics from 'expo-haptics'
import { router, useLocalSearchParams, type Href } from 'expo-router'
import React, { useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { Avatar } from '@/components/social/avatar'
import { PostCard } from '@/components/social/post-card'
import type { FeedPost, ProfileCard } from '@/components/social/types'
import { StreakFlame } from '@/components/streak/streak-flame'
import { IconSymbol } from '@/components/ui/icon-symbol'
import { radius, spacing, typography } from '@/constants/design'
import { useTheme } from '@/constants/theme-context'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'

function PeopleListModal({
  title,
  people,
  onClose,
}: {
  title: string
  people: ProfileCard[]
  onClose: () => void
}) {
  const { palette } = useTheme()
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable
          style={[
            styles.modalSheet,
            { backgroundColor: palette.bgElevated, borderColor: palette.border },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <Text style={[typography.h3, { color: palette.textPrimary }]}>
            {title}
          </Text>
          <FlatList
            data={people}
            keyExtractor={(item) => item.userId}
            ListEmptyComponent={
              <Text
                style={[
                  typography.small,
                  styles.modalEmpty,
                  { color: palette.textTertiary },
                ]}
              >
                No one here yet.
              </Text>
            }
            renderItem={({ item }) => (
              <Pressable
                onPress={() => {
                  onClose()
                  router.push({
                    pathname: '/u/[username]',
                    params: { username: item.username },
                  })
                }}
                style={styles.personRow}
                accessibilityRole="button"
                accessibilityLabel={`View ${item.displayName}`}
              >
                <Avatar url={item.avatarUrl} name={item.displayName} size={40} />
                <View style={styles.personText}>
                  <Text
                    style={[typography.bodyStrong, { color: palette.textPrimary }]}
                    numberOfLines={1}
                  >
                    {item.displayName}
                  </Text>
                  <Text
                    style={[typography.small, { color: palette.textTertiary }]}
                    numberOfLines={1}
                  >
                    @{item.username}
                  </Text>
                </View>
              </Pressable>
            )}
          />
        </Pressable>
      </Pressable>
    </Modal>
  )
}

export default function ProfileScreen() {
  const { palette } = useTheme()
  const params = useLocalSearchParams<{ username?: string; preview?: string }>()
  const username = typeof params.username === 'string' ? params.username : ''
  const preview = params.preview === '1'

  const profile = useQuery(
    api.profiles.getProfilePage,
    username ? { username, previewAsPublic: preview } : 'skip'
  )
  const myProfile = useQuery(api.profiles.getMyProfile)
  const backUser = useMutation(api.profiles.backUser)
  const unbackUser = useMutation(api.profiles.unbackUser)
  const blockUser = useMutation(api.profiles.blockUser)
  const reportContent = useMutation(api.profiles.reportContent)

  const backers = useQuery(
    api.profiles.listBackers,
    profile && profile.canViewPosts ? { userId: profile.userId } : 'skip'
  )
  const backing = useQuery(
    api.profiles.listBacking,
    profile && profile.canViewPosts ? { userId: profile.userId } : 'skip'
  )

  const {
    results: posts,
    status,
    loadMore,
  } = usePaginatedQuery(
    api.social.getUserPosts,
    profile && profile.canViewPosts ? { userId: profile.userId } : 'skip',
    { initialNumItems: 8 }
  )

  const achievements = useQuery(
    api.achievements.listForProfile,
    profile && profile.canViewPosts
      ? { username, previewAsPublic: preview }
      : 'skip'
  )
  const sharedRoutines = useQuery(
    api.routines.listSharedRoutines,
    profile && profile.canViewPosts
      ? { username, previewAsPublic: preview }
      : 'skip'
  )
  const startSessionFromRoutine = useMutation(
    api.routines.startSessionFromRoutine
  )

  const [listOpen, setListOpen] = useState<'backers' | 'backing' | null>(null)
  const [startingRoutineId, setStartingRoutineId] = useState<string | null>(
    null
  )

  const handleTryRoutine = (
    routineId: Id<'workout_routines'>,
    name: string
  ) => {
    if (preview || startingRoutineId) return
    void Haptics.selectionAsync()
    Alert.alert('Try this routine', `Start "${name}" as your own session?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Start',
        onPress: () => {
          setStartingRoutineId(String(routineId))
          startSessionFromRoutine({ routineId })
            .then((sessionId) => {
              router.push({
                pathname: '/session',
                params: { sessionId: String(sessionId) },
              } as unknown as Href)
            })
            .catch(() => {
              Alert.alert(
                'Not available',
                'This routine is no longer shared.'
              )
            })
            .finally(() => setStartingRoutineId(null))
        },
      },
    ])
  }

  const handleBackToggle = () => {
    if (!profile || preview) return
    void Haptics.selectionAsync()
    if (profile.relationship === 'none') {
      backUser({ userId: profile.userId }).catch(() => {})
    } else {
      unbackUser({ userId: profile.userId }).catch(() => {})
    }
  }

  const openMenu = () => {
    if (!profile || profile.isMe || preview) return
    Alert.alert(`@${profile.username}`, undefined, [
      {
        text: 'Report profile',
        onPress: () => {
          reportContent({
            targetType: 'profile',
            targetId: profile.userId,
            reason: 'inappropriate',
          })
            .then(() => Alert.alert('Reported', 'Thanks, we will review it.'))
            .catch(() => {})
        },
      },
      {
        text: 'Block',
        style: 'destructive',
        onPress: () => {
          blockUser({ userId: profile.userId })
            .then(() => router.back())
            .catch(() => {})
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ])
  }

  const backLabel =
    profile?.relationship === 'active'
      ? 'Backing'
      : profile?.relationship === 'pending'
        ? 'Requested'
        : 'Back'

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: palette.bg }]}
      edges={['top']}
    >
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <IconSymbol name="chevron.left" size={22} color={palette.textPrimary} />
        </Pressable>
        <Text
          style={[typography.h3, { color: palette.textPrimary }]}
          numberOfLines={1}
        >
          @{username}
        </Text>
        {profile && !profile.isMe && !preview ? (
          <Pressable
            onPress={openMenu}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Profile options"
          >
            <IconSymbol name="ellipsis" size={20} color={palette.textPrimary} />
          </Pressable>
        ) : (
          <View style={{ width: 22 }} />
        )}
      </View>

      {preview ? (
        <View
          style={[styles.previewBanner, { backgroundColor: palette.surfaceAlt }]}
        >
          <IconSymbol name="eye" size={14} color={palette.textSecondary} />
          <Text style={[typography.small, { color: palette.textSecondary }]}>
            This is how others see your profile
          </Text>
        </View>
      ) : null}

      {profile === undefined ? (
        <View style={styles.centered}>
          <ActivityIndicator size="small" color={palette.primary} />
        </View>
      ) : profile === null ? (
        <View style={styles.centered}>
          <Text style={[typography.body, { color: palette.textSecondary }]}>
            This profile is not available.
          </Text>
        </View>
      ) : (
        <FlatList
          data={(profile.canViewPosts ? posts : []) as FeedPost[]}
          keyExtractor={(item) => String(item._id)}
          renderItem={({ item }) => (
            <View style={styles.postWrap}>
              <PostCard post={item} myUserId={myProfile?.userId ?? null} />
            </View>
          )}
          ListHeaderComponent={
            <View style={styles.hero}>
              <Avatar
                url={profile.avatarUrl}
                name={profile.displayName}
                size={84}
              />
              <View style={styles.nameRow}>
                <Text style={[typography.h2, { color: palette.textPrimary }]}>
                  {profile.displayName}
                </Text>
                {profile.streakWeeks > 0 ? (
                  <StreakFlame weeks={profile.streakWeeks} size="md" />
                ) : null}
              </View>
              {profile.backsMe ? (
                <View
                  style={[
                    styles.backsYou,
                    { backgroundColor: palette.successMuted },
                  ]}
                >
                  <Text
                    style={[typography.caption, { color: palette.success }]}
                  >
                    BACKS YOU
                  </Text>
                </View>
              ) : null}
              {profile.bio ? (
                <Text
                  style={[
                    typography.body,
                    styles.bio,
                    { color: palette.textSecondary },
                  ]}
                >
                  {profile.bio}
                </Text>
              ) : null}

              <View style={styles.statsRow}>
                <View style={styles.stat}>
                  <Text style={[typography.h3, { color: palette.textPrimary }]}>
                    {profile.postCount}
                  </Text>
                  <Text
                    style={[typography.small, { color: palette.textTertiary }]}
                  >
                    Workouts
                  </Text>
                </View>
                <Pressable
                  style={styles.stat}
                  onPress={() => profile.canViewPosts && setListOpen('backers')}
                  accessibilityRole="button"
                  accessibilityLabel="See backers"
                >
                  <Text style={[typography.h3, { color: palette.textPrimary }]}>
                    {profile.backerCount}
                  </Text>
                  <Text
                    style={[typography.small, { color: palette.textTertiary }]}
                  >
                    Backers
                  </Text>
                </Pressable>
                <Pressable
                  style={styles.stat}
                  onPress={() => profile.canViewPosts && setListOpen('backing')}
                  accessibilityRole="button"
                  accessibilityLabel="See who they back"
                >
                  <Text style={[typography.h3, { color: palette.textPrimary }]}>
                    {profile.backingCount}
                  </Text>
                  <Text
                    style={[typography.small, { color: palette.textTertiary }]}
                  >
                    Backing
                  </Text>
                </Pressable>
              </View>

              {profile.isMe ? (
                <Pressable
                  onPress={() => router.push('/social/edit-profile')}
                  style={[
                    styles.actionButton,
                    {
                      backgroundColor: palette.surface,
                      borderColor: palette.border,
                      borderWidth: 1,
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Edit profile"
                >
                  <Text
                    style={[typography.bodyStrong, { color: palette.textPrimary }]}
                  >
                    Edit profile
                  </Text>
                </Pressable>
              ) : (
                <Pressable
                  onPress={handleBackToggle}
                  style={[
                    styles.actionButton,
                    {
                      backgroundColor:
                        profile.relationship === 'none'
                          ? palette.primary
                          : palette.surface,
                      borderColor: palette.border,
                      borderWidth: profile.relationship === 'none' ? 0 : 1,
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={backLabel}
                >
                  <Text
                    style={[
                      typography.bodyStrong,
                      {
                        color:
                          profile.relationship === 'none'
                            ? '#FFFFFF'
                            : palette.textPrimary,
                      },
                    ]}
                  >
                    {backLabel}
                  </Text>
                </Pressable>
              )}

              {profile.publicProgress ? (
                <View
                  style={[
                    styles.progressCard,
                    {
                      backgroundColor: palette.surface,
                      borderColor: palette.border,
                    },
                  ]}
                >
                  <View style={styles.progressStat}>
                    <Text
                      style={[typography.h3, { color: palette.textPrimary }]}
                    >
                      {profile.publicProgress.workoutsThisWeek}/
                      {profile.publicProgress.weeklyGoal}
                    </Text>
                    <Text
                      style={[typography.small, { color: palette.textTertiary }]}
                    >
                      This week
                    </Text>
                  </View>
                  <View style={styles.progressStat}>
                    <Text
                      style={[typography.h3, { color: palette.textPrimary }]}
                    >
                      {profile.publicProgress.streakWeeks}
                    </Text>
                    <Text
                      style={[typography.small, { color: palette.textTertiary }]}
                    >
                      Week streak
                    </Text>
                  </View>
                </View>
              ) : null}

              {achievements && achievements.length > 0 ? (
                <View style={styles.sectionBlock}>
                  <Text
                    style={[styles.sectionLabel, { color: palette.textTertiary }]}
                  >
                    ACHIEVEMENTS
                  </Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.achievementRow}
                  >
                    {achievements.map((achievement) => (
                      <View
                        key={achievement._id}
                        style={[
                          styles.achievementChip,
                          {
                            backgroundColor: palette.surface,
                            borderColor: palette.border,
                          },
                        ]}
                      >
                        <IconSymbol
                          name="trophy.fill"
                          size={14}
                          color={palette.primary}
                        />
                        <Text
                          style={[
                            typography.smallStrong,
                            { color: palette.textPrimary },
                          ]}
                          numberOfLines={1}
                        >
                          {achievement.title}
                        </Text>
                      </View>
                    ))}
                  </ScrollView>
                </View>
              ) : null}

              {sharedRoutines && sharedRoutines.length > 0 ? (
                <View style={styles.sectionBlock}>
                  <Text
                    style={[styles.sectionLabel, { color: palette.textTertiary }]}
                  >
                    SHARED ROUTINES
                  </Text>
                  {sharedRoutines.map((routine) => (
                    <View
                      key={routine._id}
                      style={[
                        styles.routineCard,
                        {
                          backgroundColor: palette.surface,
                          borderColor: palette.border,
                        },
                      ]}
                    >
                      <View style={styles.routineText}>
                        <Text
                          style={[
                            typography.bodyStrong,
                            { color: palette.textPrimary },
                          ]}
                          numberOfLines={1}
                        >
                          {routine.name}
                        </Text>
                        <Text
                          style={[
                            typography.small,
                            { color: palette.textSecondary },
                          ]}
                          numberOfLines={1}
                        >
                          {routine.modality} {'\u00b7'} {routine.exerciseCount}{' '}
                          {routine.exerciseCount === 1 ? 'move' : 'moves'}{' '}
                          {'\u00b7'} {routine.durationMin} min
                        </Text>
                        {routine.exercises.length > 0 ? (
                          <Text
                            style={[
                              typography.small,
                              { color: palette.textTertiary },
                            ]}
                            numberOfLines={2}
                          >
                            {routine.exercises.join(' · ')}
                          </Text>
                        ) : null}
                      </View>
                      {!profile.isMe && !preview ? (
                        <Pressable
                          onPress={() =>
                            handleTryRoutine(routine._id, routine.name)
                          }
                          disabled={startingRoutineId !== null}
                          style={[
                            styles.tryButton,
                            { backgroundColor: palette.primaryMuted },
                          ]}
                          accessibilityRole="button"
                          accessibilityLabel={`Try ${routine.name}`}
                        >
                          {startingRoutineId === String(routine._id) ? (
                            <ActivityIndicator
                              size="small"
                              color={palette.primary}
                            />
                          ) : (
                            <Text
                              style={[
                                typography.smallStrong,
                                { color: palette.primary },
                              ]}
                            >
                              Try
                            </Text>
                          )}
                        </Pressable>
                      ) : null}
                    </View>
                  ))}
                </View>
              ) : null}

              {!profile.canViewPosts ? (
                <View
                  style={[
                    styles.privateCard,
                    {
                      backgroundColor: palette.surface,
                      borderColor: palette.border,
                    },
                  ]}
                >
                  <IconSymbol
                    name="lock.fill"
                    size={22}
                    color={palette.textTertiary}
                  />
                  <Text
                    style={[typography.bodyStrong, { color: palette.textPrimary }]}
                  >
                    This account is private
                  </Text>
                  <Text
                    style={[
                      typography.small,
                      styles.privateBody,
                      { color: palette.textSecondary },
                    ]}
                  >
                    Back them to see their workouts once they accept.
                  </Text>
                </View>
              ) : null}

              {profile.canViewPosts ? (
                <Text
                  style={[styles.postsLabel, { color: palette.textTertiary }]}
                >
                  WORKOUTS
                </Text>
              ) : null}
            </View>
          }
          ListEmptyComponent={
            profile.canViewPosts && status !== 'LoadingFirstPage' ? (
              <Text
                style={[
                  typography.small,
                  styles.emptyPosts,
                  { color: palette.textTertiary },
                ]}
              >
                No shared workouts yet.
              </Text>
            ) : null
          }
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          onEndReachedThreshold={0.5}
          onEndReached={() => {
            if (status === 'CanLoadMore') loadMore(8)
          }}
        />
      )}

      {listOpen ? (
        <PeopleListModal
          title={listOpen === 'backers' ? 'Backers' : 'Backing'}
          people={((listOpen === 'backers' ? backers : backing) ??
            []) as ProfileCard[]}
          onClose={() => setListOpen(null)}
        />
      ) : null}
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
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  hero: {
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  backsYou: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 3,
  },
  bio: {
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.xxxl,
    marginTop: spacing.sm,
  },
  stat: {
    alignItems: 'center',
  },
  actionButton: {
    alignSelf: 'stretch',
    alignItems: 'center',
    borderRadius: radius.pill,
    paddingVertical: 12,
    marginTop: spacing.md,
  },
  previewBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.xl,
    marginBottom: spacing.sm,
    borderRadius: radius.pill,
    paddingVertical: spacing.sm,
  },
  progressCard: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderRadius: radius.xl,
    borderWidth: 1,
    paddingVertical: spacing.lg,
    marginTop: spacing.lg,
  },
  progressStat: {
    alignItems: 'center',
  },
  privateCard: {
    alignSelf: 'stretch',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: spacing.xxl,
    marginTop: spacing.lg,
  },
  privateBody: {
    textAlign: 'center',
  },
  postsLabel: {
    ...typography.caption,
    alignSelf: 'flex-start',
    marginTop: spacing.xl,
  },
  sectionBlock: {
    alignSelf: 'stretch',
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
  sectionLabel: {
    ...typography.caption,
  },
  achievementRow: {
    gap: spacing.sm,
  },
  achievementChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    maxWidth: 220,
  },
  routineCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.lg,
  },
  routineText: {
    flex: 1,
    gap: 2,
  },
  tryButton: {
    minWidth: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  listContent: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.huge,
  },
  postWrap: {
    marginBottom: spacing.lg,
  },
  emptyPosts: {
    textAlign: 'center',
    marginTop: spacing.md,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    maxHeight: '70%',
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    borderWidth: 1,
    padding: spacing.xl,
    gap: spacing.md,
  },
  modalEmpty: {
    marginTop: spacing.md,
  },
  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  personText: {
    flex: 1,
  },
})
