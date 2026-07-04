import { useMutation, useQuery } from 'convex/react'
import * as Haptics from 'expo-haptics'
import { router } from 'expo-router'
import React, { useEffect, useState } from 'react'
import {
  FlatList,
  Pressable,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { Avatar } from '@/components/social/avatar'
import type { ProfileCard } from '@/components/social/types'
import { IconSymbol } from '@/components/ui/icon-symbol'
import { radius, spacing, typography } from '@/constants/design'
import { useTheme } from '@/constants/theme-context'
import { api } from '@/convex/_generated/api'

export default function SocialSearchScreen() {
  const { palette } = useTheme()
  const [term, setTerm] = useState('')
  const [debounced, setDebounced] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(term), 250)
    return () => clearTimeout(timer)
  }, [term])

  const results = useQuery(
    api.profiles.searchPeople,
    debounced.trim().length >= 2 ? { term: debounced } : 'skip'
  )
  const myProfile = useQuery(api.profiles.getMyProfile)
  const backUser = useMutation(api.profiles.backUser)

  const [backed, setBacked] = useState<Set<string>>(new Set())

  const handleBack = (userId: string) => {
    void Haptics.selectionAsync()
    setBacked((prev) => new Set(prev).add(userId))
    backUser({ userId }).catch(() => {
      setBacked((prev) => {
        const next = new Set(prev)
        next.delete(userId)
        return next
      })
    })
  }

  const handleInvite = () => {
    void Haptics.selectionAsync()
    const handle = myProfile ? `@${myProfile.username}` : 'me'
    void Share.share({
      message: `Train with ${handle} on Embodi! Get the app and back me so we can cheer each other on: https://embodi.expo.app`,
    })
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
        <View
          style={[
            styles.searchBox,
            { backgroundColor: palette.surface, borderColor: palette.border },
          ]}
        >
          <IconSymbol
            name="magnifyingglass"
            size={17}
            color={palette.textTertiary}
          />
          <TextInput
            value={term}
            onChangeText={setTerm}
            placeholder="Search by name or @handle"
            placeholderTextColor={palette.textTertiary}
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
            style={[styles.searchInput, { color: palette.textPrimary }]}
          />
          {term.length > 0 ? (
            <Pressable
              onPress={() => setTerm('')}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
            >
              <IconSymbol name="xmark" size={15} color={palette.textTertiary} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <FlatList
        data={(results ?? []) as ProfileCard[]}
        keyExtractor={(item) => item.userId}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => {
          const isBacked = backed.has(item.userId)
          return (
            <Pressable
              onPress={() =>
                router.push({
                  pathname: '/u/[username]',
                  params: { username: item.username },
                })
              }
              style={styles.resultRow}
              accessibilityRole="button"
              accessibilityLabel={`View ${item.displayName}`}
            >
              <Avatar url={item.avatarUrl} name={item.displayName} size={44} />
              <View style={styles.resultText}>
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
                  {item.isPrivate ? ' \u00b7 private' : ''}
                </Text>
              </View>
              <Pressable
                onPress={() => handleBack(item.userId)}
                disabled={isBacked}
                style={[
                  styles.backButton,
                  {
                    backgroundColor: isBacked
                      ? palette.surfaceAlt
                      : palette.primary,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel={
                  isBacked ? 'Request sent' : `Back ${item.displayName}`
                }
              >
                <Text
                  style={[
                    typography.smallStrong,
                    { color: isBacked ? palette.textTertiary : '#FFFFFF' },
                  ]}
                >
                  {isBacked ? (item.isPrivate ? 'Requested' : 'Backing') : 'Back'}
                </Text>
              </Pressable>
            </Pressable>
          )
        }}
        ListEmptyComponent={
          debounced.trim().length >= 2 && results !== undefined ? (
            <Text
              style={[
                typography.small,
                styles.emptyText,
                { color: palette.textTertiary },
              ]}
            >
              No one found for &quot;{debounced.trim()}&quot;.
            </Text>
          ) : (
            <Text
              style={[
                typography.small,
                styles.emptyText,
                { color: palette.textTertiary },
              ]}
            >
              Find your people by name or handle.
            </Text>
          )
        }
        ListFooterComponent={
          <Pressable
            onPress={handleInvite}
            style={[
              styles.inviteCard,
              { backgroundColor: palette.surface, borderColor: palette.border },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Invite a friend"
          >
            <View
              style={[
                styles.inviteIcon,
                { backgroundColor: palette.primaryMuted },
              ]}
            >
              <IconSymbol
                name="person.badge.plus"
                size={20}
                color={palette.primary}
              />
            </View>
            <View style={styles.inviteText}>
              <Text
                style={[typography.bodyStrong, { color: palette.textPrimary }]}
              >
                Invite a friend
              </Text>
              <Text style={[typography.small, { color: palette.textSecondary }]}>
                Training is better with backers. Send them a link.
              </Text>
            </View>
            <IconSymbol
              name="square.and.arrow.up"
              size={18}
              color={palette.textTertiary}
            />
          </Pressable>
        }
        contentContainerStyle={styles.listContent}
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
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    height: 44,
  },
  searchInput: {
    ...typography.body,
    flex: 1,
    paddingVertical: 0,
  },
  listContent: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.huge,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  resultText: {
    flex: 1,
  },
  backButton: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: 8,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: spacing.xl,
  },
  inviteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: spacing.lg,
    marginTop: spacing.xl,
  },
  inviteIcon: {
    width: 42,
    height: 42,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inviteText: {
    flex: 1,
  },
})
