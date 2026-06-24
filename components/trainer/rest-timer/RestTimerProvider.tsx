import { setAudioModeAsync, useAudioPlayer } from 'expo-audio'
import * as Haptics from 'expo-haptics'
import * as Notifications from 'expo-notifications'
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { AppState, Platform } from 'react-native'

const CHIME = require('../../../assets/sounds/rest-done.wav')
const ANDROID_CHANNEL_ID = 'rest-timer'
const FINISHED_AUTODISMISS_MS = 5000
const CHECK_INTERVAL_MS = 500

// Foreground cue is handled in-app (haptic + chime), so suppress the OS banner
// and sound while the app is active and let it fire only on the lock screen.
if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => {
      const backgrounded = AppState.currentState !== 'active'
      return {
        shouldPlaySound: backgrounded,
        shouldSetBadge: false,
        shouldShowBanner: backgrounded,
        shouldShowList: backgrounded,
      }
    },
  })
}

export type RestTimerStatus = 'idle' | 'running' | 'finished'
export type RestTimerMode = 'full' | 'mini'

type RestTimerContextValue = {
  status: RestTimerStatus
  mode: RestTimerMode
  exerciseName: string | null
  totalSec: number
  endsAt: number | null
  start: (durationSec: number, exerciseName: string, sourceKey?: string) => void
  addTime: (deltaSec: number) => void
  skip: () => void
  minimize: () => void
  expand: () => void
  cancelFor: (sourceKey: string) => void
}

const RestTimerContext = createContext<RestTimerContextValue | null>(null)

export function useRestTimer(): RestTimerContextValue {
  const ctx = useContext(RestTimerContext)
  if (!ctx) {
    throw new Error('useRestTimer must be used within a RestTimerProvider')
  }
  return ctx
}

export function RestTimerProvider({ children }: { children: React.ReactNode }) {
  const player = useAudioPlayer(CHIME)

  const [status, setStatus] = useState<RestTimerStatus>('idle')
  const [mode, setMode] = useState<RestTimerMode>('full')
  const [exerciseName, setExerciseName] = useState<string | null>(null)
  const [totalSec, setTotalSec] = useState(0)
  const [endsAt, setEndsAt] = useState<number | null>(null)

  // Refs mirror the timing state so interval/AppState closures always read the
  // latest values without re-subscribing.
  const statusRef = useRef<RestTimerStatus>('idle')
  const endsAtRef = useRef<number | null>(null)
  const totalSecRef = useRef(0)
  const sourceKeyRef = useRef<string | null>(null)
  const notificationIdRef = useRef<string | null>(null)
  const checkIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const finishTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const setStatusBoth = useCallback((next: RestTimerStatus) => {
    statusRef.current = next
    setStatus(next)
  }, [])

  const setEndsBoth = useCallback((next: number | null) => {
    endsAtRef.current = next
    setEndsAt(next)
  }, [])

  const setTotalBoth = useCallback((next: number) => {
    totalSecRef.current = next
    setTotalSec(next)
  }, [])

  const clearCheckInterval = useCallback(() => {
    if (checkIntervalRef.current) {
      clearInterval(checkIntervalRef.current)
      checkIntervalRef.current = null
    }
  }, [])

  const clearFinishTimeout = useCallback(() => {
    if (finishTimeoutRef.current) {
      clearTimeout(finishTimeoutRef.current)
      finishTimeoutRef.current = null
    }
  }, [])

  const cancelNotification = useCallback(() => {
    const id = notificationIdRef.current
    notificationIdRef.current = null
    if (id && Platform.OS !== 'web') {
      void Notifications.cancelScheduledNotificationAsync(id).catch(() => {})
    }
  }, [])

  const scheduleEndNotification = useCallback(
    (seconds: number, name: string | null) => {
      if (Platform.OS === 'web') return
      void Notifications.scheduleNotificationAsync({
        content: {
          title: 'Rest complete',
          body: name ? `Time for your next set of ${name}.` : 'Time for your next set.',
          sound: 'rest-done.wav',
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: Math.max(1, Math.round(seconds)),
          channelId: ANDROID_CHANNEL_ID,
        },
      })
        .then((id) => {
          notificationIdRef.current = id
        })
        .catch(() => {})
    },
    [],
  )

  const playChime = useCallback(() => {
    if (Platform.OS === 'web') return
    try {
      player.seekTo(0)
      player.play()
    } catch {
      // Audio is best-effort; haptics still fire.
    }
  }, [player])

  const reset = useCallback(() => {
    clearCheckInterval()
    clearFinishTimeout()
    cancelNotification()
    sourceKeyRef.current = null
    setEndsBoth(null)
    setTotalBoth(0)
    setExerciseName(null)
    setStatusBoth('idle')
  }, [
    clearCheckInterval,
    clearFinishTimeout,
    cancelNotification,
    setEndsBoth,
    setTotalBoth,
    setStatusBoth,
  ])

  const finish = useCallback(
    (cueInApp: boolean) => {
      clearCheckInterval()
      cancelNotification()
      sourceKeyRef.current = null
      setEndsBoth(null)
      setStatusBoth('finished')
      if (cueInApp) {
        void Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        ).catch(() => {})
        playChime()
      }
      clearFinishTimeout()
      finishTimeoutRef.current = setTimeout(reset, FINISHED_AUTODISMISS_MS)
    },
    [
      clearCheckInterval,
      cancelNotification,
      setEndsBoth,
      setStatusBoth,
      playChime,
      clearFinishTimeout,
      reset,
    ],
  )

  const startCheckInterval = useCallback(() => {
    clearCheckInterval()
    checkIntervalRef.current = setInterval(() => {
      const end = endsAtRef.current
      if (statusRef.current !== 'running' || end == null) return
      if (Date.now() >= end) {
        finish(true)
      }
    }, CHECK_INTERVAL_MS)
  }, [clearCheckInterval, finish])

  const start = useCallback(
    (durationSec: number, name: string, sourceKey?: string) => {
      const total = Math.max(1, Math.round(durationSec))
      const end = Date.now() + total * 1000
      sourceKeyRef.current = sourceKey ?? null
      clearFinishTimeout()
      cancelNotification()
      setTotalBoth(total)
      setEndsBoth(end)
      setExerciseName(name)
      setMode('full')
      setStatusBoth('running')
      void Haptics.selectionAsync().catch(() => {})
      scheduleEndNotification(total, name)
      startCheckInterval()
    },
    [
      clearFinishTimeout,
      cancelNotification,
      setTotalBoth,
      setEndsBoth,
      setStatusBoth,
      scheduleEndNotification,
      startCheckInterval,
    ],
  )

  const addTime = useCallback(
    (deltaSec: number) => {
      if (statusRef.current !== 'running' || endsAtRef.current == null) return
      const minEnd = Date.now() + 1000
      let newEnd = endsAtRef.current + deltaSec * 1000
      if (newEnd < minEnd) newEnd = minEnd
      const newRemainingSec = Math.ceil((newEnd - Date.now()) / 1000)
      const newTotal = Math.max(1, totalSecRef.current + deltaSec, newRemainingSec)
      setEndsBoth(newEnd)
      setTotalBoth(newTotal)
      cancelNotification()
      scheduleEndNotification(newRemainingSec, exerciseName)
      startCheckInterval()
      void Haptics.selectionAsync().catch(() => {})
    },
    [
      setEndsBoth,
      setTotalBoth,
      cancelNotification,
      scheduleEndNotification,
      startCheckInterval,
      exerciseName,
    ],
  )

  const skip = useCallback(() => {
    void Haptics.selectionAsync().catch(() => {})
    reset()
  }, [reset])

  const minimize = useCallback(() => setMode('mini'), [])
  const expand = useCallback(() => setMode('full'), [])

  const cancelFor = useCallback(
    (sourceKey: string) => {
      if (statusRef.current === 'idle') return
      if (sourceKeyRef.current && sourceKeyRef.current === sourceKey) {
        reset()
      }
    },
    [reset],
  )

  // One-time native setup: audio plays in silent mode, ask for notification
  // permission, and create the Android channel that carries the chime.
  useEffect(() => {
    if (Platform.OS === 'web') return
    void setAudioModeAsync({ playsInSilentMode: true }).catch(() => {})
    void Notifications.requestPermissionsAsync().catch(() => {})
    if (Platform.OS === 'android') {
      void Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
        name: 'Rest timer',
        importance: Notifications.AndroidImportance.HIGH,
        sound: 'rest-done.wav',
        vibrationPattern: [0, 220, 120, 220],
      }).catch(() => {})
    }
  }, [])

  // Re-sync when returning to the foreground: the background timer may have
  // already elapsed (OS notification handled the cue), so finish silently;
  // otherwise restart the foreground checker.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return
      if (statusRef.current !== 'running' || endsAtRef.current == null) return
      if (Date.now() >= endsAtRef.current) {
        finish(false)
      } else {
        startCheckInterval()
      }
    })
    return () => sub.remove()
  }, [finish, startCheckInterval])

  useEffect(() => {
    return () => {
      clearCheckInterval()
      clearFinishTimeout()
      cancelNotification()
    }
  }, [clearCheckInterval, clearFinishTimeout, cancelNotification])

  const value = useMemo<RestTimerContextValue>(
    () => ({
      status,
      mode,
      exerciseName,
      totalSec,
      endsAt,
      start,
      addTime,
      skip,
      minimize,
      expand,
      cancelFor,
    }),
    [
      status,
      mode,
      exerciseName,
      totalSec,
      endsAt,
      start,
      addTime,
      skip,
      minimize,
      expand,
      cancelFor,
    ],
  )

  return (
    <RestTimerContext.Provider value={value}>
      {children}
    </RestTimerContext.Provider>
  )
}
