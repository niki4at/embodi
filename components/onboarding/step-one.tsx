import React, { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Pressable,
} from 'react-native'
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated'
import { LinearGradient } from 'expo-linear-gradient'
import * as Haptics from 'expo-haptics'
import { OnboardingData } from './onboarding-screen'

interface StepOneProps {
  data: OnboardingData
  updateData: (updates: Partial<OnboardingData>) => void
  onNext: () => void
  onSkip: () => void
}

export default function StepOne({ data, updateData, onNext, onSkip }: StepOneProps) {
  const [nameFocused, setNameFocused] = useState(false)
  const [ageFocused, setAgeFocused] = useState(false)

  const buttonScale = useSharedValue(1)

  const buttonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }))

  const handleButtonPressIn = () => {
    buttonScale.value = withSpring(0.96)
  }

  const handleButtonPressOut = () => {
    buttonScale.value = withSpring(1)
  }

  const handleGenderSelect = (gender: 'male' | 'female' | 'prefer-not-to-say') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    updateData({ gender })
  }

  const canProceed = data.name.trim().length > 0 && data.age.trim().length > 0

  return (
    <View style={styles.container}>
      <Animated.View entering={FadeInDown.delay(100).duration(600).springify()}>
        <Text style={styles.title}>Tell me about yourself</Text>
      </Animated.View>

      {/* Name Input */}
      <Animated.View
        entering={FadeInDown.delay(200).duration(600).springify()}
        style={styles.inputWrapper}
      >
        <Text style={styles.label}>Name</Text>
        <View style={[styles.inputContainer, nameFocused && styles.inputContainerFocused]}>
          <TextInput
            style={styles.input}
            placeholder="Your name"
            placeholderTextColor="#9ca3af"
            value={data.name}
            onChangeText={(text) => updateData({ name: text })}
            onFocus={() => {
              setNameFocused(true)
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
            }}
            onBlur={() => setNameFocused(false)}
            autoCapitalize="words"
            autoComplete="name"
          />
        </View>
      </Animated.View>

      {/* Age Input */}
      <Animated.View
        entering={FadeInDown.delay(300).duration(600).springify()}
        style={styles.inputWrapper}
      >
        <Text style={styles.label}>Age</Text>
        <View style={[styles.inputContainer, ageFocused && styles.inputContainerFocused]}>
          <TextInput
            style={styles.input}
            placeholder="Your age"
            placeholderTextColor="#9ca3af"
            value={data.age}
            onChangeText={(text) => updateData({ age: text.replace(/[^0-9]/g, '') })}
            onFocus={() => {
              setAgeFocused(true)
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
            }}
            onBlur={() => setAgeFocused(false)}
            keyboardType="number-pad"
            maxLength={3}
          />
        </View>
      </Animated.View>

      {/* Gender Selection */}
      <Animated.View
        entering={FadeInDown.delay(400).duration(600).springify()}
        style={styles.genderWrapper}
      >
        <Text style={styles.label}>Gender</Text>
        <View style={styles.genderOptions}>
          <TouchableOpacity
            style={[
              styles.genderOption,
              data.gender === 'male' && styles.genderOptionSelected,
            ]}
            onPress={() => handleGenderSelect('male')}
            activeOpacity={0.7}
          >
            <View
              style={[
                styles.radioOuter,
                data.gender === 'male' && styles.radioOuterSelected,
              ]}
            >
              {data.gender === 'male' && <View style={styles.radioInner} />}
            </View>
            <Text
              style={[
                styles.genderText,
                data.gender === 'male' && styles.genderTextSelected,
              ]}
            >
              Male
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.genderOption,
              data.gender === 'female' && styles.genderOptionSelected,
            ]}
            onPress={() => handleGenderSelect('female')}
            activeOpacity={0.7}
          >
            <View
              style={[
                styles.radioOuter,
                data.gender === 'female' && styles.radioOuterSelected,
              ]}
            >
              {data.gender === 'female' && <View style={styles.radioInner} />}
            </View>
            <Text
              style={[
                styles.genderText,
                data.gender === 'female' && styles.genderTextSelected,
              ]}
            >
              Female
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.genderOption,
              data.gender === 'prefer-not-to-say' && styles.genderOptionSelected,
            ]}
            onPress={() => handleGenderSelect('prefer-not-to-say')}
            activeOpacity={0.7}
          >
            <View
              style={[
                styles.radioOuter,
                data.gender === 'prefer-not-to-say' && styles.radioOuterSelected,
              ]}
            >
              {data.gender === 'prefer-not-to-say' && <View style={styles.radioInner} />}
            </View>
            <Text
              style={[
                styles.genderText,
                data.gender === 'prefer-not-to-say' && styles.genderTextSelected,
              ]}
            >
              Prefer not to say
            </Text>
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* Spacer */}
      <View style={styles.spacer} />

      {/* Next Button */}
      <Animated.View entering={FadeInDown.delay(500).duration(600).springify()}>
        <Animated.View style={buttonAnimatedStyle}>
          <Pressable
            onPress={onNext}
            onPressIn={handleButtonPressIn}
            onPressOut={handleButtonPressOut}
            disabled={!canProceed}
          >
            <LinearGradient
              colors={canProceed ? ['#6366f1', '#4f46e5'] : ['#d1d5db', '#9ca3af']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.nextButton}
            >
              <Text style={styles.nextButtonText}>Next</Text>
            </LinearGradient>
          </Pressable>
        </Animated.View>
      </Animated.View>

      {/* Skip Button */}
      <Animated.View entering={FadeInDown.delay(600).duration(600).springify()}>
        <TouchableOpacity onPress={onSkip} style={styles.skipButton}>
          <Text style={styles.skipButtonText}>Skip this step</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#f97316',
    marginBottom: 32,
  },
  inputWrapper: {
    marginBottom: 20,
  },
  label: {
    fontSize: 15,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  inputContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    paddingHorizontal: 16,
    height: 54,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  inputContainerFocused: {
    borderColor: '#6366f1',
    shadowColor: '#6366f1',
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  input: {
    fontSize: 16,
    color: '#1f2937',
    fontWeight: '400',
  },
  genderWrapper: {
    marginBottom: 20,
  },
  genderOptions: {
    gap: 12,
  },
  genderOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    paddingHorizontal: 16,
    paddingVertical: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  genderOptionSelected: {
    borderColor: '#6366f1',
    backgroundColor: '#eef2ff',
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  radioOuterSelected: {
    borderColor: '#6366f1',
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#6366f1',
  },
  genderText: {
    fontSize: 16,
    color: '#6b7280',
    fontWeight: '500',
  },
  genderTextSelected: {
    color: '#4f46e5',
    fontWeight: '600',
  },
  spacer: {
    flex: 1,
    minHeight: 20,
  },
  nextButton: {
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#4f46e5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  nextButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  skipButtonText: {
    fontSize: 15,
    color: '#6366f1',
    fontWeight: '500',
  },
})



