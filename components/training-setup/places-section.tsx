import { useAction, useMutation } from 'convex/react'
import React, { useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'

import { IconSymbol } from '@/components/ui/icon-symbol'
import { radius, spacing, typography } from '@/constants/design'
import { useTheme } from '@/constants/theme-context'

import { removeTrainingPlace, saveTrainingPlace } from './api'
import {
  captureForegroundCoordinates,
} from './foreground-location'
import { SectionShell } from './section-shell'
import type {
  CapturedCoordinates,
  TrainingPlace,
  TrainingPlaceKind,
} from './types'

interface PlacesSectionProps {
  places: TrainingPlace[]
  locationEnabled: boolean
  onPlacesChanged: () => Promise<void>
}

export function PlacesSection({
  places,
  locationEnabled,
  onPlacesChanged,
}: PlacesSectionProps) {
  const { palette } = useTheme()
  const savePlace = useAction(saveTrainingPlace)
  const removePlace = useMutation(removeTrainingPlace)
  const [kind, setKind] = useState<TrainingPlaceKind | null>(null)
  const [name, setName] = useState('')
  const [radius, setRadius] = useState('150')
  const [coordinates, setCoordinates] = useState<CapturedCoordinates | null>(null)
  const [isCapturing, setIsCapturing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const open = (nextKind: TrainingPlaceKind) => {
    const existingHome = nextKind === 'home'
      ? places.find((place) => place.kind === 'home')
      : undefined
    setKind(nextKind)
    setName(existingHome?.name ?? (nextKind === 'home' ? 'Home' : ''))
    setRadius(existingHome?.radiusMeters.toString() ?? '150')
    setCoordinates(
      existingHome?.latitude !== undefined && existingHome.longitude !== undefined
        ? {
            latitude: existingHome.latitude,
            longitude: existingHome.longitude,
          }
        : null,
    )
  }

  const capture = async () => {
    setIsCapturing(true)
    try {
      const nextCoordinates = await captureForegroundCoordinates()
      setCoordinates(nextCoordinates)
    } catch (error) {
      console.info('Foreground location capture unavailable', error)
      Alert.alert(
        'Could not capture location',
        error instanceof Error
          ? error.message
          : 'Check location services and try again. Background location is not used.',
      )
    } finally {
      setIsCapturing(false)
    }
  }

  const save = async () => {
    if (!kind || !coordinates || !name.trim()) {
      Alert.alert(
        'Place details needed',
        'Add a name and capture your current foreground location first.',
      )
      return
    }
    const existingHome =
      kind === 'home' ? places.find((place) => place.kind === 'home') : undefined
    setIsSaving(true)
    try {
      await savePlace({
        placeId: existingHome?._id,
        trainingEnvironment: kind,
        label: name.trim(),
        radiusM: Math.max(50, Math.min(1000, Number(radius) || 150)),
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
      })
      await onPlacesChanged()
      setKind(null)
    } catch (error) {
      console.error('Training place save failed', error)
      Alert.alert('Could not save place', 'Check your connection and try again.')
    } finally {
      setIsSaving(false)
    }
  }

  const confirmRemove = (place: TrainingPlace) => {
    Alert.alert(`Remove ${place.name}?`, 'This stops place-based suggestions here.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          void removePlace({ placeId: place._id })
            .then(onPlacesChanged)
            .catch((error) => {
              console.error('Training place removal failed', error)
              Alert.alert('Could not remove place', 'Try again in a moment.')
            })
        },
      },
    ])
  }

  return (
    <>
      <SectionShell
        icon="house.fill"
        title="Places"
        description="Save one Home and multiple Gyms. Embodi checks proximity only while the app is open."
      >
        {!locationEnabled ? (
          <View style={[styles.notice, { backgroundColor: palette.warningMuted }]}>
            <IconSymbol name="info.circle" size={18} color={palette.warning} />
            <Text style={[styles.noticeText, { color: palette.textSecondary }]}>
              Turn on location suggestions below before using saved places.
            </Text>
          </View>
        ) : null}

        {places.map((place) => (
          <View
            key={place._id}
            style={[
              styles.placeRow,
              { backgroundColor: palette.surfaceAlt, borderColor: palette.border },
            ]}
          >
            <View
              style={[styles.placeIcon, { backgroundColor: palette.primaryMuted }]}
            >
              <IconSymbol
                name={place.kind === 'home' ? 'house.fill' : 'dumbbell.fill'}
                size={19}
                color={palette.primary}
              />
            </View>
            <View style={styles.flex}>
              <Text style={[styles.placeName, { color: palette.textPrimary }]}>
                {place.name}
              </Text>
              <Text style={[styles.placeMeta, { color: palette.textSecondary }]}>
                {place.kind === 'home' ? 'Home' : 'Gym'} · {place.radiusMeters} m radius
              </Text>
            </View>
            <Pressable
              onPress={() => confirmRemove(place)}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={`Remove ${place.name}`}
            >
              <IconSymbol name="trash" size={20} color={palette.textTertiary} />
            </Pressable>
          </View>
        ))}

        <View style={styles.actions}>
          <AddPlaceButton
            label={places.some((place) => place.kind === 'home') ? 'Update Home' : 'Add Home'}
            icon="house.fill"
            onPress={() => open('home')}
          />
          <AddPlaceButton
            label="Add Gym"
            icon="dumbbell.fill"
            onPress={() => open('gym')}
          />
        </View>
      </SectionShell>

      <Modal
        visible={kind !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setKind(null)}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalCard,
              { backgroundColor: palette.bgElevated, borderColor: palette.border },
            ]}
          >
            <View style={styles.modalHeading}>
              <Text style={[styles.modalTitle, { color: palette.textPrimary }]}>
                {kind === 'home' ? 'Save Home' : 'Save a Gym'}
              </Text>
              <Pressable
                onPress={() => setKind(null)}
                accessibilityRole="button"
                accessibilityLabel="Close place editor"
              >
                <IconSymbol name="xmark" size={20} color={palette.textPrimary} />
              </Pressable>
            </View>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder={kind === 'home' ? 'Home' : 'Gym name'}
              placeholderTextColor={palette.textTertiary}
              accessibilityLabel="Place name"
              style={[
                styles.input,
                {
                  color: palette.textPrimary,
                  borderColor: palette.border,
                  backgroundColor: palette.surface,
                },
              ]}
            />
            <View style={styles.radiusRow}>
              <View style={styles.flex}>
                <Text style={[styles.inputLabel, { color: palette.textSecondary }]}>
                  Match radius in metres
                </Text>
                <TextInput
                  value={radius}
                  onChangeText={setRadius}
                  keyboardType="number-pad"
                  accessibilityLabel="Place match radius in metres"
                  style={[
                    styles.input,
                    {
                      color: palette.textPrimary,
                      borderColor: palette.border,
                      backgroundColor: palette.surface,
                    },
                  ]}
                />
              </View>
            </View>
            <Pressable
              onPress={() => void capture()}
              disabled={isCapturing}
              accessibilityRole="button"
              accessibilityLabel="Use current foreground location"
              style={[
                styles.captureButton,
                {
                  backgroundColor: coordinates
                    ? palette.successMuted
                    : palette.primaryMuted,
                  borderColor: coordinates ? palette.success : palette.primaryBorder,
                },
              ]}
            >
              {isCapturing ? (
                <ActivityIndicator size="small" color={palette.primary} />
              ) : (
                <IconSymbol
                  name={coordinates ? 'checkmark.circle.fill' : 'target'}
                  size={20}
                  color={coordinates ? palette.success : palette.primary}
                />
              )}
              <Text style={[styles.captureText, { color: palette.textPrimary }]}>
                {coordinates ? 'Current location captured' : 'Use current location'}
              </Text>
            </Pressable>
            <Text style={[styles.privacyText, { color: palette.textTertiary }]}>
              Exact coordinates are encrypted by the backend. Workouts keep only a
              generic Home or Gym label.
            </Text>
            <Pressable
              onPress={() => void save()}
              disabled={isSaving}
              accessibilityRole="button"
              accessibilityLabel="Save training place"
              style={[
                styles.primaryButton,
                { backgroundColor: palette.primary, opacity: isSaving ? 0.6 : 1 },
              ]}
            >
              {isSaving ? (
                <ActivityIndicator color={palette.white} />
              ) : (
                <Text style={[styles.primaryText, { color: palette.white }]}>
                  Save place
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  )

  function AddPlaceButton({
    label,
    icon,
    onPress,
  }: {
    label: string
    icon: React.ComponentProps<typeof IconSymbol>['name']
    onPress: () => void
  }) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={({ pressed }) => [
          styles.addButton,
          {
            backgroundColor: palette.surfaceAlt,
            borderColor: palette.border,
            opacity: pressed ? 0.75 : 1,
          },
        ]}
      >
        <IconSymbol name={icon} size={19} color={palette.primary} />
        <Text style={[styles.addText, { color: palette.textPrimary }]}>{label}</Text>
      </Pressable>
    )
  }
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  noticeText: { ...typography.small, flex: 1 },
  placeRow: {
    minHeight: 66,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  placeIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeName: { ...typography.bodyStrong },
  placeMeta: { ...typography.small, marginTop: spacing.xs },
  actions: { flexDirection: 'row', gap: spacing.md },
  addButton: {
    flex: 1,
    minHeight: 48,
    borderWidth: 1,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  addText: { ...typography.smallStrong },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xl,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  modalCard: {
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: spacing.xl,
    gap: spacing.lg,
  },
  modalHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTitle: { ...typography.h3 },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    ...typography.body,
  },
  radiusRow: { flexDirection: 'row' },
  inputLabel: { ...typography.smallStrong, marginBottom: spacing.sm },
  captureButton: {
    minHeight: 52,
    borderWidth: 1,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  captureText: { ...typography.bodyStrong },
  privacyText: { ...typography.small },
  primaryButton: {
    minHeight: 50,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { ...typography.button },
})
