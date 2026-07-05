import { useMutation, usePaginatedQuery, useQuery } from 'convex/react'
import * as Haptics from 'expo-haptics'
import { router } from 'expo-router'
import React, { useEffect, useRef } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { Avatar } from '@/components/social/avatar'
import type { ProfileCard } from '@/components/social/types'
import { IconSymbol } from '@/components/ui/icon-symbol'
import { radius, spacing, typography } from '@/constants/design'
import { useTheme } from '@/constants/theme-context'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import { timeAgo } from '@/utils/timeAgo'

type NotificationRow = {
  _id: Id<'notifications'>
  type: string
  message: string
  read: boolean
  createdAt: number
  postId: string | null
  communityId: string | null
  actor: ProfileCard | null
}

function iconForType(
  type: string
): React.ComponentProps<typeof IconSymbol>['name'] {
  switch (type) {
    case 'cheer':
      return 'hands.clap.fill'
    case 'comment':
      return 'bubble.left.fill'
    case 'repost':
      return 'arrow.2.squarepath'
    case 'new_backer':
    case 'back_request':
    case 'back_accepted':
      return 'person.badge.plus'
    case 'community_invite':
    case 'community_milestone':
      return 'person.2.fill'
    case 'workout_tried':
      return 'figure.run'
    default:
      return 'bell.fill'
  }
}

export default function NotificationsScreen() {
  const { palette } = useTheme()

  const backRequests = useQuery(api.profiles.listBackRequests)
  const respond = useMutation(api.profiles.respondToBackRequest)
  const markAllRead = useMutation(api.notifications.markAllRead)

  const {
    results: notifications,
    status,
    loadMore,
  } = usePaginatedQuery(api.notifications.listNotifications, {}, {
    initialNumItems: 25,
  })

  // Viewing the inbox clears the badge (once per visit).
  const markedRef = useRef(false)
  useEffect(() => {
    if (markedRef.current) return
    markedRef.current = true
    markAllRead({}).catch(() => {})
  }, [markAllRead])

  const openNotification = (item: NotificationRow) => {
    void Haptics.selectionAsync()
    if (item.postId) {
      if (item.type === 'comment') {
        router.push({
          pathname: '/post/[id]/comments',
          params: { id: item.postId },
        })
      } else {
        router.push({ pathname: '/post/[id]', params: { id: item.postId } })
      }
    } else if (item.communityId) {
      router.push({
        pathname: '/community/[id]',
        params: { id: item.communityId },
      })
    } else if (item.actor) {
      router.push({
        pathname: '/u/[username]',
        params: { username: item.actor.username },
      })
    }
  }

  const renderItem = ({ item }: { item: NotificationRow }) => (
    <Pressable
      onPress={() => openNotification(item)}
      style={[
        styles.row,
        !item.read && { backgroundColor: palette.primaryMuted },
      ]}
      accessibilityRole="button"
      accessibilityLabel={item.message}
    >
      {item.actor ? (
        <Avatar
          url={item.actor.avatarUrl}
          name={item.actor.displayName}
          size={40}
        />
      ) : (
        <View style={[styles.iconWrap, { backgroundColor: palette.surfaceAlt }]}>
          <IconSymbol
            name={iconForType(item.type)}
            size={17}
            color={palette.textSecondary}
          />
        </View>
      )}
      <View style={styles.rowBody}>
        <Text style={[typography.body, { color: palette.textPrimary }]}>
          {item.message}
        </Text>
        <Text style={[typography.small, { color: palette.textTertiary }]}>
          {timeAgo(item.createdAt)}
        </Text>
      </View>
      <IconSymbol
        name={iconForType(item.type)}
        size={15}
        color={palette.textTertiary}
      />
    </Pressable>
  )

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
        <Text style={[typography.h3, { color: palette.textPrimary }]}>
          Notifications
        </Text>
        <View style={{ width: 22 }} />
      </View>

      <FlatList
        data={notifications as NotificationRow[]}
        keyExtractor={(item) => String(item._id)}
        renderItem={renderItem}
        ListHeaderComponent={
          backRequests && backRequests.length > 0 ? (
            <View style={styles.requestsSection}>
              <Text
                style={[typography.caption, { color: palette.textTertiary }]}
              >
                BACK REQUESTS
              </Text>
              {(backRequests as ProfileCard[]).map((person) => (
                <View key={person.userId} style={styles.requestRow}>
                  <Pressable
                    onPress={() =>
                      router.push({
                        pathname: '/u/[username]',
                        params: { username: person.username },
                      })
                    }
                    style={styles.requestPerson}
                    accessibilityRole="button"
                    accessibilityLabel={`View ${person.displayName}`}
                  >
                    <Avatar
                      url={person.avatarUrl}
                      name={person.displayName}
                      size={40}
                    />
                    <View style={styles.requestText}>
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
                        @{person.username} wants to back you
                      </Text>
                    </View>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      void Haptics.selectionAsync()
                      respond({
                        followerId: person.userId,
                        accept: true,
                      }).catch(() => {})
                    }}
                    style={[
                      styles.requestButton,
                      { backgroundColor: palette.primary },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`Accept ${person.displayName}`}
                  >
                    <IconSymbol name="checkmark" size={15} color="#FFFFFF" />
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      void Haptics.selectionAsync()
                      respond({
                        followerId: person.userId,
                        accept: false,
                      }).catch(() => {})
                    }}
                    style={[
                      styles.requestButton,
                      { backgroundColor: palette.surfaceAlt },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`Decline ${person.displayName}`}
                  >
                    <IconSymbol
                      name="xmark"
                      size={14}
                      color={palette.textSecondary}
                    />
                  </Pressable>
                </View>
              ))}
            </View>
          ) : null
        }
        ListEmptyComponent={
          status === 'LoadingFirstPage' ? (
            <ActivityIndicator
              size="small"
              color={palette.primary}
              style={styles.spinner}
            />
          ) : (
            <View style={styles.emptyState}>
              <IconSymbol name="bell.fill" size={30} color={palette.textMuted} />
              <Text style={[typography.body, { color: palette.textSecondary }]}>
                Nothing yet. Share a workout to get some cheers.
              </Text>
            </View>
          )
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (status === 'CanLoadMore') loadMore(25)
        }}
      />
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
  },
  listContent: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.huge,
  },
  requestsSection: {
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  requestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  requestPerson: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  requestText: {
    flex: 1,
  },
  requestButton: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginHorizontal: -spacing.md,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: {
    flex: 1,
    gap: 1,
  },
  spinner: {
    marginTop: spacing.huge,
  },
  emptyState: {
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.huge,
  },
})
