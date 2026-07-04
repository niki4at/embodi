import { useMutation, useQuery } from 'convex/react'
import * as Haptics from 'expo-haptics'
import { router } from 'expo-router'
import React, { useState } from 'react'
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'

import { Avatar } from '@/components/social/avatar'
import { IconSymbol } from '@/components/ui/icon-symbol'
import { radius, spacing, typography } from '@/constants/design'
import { useTheme } from '@/constants/theme-context'
import { api } from '@/convex/_generated/api'
import { daysUntil } from '@/utils/timeAgo'

/**
 * "Together" strip on the Challenges tab: your communities, plus entry
 * points to start one or join with a code.
 */
export function TogetherSection() {
  const { palette } = useTheme()
  const communities = useQuery(api.communities.listMyCommunities)
  const joinCommunity = useMutation(api.communities.joinCommunity)

  const [codeOpen, setCodeOpen] = useState(false)
  const [code, setCode] = useState('')
  const [joining, setJoining] = useState(false)

  const handleJoinWithCode = async () => {
    const trimmed = code.trim()
    if (!trimmed || joining) return
    setJoining(true)
    try {
      const communityId = await joinCommunity({ inviteCode: trimmed })
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      setCodeOpen(false)
      setCode('')
      router.push({
        pathname: '/community/[id]',
        params: { id: String(communityId) },
      })
    } catch (error) {
      Alert.alert(
        'Could not join',
        error instanceof Error
          ? error.message.replace(/^.*Error: /, '')
          : 'Check the code and try again.'
      )
    } finally {
      setJoining(false)
    }
  }

  return (
    <View style={styles.section}>
      <Text style={[typography.caption, { color: palette.textTertiary }]}>
        TOGETHER
      </Text>

      {communities && communities.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.cardsRow}
        >
          {communities.map((community) => (
            <Pressable
              key={String(community._id)}
              onPress={() => {
                void Haptics.selectionAsync()
                router.push({
                  pathname: '/community/[id]',
                  params: { id: String(community._id) },
                })
              }}
              style={[
                styles.card,
                {
                  backgroundColor: palette.surface,
                  borderColor: palette.border,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Open ${community.name}`}
            >
              <Text
                style={[typography.bodyStrong, { color: palette.textPrimary }]}
                numberOfLines={1}
              >
                {community.name}
              </Text>
              <Text
                style={[typography.small, { color: palette.textTertiary }]}
                numberOfLines={1}
              >
                {community.eventDate
                  ? `${daysUntil(community.eventDate)} days to go`
                  : community.goalLabel}
                {' \u00b7 '}
                {community.memberCount}
              </Text>

              <View style={styles.avatarsRow}>
                {community.memberPreviews.slice(0, 4).map((member, index) => (
                  <View
                    key={member.userId}
                    style={[
                      styles.avatarWrap,
                      {
                        marginLeft: index === 0 ? 0 : -10,
                        borderColor: palette.surface,
                      },
                    ]}
                  >
                    <Avatar
                      url={member.avatarUrl}
                      name={member.displayName}
                      size={26}
                    />
                  </View>
                ))}
              </View>

              {community.myPercent != null ? (
                <View style={styles.progressBlock}>
                  <View
                    style={[
                      styles.progressTrack,
                      { backgroundColor: palette.surfaceHigh },
                    ]}
                  >
                    <View
                      style={[
                        styles.progressFill,
                        {
                          width: `${community.myPercent}%`,
                          backgroundColor:
                            community.myPercent >= 100
                              ? palette.success
                              : palette.primary,
                        },
                      ]}
                    />
                  </View>
                  <Text
                    style={[
                      typography.smallStrong,
                      { color: palette.textSecondary },
                    ]}
                  >
                    You: {community.myProgress.toLocaleString()}
                    {community.myTarget
                      ? ` / ${community.myTarget.toLocaleString()}`
                      : ''}{' '}
                    {community.metric.unit}
                  </Text>
                </View>
              ) : (
                <Text
                  style={[
                    typography.smallStrong,
                    { color: palette.textSecondary },
                  ]}
                >
                  You: {community.myProgress.toLocaleString()}{' '}
                  {community.metric.unit}
                </Text>
              )}
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      <View style={styles.actionsRow}>
        <Pressable
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
            router.push('/community/new')
          }}
          style={[
            styles.actionCard,
            { backgroundColor: palette.surface, borderColor: palette.border },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Start a community"
        >
          <View
            style={[styles.actionIcon, { backgroundColor: palette.primaryMuted }]}
          >
            <IconSymbol name="person.2.fill" size={16} color={palette.primary} />
          </View>
          <Text style={[typography.smallStrong, { color: palette.textPrimary }]}>
            Start a community
          </Text>
        </Pressable>
        <Pressable
          onPress={() => {
            void Haptics.selectionAsync()
            setCodeOpen(true)
          }}
          style={[
            styles.actionCard,
            { backgroundColor: palette.surface, borderColor: palette.border },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Join with a code"
        >
          <View
            style={[styles.actionIcon, { backgroundColor: palette.successMuted }]}
          >
            <IconSymbol name="ticket.fill" size={16} color={palette.success} />
          </View>
          <Text style={[typography.smallStrong, { color: palette.textPrimary }]}>
            Join with a code
          </Text>
        </Pressable>
      </View>

      <Modal
        visible={codeOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setCodeOpen(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setCodeOpen(false)}
        >
          <Pressable
            style={[
              styles.modalSheet,
              {
                backgroundColor: palette.bgElevated,
                borderColor: palette.border,
              },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={[typography.h3, { color: palette.textPrimary }]}>
              Join with a code
            </Text>
            <TextInput
              value={code}
              onChangeText={setCode}
              placeholder="e.g. em4k7t2p9x"
              placeholderTextColor={palette.textTertiary}
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
              style={[
                styles.codeInput,
                {
                  backgroundColor: palette.surface,
                  borderColor: palette.border,
                  color: palette.textPrimary,
                },
              ]}
            />
            <Pressable
              onPress={handleJoinWithCode}
              disabled={!code.trim() || joining}
              style={[
                styles.joinButton,
                {
                  backgroundColor: code.trim()
                    ? palette.primary
                    : palette.surfaceAlt,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Join community"
            >
              <Text
                style={[
                  typography.bodyStrong,
                  { color: code.trim() ? '#FFFFFF' : palette.textTertiary },
                ]}
              >
                {joining ? 'Joining\u2026' : 'Join'}
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  cardsRow: {
    gap: spacing.md,
  },
  card: {
    width: 230,
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  avatarsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarWrap: {
    borderWidth: 2,
    borderRadius: 15,
  },
  progressBlock: {
    gap: spacing.xs,
  },
  progressTrack: {
    height: 7,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  actionCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
  },
  actionIcon: {
    width: 30,
    height: 30,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  modalSheet: {
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: spacing.xl,
    gap: spacing.lg,
  },
  codeInput: {
    ...typography.body,
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
  },
  joinButton: {
    alignItems: 'center',
    borderRadius: radius.pill,
    paddingVertical: 12,
  },
})
