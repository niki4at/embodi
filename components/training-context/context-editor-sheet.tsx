import * as Haptics from 'expo-haptics'
import React, { useEffect, useState } from 'react'
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import Animated, {
  Easing,
  SlideInDown,
  SlideOutDown,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { IconSymbol } from '@/components/ui/icon-symbol'
import { radius, spacing, typography } from '@/constants/design'
import { useTheme } from '@/constants/theme-context'

import {
  CONTEXT_TAG_LABELS,
  CONTEXT_TAGS,
  EQUIPMENT_INTENT_LABELS,
  EQUIPMENT_INTENTS,
  TRAINING_ENVIRONMENT_LABELS,
  TRAINING_ENVIRONMENTS,
  type EquipmentIntent,
  type TrainingContextSelection,
  type TrainingContextTag,
  type TrainingEnvironment,
} from './types'

type ContextEditorSheetProps = {
  visible: boolean
  value: TrainingContextSelection
  onSave: (value: TrainingContextSelection) => void
  onClose: () => void
  showTrainingSetupLink?: boolean
  onOpenTrainingSetup?: () => void
}

const GYM_EQUIPMENT_OPTIONS = [
  { catalogKey: 'barbell', label: 'Barbell' },
  { catalogKey: 'dumbbell', label: 'Dumbbells' },
  { catalogKey: 'cable', label: 'Cable machine' },
  { catalogKey: 'machine', label: 'Weight machines' },
  { catalogKey: 'bench', label: 'Bench' },
  { catalogKey: 'squat rack', label: 'Squat rack' },
  { catalogKey: 'treadmill', label: 'Treadmill' },
  { catalogKey: 'rower', label: 'Rower' },
  { catalogKey: 'stationary bike', label: 'Stationary bike' },
  { catalogKey: 'kettlebell', label: 'Kettlebells' },
] as const

export function ContextEditorSheet({
  visible,
  value,
  onSave,
  onClose,
  showTrainingSetupLink = false,
  onOpenTrainingSetup,
}: ContextEditorSheetProps) {
  const { palette, shadows } = useTheme()
  const insets = useSafeAreaInsets()
  const [draft, setDraft] = useState(value)

  useEffect(() => {
    if (visible) setDraft(value)
  }, [value, visible])

  const chooseEnvironment = (trainingEnvironment: TrainingEnvironment) => {
    void Haptics.selectionAsync()
    setDraft((current) => ({
      ...current,
      trainingEnvironment,
      suggestionSource: 'manual',
      suggestionReason: 'Changed for this session.',
    }))
  }

  const chooseIntent = (equipmentIntent: EquipmentIntent) => {
    void Haptics.selectionAsync()
    setDraft((current) => ({
      ...current,
      equipmentIntent,
      suggestionSource: 'manual',
      suggestionReason: 'Changed for this session.',
    }))
  }

  const toggleTag = (tag: TrainingContextTag) => {
    void Haptics.selectionAsync()
    setDraft((current) => ({
      ...current,
      contextTags: current.contextTags.includes(tag)
        ? current.contextTags.filter((item) => item !== tag)
        : [...current.contextTags, tag],
      suggestionSource: 'manual',
      suggestionReason: 'Changed for this session.',
    }))
  }

  const toggleUnavailable = (catalogKey: string) => {
    void Haptics.selectionAsync()
    setDraft((current) => ({
      ...current,
      unavailableEquipment: current.unavailableEquipment.includes(catalogKey)
        ? current.unavailableEquipment.filter((item) => item !== catalogKey)
        : [...current.unavailableEquipment, catalogKey],
      suggestionSource: 'manual',
      suggestionReason: 'Changed for this session.',
    }))
  }

  const save = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onSave(draft)
  }
  const unavailableOptions =
    draft.trainingEnvironment === 'gym'
      ? GYM_EQUIPMENT_OPTIONS
      : draft.equipmentSnapshot

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      accessibilityViewIsModal
    >
      <View style={styles.overlay}>
        <Pressable
          style={styles.backdrop}
          onPress={onClose}
          accessibilityLabel="Close training context editor"
        />
        <Animated.View
          entering={SlideInDown.duration(280).easing(
            Easing.bezier(0.22, 1, 0.36, 1),
          )}
          exiting={SlideOutDown.duration(220).easing(
            Easing.bezier(0.4, 0, 1, 1),
          )}
          style={[
            styles.panel,
            shadows.lg,
            {
              backgroundColor: palette.bgElevated,
              borderColor: palette.border,
              paddingBottom: Math.max(insets.bottom, spacing.lg),
            },
          ]}
        >
          <View
            style={[styles.handle, { backgroundColor: palette.borderStrong }]}
          />
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={[styles.title, { color: palette.textPrimary }]}>
                Train where you are
              </Text>
              <Text style={[styles.subtitle, { color: palette.textSecondary }]}>
                Place and equipment stay separate, so any combination works.
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={[
                styles.closeButton,
                {
                  backgroundColor: palette.surface,
                  borderColor: palette.border,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <IconSymbol name="xmark" size={16} color={palette.textPrimary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <OptionGroup title="Place">
              {TRAINING_ENVIRONMENTS.map((environment) => (
                <ChoiceChip
                  key={environment}
                  label={TRAINING_ENVIRONMENT_LABELS[environment]}
                  selected={draft.trainingEnvironment === environment}
                  onPress={() => chooseEnvironment(environment)}
                />
              ))}
            </OptionGroup>

            <OptionGroup title="Equipment for this session">
              {EQUIPMENT_INTENTS.map((intent) => (
                <ChoiceChip
                  key={intent}
                  label={EQUIPMENT_INTENT_LABELS[intent]}
                  selected={draft.equipmentIntent === intent}
                  onPress={() => chooseIntent(intent)}
                />
              ))}
            </OptionGroup>

            <OptionGroup title="Today’s constraints" optional>
              {CONTEXT_TAGS.map((tag) => (
                <ChoiceChip
                  key={tag}
                  label={CONTEXT_TAG_LABELS[tag]}
                  selected={draft.contextTags.includes(tag)}
                  onPress={() => toggleTag(tag)}
                />
              ))}
            </OptionGroup>

            {draft.equipmentIntent === 'available' &&
            unavailableOptions.length > 0 ? (
              <OptionGroup title="Unavailable today" optional>
                {unavailableOptions.map((equipment) => (
                  <ChoiceChip
                    key={equipment.catalogKey}
                    label={equipment.label}
                    selected={draft.unavailableEquipment.includes(
                      equipment.catalogKey,
                    )}
                    onPress={() => toggleUnavailable(equipment.catalogKey)}
                    selectedMeansUnavailable
                  />
                ))}
              </OptionGroup>
            ) : null}

            {showTrainingSetupLink && onOpenTrainingSetup ? (
              <TouchableOpacity
                onPress={onOpenTrainingSetup}
                accessibilityRole="link"
                accessibilityLabel="Add equipment in training setup"
                style={styles.setupLink}
              >
                <IconSymbol name="plus" size={15} color={palette.primary} />
                <Text style={[styles.setupLinkText, { color: palette.primary }]}>
                  Add equipment in Training setup
                </Text>
              </TouchableOpacity>
            ) : null}
          </ScrollView>

          <TouchableOpacity
            onPress={save}
            accessibilityRole="button"
            accessibilityLabel="Use this training context"
            style={[styles.saveButton, { backgroundColor: palette.primary }]}
          >
            <Text style={[styles.saveText, { color: palette.white }]}>
              Use this context
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  )
}

function OptionGroup({
  title,
  optional = false,
  children,
}: {
  title: string
  optional?: boolean
  children: React.ReactNode
}) {
  const { palette } = useTheme()

  return (
    <View style={styles.group}>
      <View style={styles.groupTitleRow}>
        <Text style={[styles.groupTitle, { color: palette.textPrimary }]}>
          {title}
        </Text>
        {optional ? (
          <Text style={[styles.optional, { color: palette.textTertiary }]}>
            Optional
          </Text>
        ) : null}
      </View>
      <View style={styles.options}>{children}</View>
    </View>
  )
}

function ChoiceChip({
  label,
  selected,
  onPress,
  selectedMeansUnavailable = false,
}: {
  label: string
  selected: boolean
  onPress: () => void
  selectedMeansUnavailable?: boolean
}) {
  const { palette } = useTheme()
  const selectedColor = selectedMeansUnavailable ? palette.danger : palette.primary
  const selectedBackground = selectedMeansUnavailable
    ? palette.dangerMuted
    : palette.primaryMuted

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${label}${selectedMeansUnavailable ? ' unavailable' : ''}`}
      style={[
        styles.choice,
        {
          backgroundColor: selected ? selectedBackground : palette.surface,
          borderColor: selected ? selectedColor : palette.border,
        },
      ]}
    >
      {selected ? (
        <IconSymbol
          name={selectedMeansUnavailable ? 'xmark' : 'checkmark'}
          size={13}
          color={selectedColor}
        />
      ) : null}
      <Text
        style={[
          styles.choiceText,
          { color: selected ? selectedColor : palette.textPrimary },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  panel: {
    maxHeight: '90%',
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    borderTopWidth: 1,
    paddingTop: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  handle: {
    alignSelf: 'center',
    width: 44,
    height: 4,
    borderRadius: radius.pill,
    marginBottom: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  headerCopy: {
    flex: 1,
  },
  title: {
    ...typography.h2,
  },
  subtitle: {
    ...typography.small,
    marginTop: spacing.xs,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    flexGrow: 0,
  },
  scrollContent: {
    paddingBottom: spacing.lg,
  },
  group: {
    marginBottom: spacing.xl,
  },
  groupTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  groupTitle: {
    ...typography.bodyStrong,
  },
  optional: {
    ...typography.caption,
  },
  options: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  choice: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  choiceText: {
    ...typography.smallStrong,
  },
  setupLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  setupLinkText: {
    ...typography.smallStrong,
  },
  saveButton: {
    height: 54,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveText: {
    ...typography.button,
  },
})
