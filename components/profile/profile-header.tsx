import * as Haptics from 'expo-haptics'
import { router } from 'expo-router'
import React, { useCallback } from 'react'
import { Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native'

import { Avatar } from '@/components/social/avatar'
import { IconSymbol } from '@/components/ui/icon-symbol'
import { radius, spacing, typography } from '@/constants/design'
import { useTheme } from '@/constants/theme-context'

export interface ProfileHeaderData {
  username: string
  displayName: string
  bio: string | null
  avatarUrl: string | null
  backerCount: number
  backingCount: number
}

interface ProfileHeaderProps {
  profile: ProfileHeaderData | null
  fallbackName: string | null
}

/**
 * Identity block at the top of the Profile tab: avatar, name, handle, bio,
 * backer counts, and the Edit / Share / Settings actions.
 */
export function ProfileHeader({ profile, fallbackName }: ProfileHeaderProps) {
  const { palette, resolved } = useTheme()
  const iconTint = resolved === 'dark' ? palette.white : palette.textPrimary

  const handleEdit = useCallback(() => {
    Haptics.selectionAsync()
    router.push('/social/edit-profile')
  }, [])

  const handleShare = useCallback(async () => {
    await Haptics.selectionAsync()
    try {
      const handle = profile ? `@${profile.username}` : 'Embodi'
      await Share.share({
        message: `Follow my training on Embodi ${handle ? `(${handle})` : ''}`.trim(),
      })
    } catch {
      // User dismissed the share sheet.
    }
  }, [profile])

  const handleSettings = useCallback(() => {
    Haptics.selectionAsync()
    router.push('/settings')
  }, [])

  const name = profile?.displayName || fallbackName || 'Your profile'

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <Avatar url={profile?.avatarUrl} name={name} size={64} />
        <View style={styles.identity}>
          <Text
            style={[styles.name, { color: palette.textPrimary }]}
            numberOfLines={1}
          >
            {name}
          </Text>
          {profile ? (
            <Text
              style={[styles.handle, { color: palette.textSecondary }]}
              numberOfLines={1}
            >
              @{profile.username}
            </Text>
          ) : null}
        </View>
        <TouchableOpacity
          onPress={handleSettings}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Settings"
          style={[
            styles.iconButton,
            { backgroundColor: palette.surface, borderColor: palette.border },
          ]}
        >
          <IconSymbol name="gear" size={20} color={iconTint} />
        </TouchableOpacity>
      </View>

      {profile?.bio ? (
        <Text style={[styles.bio, { color: palette.textSecondary }]}>
          {profile.bio}
        </Text>
      ) : null}

      {profile ? (
        <View style={styles.countsRow}>
          <Text style={[styles.count, { color: palette.textPrimary }]}>
            {profile.backerCount}
            <Text style={[styles.countLabel, { color: palette.textSecondary }]}>
              {'  '}backers
            </Text>
          </Text>
          <Text style={[styles.count, { color: palette.textPrimary }]}>
            {profile.backingCount}
            <Text style={[styles.countLabel, { color: palette.textSecondary }]}>
              {'  '}backing
            </Text>
          </Text>
        </View>
      ) : null}

      <View style={styles.actionsRow}>
        <TouchableOpacity
          onPress={handleEdit}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Edit profile"
          style={[
            styles.actionButton,
            { backgroundColor: palette.surface, borderColor: palette.border },
          ]}
        >
          <Text style={[styles.actionLabel, { color: palette.textPrimary }]}>
            Edit profile
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleShare}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Share profile"
          style={[
            styles.actionButton,
            { backgroundColor: palette.surface, borderColor: palette.border },
          ]}
        >
          <Text style={[styles.actionLabel, { color: palette.textPrimary }]}>
            Share
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    paddingTop: spacing.md,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  identity: {
    flex: 1,
  },
  name: {
    ...typography.h2,
  },
  handle: {
    ...typography.small,
    marginTop: 2,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  bio: {
    ...typography.small,
    marginTop: spacing.md,
  },
  countsRow: {
    flexDirection: 'row',
    gap: spacing.xl,
    marginTop: spacing.md,
  },
  count: {
    ...typography.bodyStrong,
  },
  countLabel: {
    ...typography.small,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  actionButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  actionLabel: {
    ...typography.smallStrong,
  },
})
