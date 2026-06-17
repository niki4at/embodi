import { useAction, useMutation, useQuery } from 'convex/react'
import * as Haptics from 'expo-haptics'
import React, { useEffect, useRef, useState } from 'react'
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
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { IconSymbol } from '@/components/ui/icon-symbol'
import { radius, spacing, typography } from '@/constants/design'
import { useTheme } from '@/constants/theme-context'
import { api } from '@/convex/_generated/api'

type ExerciseCoachChatProps = {
  visible: boolean
  onClose: () => void
  catalogId: string
  exerciseName: string
}

const SUGGESTIONS = [
  'How much should I lift today?',
  'Am I progressing well?',
  'How do I make this harder?',
]

export function ExerciseCoachChat({
  visible,
  onClose,
  catalogId,
  exerciseName,
}: ExerciseCoachChatProps) {
  const { palette, resolved } = useTheme()
  const insets = useSafeAreaInsets()

  const messages = useQuery(
    api.coachChat.getMessages,
    visible ? { catalogId } : 'skip'
  )
  const sendMessage = useAction(api.coachChat.sendCoachMessage)
  const clearThread = useMutation(api.coachChat.clearThread)

  const [input, setInput] = useState('')
  const [isSending, setIsSending] = useState(false)
  const scrollRef = useRef<ScrollView>(null)

  useEffect(() => {
    if (messages && messages.length > 0) {
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }))
    }
  }, [messages, isSending])

  const handleSend = async (text?: string) => {
    const value = (text ?? input).trim()
    if (value.length === 0 || isSending) return
    setInput('')
    setIsSending(true)
    Haptics.selectionAsync().catch(() => {})
    try {
      await sendMessage({ catalogId, exerciseName, text: value })
    } catch (error) {
      console.error('send coach message', error)
    } finally {
      setIsSending(false)
    }
  }

  const handleClear = async () => {
    Haptics.selectionAsync().catch(() => {})
    try {
      await clearThread({ catalogId })
    } catch (error) {
      console.error('clear coach thread', error)
    }
  }

  const isEmpty = !messages || messages.length === 0

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.root, { backgroundColor: palette.bg }]}>
        <View
          style={[
            styles.header,
            {
              paddingTop: insets.top + spacing.sm,
              borderBottomColor: palette.divider,
            },
          ]}
        >
          <View style={styles.headerText}>
            <Text style={[styles.headerTitle, { color: palette.textPrimary }]}>
              Coach
            </Text>
            <Text
              style={[styles.headerSub, { color: palette.textSecondary }]}
              numberOfLines={1}
            >
              {exerciseName}
            </Text>
          </View>
          {!isEmpty ? (
            <Pressable
              onPress={handleClear}
              hitSlop={8}
              style={styles.headerAction}
              accessibilityLabel="Clear conversation"
            >
              <IconSymbol name="trash" size={18} color={palette.textTertiary} />
            </Pressable>
          ) : null}
          <Pressable
            onPress={onClose}
            hitSlop={8}
            style={[
              styles.headerAction,
              { backgroundColor: palette.surface, borderColor: palette.border },
            ]}
            accessibilityLabel="Close chat"
          >
            <IconSymbol
              name="xmark"
              size={18}
              color={resolved === 'dark' ? palette.white : palette.textPrimary}
            />
          </Pressable>
        </View>

        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={insets.top + 8}
        >
          <ScrollView
            ref={scrollRef}
            style={styles.flex}
            contentContainerStyle={styles.messages}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {isEmpty ? (
              <View style={styles.intro}>
                <View
                  style={[
                    styles.introIcon,
                    { backgroundColor: palette.primaryMuted },
                  ]}
                >
                  <IconSymbol name="sparkles" size={26} color={palette.primary} />
                </View>
                <Text style={[styles.introTitle, { color: palette.textPrimary }]}>
                  Ask me about {exerciseName}
                </Text>
                <Text
                  style={[styles.introSub, { color: palette.textSecondary }]}
                >
                  I know your records, today&apos;s check-in, and your goals. Ask
                  how to load it, whether you&apos;re progressing, or how to
                  tweak your form.
                </Text>
                <View style={styles.suggestions}>
                  {SUGGESTIONS.map((s) => (
                    <Pressable
                      key={s}
                      onPress={() => handleSend(s)}
                      style={[
                        styles.suggestion,
                        {
                          backgroundColor: palette.surface,
                          borderColor: palette.border,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.suggestionText,
                          { color: palette.textPrimary },
                        ]}
                      >
                        {s}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : (
              messages.map((m) => (
                <View
                  key={m._id}
                  style={[
                    styles.bubble,
                    m.role === 'user'
                      ? [styles.bubbleUser, { backgroundColor: palette.primary }]
                      : [
                          styles.bubbleCoach,
                          {
                            backgroundColor: palette.surface,
                            borderColor: palette.border,
                          },
                        ],
                  ]}
                >
                  <Text
                    style={[
                      styles.bubbleText,
                      {
                        color:
                          m.role === 'user' ? palette.white : palette.textPrimary,
                      },
                    ]}
                  >
                    {m.content}
                  </Text>
                </View>
              ))
            )}

            {isSending ? (
              <View
                style={[
                  styles.bubble,
                  styles.bubbleCoach,
                  { backgroundColor: palette.surface, borderColor: palette.border },
                ]}
              >
                <ActivityIndicator size="small" color={palette.textTertiary} />
              </View>
            ) : null}
          </ScrollView>

          <View
            style={[
              styles.inputBar,
              {
                backgroundColor: palette.bgElevated,
                borderTopColor: palette.divider,
                paddingBottom: insets.bottom + spacing.sm,
              },
            ]}
          >
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: palette.surface,
                  borderColor: palette.borderStrong,
                  color: palette.textPrimary,
                },
              ]}
              value={input}
              onChangeText={setInput}
              placeholder="Message coach…"
              placeholderTextColor={palette.textTertiary}
              multiline
              returnKeyType="send"
              onSubmitEditing={() => handleSend()}
            />
            <Pressable
              onPress={() => handleSend()}
              disabled={input.trim().length === 0 || isSending}
              style={[
                styles.sendButton,
                {
                  backgroundColor:
                    input.trim().length === 0 || isSending
                      ? palette.surfaceHigh
                      : palette.primary,
                },
              ]}
              accessibilityLabel="Send message"
            >
              <IconSymbol
                name="arrow.up.right"
                size={18}
                color={
                  input.trim().length === 0 || isSending
                    ? palette.textTertiary
                    : palette.white
                }
              />
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    ...typography.h3,
  },
  headerSub: {
    ...typography.small,
    marginTop: 1,
  },
  headerAction: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  messages: {
    padding: spacing.xl,
    gap: spacing.md,
  },
  intro: {
    alignItems: 'center',
    paddingTop: spacing.xxl,
    gap: spacing.sm,
  },
  introIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  introTitle: {
    ...typography.h2,
    textAlign: 'center',
  },
  introSub: {
    ...typography.body,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
  },
  suggestions: {
    marginTop: spacing.lg,
    gap: spacing.sm,
    alignSelf: 'stretch',
  },
  suggestion: {
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
  },
  suggestionText: {
    ...typography.bodyStrong,
  },
  bubble: {
    maxWidth: '86%',
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  bubbleUser: {
    alignSelf: 'flex-end',
    borderBottomRightRadius: radius.xs,
  },
  bubbleCoach: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderBottomLeftRadius: radius.xs,
  },
  bubbleText: {
    ...typography.body,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1,
    maxHeight: 120,
    minHeight: 44,
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingTop: 12,
    paddingBottom: 12,
    ...typography.body,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
