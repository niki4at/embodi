import Constants, { ExecutionEnvironment } from 'expo-constants'
import { Platform } from 'react-native'

// Importing `expo-notifications` runs a push-token auto-registration side effect
// that logs a fatal-looking error on Android in Expo Go (SDK 53+ removed push
// there). The rest timer only needs LOCAL notifications, which work in real
// dev/prod builds. So we load the module lazily and skip it entirely in Expo Go
// and on web, keeping those environments quiet without losing native behavior.
const isExpoGo =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient
const notificationsAvailable = Platform.OS !== 'web' && !isExpoGo

type NotificationsModule = typeof import('expo-notifications')

let cached: NotificationsModule | null = null

function getNotifications(): NotificationsModule | null {
  if (!notificationsAvailable) return null
  if (cached) return cached
  cached = require('expo-notifications') as NotificationsModule
  return cached
}

const ANDROID_CHANNEL_ID = 'rest-timer'

export function configureRestNotifications(
  isBackgrounded: () => boolean,
): void {
  const Notifications = getNotifications()
  if (!Notifications) return
  // Foreground cue is handled in-app (haptic + chime), so suppress the OS
  // banner/sound while active and let it fire only on the lock screen.
  Notifications.setNotificationHandler({
    handleNotification: async () => {
      const backgrounded = isBackgrounded()
      return {
        shouldPlaySound: backgrounded,
        shouldSetBadge: false,
        shouldShowBanner: backgrounded,
        shouldShowList: backgrounded,
      }
    },
  })
}

export async function setupRestNotifications(): Promise<void> {
  const Notifications = getNotifications()
  if (!Notifications) return
  await Notifications.requestPermissionsAsync().catch(() => {})
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
      name: 'Rest timer',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'rest-done.wav',
      vibrationPattern: [0, 220, 120, 220],
    }).catch(() => {})
  }
}

export async function scheduleRestEndNotification(
  seconds: number,
  exerciseName: string | null,
): Promise<string | null> {
  const Notifications = getNotifications()
  if (!Notifications) return null
  try {
    return await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Rest complete',
        body: exerciseName
          ? `Time for your next set of ${exerciseName}.`
          : 'Time for your next set.',
        sound: 'rest-done.wav',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: Math.max(1, Math.round(seconds)),
        channelId: ANDROID_CHANNEL_ID,
      },
    })
  } catch {
    return null
  }
}

export async function cancelRestNotification(id: string): Promise<void> {
  const Notifications = getNotifications()
  if (!Notifications) return
  await Notifications.cancelScheduledNotificationAsync(id).catch(() => {})
}
