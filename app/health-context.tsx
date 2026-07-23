import { useMutation, useQuery } from 'convex/react'
import * as Haptics from 'expo-haptics'
import { router } from 'expo-router'
import React, { useState } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { confirmAction } from '@/components/settings/settings-row'
import { IconSymbol } from '@/components/ui/icon-symbol'
import { radius, spacing, typography } from '@/constants/design'
import { useTheme } from '@/constants/theme-context'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'

type AnswerValue = string | number | string[]

interface EditState {
  title: string
  initial: string
  multiline?: boolean
  onSave: (text: string) => void
}

function formatAnswer(answer: AnswerValue): string {
  if (Array.isArray(answer)) return answer.join(', ')
  return String(answer)
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

const CATEGORY_LABELS: Record<string, string> = {
  goals: 'Goals',
  lifestyle: 'Lifestyle',
  training: 'Training',
  recovery: 'Recovery',
  nutrition: 'Nutrition',
  health: 'Health',
}

export default function HealthContextScreen() {
  const { palette } = useTheme()
  const context = useQuery(api.healthContext.getHealthContext)
  const updateHealthProfile = useMutation(api.healthContext.updateHealthProfile)
  const updateAnswer = useMutation(api.healthContext.updateAnswer)
  const deleteAnswer = useMutation(api.healthContext.deleteAnswer)

  const [edit, setEdit] = useState<EditState | null>(null)
  const [draft, setDraft] = useState('')

  const openEditor = (state: EditState) => {
    void Haptics.selectionAsync()
    setDraft(state.initial)
    setEdit(state)
  }

  const saveEditor = () => {
    if (!edit) return
    edit.onSave(draft.trim())
    setEdit(null)
  }

  const editListField = (
    field: 'injuries' | 'conditions',
    title: string,
    current: string[],
  ) => {
    openEditor({
      title,
      initial: current.join(', '),
      onSave: (text) => {
        const values = text
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean)
        updateHealthProfile({ [field]: values }).catch(() => {})
      },
    })
  }

  const editAnswer = (
    answerId: Id<'profile_answers'>,
    answerType: 'slider' | 'single' | 'multi' | 'text',
    questionText: string,
    current: AnswerValue,
  ) => {
    openEditor({
      title: questionText,
      initial: formatAnswer(current),
      multiline: answerType === 'text',
      onSave: (text) => {
        let value: AnswerValue = text
        if (answerType === 'multi') {
          value = text
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean)
        } else if (answerType === 'slider') {
          const parsed = Number(text)
          if (Number.isNaN(parsed)) return
          value = parsed
        }
        updateAnswer({ answerId, answer: value }).catch(() => {})
      },
    })
  }

  const removeAnswer = (answerId: Id<'profile_answers'>, question: string) => {
    confirmAction({
      title: 'Remove this?',
      message: `Your coach will stop using "${question}" when building sessions.`,
      confirmText: 'Remove',
      confirmStyle: 'destructive',
      onConfirm: () => {
        deleteAnswer({ answerId }).catch(() => {})
      },
    })
  }

  const answersByCategory = new Map<string, NonNullable<typeof context>['answers']>()
  if (context) {
    for (const answer of context.answers) {
      const list = answersByCategory.get(answer.category) ?? []
      list.push(answer)
      answersByCategory.set(answer.category, list)
    }
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
          <IconSymbol name="arrow.left" size={22} color={palette.textPrimary} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: palette.textPrimary }]}>
          Health & coaching
        </Text>
        <View style={{ width: 22 }} />
      </View>

      {context === undefined ? (
        <View style={styles.loading}>
          <ActivityIndicator size="small" color={palette.primary} />
        </View>
      ) : context === null ? (
        <View style={styles.loading}>
          <Text style={[typography.body, { color: palette.textSecondary }]}>
            Sign in to see your health context.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <View
            style={[
              styles.privacyNote,
              { backgroundColor: palette.surfaceAlt },
            ]}
          >
            <IconSymbol name="lock.fill" size={14} color={palette.textSecondary} />
            <Text
              style={[typography.small, styles.privacyText, { color: palette.textSecondary }]}
            >
              Everything here is private. It shapes your sessions and is never
              shown on your profile.
            </Text>
          </View>

          <Text style={[styles.sectionLabel, { color: palette.textTertiary }]}>
            YOUR HEALTH PROFILE
          </Text>
          {context.health ? (
            <View
              style={[
                styles.card,
                { backgroundColor: palette.surface, borderColor: palette.border },
              ]}
            >
              <FieldRow
                label="Goal"
                value={context.health.goal}
                onEdit={() =>
                  openEditor({
                    title: 'Goal',
                    initial: context.health?.goal ?? '',
                    onSave: (text) => {
                      if (!text) return
                      updateHealthProfile({ goal: text }).catch(() => {})
                    },
                  })
                }
              />
              <FieldRow
                label="Injuries"
                value={
                  context.health.injuries.length > 0
                    ? context.health.injuries.join(', ')
                    : 'None listed'
                }
                onEdit={() =>
                  editListField(
                    'injuries',
                    'Injuries (comma separated)',
                    context.health?.injuries ?? [],
                  )
                }
              />
              <FieldRow
                label="Conditions"
                value={
                  context.health.conditions.length > 0
                    ? context.health.conditions.join(', ')
                    : 'None listed'
                }
                onEdit={() =>
                  editListField(
                    'conditions',
                    'Conditions (comma separated)',
                    context.health?.conditions ?? [],
                  )
                }
              />
              <FieldRow
                label="Medications"
                value={context.health.medications || 'None listed'}
                onEdit={() =>
                  openEditor({
                    title: 'Medications',
                    initial: context.health?.medications ?? '',
                    onSave: (text) => {
                      updateHealthProfile({ medications: text }).catch(() => {})
                    },
                  })
                }
              />
              <FieldRow
                label="Activity level"
                value={context.health.activityLevel ?? 'Not set'}
              />
              <FieldRow
                label="Completed"
                value={formatDate(context.health.completedAt)}
                last
              />
            </View>
          ) : (
            <Text style={[typography.small, { color: palette.textSecondary }]}>
              Complete onboarding to build your health profile.
            </Text>
          )}

          <Text style={[styles.sectionLabel, { color: palette.textTertiary }]}>
            WHAT YOUR COACH KNOWS
          </Text>
          {context.coachSummary ? (
            <View
              style={[
                styles.card,
                { backgroundColor: palette.surface, borderColor: palette.border },
              ]}
            >
              <Text style={[typography.small, { color: palette.textSecondary }]}>
                Coach summary · updated {formatDate(context.coachSummary.updatedAt)}
              </Text>
              <Text
                style={[typography.body, styles.summaryText, { color: palette.textPrimary }]}
              >
                {context.coachSummary.text}
              </Text>
            </View>
          ) : null}

          {context.answers.length === 0 && !context.coachSummary ? (
            <Text style={[typography.small, { color: palette.textSecondary }]}>
              Chat with your coach or answer profile questions and what it
              learns will show up here.
            </Text>
          ) : null}

          {[...answersByCategory.entries()].map(([category, answers]) => (
            <View key={category} style={styles.categoryBlock}>
              <Text
                style={[typography.smallStrong, { color: palette.textSecondary }]}
              >
                {CATEGORY_LABELS[category] ??
                  category.charAt(0).toUpperCase() + category.slice(1)}
              </Text>
              {answers.map((answer) => (
                <View
                  key={answer._id}
                  style={[
                    styles.answerCard,
                    { backgroundColor: palette.surface, borderColor: palette.border },
                  ]}
                >
                  <View style={styles.answerText}>
                    <Text
                      style={[typography.small, { color: palette.textSecondary }]}
                    >
                      {answer.questionText}
                    </Text>
                    <Text
                      style={[typography.bodyStrong, { color: palette.textPrimary }]}
                    >
                      {formatAnswer(answer.answer)}
                    </Text>
                    <Text
                      style={[typography.caption, { color: palette.textTertiary }]}
                    >
                      From profile questions · {formatDate(answer.updatedAt)}
                    </Text>
                  </View>
                  <View style={styles.answerActions}>
                    <Pressable
                      onPress={() =>
                        editAnswer(
                          answer._id,
                          answer.answerType,
                          answer.questionText,
                          answer.answer,
                        )
                      }
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel={`Correct ${answer.questionText}`}
                    >
                      <IconSymbol
                        name="pencil"
                        size={18}
                        color={palette.textSecondary}
                      />
                    </Pressable>
                    <Pressable
                      onPress={() => removeAnswer(answer._id, answer.questionText)}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${answer.questionText}`}
                    >
                      <IconSymbol name="trash" size={18} color={palette.danger} />
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          ))}

          <Text style={[styles.sectionLabel, { color: palette.textTertiary }]}>
            CURRENT STATE
          </Text>
          <View
            style={[
              styles.card,
              { backgroundColor: palette.surface, borderColor: palette.border },
            ]}
          >
            <FieldRow
              label="Flare-up mode"
              value={
                context.flareUp.active
                  ? `Active${context.flareUp.regions.length > 0 ? ` · ${context.flareUp.regions.join(', ')}` : ''}`
                  : 'Off'
              }
            />
            <FieldRow
              label="Cycle tracking"
              value={context.cycleTrackingEnabled ? 'On' : 'Off'}
              last
            />
          </View>

          <Pressable
            onPress={() => {
              void Haptics.selectionAsync()
              router.push('/profile-questions')
            }}
            accessibilityRole="button"
            accessibilityLabel="Answer more profile questions"
            style={({ pressed }) => [
              styles.questionsButton,
              {
                backgroundColor: palette.primaryMuted,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <Text style={[typography.bodyStrong, { color: palette.primary }]}>
              Answer more profile questions
            </Text>
          </Pressable>
        </ScrollView>
      )}

      <Modal
        visible={edit !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setEdit(null)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalBackdrop}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setEdit(null)} />
          <View
            style={[
              styles.modalCard,
              { backgroundColor: palette.bgElevated, borderColor: palette.border },
            ]}
          >
            <Text style={[typography.h3, { color: palette.textPrimary }]}>
              {edit?.title}
            </Text>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              multiline={edit?.multiline}
              autoFocus
              style={[
                styles.modalInput,
                {
                  backgroundColor: palette.surfaceAlt,
                  color: palette.textPrimary,
                },
                edit?.multiline && styles.modalInputMultiline,
              ]}
              placeholderTextColor={palette.textTertiary}
            />
            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setEdit(null)}
                accessibilityRole="button"
                accessibilityLabel="Cancel"
                style={styles.modalButton}
              >
                <Text style={[typography.bodyStrong, { color: palette.textSecondary }]}>
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                onPress={saveEditor}
                accessibilityRole="button"
                accessibilityLabel="Save"
                style={[styles.modalButton, { backgroundColor: palette.primary }]}
              >
                <Text style={[typography.bodyStrong, { color: '#FFFFFF' }]}>
                  Save
                </Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  )
}

function FieldRow({
  label,
  value,
  onEdit,
  last,
}: {
  label: string
  value: string
  onEdit?: () => void
  last?: boolean
}) {
  const { palette } = useTheme()
  return (
    <View
      style={[
        styles.fieldRow,
        !last && { borderBottomWidth: 1, borderBottomColor: palette.divider },
      ]}
    >
      <View style={styles.fieldText}>
        <Text style={[typography.small, { color: palette.textTertiary }]}>
          {label}
        </Text>
        <Text style={[typography.body, { color: palette.textPrimary }]}>
          {value}
        </Text>
      </View>
      {onEdit ? (
        <Pressable
          onPress={onEdit}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`Edit ${label}`}
        >
          <IconSymbol name="pencil" size={18} color={palette.textSecondary} />
        </Pressable>
      ) : null}
    </View>
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
  content: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.huge,
  },
  privacyNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  privacyText: {
    flex: 1,
  },
  sectionLabel: {
    ...typography.caption,
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  fieldText: {
    flex: 1,
    gap: 2,
  },
  summaryText: {
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  categoryBlock: {
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  answerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
  },
  answerText: {
    flex: 1,
    gap: 2,
  },
  answerActions: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  questionsButton: {
    alignItems: 'center',
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    marginTop: spacing.xxl,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  modalCard: {
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: spacing.xl,
    gap: spacing.lg,
  },
  modalInput: {
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    ...typography.body,
  },
  modalInputMultiline: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.md,
  },
  modalButton: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
  },
})
