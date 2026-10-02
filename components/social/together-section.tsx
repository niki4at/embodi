import { useMutation, useQuery } from 'convex/react'
import * as Haptics from 'expo-haptics'
import { LinearGradient } from 'expo-linear-gradient'
import { router } from 'expo-router'
import React, { useState } from 'react'
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'

import { BottomSheet } from '@/components/ui/bottom-sheet'
import { PillButton } from '@/components/ui/pill-button'
import { ArrowRow, Eyebrow } from '@/components/ui/primitives'
import { gradients, radius, spacing, typography } from '@/constants/design'
import { fonts } from '@/constants/fonts'
import { useTheme } from '@/constants/theme-context'
import { api } from '@/convex/_generated/api'

function daysUntil(timestamp: number): number {
  return Math.max(0, Math.ceil((timestamp - Date.now()) / (24 * 60 * 60 * 1000)))
}

/**
 * "Group challenges": the communities you belong to as plain arrow rows, plus
 * a gradient "+" to join with a code or start a new one. Distinct from the
 * personal challenges list above it.
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
          : 'Check the code and try again.',
      )
    } finally {
      setJoining(false)
    }
  }

  const handlePlus = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    Alert.alert('Group challenge', undefined, [
      { text: 'Join with a code', onPress: () => setCodeOpen(true) },
      { text: 'Start a community', onPress: () => router.push('/community/new') },
      { text: 'Cancel', style: 'cancel' },
    ])
  }

  const rows = (communities ?? []).map((community) => ({
    key: String(community._id),
    label: `${community.name} \u00b7 ${
      community.eventDate
        ? `${daysUntil(community.eventDate)} days to go`
        : community.goalLabel
    }`,
    onPress: () => {
      void Haptics.selectionAsync()
      router.push({
        pathname: '/community/[id]',
        params: { id: String(community._id) },
      })
    },
  }))

  return (
    <View style={styles.section}>
      <Eyebrow>Group challenges</Eyebrow>
      <View style={styles.body}>
        <View style={styles.rows}>
          {rows.map((row) => (
            <ArrowRow key={row.key} label={row.label} onPress={row.onPress} dot={palette.accent} />
          ))}
          <ArrowRow label="Join with a code" onPress={() => setCodeOpen(true)} />
          <ArrowRow
            label="Start a community"
            onPress={() => router.push('/community/new')}
            last
          />
        </View>
        <Pressable
          onPress={handlePlus}
          accessibilityRole="button"
          accessibilityLabel="Join or create a group challenge"
          style={({ pressed }) => [styles.plusWrap, pressed && { opacity: 0.7 }]}
        >
          <LinearGradient
            colors={[...gradients.hero]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.plusRing}
          >
            <View style={[styles.plusInner, { backgroundColor: palette.bg }]}>
              <Text style={[styles.plus, { color: palette.primary }]}>+</Text>
              <Text style={[styles.plusLabel, { color: palette.accent }]}>join / create</Text>
            </View>
          </LinearGradient>
        </Pressable>
      </View>

      <BottomSheet
        visible={codeOpen}
        onClose={() => setCodeOpen(false)}
        title="Join with a code"
        subtitle="Paste the invite code a friend shared."
        footer={
          <PillButton
            label={joining ? 'Joining' : 'Join'}
            onPress={handleJoinWithCode}
            disabled={!code.trim() || joining}
            loading={joining}
          />
        }
      >
        <TextInput
          value={code}
          onChangeText={setCode}
          placeholder="e.g. em4k7t2p9x"
          placeholderTextColor={palette.textTertiary}
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus
          accessibilityLabel="Invite code"
          style={[
            styles.codeInput,
            { backgroundColor: palette.surface, color: palette.textPrimary },
          ]}
        />
      </BottomSheet>
    </View>
  )
}

const styles = StyleSheet.create({
  section: {
    marginTop: spacing.xxxl,
    gap: spacing.md,
  },
  body: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  rows: {
    flex: 1,
  },
  plusWrap: {
    width: 64,
    height: 64,
  },
  plusRing: {
    width: 64,
    height: 64,
    borderRadius: 32,
    padding: 1.5,
  },
  plusInner: {
    flex: 1,
    borderRadius: 31,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plus: {
    fontFamily: fonts.displayRegular,
    fontSize: 26,
    lineHeight: 28,
  },
  plusLabel: {
    fontFamily: fonts.uiRegular,
    fontSize: 8,
    lineHeight: 10,
  },
  codeInput: {
    ...typography.body,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
  },
})
