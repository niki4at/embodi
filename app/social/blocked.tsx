import { useMutation, useQuery } from 'convex/react'
import * as Haptics from 'expo-haptics'
import { router } from 'expo-router'
import React from 'react'
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
import { IconSymbol } from '@/components/ui/icon-symbol'
import { radius, spacing, typography } from '@/constants/design'
import { useTheme } from '@/constants/theme-context'
import { api } from '@/convex/_generated/api'

export default function BlockedScreen() {
  const { palette } = useTheme()
  const blocked = useQuery(api.profiles.listBlocked)
  const unblockUser = useMutation(api.profiles.unblockUser)

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
          <IconSymbol name="arrow.left" size={22} color={palette.textPrimary} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: palette.textPrimary }]}>
          Blocked people
        </Text>
        <View style={{ width: 22 }} />
      </View>

      {blocked === undefined ? (
        <View style={styles.loading}>
          <ActivityIndicator size="small" color={palette.primary} />
        </View>
      ) : blocked.length === 0 ? (
        <View style={styles.empty}>
          <Text style={[styles.emptyTitle, { color: palette.textPrimary }]}>
            No one blocked
          </Text>
          <Text style={[styles.emptyBody, { color: palette.textSecondary }]}>
            Blocked people can&apos;t see your posts or reach you, and you
            won&apos;t see theirs.
          </Text>
        </View>
      ) : (
        <FlatList
          data={blocked}
          keyExtractor={(item) => item.userId}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <View
              style={[
                styles.row,
                { backgroundColor: palette.surface, borderColor: palette.border },
              ]}
            >
              <Avatar url={item.avatarUrl} name={item.displayName} size={44} />
              <View style={styles.rowText}>
                <Text
                  style={[styles.rowName, { color: palette.textPrimary }]}
                  numberOfLines={1}
                >
                  {item.displayName}
                </Text>
                <Text
                  style={[styles.rowHandle, { color: palette.textSecondary }]}
                  numberOfLines={1}
                >
                  @{item.username}
                </Text>
              </View>
              <Pressable
                onPress={() => {
                  Haptics.selectionAsync()
                  void unblockUser({ userId: item.userId })
                }}
                accessibilityRole="button"
                accessibilityLabel={`Unblock ${item.displayName}`}
                style={({ pressed }) => [
                  styles.unblockButton,
                  {
                    borderColor: palette.borderStrong,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Text
                  style={[styles.unblockLabel, { color: palette.textPrimary }]}
                >
                  Unblock
                </Text>
              </Pressable>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
  },
  headerTitle: {
    ...typography.h3,
  },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
    gap: spacing.sm,
  },
  emptyTitle: {
    ...typography.h3,
  },
  emptyBody: {
    ...typography.small,
    textAlign: 'center',
  },
  listContent: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.huge,
    gap: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
  },
  rowText: { flex: 1 },
  rowName: {
    ...typography.bodyStrong,
  },
  rowHandle: {
    ...typography.small,
  },
  unblockButton: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  unblockLabel: {
    ...typography.smallStrong,
  },
})
