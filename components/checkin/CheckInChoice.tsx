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

export interface ChoiceOption<T extends string> {
  value: T
  label: string
  emoji?: string
  description?: string
}

interface CheckInChoiceProps<T extends string> {
  title: string
  subtitle?: string
  options: ChoiceOption<T>[]
  value: T | null
  onChange: (value: T) => void
  columns?: 1 | 2 | 3
  delay?: number
}

export default function CheckInChoice<T extends string>({
  title,
  subtitle,
  options,
  value,
  onChange,
  columns = 2,
  delay = 0,
}: CheckInChoiceProps<T>) {
  return (
    <Animated.View
      entering={FadeInDown.delay(delay).duration(400).springify()}
      style={styles.container}
    >
      <Text style={styles.title}>{title}</Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}

      <View
        style={[
          styles.optionsGrid,
          columns === 1 && styles.singleColumn,
          columns === 3 && styles.threeColumns,
        ]}
      >
        {options.map((option, index) => (
          <ChoiceButton
            key={option.value}
            option={option}
            isSelected={value === option.value}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              onChange(option.value)
            }}
            columns={columns}
            index={index}
          />
        ))}
      </View>
    </Animated.View>
  )
}

interface ChoiceButtonProps<T extends string> {
  option: ChoiceOption<T>
  isSelected: boolean
  onPress: () => void
  columns: number
  index: number
}

function ChoiceButton<T extends string>({
  option,
  isSelected,
  onPress,
  columns,
}: ChoiceButtonProps<T>) {
  const scale = useSharedValue(1)

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  const handlePressIn = () => {
    scale.value = withSpring(0.96)
  }

  const handlePressOut = () => {
    scale.value = withSpring(1)
  }

  return (
    <AnimatedTouchableOpacity
      style={[
        styles.option,
        isSelected && styles.optionSelected,
        columns === 1 && styles.optionFullWidth,
        columns === 3 && styles.optionThird,
        animatedStyle,
      ]}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={0.8}
    >
      {option.emoji && <Text style={styles.emoji}>{option.emoji}</Text>}
      <Text style={[styles.optionLabel, isSelected && styles.optionLabelSelected]}>
        {option.label}
      </Text>
      {option.description && (
        <Text
          style={[
            styles.optionDescription,
            isSelected && styles.optionDescriptionSelected,
          ]}
        >
          {option.description}
        </Text>
      )}
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
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 12,
  },
  singleColumn: {
    flexDirection: 'column',
  },
  threeColumns: {},
  option: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  optionFullWidth: {
    minWidth: '100%',
    flexDirection: 'row',
    justifyContent: 'flex-start',
    gap: 12,
  },
  optionThird: {
    minWidth: '30%',
    flex: 1,
  },
  optionSelected: {
    borderColor: '#4f46e5',
    backgroundColor: '#eef2ff',
  },
  emoji: {
    fontSize: 24,
    marginBottom: 8,
  },
  optionLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
    textAlign: 'center',
  },
  optionLabelSelected: {
    color: '#4f46e5',
  },
  optionDescription: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'center',
    marginTop: 4,
  },
  optionDescriptionSelected: {
    color: '#6366f1',
  },
})
