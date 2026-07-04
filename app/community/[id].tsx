import { useMutation, useQuery } from 'convex/react'
import * as Haptics from 'expo-haptics'
import { LinearGradient } from 'expo-linear-gradient'
import { router, useLocalSearchParams } from 'expo-router'
import React, { useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { Avatar } from '@/components/social/avatar'
import { IconSymbol } from '@/components/ui/icon-symbol'
import { radius, spacing, typography } from '@/constants/design'
import { useTheme } from '@/constants/theme-context'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import { daysUntil, timeAgo } from '@/utils/timeAgo'

export default function CommunityDetailScreen() {
  const { palette } = useTheme()
  const params = useLocalSearchParams<{ id?: string }>()
  const communityId =
    typeof params.id === 'string' ? (params.id as Id<'communities'>) : undefined

  const community = useQuery(
    api.communities.getCommunityDetail,
    communityId ? { communityId } : 'skip'
  )
  const joinCommunity = useMutation(api.communities.joinCommunity)
  const leaveCommunity = useMutation(api.communities.leaveCommunity)
  const logProgress = useMutation(api.communities.logCommunityProgress)

  const [joining, setJoining] = useState(false)
  const [logValue, setLogValue] = useState('')

  const handleJoin = async () => {
    if (!communityId || joining) return
    setJoining(true)
    try {
      await joinCommunity({ communityId })
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    } catch (error) {
      Alert.alert(
        'Could not join',
        error instanceof Error
          ? error.message.replace(/^.*Error: /, '')
          : 'Try again.'
      )
    } finally {
      setJoining(false)
    }
  }

  const handleLeave = () => {
    if (!communityId) return
    Alert.alert(
      'Leave community?',
      'Your progress in this community will be removed.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: () => {
            leaveCommunity({ communityId })
              .then(() => router.back())
              .catch(() => {})
          },
        },
      ]
    )
  }

  const handleShareInvite = () => {
    if (!community?.inviteCode) return
    void Haptics.selectionAsync()
    void Share.share({
      message: `Join my "${community.name}" community on Embodi! Open the app and enter code ${community.inviteCode.toUpperCase()}, or tap: embodi://join/${community.inviteCode}`,
    })
  }

  const handleLogProgress = async () => {
    if (!communityId) return
    const value = Number(logValue)
    if (!Number.isFinite(value) || value <= 0) return
    try {
      await logProgress({ communityId, value })
      setLogValue('')
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    } catch (error) {
      Alert.alert(
        'Could not log progress',
        error instanceof Error
          ? error.message.replace(/^.*Error: /, '')
          : 'Try again.'
      )
    }
  }

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
          style={[typography.h3, styles.headerTitle, { color: palette.textPrimary }]}
          numberOfLines={1}
        >
          {community?.name ?? 'Community'}
        </Text>
        {community?.isMember ? (
          <Pressable
            onPress={handleLeave}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Community options"
          >
            <IconSymbol name="ellipsis" size={20} color={palette.textPrimary} />
          </Pressable>
        ) : (
          <View style={{ width: 22 }} />
        )}
      </View>

      {community === undefined ? (
        <View style={styles.centered}>
          <ActivityIndicator size="small" color={palette.primary} />
        </View>
      ) : community === null ? (
        <View style={styles.centered}>
          <Text style={[typography.body, { color: palette.textSecondary }]}>
            This community is not available.
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <LinearGradient
            colors={['#5B7CFA', '#38C6C0']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.hero}
          >
            <Text style={styles.heroGoal}>
              {community.goalLabel.toUpperCase()}
            </Text>
            <Text style={styles.heroName}>{community.name}</Text>
            {community.description ? (
              <Text style={styles.heroDescription}>
                {community.description}
              </Text>
            ) : null}
            <View style={styles.heroStats}>
              {community.eventDate ? (
                <View style={styles.heroStat}>
                  <Text style={styles.heroStatValue}>
                    {daysUntil(community.eventDate)}
                  </Text>
                  <Text style={styles.heroStatLabel}>days to go</Text>
                </View>
              ) : null}
              <View style={styles.heroStat}>
                <Text style={styles.heroStatValue}>
                  {community.memberCount}
                </Text>
                <Text style={styles.heroStatLabel}>
                  member{community.memberCount === 1 ? '' : 's'}
                </Text>
              </View>
              {community.metric.target ? (
                <View style={styles.heroStat}>
                  <Text style={styles.heroStatValue}>
                    {community.metric.target.toLocaleString()}
                  </Text>
                  <Text style={styles.heroStatLabel}>
                    {community.metric.unit} goal
                  </Text>
                </View>
              ) : null}
            </View>
          </LinearGradient>

          {!community.isMember ? (
            <Pressable
              onPress={handleJoin}
              disabled={joining}
              style={[styles.joinButton, { backgroundColor: palette.primary }]}
              accessibilityRole="button"
              accessibilityLabel="Join community"
            >
              <Text style={[typography.bodyStrong, { color: '#FFFFFF' }]}>
                {joining ? 'Joining\u2026' : 'Join this community'}
              </Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={handleShareInvite}
              style={[
                styles.inviteButton,
                { backgroundColor: palette.surface, borderColor: palette.border },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Invite people"
            >
              <IconSymbol
                name="person.badge.plus"
                size={17}
                color={palette.primary}
              />
              <Text style={[typography.bodyStrong, { color: palette.textPrimary }]}>
                Invite with code {community.inviteCode?.toUpperCase()}
              </Text>
              <IconSymbol
                name="square.and.arrow.up"
                size={16}
                color={palette.textTertiary}
              />
            </Pressable>
          )}

          {community.isMember && community.metric.kind === 'custom' ? (
            <View
              style={[
                styles.logCard,
                { backgroundColor: palette.surface, borderColor: palette.border },
              ]}
            >
              <Text
                style={[typography.smallStrong, { color: palette.textSecondary }]}
              >
                Log progress ({community.metric.unit})
              </Text>
              <View style={styles.logRow}>
                <TextInput
                  value={logValue}
                  onChangeText={setLogValue}
                  placeholder="0"
                  placeholderTextColor={palette.textTertiary}
                  keyboardType="numeric"
                  style={[
                    styles.logInput,
                    {
                      backgroundColor: palette.surfaceAlt,
                      color: palette.textPrimary,
                    },
                  ]}
                />
                <Pressable
                  onPress={handleLogProgress}
                  style={[styles.logButton, { backgroundColor: palette.primary }]}
                  accessibilityRole="button"
                  accessibilityLabel="Log progress"
                >
                  <Text style={[typography.smallStrong, { color: '#FFFFFF' }]}>
                    Add
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          <View style={styles.sectionHeader}>
            <Text style={[typography.caption, { color: palette.textTertiary }]}>
              PROGRESS BOARD
            </Text>
            <Text style={[typography.small, { color: palette.textTertiary }]}>
              progress, not ranking
            </Text>
          </View>

          <View
            style={[
              styles.boardCard,
              { backgroundColor: palette.surface, borderColor: palette.border },
            ]}
          >
            {community.board.map((member) => (
              <Pressable
                key={member.userId}
                onPress={() =>
                  router.push({
                    pathname: '/u/[username]',
                    params: { username: member.username },
                  })
                }
                style={styles.memberRow}
                accessibilityRole="button"
                accessibilityLabel={`View ${member.displayName}`}
              >
                <Avatar
                  url={member.avatarUrl}
                  name={member.displayName}
                  size={38}
                />
                <View style={styles.memberBody}>
                  <View style={styles.memberMeta}>
                    <Text
                      style={[
                        typography.smallStrong,
                        { color: palette.textPrimary },
                      ]}
                      numberOfLines={1}
                    >
                      {member.isMe ? 'You' : member.displayName}
                    </Text>
                    <Text
                      style={[typography.small, { color: palette.textTertiary }]}
                    >
                      {member.percent != null
                        ? `${member.progressValue.toLocaleString()} / ${member.target?.toLocaleString()} ${community.metric.unit}`
                        : `${member.sessionsCount} session${member.sessionsCount === 1 ? '' : 's'}`}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.progressTrack,
                      { backgroundColor: palette.surfaceAlt },
                    ]}
                  >
                    <View
                      style={[
                        styles.progressFill,
                        {
                          width: `${member.percent ?? Math.min(100, member.sessionsCount * 10)}%`,
                          backgroundColor:
                            (member.percent ?? 0) >= 100
                              ? palette.success
                              : palette.primary,
                        },
                      ]}
                    />
                  </View>
                </View>
                {(member.percent ?? 0) >= 100 ? (
                  <IconSymbol
                    name="trophy.fill"
                    size={17}
                    color={palette.warning}
                  />
                ) : null}
              </Pressable>
            ))}
          </View>

          {community.events.length > 0 ? (
            <>
              <View style={styles.sectionHeader}>
                <Text
                  style={[typography.caption, { color: palette.textTertiary }]}
                >
                  ACTIVITY
                </Text>
              </View>
              <View
                style={[
                  styles.activityCard,
                  {
                    backgroundColor: palette.surface,
                    borderColor: palette.border,
                  },
                ]}
              >
                {community.events.map((event) => (
                  <View key={String(event._id)} style={styles.activityRow}>
                    <View
                      style={[
                        styles.activityDot,
                        {
                          backgroundColor:
                            event.kind === 'milestone'
                              ? palette.warning
                              : event.kind === 'workout_done'
                                ? palette.success
                                : palette.textTertiary,
                        },
                      ]}
                    />
                    <Text
                      style={[
                        typography.small,
                        styles.activityText,
                        { color: palette.textSecondary },
                      ]}
                    >
                      {event.message}
                    </Text>
                    <Text
                      style={[typography.small, { color: palette.textTertiary }]}
                    >
                      {timeAgo(event.createdAt)}
                    </Text>
                  </View>
                ))}
              </View>
            </>
          ) : null}

          {community.isMember && community.metric.kind !== 'custom' ? (
            <Text style={[styles.autoNote, { color: palette.textTertiary }]}>
              Progress updates automatically when you complete workouts.
            </Text>
          ) : null}
        </ScrollView>
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
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  scrollContent: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.huge,
  },
  hero: {
    borderRadius: radius.xxl,
    padding: spacing.xxl,
    gap: spacing.sm,
  },
  heroGoal: {
    ...typography.caption,
    color: 'rgba(255,255,255,0.85)',
  },
  heroName: {
    ...typography.h1,
    color: '#FFFFFF',
  },
  heroDescription: {
    ...typography.small,
    color: 'rgba(255,255,255,0.9)',
  },
  heroStats: {
    flexDirection: 'row',
    gap: spacing.xxl,
    marginTop: spacing.md,
  },
  heroStat: {},
  heroStatValue: {
    ...typography.h2,
    color: '#FFFFFF',
  },
  heroStatLabel: {
    ...typography.small,
    color: 'rgba(255,255,255,0.85)',
  },
  joinButton: {
    alignItems: 'center',
    borderRadius: radius.pill,
    paddingVertical: 14,
    marginTop: spacing.lg,
  },
  inviteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingVertical: 12,
    marginTop: spacing.lg,
  },
  logCard: {
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  logRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  logInput: {
    ...typography.body,
    flex: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
  },
  logButton: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    paddingHorizontal: spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xxl,
    marginBottom: spacing.sm,
  },
  boardCard: {
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  memberBody: {
    flex: 1,
    gap: spacing.xs,
  },
  memberMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: 8,
    borderRadius: 4,
  },
  activityCard: {
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.md,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  activityDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  activityText: {
    flex: 1,
  },
  autoNote: {
    ...typography.small,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
})
