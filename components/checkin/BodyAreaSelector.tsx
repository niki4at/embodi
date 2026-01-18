import * as Haptics from 'expo-haptics'
import React from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated'

const AnimatedTouchableOpacity =
  Animated.createAnimatedComponent(TouchableOpacity)

const BODY_AREAS = [
  { id: 'neck', label: 'Neck', emoji: '' },
  { id: 'shoulders', label: 'Shoulders', emoji: '' },
  { id: 'upper-back', label: 'Upper Back', emoji: '' },
  { id: 'lower-back', label: 'Lower Back', emoji: '' },
  { id: 'hips', label: 'Hips', emoji: '' },
  { id: 'knees', label: 'Knees', emoji: '' },
  { id: 'ankles', label: 'Ankles', emoji: '' },
  { id: 'wrists', label: 'Wrists', emoji: '' },
] as const

type BodyAreaId = (typeof BODY_AREAS)[number]['id']

interface BodyAreaSelectorProps {
  title: string
  subtitle?: string
  selectedAreas: string[]
  onChange: (areas: string[]) => void
  delay?: number
}

export default function BodyAreaSelector({
  title,
  subtitle,
  selectedAreas,
  onChange,
  delay = 0,
}: BodyAreaSelectorProps) {
  const toggleArea = (areaId: BodyAreaId) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    if (selectedAreas.includes(areaId)) {
      onChange(selectedAreas.filter((id) => id !== areaId))
    } else {
      onChange([...selectedAreas, areaId])
    }
  }

  return (
    <Animated.View
      entering={FadeInDown.delay(delay).duration(400).springify()}
      style={styles.container}
    >
      <Text style={styles.title}>{title}</Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}

      <View style={styles.areasGrid}>
        {BODY_AREAS.map((area) => (
          <AreaChip
            key={area.id}
            label={area.label}
            isSelected={selectedAreas.includes(area.id)}
            onPress={() => toggleArea(area.id)}
          />
        ))}
      </View>
    </Animated.View>
  )
}

interface AreaChipProps {
  label: string
  isSelected: boolean
  onPress: () => void
}

function AreaChip({ label, isSelected, onPress }: AreaChipProps) {
  const scale = useSharedValue(1)

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  const handlePressIn = () => {
    scale.value = withSpring(0.95)
  }

  const handlePressOut = () => {
    scale.value = withSpring(1)
  }

  return (
    <AnimatedTouchableOpacity
      style={[styles.chip, isSelected && styles.chipSelected, animatedStyle]}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={0.8}
    >
      <Text style={[styles.chipLabel, isSelected && styles.chipLabelSelected]}>
        {label}
      </Text>
    </AnimatedTouchableOpacity>
  )
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 32,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 16,
  },
  areasGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 12,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#f3f4f6',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
  },
  chipSelected: {
    backgroundColor: '#fef2f2',
    borderColor: '#ef4444',
  },
  chipLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#4b5563',
  },
  chipLabelSelected: {
    color: '#dc2626',
  },
})
