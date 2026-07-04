import { useMutation, useQuery } from 'convex/react'
import * as Haptics from 'expo-haptics'
import { router, useLocalSearchParams } from 'expo-router'
import React, { useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { IconSymbol } from '@/components/ui/icon-symbol'
import { PillButton } from '@/components/ui/pill-button'
import { radius, spacing, typography } from '@/constants/design'
import { useTheme } from '@/constants/theme-context'
import { api } from '@/convex/_generated/api'
import { daysUntil } from '@/utils/timeAgo'

export default function JoinByCodeScreen() {
  const { palette } = useTheme()
  const params = useLocalSearchParams<{ code?: string }>()
  const code = typeof params.code === 'string' ? params.code : ''

  const preview = useQuery(
    api.communities.getCommunityByInviteCode,
    code ? { inviteCode: code } : 'skip'
  )
  const joinCommunity = useMutation(api.communities.joinCommunity)
  const [joining, setJoining] = useState(false)

  const openCommunity = (id: string) => {
    router.replace({ pathname: '/community/[id]', params: { id } })
  }

  const handleJoin = async () => {
    if (!code || joining) return
    setJoining(true)
    try {
      const communityId = await joinCommunity({ inviteCode: code })
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      openCommunity(String(communityId))
    } catch (error) {
      Alert.alert(
        'Could not join',
        error instanceof Error
          ? error.message.replace(/^.*Error: /, '')
          : 'Try again.'
      )
      setJoining(false)
    }
  }

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: palette.bg }]}
      edges={['top', 'bottom']}
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
      </View>

      <View style={styles.body}>
        {preview === undefined ? (
          <ActivityIndicator size="small" color={palette.primary} />
        ) : preview === null ? (
          <View style={styles.centeredContent}>
            <IconSymbol
              name="questionmark.circle"
              size={40}
              color={palette.textTertiary}
            />
            <Text style={[typography.h2, { color: palette.textPrimary }]}>
              Invite not found
            </Text>
            <Text
              style={[
                typography.body,
                styles.subtitle,
                { color: palette.textSecondary },
              ]}
            >
              This invite code is invalid or the community no longer exists.
            </Text>
          </View>
        ) : (
          <View style={styles.centeredContent}>
            <View
              style={[styles.iconWrap, { backgroundColor: palette.primaryMuted }]}
            >
              <IconSymbol name="person.2.fill" size={30} color={palette.primary} />
            </View>
            <Text style={[typography.caption, { color: palette.textTertiary }]}>
              YOU&apos;RE INVITED TO
            </Text>
            <Text
              style={[typography.h1, styles.name, { color: palette.textPrimary }]}
            >
              {preview.name}
            </Text>
            <Text style={[typography.body, { color: palette.textSecondary }]}>
              {preview.goalLabel}
              {' \u00b7 '}
              {preview.memberCount} member{preview.memberCount === 1 ? '' : 's'}
              {preview.eventDate
                ? ` \u00b7 ${daysUntil(preview.eventDate)} days to event`
                : ''}
            </Text>

            <View style={styles.cta}>
              {preview.isMember ? (
                <PillButton
                  label="Open community"
                  onPress={() => openCommunity(String(preview._id))}
                />
              ) : (
                <PillButton
                  label={joining ? 'Joining\u2026' : 'Join community'}
                  onPress={handleJoin}
                  disabled={joining}
                  loading={joining}
                />
              )}
            </View>
          </View>
        )}
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  header: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
  },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  centeredContent: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconWrap: {
    width: 68,
    height: 68,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  name: {
    textAlign: 'center',
  },
  subtitle: {
    textAlign: 'center',
  },
  cta: {
    alignSelf: 'stretch',
    marginTop: spacing.xxl,
  },
})
