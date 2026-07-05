import { useMutation, usePaginatedQuery, useQuery } from 'convex/react'
import * as Haptics from 'expo-haptics'
import { router, useLocalSearchParams } from 'expo-router'
import React, { useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
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
  const params = useLocalSearchParams<{ username?: string }>()
  const username = typeof params.username === 'string' ? params.username : ''

  const profile = useQuery(
    api.profiles.getProfilePage,
    username ? { username } : 'skip'
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

  const [listOpen, setListOpen] = useState<'backers' | 'backing' | null>(null)

  const handleBackToggle = () => {
    if (!profile) return
    void Haptics.selectionAsync()
    if (profile.relationship === 'none') {
      backUser({ userId: profile.userId }).catch(() => {})
    } else {
      unbackUser({ userId: profile.userId }).catch(() => {})
    }
  }

  const openMenu = () => {
    if (!profile || profile.isMe) return
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
        {profile && !profile.isMe ? (
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
