import { useMutation } from 'convex/react'
import * as Haptics from 'expo-haptics'
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
import Svg, { Circle, Defs, LinearGradient, Stop, Text as SvgText } from 'react-native-svg'

import { BottomSheet } from '@/components/ui/bottom-sheet'
import { PillButton } from '@/components/ui/pill-button'
import { gradients, radius, spacing, typography } from '@/constants/design'
import { fonts } from '@/constants/fonts'
import { useTheme } from '@/constants/theme-context'
import { api } from '@/convex/_generated/api'

const FAB_SIZE = 57

/**
 * "Group challenges" from the bodyfyt challenges frame (36:226): a 9pt mono
 * eyebrow, 29pt arrow rows with 0.5pt rules, and the 57pt gradient-ring "+"
 * to join with a code or start a community. Shared challenges you already
 * belong to are listed with the personal ones above.
 */
export function TogetherSection() {
  const { palette } = useTheme()
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

  const rows = [
    { key: 'join', label: 'Join with a code', onPress: () => setCodeOpen(true) },
    { key: 'start', label: 'Start a community', onPress: () => router.push('/community/new') },
  ]

  return (
    <View style={styles.section}>
      <Text style={[styles.eyebrow, { color: palette.textSecondary }]}>GROUP CHALLENGES</Text>
      <View style={styles.body}>
        <View style={styles.rows}>
          {rows.map((row) => (
            <Pressable
              key={row.key}
              onPress={() => {
                void Haptics.selectionAsync()
                row.onPress()
              }}
              accessibilityRole="button"
              accessibilityLabel={row.label}
              style={({ pressed }) => [
                styles.row,
                { borderBottomColor: palette.borderStrong },
                pressed && { opacity: 0.7 },
              ]}
            >
              <View style={[styles.dot, { backgroundColor: palette.primary }]} />
              <Text style={[styles.rowLabel, { color: palette.textPrimary }]} numberOfLines={1}>
                {row.label}
              </Text>
              <Text style={[styles.rowArrow, { color: palette.textPrimary }]}>{'\u2192'}</Text>
            </Pressable>
          ))}
        </View>
        <Pressable
          onPress={handlePlus}
          accessibilityRole="button"
          accessibilityLabel="Join or create a group challenge"
          hitSlop={8}
          style={({ pressed }) => [styles.fab, pressed && { opacity: 0.7 }]}
        >
          <JoinCreateRing />
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

/** 1pt gradient ring with a gradient "+" and "join / create" caption (Figma 40:297, 40:301, 40:299). */
function JoinCreateRing() {
  const id = React.useId().replace(/:/g, '')
  const [blue, lavender] = gradients.hero
  return (
    <Svg width={FAB_SIZE} height={FAB_SIZE}>
      <Defs>
        <LinearGradient
          id={`${id}ring`}
          x1="12.26"
          y1="4.97"
          x2="44.41"
          y2="54.35"
          gradientUnits="userSpaceOnUse"
        >
          <Stop offset="0" stopColor={gradients.ring[0]} />
          <Stop offset="1" stopColor={gradients.ring[1]} />
        </LinearGradient>
        <LinearGradient id={`${id}plus`} x1="0" y1="11.3" x2="0" y2="59.3" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={blue} />
          <Stop offset="1" stopColor={lavender} />
        </LinearGradient>
        <LinearGradient id={`${id}label`} x1="0" y1="36.3" x2="0" y2="43" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={blue} />
          <Stop offset="1" stopColor={lavender} />
        </LinearGradient>
      </Defs>
      <Circle cx={28.5} cy={28.5} r={28} stroke={`url(#${id}ring)`} strokeWidth={1} fill="none" />
      <SvgText
        x={28.5}
        y={31}
        textAnchor="middle"
        fontFamily={fonts.displayRegular}
        fontSize={25}
        fill={`url(#${id}plus)`}
      >
        +
      </SvgText>
      <SvgText
        x={30}
        y={41}
        textAnchor="middle"
        fontFamily={fonts.uiRegular}
        fontSize={6}
        fill={`url(#${id}label)`}
      >
        join / create
      </SvgText>
    </Svg>
  )
}

const styles = StyleSheet.create({
  section: {
    marginTop: 45,
    paddingLeft: 24,
    paddingRight: 64,
  },
  eyebrow: {
    fontFamily: fonts.mono,
    fontSize: 9,
    lineHeight: 12,
  },
  body: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 43,
    marginTop: 7,
  },
  rows: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 7,
    paddingBottom: 7,
    borderBottomWidth: 0.5,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginLeft: 6,
    marginRight: 6,
  },
  rowLabel: {
    flex: 1,
    fontFamily: fonts.uiSemiBold,
    fontSize: 12,
    lineHeight: 15,
  },
  rowArrow: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 12,
    lineHeight: 15,
    marginRight: 10,
  },
  fab: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    marginTop: 23,
  },
  codeInput: {
    ...typography.body,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
  },
})
