import * as Haptics from 'expo-haptics'
import React, { useState } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import Svg, { Ellipse, G, Path } from 'react-native-svg'

import {
  BACK_PARTS,
  FRONT_PARTS,
  type BodyPart,
} from '@/constants/body-shapes'
import { BODY_GROUP_LABELS, type BodyGroup } from '@/constants/exercise-catalog'
import { radius, spacing, typography } from '@/constants/design'
import { useTheme } from '@/constants/theme-context'

// Each tappable region maps onto a catalog body group. Regions not represented
// in the catalog as their own group (cardio, full body, recovery) fall back to
// the closest training group.
const REGION_TO_GROUP: Record<BodyPart, BodyGroup> = {
  head: 'mobility',
  neck: 'mobility',
  leftShoulder: 'shoulders',
  rightShoulder: 'shoulders',
  leftArm: 'arms',
  rightArm: 'arms',
  leftForearm: 'arms',
  rightForearm: 'arms',
  leftHand: 'arms',
  rightHand: 'arms',
  chest: 'chest',
  abdomen: 'core',
  upperBack: 'back',
  lowerBack: 'back',
  leftGlute: 'glutes',
  rightGlute: 'glutes',
  leftThigh: 'legs',
  rightThigh: 'legs',
  leftKnee: 'legs',
  rightKnee: 'legs',
  leftCalf: 'legs',
  rightCalf: 'legs',
  leftFoot: 'legs',
  rightFoot: 'legs',
}

interface BodyPartSelectorProps {
  selectedGroup: BodyGroup | null
  onSelectGroup: (group: BodyGroup) => void
}

export function BodyPartSelector({
  selectedGroup,
  onSelectGroup,
}: BodyPartSelectorProps) {
  const { palette, resolved } = useTheme()
  const [view, setView] = useState<'front' | 'back'>('front')

  const parts = view === 'front' ? FRONT_PARTS : BACK_PARTS
  const baseFill = resolved === 'dark' ? palette.surfaceAlt : '#EEF1F4'
  const stroke = palette.borderStrong

  const handlePress = (part: BodyPart) => {
    Haptics.selectionAsync()
    onSelectGroup(REGION_TO_GROUP[part])
  }

  const fillFor = (part: BodyPart) =>
    selectedGroup && REGION_TO_GROUP[part] === selectedGroup
      ? palette.primary
      : baseFill

  return (
    <View style={styles.wrap}>
      <View style={styles.toggleRow}>
        <View
          style={[styles.toggleTrack, { backgroundColor: palette.surfaceAlt }]}
        >
          {(['front', 'back'] as const).map((v) => {
            const active = v === view
            return (
              <TouchableOpacity
                key={v}
                style={[
                  styles.toggleBtn,
                  active && { backgroundColor: palette.surface },
                ]}
                onPress={() => {
                  Haptics.selectionAsync()
                  setView(v)
                }}
                activeOpacity={0.85}
              >
                <Text
                  style={[
                    styles.toggleLabel,
                    {
                      color: active
                        ? palette.textPrimary
                        : palette.textSecondary,
                    },
                  ]}
                >
                  {v === 'front' ? 'Front' : 'Back'}
                </Text>
              </TouchableOpacity>
            )
          })}
        </View>
      </View>

      <View
        style={[
          styles.canvas,
          { backgroundColor: palette.surfaceAlt, borderColor: palette.border },
        ]}
      >
        <Svg viewBox="0 0 200 420" width="100%" height="100%">
          <G>
            {parts.map((part) => {
              const fill = fillFor(part.id)
              if (part.shape === 'ellipse') {
                return (
                  <Ellipse
                    key={`${view}-${part.id}`}
                    cx={part.cx}
                    cy={part.cy}
                    rx={part.rx}
                    ry={part.ry}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={1.5}
                    onPress={() => handlePress(part.id)}
                  />
                )
              }
              return (
                <Path
                  key={`${view}-${part.id}`}
                  d={part.d}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={1.5}
                  onPress={() => handlePress(part.id)}
                />
              )
            })}
          </G>
        </Svg>
      </View>

      <Text style={[styles.caption, { color: palette.textSecondary }]}>
        {selectedGroup
          ? `Showing ${BODY_GROUP_LABELS[selectedGroup]} exercises`
          : 'Tap a body part to see its exercises'}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
  },
  toggleRow: {
    marginBottom: spacing.md,
  },
  toggleTrack: {
    flexDirection: 'row',
    borderRadius: radius.pill,
    padding: 4,
  },
  toggleBtn: {
    paddingHorizontal: spacing.xl,
    paddingVertical: 8,
    borderRadius: radius.pill,
  },
  toggleLabel: {
    ...typography.smallStrong,
  },
  canvas: {
    width: 200,
    height: 320,
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  caption: {
    ...typography.small,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
})
